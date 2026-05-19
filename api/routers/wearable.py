"""Wearable data endpoints.

GET /wearable/data?date=YYYY-MM-DD       — raw samples for one night
GET /wearable/summary?date_from=&date_to= — daily aggregates for a date range
"""

import logging
import os
from datetime import date as date_type
from datetime import datetime, timedelta
from statistics import mean

import httpx
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import text
from sqlalchemy.orm import Session

from ..auth import get_current_user
from ..database import get_db
from ..wearable.base import StageSample
from ..wearable.registry import get_adapter

router = APIRouter()
logger = logging.getLogger(__name__)


def _wearable_enabled() -> bool:
    return os.environ.get("WEARABLE_ENABLED", "true").lower() not in ("false", "0", "no")


class SampleOut(BaseModel):
    timestamp: str
    value: float


class StageSampleOut(BaseModel):
    timestamp: str
    stage: int


class WearableDataResponse(BaseModel):
    hr: list[SampleOut]
    spo2: list[SampleOut]
    stages: list[StageSampleOut]


class WearableDailySummary(BaseModel):
    date: str
    avg_hr: float | None
    avg_spo2: float | None
    awake_h: float
    light_h: float
    deep_h: float
    rem_h: float


def _get_adapter_for_user(user_id: str, db: Session):
    """Return a configured wearable adapter for the given user, or None.

    Args:
        user_id: The authenticated user's UUID string.
        db: SQLAlchemy database session.

    Returns:
        A WearableAdapter instance, or None if no provider is configured
        or the provider name is unrecognized.
    """
    row = db.execute(
        text("""
            SELECT wearable_provider, wearable_base_url, wearable_api_key
            FROM user_import_settings
            WHERE user_id = CAST(:uid AS uuid)
        """),
        {"uid": user_id},
    ).mappings().first()

    provider = (row and row["wearable_provider"]) or os.environ.get("WEARABLE_DEFAULT_PROVIDER", "")
    base_url = (row and row["wearable_base_url"]) or os.environ.get("WEARABLE_DEFAULT_BASE_URL", "")
    api_key  = (row and row["wearable_api_key"])  or os.environ.get("WEARABLE_DEFAULT_API_KEY", "")

    if not provider:
        return None

    try:
        return get_adapter(provider, base_url, api_key)
    except ValueError:
        return None


def _payload_to_response(payload) -> WearableDataResponse:
    return WearableDataResponse(
        hr=[SampleOut(timestamp=s.timestamp, value=s.value) for s in payload.hr],
        spo2=[SampleOut(timestamp=s.timestamp, value=s.value) for s in payload.spo2],
        stages=[StageSampleOut(timestamp=s.timestamp, stage=s.stage) for s in payload.stages],
    )


def _stages_to_hours(stages: list[StageSample]) -> dict:
    """Convert a list of StageSample epochs to hours per stage.

    Each epoch runs from its timestamp to the next epoch's timestamp.
    The final epoch defaults to 30 minutes.
    """
    hours: dict[int, float] = {1: 0.0, 2: 0.0, 3: 0.0, 4: 0.0}

    for i, sample in enumerate(stages):
        try:
            start = datetime.fromisoformat(sample.timestamp.replace("Z", "+00:00"))
        except ValueError:
            continue
        if i + 1 < len(stages):
            end_str = stages[i + 1].timestamp
            try:
                end = datetime.fromisoformat(end_str.replace("Z", "+00:00"))
            except ValueError:
                continue
        else:
            end = start + timedelta(minutes=30)

        duration_h = max(0.0, (end - start).total_seconds() / 3600)
        hours[sample.stage] = hours.get(sample.stage, 0.0) + duration_h

    return hours


@router.get("/data", response_model=WearableDataResponse)
def get_wearable_data(
    date: str = Query(..., description="YYYY-MM-DD"),
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if not _wearable_enabled():
        return WearableDataResponse(hr=[], spo2=[], stages=[])

    adapter = _get_adapter_for_user(current_user["id"], db)
    if adapter is None:
        return WearableDataResponse(hr=[], spo2=[], stages=[])

    try:
        target = date_type.fromisoformat(date)
    except ValueError:
        raise HTTPException(status_code=400, detail="date must be YYYY-MM-DD")

    try:
        payload = adapter.fetch(current_user["id"], target)
    except httpx.HTTPStatusError as exc:
        if exc.response.status_code == 401:
            raise HTTPException(
                status_code=502,
                detail="Wearable API rejected your credentials (401). Check your API key in Settings.",
            )
        if exc.response.status_code == 403:
            raise HTTPException(
                status_code=502,
                detail="Wearable API denied access (403). Your account may lack permission.",
            )
        return WearableDataResponse(hr=[], spo2=[], stages=[])

    return _payload_to_response(payload)


@router.get("/summary", response_model=list[WearableDailySummary])
def get_wearable_summary(
    date_from: str = Query(..., description="YYYY-MM-DD"),
    date_to: str = Query(..., description="YYYY-MM-DD"),
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if not _wearable_enabled():
        return []

    adapter = _get_adapter_for_user(current_user["id"], db)
    if adapter is None:
        return []

    try:
        start = date_type.fromisoformat(date_from)
        end = date_type.fromisoformat(date_to)
    except ValueError:
        raise HTTPException(status_code=400, detail="date_from and date_to must be YYYY-MM-DD")

    results: list[WearableDailySummary] = []
    current = start
    while current <= end:
        try:
            payload = adapter.fetch(current_user["id"], current)
        except httpx.HTTPStatusError as exc:
            if exc.response.status_code == 401:
                raise HTTPException(
                    status_code=502,
                    detail="Wearable API rejected your credentials (401). Check your API key in Settings.",
                )
            if exc.response.status_code == 403:
                raise HTTPException(
                    status_code=502,
                    detail="Wearable API denied access (403). Your account may lack permission.",
                )
            current += timedelta(days=1)
            continue

        if not payload.is_empty():
            hr_vals = [s.value for s in payload.hr]
            spo2_vals = [s.value for s in payload.spo2]
            stage_hours = _stages_to_hours(payload.stages)
            results.append(WearableDailySummary(
                date=current.isoformat(),
                avg_hr=round(mean(hr_vals), 1) if hr_vals else None,
                avg_spo2=round(mean(spo2_vals), 1) if spo2_vals else None,
                awake_h=round(stage_hours[1], 2),
                light_h=round(stage_hours[2], 2),
                deep_h=round(stage_hours[3], 2),
                rem_h=round(stage_hours[4], 2),
            ))

        current += timedelta(days=1)

    return results
