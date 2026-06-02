from pydantic import BaseModel, Field, computed_field
from typing import Dict, List, Literal, Optional
from datetime import datetime, date


class SessionSummary(BaseModel):
    id: str
    session_id: str
    folder_date: date
    block_index: int
    start_datetime: datetime
    end_datetime: datetime | None = None
    duration_seconds: int
    ahi: float | None
    central_apnea_count: int
    obstructive_apnea_count: int
    hypopnea_count: int
    apnea_count: int
    arousal_count: int | None
    total_ahi_events: int
    avg_pressure: float | None
    p95_pressure: float | None
    avg_leak: float | None
    has_spo2: bool
    machine_tz: str | None = None

    @computed_field
    @property
    def duration_hours(self) -> float:
        return round(self.duration_seconds / 3600, 2)

    model_config = {"from_attributes": True}


class TherapyScoreComponent(BaseModel):
    score: int
    max_score: int
    label: str
    value: Optional[float] = None
    unit: Optional[str] = None
    unavailable_reason: Optional[str] = None


class TherapyScoreComponents(BaseModel):
    ahi: Optional[TherapyScoreComponent] = None
    leak: Optional[TherapyScoreComponent] = None
    duration: Optional[TherapyScoreComponent] = None
    spo2: Optional[TherapyScoreComponent] = None


class TherapyScore(BaseModel):
    total: int
    grade: Literal["A", "B", "C", "D", "F"]
    low_confidence: bool
    callout: str
    components: TherapyScoreComponents


class SessionDetail(SessionSummary):
    pld_start_datetime: datetime
    device_serial: Optional[str]
    therapy_score: TherapyScore
    score_vs_30d_avg: Optional[float] = None
    note: str | None = None
    tags: list[str] = Field(default_factory=list)
    avg_resp_rate: Optional[float]
    avg_tidal_vol: Optional[float]
    avg_min_vent: Optional[float]
    avg_snore: Optional[float]
    avg_flow_lim: Optional[float]
    avg_spo2: Optional[float]
    min_spo2: Optional[float]
    therapy_mode: Optional[str]
    mask_type: Optional[str]
    humidity_level: Optional[int]
    temperature_c: Optional[float]


class TagInsight(BaseModel):
    tag: str
    night_count: int
    avg_ahi: Optional[float]
    baseline_avg_ahi: Optional[float]
    delta_ahi: Optional[float]


class EventRecord(BaseModel):
    id: int
    event_type: str
    onset_seconds: float
    duration_seconds: float | None
    event_datetime: datetime

    model_config = {"from_attributes": True}


class MetricsResponse(BaseModel):
    timestamps: list[str]
    mask_pressure: list[float | None]
    pressure: list[float | None]
    epr_pressure: list[float | None]
    leak: list[float | None]
    resp_rate: list[float | None]
    tidal_vol: list[float | None]
    min_vent: list[float | None]
    snore: list[float | None]
    flow_lim: list[float | None]


class SpO2Response(BaseModel):
    timestamps: list[str]
    spo2: list[int | None]
    pulse: list[int | None]


class WaveformResponse(BaseModel):
    timestamps: list[str]
    flow: list[float | None]
    pressure: list[float | None]


class EventWindowResponse(BaseModel):
    event: EventRecord
    neighboring_events: list[EventRecord]
    metrics: MetricsResponse
    waveform: WaveformResponse


EquipmentType = Literal["cushion", "headgear", "tubing", "humidifier_chamber", "filter"]


class EquipmentResponse(BaseModel):
    id: str
    equipment_type: str
    start_date: date
    replacement_days: int | None
    mask_category: str | None
    brand: str | None
    model: str | None
    notes: str | None
    days_in_use: int | None  # computed relative to a reference date when present
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class EquipmentCreate(BaseModel):
    equipment_type: EquipmentType
    start_date: date
    replacement_days: int | None = None
    mask_category: str | None = None
    brand: str | None = None
    model: str | None = None
    notes: str | None = None


class EquipmentUpdate(BaseModel):
    start_date: date | None = None
    replacement_days: int | None = None
    mask_category: str | None = None
    brand: str | None = None
    model: str | None = None
    notes: str | None = None


class InferredEquipment(BaseModel):
    cushion: EquipmentResponse | None = None
    headgear: EquipmentResponse | None = None
    tubing: EquipmentResponse | None = None
    humidifier_chamber: EquipmentResponse | None = None
    filter: EquipmentResponse | None = None


class DailyStat(BaseModel):
    folder_date: date
    ahi: float | None
    duration_hours: float
    session_id: str


class OverviewDailyStat(BaseModel):
    folder_date: date
    session_id: str
    ahi: float | None
    central_apnea_index: float | None
    obstructive_apnea_index: float | None
    hypopnea_index: float | None
    apnea_index: float | None
    arousal_index: float | None
    usage_hours: float
    session_start_hour: float | None
    session_end_hour: float | None
    avg_pressure: float | None
    p95_pressure: float | None
    avg_leak: float | None
    large_leak_minutes: float | None
    avg_flow_lim: float | None
    avg_tidal_vol: float | None
    avg_min_vent: float | None
    avg_resp_rate: float | None
    min_spo2: float | None
    avg_spo2: float | None
    avg_pulse: float | None
    equipment_age_days: int | None


class SummaryStats(BaseModel):
    total_nights: int
    nights_with_data: int
    compliance_pct: float
    avg_ahi: float | None
    avg_pressure: float | None
    ahi_trend: list[DailyStat]
    event_breakdown: dict


class OverviewStats(BaseModel):
    nights: list[OverviewDailyStat]


class AdherenceNightlyStat(BaseModel):
    date: str
    usage_hours: float
    status: int  # 0=None, 2=Borderline, 3=Full — matches AdherenceStatus IntEnum
    ahi: float | None = None
    avg_leak: float | None = None


class AdherenceWindowStat(BaseModel):
    start_date: str
    end_date: str
    total_nights: int
    compliant_nights: int
    adherence_pct: float
    avg_hours: float
    passes: bool


class AdherenceStats(BaseModel):
    overall: AdherenceWindowStat
    best_window: AdherenceWindowStat | None = None
    nightly: list[AdherenceNightlyStat]
    rolling_adherence: list[dict]
    streak_longest: int
    streak_current: int
    usage_threshold_hours: float
    borderline_threshold_hours: float | None = None
    target_adherence_pct: float
