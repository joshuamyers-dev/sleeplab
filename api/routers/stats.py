from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import text

from ..auth import get_current_user
from ..database import get_db
from ..models import SummaryStats, DailyStat

router = APIRouter()


@router.get("/summary", response_model=SummaryStats)
def get_summary(
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Global stats for the dashboard header and charts.

    For multi-block nights, picks the longest block as the primary AHI for that night.
    """
    # Date range and compliance
    range_row = db.execute(text("""
        SELECT MIN(folder_date) AS first_date, MAX(folder_date) AS last_date
        FROM sessions
        WHERE user_id = CAST(:uid AS uuid)
    """), {"uid": current_user["id"]}).mappings().first()

    if not range_row or not range_row["first_date"]:
        return SummaryStats(
            total_nights=0, nights_with_data=0, compliance_pct=0.0,
            avg_ahi=None, avg_pressure=None, ahi_trend=[], event_breakdown={}
        )

    # Total calendar nights in range
    total_nights_row = db.execute(text("""
        SELECT (MAX(folder_date) - MIN(folder_date) + 1) AS total_nights,
               COUNT(DISTINCT folder_date) AS nights_with_data
        FROM sessions
        WHERE user_id = CAST(:uid AS uuid)
    """), {"uid": current_user["id"]}).mappings().first()

    total_nights = int(total_nights_row["total_nights"])
    nights_with_data = int(total_nights_row["nights_with_data"])
    compliance_pct = round(nights_with_data / total_nights * 100, 1) if total_nights > 0 else 0.0

    # Per-night primary block: longest duration per folder_date
    primary_blocks = db.execute(text("""
        SELECT DISTINCT ON (folder_date)
            id::text AS id, folder_date, ahi, duration_seconds, avg_pressure
        FROM sessions
        WHERE user_id = CAST(:uid AS uuid)
        ORDER BY folder_date, duration_seconds DESC
    """), {"uid": current_user["id"]}).mappings().all()

    ahi_values = [float(r["ahi"]) for r in primary_blocks if r["ahi"] is not None]
    press_values = [float(r["avg_pressure"]) for r in primary_blocks if r["avg_pressure"] is not None]

    avg_ahi = round(sum(ahi_values) / len(ahi_values), 2) if ahi_values else None
    avg_pressure = round(sum(press_values) / len(press_values), 2) if press_values else None

    # AHI trend: all nights (most recent 90)
    ahi_trend_rows = db.execute(text("""
        SELECT DISTINCT ON (folder_date)
            id::text AS id, folder_date, ahi, duration_seconds
        FROM sessions
        WHERE user_id = CAST(:uid AS uuid)
        ORDER BY folder_date DESC, duration_seconds DESC
        LIMIT 90
    """), {"uid": current_user["id"]}).mappings().all()

    ahi_trend = [
        DailyStat(
            folder_date=r["folder_date"],
            ahi=float(r["ahi"]) if r["ahi"] is not None else None,
            duration_hours=round(float(r["duration_seconds"]) / 3600, 2),
            session_id=r["id"],
        )
        for r in reversed(ahi_trend_rows)
    ]

    # Event breakdown totals (across all sessions)
    evt_row = db.execute(text("""
        SELECT
            SUM(central_apnea_count)     AS central,
            SUM(obstructive_apnea_count) AS obstructive,
            SUM(hypopnea_count)          AS hypopnea,
            SUM(apnea_count)             AS apnea,
            SUM(arousal_count)           AS arousal
        FROM sessions
        WHERE user_id = CAST(:uid AS uuid)
    """), {"uid": current_user["id"]}).mappings().first()

    event_breakdown = {
        "central_apnea":     int(evt_row["central"] or 0),
        "obstructive_apnea": int(evt_row["obstructive"] or 0),
        "hypopnea":          int(evt_row["hypopnea"] or 0),
        "apnea":             int(evt_row["apnea"] or 0),
        "arousal":           int(evt_row["arousal"] or 0),
    }

    return SummaryStats(
        total_nights=total_nights,
        nights_with_data=nights_with_data,
        compliance_pct=compliance_pct,
        avg_ahi=avg_ahi,
        avg_pressure=avg_pressure,
        ahi_trend=ahi_trend,
        event_breakdown=event_breakdown,
    )
