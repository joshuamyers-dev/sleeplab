from datetime import date, datetime
from typing import Dict, List, Literal, Optional

from pydantic import BaseModel, Field, computed_field


class SessionSummary(BaseModel):
    """Pydantic model representing a high-level CPAP session summary.

    Attributes:
        id: The unique primary database ID string of the session.
        session_id: The unique operational session ID string.
        folder_date: The date this session was imported under.
        block_index: The block index sequence within the night.
        start_datetime: The naive or localized start timestamp of the session.
        duration_seconds: The total session duration in seconds.
        ahi: The calculated Apnea-Hypopnea Index (AHI) value.
        central_apnea_count: Count of central apnea events detected.
        obstructive_apnea_count: Count of obstructive apnea events detected.
        hypopnea_count: Count of hypopnea events detected.
        apnea_count: Total count of all apnea events.
        arousal_count: Optional count of arousal events.
        total_ahi_events: Total events contributing to AHI calculations.
        avg_pressure: The calculated average mask pressure.
        p95_pressure: The 95th percentile mask pressure.
        avg_leak: The calculated average air leak rate.
        has_spo2: True if pulse oximetry data is available, False otherwise.
        machine_tz: The CPAP machine's timezone string.
    """

    id: str
    session_id: str
    folder_date: date
    block_index: int
    start_datetime: datetime
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
        """Calculate the session duration in hours, rounded to 2 decimal places.

        Returns:
            The duration value in hours.
        """
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
    """Pydantic model representing detailed telemetry metrics of a CPAP session.

    Attributes:
        pld_start_datetime: The localized telemetry start datetime.
        device_serial: The serial number string of the CPAP device.
        therapy_score: The computed therapy quality score for the session.
        score_vs_30d_avg: Delta between this session's score and 30-day average.
        note: Optional user-supplied note for the session.
        tags: List of user-applied tags for the session.
        avg_resp_rate: The calculated average respiration rate.
        avg_tidal_vol: The calculated average tidal volume.
        avg_min_vent: The calculated average minute ventilation.
        avg_snore: The calculated average snore index.
        avg_flow_lim: The calculated average flow limitation.
        avg_spo2: The calculated average SpO2 percentage.
        min_spo2: The calculated minimum SpO2 percentage.
        therapy_mode: The active CPAP therapy mode string.
        mask_type: The configured CPAP mask type.
        humidity_level: The configured CPAP humidifier level.
        temperature_c: The configured heated tubing temperature.
    """

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
    """Pydantic model representing a single CPAP therapy event occurrence.

    Attributes:
        id: The unique primary database ID of the event record.
        event_type: The type label of the event (e.g. 'Apnea', 'Hypopnea').
        onset_seconds: The onset timestamp in seconds from session start.
        duration_seconds: The duration of the event in seconds, or None.
        event_datetime: The absolute localized datetime of the event.
    """

    id: int
    event_type: str
    onset_seconds: float
    duration_seconds: float | None
    event_datetime: datetime

    model_config = {"from_attributes": True}


class MetricsResponse(BaseModel):
    """Pydantic model representing time-series data vectors for session metrics.

    Attributes:
        timestamps: Lists of ISO-8601 formatted UTC timestamps.
        mask_pressure: Mask pressure data series.
        pressure: Therapeutic pressure data series.
        epr_pressure: Expiratory Pressure Relief (EPR) data series.
        leak: Mask leak rate data series.
        resp_rate: Respiration rate data series.
        tidal_vol: Tidal volume data series.
        min_vent: Minute ventilation data series.
        snore: Snore index data series.
        flow_lim: Flow limitation index data series.
    """

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
    """Pydantic model representing pulse oximetry time-series data.

    Attributes:
        timestamps: Lists of ISO-8601 formatted UTC timestamps.
        spo2: Oxygen saturation (SpO2) data series.
        pulse: Heart rate/pulse data series.
    """

    timestamps: list[str]
    spo2: list[int | None]
    pulse: list[int | None]


class WaveformResponse(BaseModel):
    """Pydantic model representing high-frequency therapeutic waveform data.

    Attributes:
        timestamps: Lists of ISO-8601 formatted UTC timestamps.
        flow: High-resolution flow waveform data series.
        pressure: High-resolution pressure waveform data series.
    """

    timestamps: list[str]
    flow: list[float | None]
    pressure: list[float | None]


class EventWindowResponse(BaseModel):
    """Pydantic model representing the timeline window surrounding an event.

    Attributes:
        event: The event record details under focus.
        neighboring_events: Surrounding event records within the window.
        metrics: Detailed metrics time-series within the window.
        waveform: Waveform flow/pressure details within the window.
    """

    event: EventRecord
    neighboring_events: list[EventRecord]
    metrics: MetricsResponse
    waveform: WaveformResponse


EquipmentType = Literal["cushion", "headgear", "tubing", "humidifier_chamber", "filter"]


