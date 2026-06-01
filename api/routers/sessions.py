from datetime import date
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import text
from sqlalchemy.orm import Session
from typing import Dict, List, Optional

from ..auth import get_current_user
from ..database import get_db
from ..models import SessionSummary, SessionDetail, TagInsight, EventRecord, MetricsResponse, SpO2Response, EquipmentResponse, InferredEquipment, WaveformResponse, EventWindowResponse

router = APIRouter()


class SessionTimezoneUpdate(BaseModel):
    machine_tz: str


class SessionNoteUpdate(BaseModel):
    note: str | None = None


ALLOWED_SESSION_TAGS = {
    "Travel",
    "Alcohol",
    "Sick",
    "New mask",
    "Mouth tape",
    "Back sleeper",
    "Bad sleep",
    "Good sleep",
    "Camping",
}


class SessionTagsUpdate(BaseModel):
    tags: list[str]


@router.get("/", response_model=List[SessionSummary])
def list_sessions(
    page: int = Query(1, ge=1),
    per_page: int = Query(30, ge=1, le=600),
    date_from: Optional[date] = None,
    date_to: Optional[date] = None,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """List sessions with summary stats, sorted by folder_date DESC."""
    conditions = ["user_id = :uid"]
    params: Dict = {"limit": per_page, "offset": (page - 1) * per_page, "uid": current_user["id"]}

    if date_from:
        conditions.append("folder_date >= :date_from")
        params["date_from"] = date_from
    if date_to:
        conditions.append("folder_date <= :date_to")
        params["date_to"] = date_to

    where = ("WHERE " + " AND ".join(conditions)) if conditions else ""

    sql = text(f"""
        WITH night AS (
            SELECT
                folder_date,
                (array_agg(id::text ORDER BY duration_seconds DESC))[1] AS id,
                (array_agg(session_id ORDER BY duration_seconds DESC))[1] AS session_id,
                MIN(start_datetime) AS start_datetime,
                0 AS block_index,
                SUM(duration_seconds) AS duration_seconds,
                SUM(total_ahi_events) AS total_ahi_events,
                SUM(central_apnea_count) AS central_apnea_count,
                SUM(obstructive_apnea_count) AS obstructive_apnea_count,
                SUM(hypopnea_count) AS hypopnea_count,
                SUM(apnea_count) AS apnea_count,
                SUM(arousal_count) AS arousal_count,
                AVG(avg_pressure) AS avg_pressure,
                MAX(p95_pressure) AS p95_pressure,
                AVG(avg_leak) AS avg_leak,
                BOOL_OR(has_spo2) AS has_spo2,
                (array_agg(machine_tz ORDER BY duration_seconds DESC))[1] AS machine_tz,
                CASE
                    WHEN SUM(duration_seconds) > 0
                    THEN ROUND((SUM(total_ahi_events) / (SUM(duration_seconds) / 3600.0))::numeric, 2)
                    ELSE 0
                END AS ahi
            FROM sessions
            {where}
            {"AND" if where else "WHERE"} duration_seconds >= 600
            GROUP BY folder_date
        )
        SELECT id, session_id, folder_date, block_index, start_datetime, duration_seconds,
               ahi, central_apnea_count, obstructive_apnea_count, hypopnea_count,
               apnea_count, arousal_count, total_ahi_events,
               avg_pressure, p95_pressure, avg_leak, has_spo2, machine_tz
        FROM night
        ORDER BY folder_date DESC
        LIMIT :limit OFFSET :offset
    """)
    rows = db.execute(sql, params).mappings().all()
    return [SessionSummary.model_validate(dict(r)) for r in rows]


@router.get("/tag-insights", response_model=List[TagInsight])
def get_tag_insights(
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    rows = db.execute(
        text("""
            WITH night_metric AS (
                SELECT
                    user_id,
                    folder_date,
                    CASE
                        WHEN SUM(duration_seconds) > 0
                        THEN ROUND((SUM(total_ahi_events) / (SUM(duration_seconds) / 3600.0))::numeric, 2)
                        ELSE NULL
                    END AS ahi
                FROM sessions
                WHERE user_id = CAST(:uid AS uuid)
                  AND folder_date >= CURRENT_DATE - INTERVAL '90 days'
                  AND duration_seconds >= 600
                GROUP BY user_id, folder_date
            ),
            night AS (
                SELECT
                    night_metric.user_id,
                    night_metric.folder_date,
                    night_metric.ahi,
                    COALESCE((
                        SELECT s2.tags
                        FROM sessions s2
                        WHERE s2.user_id = night_metric.user_id
                          AND s2.folder_date = night_metric.folder_date
                          AND s2.duration_seconds >= 600
                          AND s2.tags IS NOT NULL
                        ORDER BY s2.duration_seconds DESC
                        LIMIT 1
                    ), ARRAY[]::text[]) AS tags
                FROM night_metric
            ),
            baseline AS (
                SELECT ROUND(AVG(ahi)::numeric, 2) AS baseline_avg_ahi
                FROM night
            ),
            tagged AS (
                SELECT
                    tag,
                    COUNT(*) AS night_count,
                    ROUND(AVG(ahi)::numeric, 2) AS avg_ahi
                FROM night
                CROSS JOIN LATERAL unnest(tags) AS tag
                GROUP BY tag
                HAVING COUNT(*) >= 2
            )
            SELECT
                tagged.tag,
                tagged.night_count,
                tagged.avg_ahi,
                baseline.baseline_avg_ahi,
                CASE
                    WHEN tagged.avg_ahi IS NULL OR baseline.baseline_avg_ahi IS NULL THEN NULL
                    ELSE ROUND((tagged.avg_ahi - baseline.baseline_avg_ahi)::numeric, 2)
                END AS delta_ahi
            FROM tagged
            CROSS JOIN baseline
            ORDER BY tagged.tag
        """),
        {"uid": current_user["id"]},
    ).mappings().all()
    return [TagInsight.model_validate(dict(r)) for r in rows]


@router.get("/{session_id}", response_model=SessionDetail)
def get_session(
    session_id: str,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Full session detail — aggregated across all blocks for the night."""
    row = db.execute(
        text("""
            WITH night AS (
                SELECT folder_date, user_id
                FROM sessions
                WHERE id = CAST(:id AS uuid) AND user_id = CAST(:uid AS uuid)
            )
            SELECT
                (array_agg(s.id::text ORDER BY s.duration_seconds DESC))[1] AS id,
                (array_agg(s.session_id ORDER BY s.duration_seconds DESC))[1] AS session_id,
                s.folder_date,
                0 AS block_index,
                MIN(s.start_datetime) AS start_datetime,
                MIN(s.start_datetime) AS pld_start_datetime,
                SUM(s.duration_seconds) AS duration_seconds,
                SUM(s.total_ahi_events) AS total_ahi_events,
                SUM(s.central_apnea_count) AS central_apnea_count,
                SUM(s.obstructive_apnea_count) AS obstructive_apnea_count,
                SUM(s.hypopnea_count) AS hypopnea_count,
                SUM(s.apnea_count) AS apnea_count,
                SUM(s.arousal_count) AS arousal_count,
                AVG(s.avg_pressure) AS avg_pressure,
                MAX(s.p95_pressure) AS p95_pressure,
                AVG(s.avg_leak) AS avg_leak,
                BOOL_OR(s.has_spo2) AS has_spo2,
                CASE WHEN SUM(s.duration_seconds) > 0
                     THEN ROUND((SUM(s.total_ahi_events) / (SUM(s.duration_seconds) / 3600.0))::numeric, 2)
                     ELSE 0 END AS ahi,
                AVG(s.avg_resp_rate) AS avg_resp_rate,
                AVG(s.avg_tidal_vol) AS avg_tidal_vol,
                AVG(s.avg_min_vent) AS avg_min_vent,
                AVG(s.avg_snore) AS avg_snore,
                AVG(s.avg_flow_lim) AS avg_flow_lim,
                AVG(s.avg_spo2) AS avg_spo2,
                MIN(s.min_spo2) AS min_spo2,
                (array_agg(s.device_serial   ORDER BY s.duration_seconds DESC))[1] AS device_serial,
                (array_agg(s.therapy_mode    ORDER BY s.duration_seconds DESC))[1] AS therapy_mode,
                (array_agg(s.mask_type       ORDER BY s.duration_seconds DESC))[1] AS mask_type,
                (array_agg(s.humidity_level  ORDER BY s.duration_seconds DESC))[1] AS humidity_level,
                (array_agg(s.temperature_c   ORDER BY s.duration_seconds DESC))[1] AS temperature_c,
                (array_agg(s.machine_tz      ORDER BY s.duration_seconds DESC))[1] AS machine_tz,
                (array_agg(s.note            ORDER BY s.duration_seconds DESC))[1] AS note,
                COALESCE((
                    SELECT s2.tags
                    FROM sessions s2
                    JOIN night n2 ON s2.folder_date = n2.folder_date AND s2.user_id = n2.user_id
                    WHERE s2.duration_seconds >= 600
                      AND s2.tags IS NOT NULL
                    ORDER BY s2.duration_seconds DESC
                    LIMIT 1
                ), ARRAY[]::text[]) AS tags
            FROM sessions s
            JOIN night n ON s.folder_date = n.folder_date AND s.user_id = n.user_id
            WHERE s.duration_seconds >= 600
            GROUP BY s.folder_date
        """),
        {"id": session_id, "uid": current_user["id"]},
    ).mappings().first()
    if not row:
        raise HTTPException(status_code=404, detail="Session not found")
    return SessionDetail.model_validate(dict(row))


@router.put("/{session_id}/note", response_model=SessionDetail)
def update_session_note(
    session_id: str,
    body: SessionNoteUpdate,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    selected = db.execute(
        text("""
            SELECT folder_date
            FROM sessions
            WHERE id::text = :id
              AND user_id = CAST(:uid AS uuid)
        """),
        {"id": session_id, "uid": current_user["id"]},
    ).mappings().first()
    if not selected:
        raise HTTPException(status_code=404, detail="Session not found")

    note = body.note.strip() if body.note is not None else None
    if note == "":
        note = None

    db.execute(
        text("""
            UPDATE sessions
            SET note = :note,
                updated_at = NOW()
            WHERE user_id = CAST(:uid AS uuid)
              AND folder_date = :folder_date
        """),
        {"note": note, "uid": current_user["id"], "folder_date": selected["folder_date"]},
    )
    db.commit()
    return get_session(session_id=session_id, current_user=current_user, db=db)


@router.put("/{session_id}/tags", response_model=SessionDetail)
def update_session_tags(
    session_id: str,
    body: SessionTagsUpdate,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    selected = db.execute(
        text("""
            SELECT folder_date
            FROM sessions
            WHERE id::text = :id
              AND user_id = CAST(:uid AS uuid)
        """),
        {"id": session_id, "uid": current_user["id"]},
    ).mappings().first()
    if not selected:
        raise HTTPException(status_code=404, detail="Session not found")

    tags = []
    for tag in body.tags:
        if tag not in ALLOWED_SESSION_TAGS:
            raise HTTPException(status_code=422, detail=f"Invalid session tag: {tag}")
        if tag not in tags:
            tags.append(tag)

    db.execute(
        text("""
            UPDATE sessions
            SET tags = CAST(:tags AS text[]),
                updated_at = NOW()
            WHERE user_id = CAST(:uid AS uuid)
              AND folder_date = :folder_date
        """),
        {"tags": tags, "uid": current_user["id"], "folder_date": selected["folder_date"]},
    )
    db.commit()
    return get_session(session_id=session_id, current_user=current_user, db=db)


@router.get("/{session_id}/events", response_model=List[EventRecord])
def get_session_events(
    session_id: str,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """All respiratory events for a session, sorted by onset."""
    internal_session_id = _require_session(session_id, current_user["id"], db)
    rows = db.execute(
        text("""
            SELECT se.id, se.event_type, se.onset_seconds, se.duration_seconds, se.event_datetime
            FROM session_events se
            JOIN sessions s ON se.session_id = s.id
            WHERE s.folder_date = (SELECT folder_date FROM sessions WHERE id = CAST(:sid AS uuid))
              AND s.user_id = CAST(:uid AS uuid)
            ORDER BY se.event_datetime
        """),
        {"sid": internal_session_id, "uid": current_user["id"]}
    ).mappings().all()
    return [EventRecord.model_validate(dict(r)) for r in rows]


@router.get("/{session_id}/events/{event_id}/window", response_model=EventWindowResponse)
def get_event_window(
    session_id: str,
    event_id: int,
    before_seconds: int = Query(120, ge=10, le=600),
    after_seconds: int = Query(180, ge=10, le=600),
    waveform_downsample: int = Query(1, ge=1, le=25),
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Focused metrics and BRP waveform around one event."""
    internal_session_id = _require_session(session_id, current_user["id"], db)

    event_row = db.execute(
        text("""
            SELECT se.id, se.event_type, se.onset_seconds, se.duration_seconds, se.event_datetime
            FROM session_events se
            JOIN sessions s ON se.session_id = s.id
            WHERE se.id = :event_id
              AND s.folder_date = (SELECT folder_date FROM sessions WHERE id = CAST(:sid AS uuid))
              AND s.user_id = CAST(:uid AS uuid)
        """),
        {"event_id": event_id, "sid": internal_session_id, "uid": current_user["id"]},
    ).mappings().first()
    if not event_row:
        raise HTTPException(status_code=404, detail="Event not found")

    neighboring_event_rows = db.execute(
        text("""
            SELECT se.id, se.event_type, se.onset_seconds, se.duration_seconds, se.event_datetime
            FROM session_events se
            JOIN sessions s ON se.session_id = s.id
            WHERE s.folder_date = (SELECT folder_date FROM sessions WHERE id = CAST(:sid AS uuid))
              AND s.user_id = CAST(:uid AS uuid)
              AND se.event_datetime >= (:event_ts - (:before_seconds * INTERVAL '1 second'))
              AND se.event_datetime <= (:event_ts + (:after_seconds * INTERVAL '1 second'))
            ORDER BY se.event_datetime
        """),
        {
            "sid": internal_session_id,
            "uid": current_user["id"],
            "event_ts": event_row["event_datetime"],
            "before_seconds": before_seconds,
            "after_seconds": after_seconds,
        },
    ).mappings().all()

    metric_rows = db.execute(
        text("""
            SELECT ts, mask_pressure, pressure, epr_pressure, leak,
                   resp_rate, tidal_vol, min_vent, snore, flow_lim
            FROM session_metrics sm
            JOIN sessions s ON sm.session_id = s.id
            WHERE s.folder_date = (SELECT folder_date FROM sessions WHERE id = CAST(:sid AS uuid))
              AND s.user_id = CAST(:uid AS uuid)
              AND sm.ts >= (:event_ts - (:before_seconds * INTERVAL '1 second'))
              AND sm.ts <= (:event_ts + (:after_seconds * INTERVAL '1 second'))
            ORDER BY sm.ts
        """),
        {
            "sid": internal_session_id,
            "uid": current_user["id"],
            "event_ts": event_row["event_datetime"],
            "before_seconds": before_seconds,
            "after_seconds": after_seconds,
        },
    ).mappings().all()

    waveform_rows = db.execute(
        text("""
            WITH numbered AS (
                SELECT sw.ts, sw.flow, sw.pressure,
                       ROW_NUMBER() OVER (ORDER BY sw.ts) AS rn
                FROM session_waveform sw
                JOIN sessions s ON sw.session_id = s.id
                WHERE s.folder_date = (SELECT folder_date FROM sessions WHERE id = CAST(:sid AS uuid))
                  AND s.user_id = CAST(:uid AS uuid)
                  AND sw.ts >= (:event_ts - (:before_seconds * INTERVAL '1 second'))
                  AND sw.ts <= (:event_ts + (:after_seconds * INTERVAL '1 second'))
            )
            SELECT ts, flow, pressure
            FROM numbered
            WHERE (rn - 1) % :ds = 0
            ORDER BY ts
        """),
        {
            "sid": internal_session_id,
            "uid": current_user["id"],
            "event_ts": event_row["event_datetime"],
            "before_seconds": before_seconds,
            "after_seconds": after_seconds,
            "ds": waveform_downsample,
        },
    ).mappings().all()

    return EventWindowResponse(
        event=EventRecord.model_validate(dict(event_row)),
        neighboring_events=[EventRecord.model_validate(dict(r)) for r in neighboring_event_rows],
        metrics=_metrics_response(metric_rows),
        waveform=WaveformResponse(
            timestamps=[r["ts"].isoformat() for r in waveform_rows],
            flow=[_f(r["flow"]) for r in waveform_rows],
            pressure=[_f(r["pressure"]) for r in waveform_rows],
        ),
    )


@router.get("/{session_id}/metrics", response_model=MetricsResponse)
def get_session_metrics(
    session_id: str,
    downsample: int = Query(15, ge=1, le=120,
                            description="Keep every Nth row. 1=2s, 15=30s, 30=60s resolution"),
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    PLD time-series for one session.
    Returns columnar arrays (one list per signal) for efficient charting.
    Default downsample=15 gives 30-second resolution (~580 points for a 5h session).
    """
    internal_session_id = _require_session(session_id, current_user["id"], db)
    rows = db.execute(
        text("""
            WITH numbered AS (
                SELECT ts, mask_pressure, pressure, epr_pressure, leak,
                       resp_rate, tidal_vol, min_vent, snore, flow_lim,
                       ROW_NUMBER() OVER (ORDER BY ts) AS rn
                FROM session_metrics sm
                JOIN sessions s ON sm.session_id = s.id
                WHERE s.folder_date = (SELECT folder_date FROM sessions WHERE id = CAST(:sid AS uuid))
                  AND s.user_id = CAST(:uid AS uuid)
            )
            SELECT ts, mask_pressure, pressure, epr_pressure, leak,
                   resp_rate, tidal_vol, min_vent, snore, flow_lim
            FROM numbered
            WHERE (rn - 1) % :ds = 0
            ORDER BY ts
        """),
        {"sid": internal_session_id, "ds": downsample, "uid": current_user["id"]}
    ).mappings().all()

    if not rows:
        return _empty_metrics_response()

    return _metrics_response(rows)


@router.get("/{session_id}/breath", response_model=MetricsResponse)
def get_session_breath(
    session_id: str,
    offset_minutes: int = Query(0, ge=0, description="Start offset from session start in minutes"),
    window_minutes: int = Query(10, ge=1, le=60, description="Window length in minutes (max 60)"),
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Full 2-second resolution metrics for a time window within a session.
    Use offset_minutes + window_minutes to navigate through the night breath-by-breath.
    """
    internal_session_id = _require_session(session_id, current_user["id"], db)
    rows = db.execute(
        text("""
            SELECT ts, mask_pressure, pressure, epr_pressure, leak,
                   resp_rate, tidal_vol, min_vent, snore, flow_lim
            FROM session_metrics
            WHERE session_id = :sid
              AND ts >= (
                  SELECT MIN(ts) + (:offset_min * INTERVAL '1 minute')
                  FROM session_metrics WHERE session_id = :sid
              )
              AND ts < (
                  SELECT MIN(ts) + ((:offset_min + :window_min) * INTERVAL '1 minute')
                  FROM session_metrics WHERE session_id = :sid
              )
            ORDER BY ts
        """),
        {"sid": internal_session_id, "offset_min": offset_minutes, "window_min": window_minutes}
    ).mappings().all()

    if not rows:
        return _empty_metrics_response()

    return _metrics_response(rows)


def _empty_metrics_response() -> MetricsResponse:
    return MetricsResponse(
        timestamps=[], mask_pressure=[], pressure=[], epr_pressure=[],
        leak=[], resp_rate=[], tidal_vol=[], min_vent=[], snore=[], flow_lim=[]
    )


def _metrics_response(rows) -> MetricsResponse:
    return MetricsResponse(
        timestamps=[r["ts"].isoformat() for r in rows],
        mask_pressure=[_f(r["mask_pressure"]) for r in rows],
        pressure=[_f(r["pressure"]) for r in rows],
        epr_pressure=[_f(r["epr_pressure"]) for r in rows],
        leak=[_f(r["leak"]) for r in rows],
        resp_rate=[_f(r["resp_rate"]) for r in rows],
        tidal_vol=[_f(r["tidal_vol"]) for r in rows],
        min_vent=[_f(r["min_vent"]) for r in rows],
        snore=[_f(r["snore"]) for r in rows],
        flow_lim=[_f(r["flow_lim"]) for r in rows],
    )


@router.get("/{session_id}/spo2", response_model=SpO2Response)
def get_session_spo2(
    session_id: str,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """SpO2 and pulse time-series. Returns 404 if no oximeter data for this session."""
    internal_session_id = _require_session(session_id, current_user["id"], db)
    session = db.execute(
        text("SELECT has_spo2 FROM sessions WHERE id = :id"),
        {"id": internal_session_id},
    ).mappings().first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    if not session["has_spo2"]:
        raise HTTPException(status_code=404, detail="No SpO2 data for this session")

    rows = db.execute(
        text("""
            SELECT ts, spo2, pulse FROM session_spo2
            WHERE session_id = :sid ORDER BY ts
        """),
        {"sid": internal_session_id}
    ).mappings().all()

    return SpO2Response(
        timestamps=[r["ts"].isoformat() for r in rows],
        spo2=[r["spo2"] for r in rows],
        pulse=[r["pulse"] for r in rows],
    )


@router.put("/{session_id}/timezone", response_model=SessionDetail)
def update_session_timezone(
    session_id: str,
    body: SessionTimezoneUpdate,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Reinterpret a night's imported timestamps using a corrected machine timezone."""
    try:
        new_zone_name = body.machine_tz.strip()
        new_zone = ZoneInfo(new_zone_name)
    except (ZoneInfoNotFoundError, KeyError, ValueError):
        raise HTTPException(status_code=400, detail=f"Unknown timezone: {body.machine_tz}")

    selected = db.execute(
        text("""
            SELECT folder_date
            FROM sessions
            WHERE id = CAST(:id AS uuid)
              AND user_id = CAST(:uid AS uuid)
        """),
        {"id": session_id, "uid": current_user["id"]},
    ).mappings().first()
    if not selected:
        raise HTTPException(status_code=404, detail="Session not found")

    rows = db.execute(
        text("""
            SELECT id::text AS id, start_datetime, pld_start_datetime, COALESCE(machine_tz, 'UTC') AS machine_tz
            FROM sessions
            WHERE user_id = CAST(:uid AS uuid)
              AND folder_date = :folder_date
        """),
        {"uid": current_user["id"], "folder_date": selected["folder_date"]},
    ).mappings().all()

    for row in rows:
        try:
            old_zone = ZoneInfo(row["machine_tz"] or "UTC")
        except (ZoneInfoNotFoundError, KeyError, ValueError):
            old_zone = ZoneInfo("UTC")

        old_start = row["start_datetime"]
        old_pld_start = row["pld_start_datetime"]
        new_start = _reinterpret_with_timezone(old_start, old_zone, new_zone)
        new_pld_start = _reinterpret_with_timezone(old_pld_start, old_zone, new_zone)
        delta = new_start - old_start

        db.execute(
            text("""
                UPDATE sessions
                SET start_datetime = :start_datetime,
                    pld_start_datetime = :pld_start_datetime,
                    machine_tz = :machine_tz,
                    updated_at = NOW()
                WHERE id = CAST(:id AS uuid)
            """),
            {
                "id": row["id"],
                "start_datetime": new_start,
                "pld_start_datetime": new_pld_start,
                "machine_tz": new_zone_name,
            },
        )
        db.execute(
            text("UPDATE session_events SET event_datetime = event_datetime + :delta WHERE session_id = CAST(:id AS uuid)"),
            {"id": row["id"], "delta": delta},
        )
        db.execute(
            text("UPDATE session_metrics SET ts = ts + :delta WHERE session_id = CAST(:id AS uuid)"),
            {"id": row["id"], "delta": delta},
        )
        db.execute(
            text("UPDATE session_spo2 SET ts = ts + :delta WHERE session_id = CAST(:id AS uuid)"),
            {"id": row["id"], "delta": delta},
        )

    db.commit()
    return get_session(session_id=session_id, current_user=current_user, db=db)


def _require_session(session_id: str, user_id: str, db: Session) -> str:
    row = db.execute(
        text("SELECT id::text AS id FROM sessions WHERE id = CAST(:id AS uuid) AND user_id = CAST(:uid AS uuid)"),
        {"id": session_id, "uid": user_id},
    ).mappings().first()
    if not row:
        raise HTTPException(status_code=404, detail="Session not found")
    return row["id"]


def _f(val) -> Optional[float]:
    """Convert Decimal to float for JSON serialization."""
    return float(val) if val is not None else None


def _reinterpret_with_timezone(value, old_zone: ZoneInfo, new_zone: ZoneInfo):
    wall_time = value.astimezone(old_zone).replace(tzinfo=None)
    return wall_time.replace(tzinfo=new_zone)


@router.delete("/all", status_code=204)
def delete_all_sessions(
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Delete all session data for the current user."""
    db.execute(
        text("DELETE FROM sessions WHERE user_id = CAST(:uid AS uuid)"),
        {"uid": current_user["id"]},
    )
    db.commit()


@router.get("/by-date/{folder_date}", response_model=SessionDetail)
def get_session_by_date(
    folder_date: str,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get session detail by date (YYYY-MM-DD)."""
    row = db.execute(
        text("""
            WITH night AS (
                SELECT folder_date, user_id
                FROM sessions
                WHERE folder_date = CAST(:date AS date) AND user_id = CAST(:uid AS uuid)
                LIMIT 1
            )
            SELECT
                (array_agg(s.id::text ORDER BY s.duration_seconds DESC))[1] AS id,
                (array_agg(s.session_id ORDER BY s.duration_seconds DESC))[1] AS session_id,
                s.folder_date,
                0 AS block_index,
                MIN(s.start_datetime) AS start_datetime,
                MIN(s.start_datetime) AS pld_start_datetime,
                SUM(s.duration_seconds) AS duration_seconds,
                SUM(s.total_ahi_events) AS total_ahi_events,
                SUM(s.central_apnea_count) AS central_apnea_count,
                SUM(s.obstructive_apnea_count) AS obstructive_apnea_count,
                SUM(s.hypopnea_count) AS hypopnea_count,
                SUM(s.apnea_count) AS apnea_count,
                SUM(s.arousal_count) AS arousal_count,
                AVG(s.avg_pressure) AS avg_pressure,
                MAX(s.p95_pressure) AS p95_pressure,
                AVG(s.avg_leak) AS avg_leak,
                BOOL_OR(s.has_spo2) AS has_spo2,
                CASE WHEN SUM(s.duration_seconds) > 0
                     THEN ROUND((SUM(s.total_ahi_events) / (SUM(s.duration_seconds) / 3600.0))::numeric, 2)
                     ELSE 0 END AS ahi,
                AVG(s.avg_resp_rate) AS avg_resp_rate,
                AVG(s.avg_tidal_vol) AS avg_tidal_vol,
                AVG(s.avg_min_vent) AS avg_min_vent,
                AVG(s.avg_snore) AS avg_snore,
                AVG(s.avg_flow_lim) AS avg_flow_lim,
                AVG(s.avg_spo2) AS avg_spo2,
                MIN(s.min_spo2) AS min_spo2,
                (array_agg(s.device_serial   ORDER BY s.duration_seconds DESC))[1] AS device_serial,
                (array_agg(s.therapy_mode    ORDER BY s.duration_seconds DESC))[1] AS therapy_mode,
                (array_agg(s.mask_type       ORDER BY s.duration_seconds DESC))[1] AS mask_type,
                (array_agg(s.humidity_level  ORDER BY s.duration_seconds DESC))[1] AS humidity_level,
                (array_agg(s.temperature_c   ORDER BY s.duration_seconds DESC))[1] AS temperature_c,
                (array_agg(s.machine_tz      ORDER BY s.duration_seconds DESC))[1] AS machine_tz,
                (array_agg(s.note            ORDER BY s.duration_seconds DESC))[1] AS note,
                COALESCE((
                    SELECT s2.tags
                    FROM sessions s2
                    JOIN night n2 ON s2.folder_date = n2.folder_date AND s2.user_id = n2.user_id
                    WHERE s2.duration_seconds >= 600
                      AND s2.tags IS NOT NULL
                    ORDER BY s2.duration_seconds DESC
                    LIMIT 1
                ), ARRAY[]::text[]) AS tags
            FROM sessions s
            JOIN night n ON s.folder_date = n.folder_date AND s.user_id = n.user_id
            WHERE s.duration_seconds >= 600
            GROUP BY s.folder_date
        """),
        {"date": folder_date, "uid": current_user["id"]},
    ).mappings().first()
    if not row:
        raise HTTPException(status_code=404, detail="No session found for this date")
    return SessionDetail.model_validate(dict(row))
