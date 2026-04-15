"""
Wearable data router.

Accepts heart rate, SpO2, and sleep stage time-series from external devices
(Withings, Oura Ring, Fitbit, Apple Watch/Health) and serves them back for
display alongside CPAP session data.

Sleep stage normalisation
-------------------------
All device-specific stage labels are mapped to a shared integer encoding:
  1 = Deep    (N3 / SWS / slow-wave)
  2 = Light   (N1 / N2 / Core / unspecified asleep)
  3 = REM
  4 = Awake   (in-bed but awake / out of bed)

Supported source labels (case-insensitive, spaces and underscores ignored):

  Withings :  'deep_sleep' | 'light_sleep' | 'rem_sleep' | 'awake'
  Oura Ring:  'deep'       | 'light'       | 'rem'       | 'awake'
  Fitbit   :  'deep'       | 'light'       | 'rem'       | 'wake'
  Apple    :  'asleepdeep' | 'asleepcore'  | 'asleeprem' | 'awake' |
              'asleepunspecified' | 'inbed'

Endpoints
---------
POST /wearable/samples         Bulk upsert samples (JWT)
GET  /wearable/samples         Query by date or date range (JWT)
"""

import re
from datetime import date, datetime, timedelta
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import text
from sqlalchemy.orm import Session

from ..auth import get_current_user
from ..database import get_db

router = APIRouter()


# ---------------------------------------------------------------------------
# Sleep stage normalisation
# ---------------------------------------------------------------------------

def _key(s: str) -> str:
    """Normalise a stage label to a lowercase alphanum key for lookup."""
    return re.sub(r"[^a-z0-9]", "", s.lower())


# Maps normalised label → integer stage value
_STAGE_MAP: dict[str, int] = {
    # Deep (1)
    "deep": 1, "n3": 1, "sws": 1, "slowwave": 1, "deepsleep": 1,
    "asleepdeep": 1,
    # Light (2)
    "light": 2, "n1": 2, "n2": 2, "core": 2, "lightsleep": 2,
    "asleepcore": 2, "asleep": 2, "asleepunspecified": 2,
    # REM (3)
    "rem": 3, "remsleep": 3, "asleeprem": 3,
    # Awake (4)
    "awake": 4, "wake": 4, "inbed": 4, "in_bed": 4,
}

STAGE_LABELS = {1: "Deep", 2: "Light", 3: "REM", 4: "Awake"}


def normalise_stage(raw: Optional[str]) -> Optional[int]:
    if raw is None:
        return None
    return _STAGE_MAP.get(_key(raw))


# ---------------------------------------------------------------------------
# Pydantic models
# ---------------------------------------------------------------------------

class WearableSampleIn(BaseModel):
    ts: datetime
    heart_rate: Optional[int] = None   # bpm
    spo2: Optional[float] = None       # %
    sleep_stage: Optional[str] = None  # raw label from device


class WearableBulkIn(BaseModel):
    source: str                        # 'withings' | 'oura' | 'fitbit' | 'apple_health'
    samples: List[WearableSampleIn]


class WearableSampleOut(BaseModel):
    ts: str
    heart_rate: Optional[int]
    spo2: Optional[float]
    sleep_stage: Optional[int]
    raw_stage: Optional[str]
    source: Optional[str]


class WearableResponse(BaseModel):
    samples: List[WearableSampleOut]


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.post("/samples", status_code=204)
def upsert_wearable_samples(
    body: WearableBulkIn,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Bulk upsert wearable samples for the current user.

    Duplicate (user, ts, source) rows are updated in place.
    Unknown sleep stage labels are stored as NULL in sleep_stage but
    preserved verbatim in raw_stage.
    """
    if not body.samples:
        return

    source = body.source.strip().lower()
    rows = []
    for s in body.samples:
        rows.append({
            "uid":    current_user["id"],
            "ts":     s.ts,
            "hr":     s.heart_rate,
            "spo2":   round(s.spo2, 2) if s.spo2 is not None else None,
            "stage":  normalise_stage(s.sleep_stage),
            "raw":    s.sleep_stage,
            "source": source,
        })

    db.execute(
        text("""
            INSERT INTO wearable_samples
                (user_id, ts, heart_rate, spo2, sleep_stage, raw_stage, source)
            VALUES
                (CAST(:uid AS uuid), :ts, :hr, :spo2, :stage, :raw, :source)
            ON CONFLICT (user_id, ts, source) DO UPDATE SET
                heart_rate  = COALESCE(EXCLUDED.heart_rate,  wearable_samples.heart_rate),
                spo2        = COALESCE(EXCLUDED.spo2,        wearable_samples.spo2),
                sleep_stage = COALESCE(EXCLUDED.sleep_stage, wearable_samples.sleep_stage),
                raw_stage   = COALESCE(EXCLUDED.raw_stage,   wearable_samples.raw_stage)
        """),
        rows,
    )
    db.commit()


@router.get("/samples", response_model=WearableResponse)
def get_wearable_samples(
    date: Optional[str] = Query(None, description="YYYY-MM-DD — fetch this calendar date plus the following morning (to cover sessions spanning midnight)"),
    date_from: Optional[str] = Query(None, description="YYYY-MM-DD range start (inclusive)"),
    date_to: Optional[str] = Query(None, description="YYYY-MM-DD range end (inclusive)"),
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Return wearable samples for the current user.

    Provide either ?date=YYYY-MM-DD (single night — includes following morning
    to cover sessions spanning midnight) or ?date_from=&date_to= for a range.
    """
    uid = current_user["id"]

    if date is not None:
        try:
            d = datetime.strptime(date, "%Y-%m-%d").date()
        except ValueError:
            raise HTTPException(status_code=400, detail="date must be YYYY-MM-DD")
        # Include the following morning so sessions that run past midnight are covered
        ts_from = datetime(d.year, d.month, d.day)
        ts_to   = datetime(d.year, d.month, d.day) + timedelta(hours=36)
        rows = db.execute(
            text("""
                SELECT ts, heart_rate, spo2, sleep_stage, raw_stage, source
                FROM wearable_samples
                WHERE user_id = CAST(:uid AS uuid)
                  AND ts >= :ts_from AND ts < :ts_to
                ORDER BY ts
            """),
            {"uid": uid, "ts_from": ts_from, "ts_to": ts_to},
        ).mappings().all()

    elif date_from is not None:
        try:
            d_from = datetime.strptime(date_from, "%Y-%m-%d").date()
            d_to   = datetime.strptime(date_to, "%Y-%m-%d").date() if date_to else d_from
        except ValueError:
            raise HTTPException(status_code=400, detail="dates must be YYYY-MM-DD")
        rows = db.execute(
            text("""
                SELECT ts, heart_rate, spo2, sleep_stage, raw_stage, source
                FROM wearable_samples
                WHERE user_id = CAST(:uid AS uuid)
                  AND ts::date BETWEEN :d_from AND :d_to
                ORDER BY ts
            """),
            {"uid": uid, "d_from": d_from, "d_to": d_to},
        ).mappings().all()

    else:
        raise HTTPException(status_code=400, detail="Provide ?date= or ?date_from=")

    return WearableResponse(
        samples=[
            WearableSampleOut(
                ts=r["ts"].isoformat(),
                heart_rate=r["heart_rate"],
                spo2=float(r["spo2"]) if r["spo2"] is not None else None,
                sleep_stage=r["sleep_stage"],
                raw_stage=r["raw_stage"],
                source=r["source"],
            )
            for r in rows
        ]
    )