class EquipmentResponse(BaseModel):
    """Pydantic model representing a CPAP accessory/equipment item response.

    Attributes:
        id: The unique primary database ID string of the equipment.
        equipment_type: The category type of CPAP accessory.
        start_date: The date this accessory was put into service.
        replacement_days: The recommended replacement interval in days.
        mask_category: Optional mask category type.
        brand: The manufacturer brand name.
        model: The item model name.
        notes: General description notes.
        days_in_use: Calculated count of service days relative to target date.
        created_at: Database record creation timestamp.
        updated_at: Database record update timestamp.
    """

    id: str
    equipment_type: str
    start_date: date
    replacement_days: int | None
    mask_category: str | None
    brand: str | None
    model: str | None
    notes: str | None
    days_in_use: int | None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class EquipmentCreate(BaseModel):
    """Pydantic model representing payload requirements to create equipment.

    Attributes:
        equipment_type: The category type of CPAP accessory.
        start_date: The service initiation date.
        replacement_days: The recommended replacement interval in days.
        mask_category: Optional mask category.
        brand: The manufacturer brand name.
        model: The item model name.
        notes: Description details.
    """

    equipment_type: EquipmentType
    start_date: date
    replacement_days: int | None = None
    mask_category: str | None = None
    brand: str | None = None
    model: str | None = None
    notes: str | None = None


class EquipmentUpdate(BaseModel):
    """Pydantic model representing payload updates to an equipment item.

    Attributes:
        start_date: The service initiation date.
        replacement_days: The recommended replacement interval in days.
        mask_category: Optional mask category.
        brand: The manufacturer brand name.
        model: The item model name.
        notes: Description details.
    """

    start_date: date | None = None
    replacement_days: int | None = None
    mask_category: str | None = None
    brand: str | None = None
    model: str | None = None
    notes: str | None = None


class InferredEquipment(BaseModel):
    """Pydantic model representing inferred equipment configurations.

    Attributes:
        cushion: Cushion accessory response details.
        headgear: Headgear accessory response details.
        tubing: Tubing accessory response details.
        humidifier_chamber: Humidifier chamber response details.
        filter: Air filter accessory response details.
    """

    cushion: EquipmentResponse | None = None
    headgear: EquipmentResponse | None = None
    tubing: EquipmentResponse | None = None
    humidifier_chamber: EquipmentResponse | None = None
    filter: EquipmentResponse | None = None


class DailyStat(BaseModel):
    """Pydantic model representing daily index telemetry metrics.

    Attributes:
        folder_date: The date this statistic represents.
        ahi: The Apnea-Hypopnea Index value for that night.
        duration_hours: Total therapy hours recorded.
        session_id: The unique operational session ID string.
    """

    folder_date: date
    ahi: float | None
    duration_hours: float
    session_id: str


class OverviewDailyStat(BaseModel):
    """Pydantic model representing overview metrics for a single night's session.

    Attributes:
        folder_date: The date representing the night's session.
        session_id: The unique session identifier.
        ahi: Apnea-Hypopnea Index.
        central_apnea_index: Calculated hourly central apnea events.
        obstructive_apnea_index: Calculated hourly obstructive apnea events.
        hypopnea_index: Calculated hourly hypopnea events.
        apnea_index: Calculated hourly total apnea events.
        arousal_index: Calculated hourly arousal events.
        usage_hours: Total therapy duration in hours.
        session_start_hour: Start time offset from midnight.
        session_end_hour: End time offset from midnight.
        avg_pressure: Average therapeutic mask pressure.
        p95_pressure: 95th percentile mask pressure.
        avg_leak: Average mask air leak rate.
        large_leak_minutes: Duration of large mask leaks in minutes.
        avg_flow_lim: Average flow limitation index.
        avg_tidal_vol: Average respiration tidal volume.
        avg_min_vent: Average minute ventilation.
        avg_resp_rate: Average respiration rate.
        min_spo2: Minimum SpO2 percentage recorded.
        avg_spo2: Average SpO2 percentage recorded.
        avg_pulse: Average pulse rate recorded.
        equipment_age_days: Age in days of active CPAP cushion.
    """

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
    """Pydantic model representing compliance and therapeutic stats aggregates.

    Attributes:
        total_nights: Total nights in query range.
        nights_with_data: Nights with recorded CPAP sessions.
        compliance_pct: Compliance rate percentage (duration >= 4 hours).
        avg_ahi: Average AHI calculated across data nights.
        avg_pressure: Average therapeutic pressure across data nights.
        ahi_trend: Time-series trend list of daily stats.
        event_breakdown: Grouped count mapping of individual event types.
    """

    total_nights: int
    nights_with_data: int
    compliance_pct: float
    avg_ahi: float | None
    avg_pressure: float | None
    ahi_trend: list[DailyStat]
    event_breakdown: dict


class OverviewStats(BaseModel):
    """Pydantic model representing grouped overview daily stats list.

    Attributes:
        nights: List of overview daily statistics records.
    """

    nights: list[OverviewDailyStat]
