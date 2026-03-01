from pydantic import BaseModel, computed_field
from typing import Dict, List, Optional
from datetime import datetime, date


class SessionSummary(BaseModel):
    id: str
    session_id: str
    folder_date: date
    block_index: int
    start_datetime: datetime
    duration_seconds: int
    ahi: Optional[float]
    central_apnea_count: int
    obstructive_apnea_count: int
    hypopnea_count: int
    apnea_count: int
    arousal_count: int
    total_ahi_events: int
    avg_pressure: Optional[float]
    p95_pressure: Optional[float]
    avg_leak: Optional[float]
    has_spo2: bool

    @computed_field
    @property
    def duration_hours(self) -> float:
        return round(self.duration_seconds / 3600, 2)

    model_config = {"from_attributes": True}


class SessionDetail(SessionSummary):
    pld_start_datetime: datetime
    device_serial: Optional[str]
    avg_resp_rate: Optional[float]
    avg_tidal_vol: Optional[float]
    avg_min_vent: Optional[float]
    avg_snore: Optional[float]
    avg_flow_lim: Optional[float]
    avg_spo2: Optional[float]
    min_spo2: Optional[float]


class EventRecord(BaseModel):
    id: int
    event_type: str
    onset_seconds: float
    duration_seconds: Optional[float]
    event_datetime: datetime

    model_config = {"from_attributes": True}


class MetricsResponse(BaseModel):
    timestamps: List[str]
    mask_pressure: List[Optional[float]]
    pressure: List[Optional[float]]
    epr_pressure: List[Optional[float]]
    leak: List[Optional[float]]
    resp_rate: List[Optional[float]]
    tidal_vol: List[Optional[float]]
    min_vent: List[Optional[float]]
    snore: List[Optional[float]]
    flow_lim: List[Optional[float]]


class SpO2Response(BaseModel):
    timestamps: List[str]
    spo2: List[Optional[int]]
    pulse: List[Optional[int]]


class DailyStat(BaseModel):
    folder_date: date
    ahi: Optional[float]
    duration_hours: float
    session_id: str


class SummaryStats(BaseModel):
    total_nights: int
    nights_with_data: int
    compliance_pct: float
    avg_ahi: Optional[float]
    avg_pressure: Optional[float]
    ahi_trend: List[DailyStat]
    event_breakdown: Dict
