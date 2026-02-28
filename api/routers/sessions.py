from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import text
from typing import Optional
from datetime import date

from ..auth import get_current_user
from ..database import get_db
from ..models import SessionSummary, SessionDetail, EventRecord, MetricsResponse, SpO2Response

router = APIRouter()


@router.get("/", response_model=list[SessionSummary])
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
    params: dict = {"limit": per_page, "offset": (page - 1) * per_page, "uid": current_user["id"]}

    if date_from:
        conditions.append("folder_date >= :date_from")
        params["date_from"] = date_from
    if date_to:
        conditions.append("folder_date <= :date_to")
        params["date_to"] = date_to

    where = ("WHERE " + " AND ".join(conditions)) if conditions else ""

    sql = text(f"""
        SELECT id::text AS id, session_id, folder_date, block_index, start_datetime, duration_seconds,
               ahi, central_apnea_count, obstructive_apnea_count, hypopnea_count,
               apnea_count, arousal_count, total_ahi_events,
               avg_pressure, p95_pressure, avg_leak, has_spo2
        FROM sessions
        {where}
        ORDER BY folder_date DESC, block_index ASC
        LIMIT :limit OFFSET :offset
    """)
    rows = db.execute(sql, params).mappings().all()
    return [SessionSummary.model_validate(dict(r)) for r in rows]


@router.get("/{session_id}", response_model=SessionDetail)
def get_session(
    session_id: str,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Full session detail."""
    row = db.execute(
        text("SELECT id::text AS id, session_id, folder_date, block_index, start_datetime, "
             "duration_seconds, ahi, central_apnea_count, obstructive_apnea_count, hypopnea_count, "
             "apnea_count, arousal_count, total_ahi_events, avg_pressure, p95_pressure, avg_leak, has_spo2, "
             "pld_start_datetime, device_serial, avg_resp_rate, avg_tidal_vol, avg_min_vent, avg_snore, "
             "avg_flow_lim, avg_spo2, min_spo2 "
             "FROM sessions WHERE id = CAST(:id AS uuid) AND user_id = CAST(:uid AS uuid)"),
        {"id": session_id, "uid": current_user["id"]},
    ).mappings().first()
    if not row:
        raise HTTPException(status_code=404, detail="Session not found")
    return SessionDetail.model_validate(dict(row))


@router.get("/{session_id}/events", response_model=list[EventRecord])
def get_session_events(
    session_id: str,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """All respiratory events for a session, sorted by onset."""
    internal_session_id = _require_session(session_id, current_user["id"], db)
    rows = db.execute(
        text("""
            SELECT id, event_type, onset_seconds, duration_seconds, event_datetime
            FROM session_events
            WHERE session_id = :sid
            ORDER BY onset_seconds
        """),
        {"sid": internal_session_id}
    ).mappings().all()
    return [EventRecord.model_validate(dict(r)) for r in rows]


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
                FROM session_metrics
                WHERE session_id = :sid
            )
            SELECT ts, mask_pressure, pressure, epr_pressure, leak,
                   resp_rate, tidal_vol, min_vent, snore, flow_lim
            FROM numbered
            WHERE rn % :ds = 1
            ORDER BY ts
        """),
        {"sid": internal_session_id, "ds": downsample}
    ).mappings().all()

    if not rows:
        return MetricsResponse(
            timestamps=[], mask_pressure=[], pressure=[], epr_pressure=[],
            leak=[], resp_rate=[], tidal_vol=[], min_vent=[], snore=[], flow_lim=[]
        )

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
