import re
from collections import defaultdict
from datetime import date, datetime
from io import BytesIO
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

import matplotlib
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlalchemy import text
from sqlalchemy.orm import Session

from ..auth import get_current_user
from ..database import get_db
from ..models import (
    EquipmentResponse,
    EventRecord,
    EventWindowResponse,
    InferredEquipment,
    MetricsResponse,
    SessionDetail,
    SessionSummary,
    SpO2Response,
    TagInsight,
    WaveformResponse,
)
from ..therapy_score import compute_therapy_score

matplotlib.use("Agg")
from matplotlib import pyplot as plt  # noqa: E402
from reportlab.lib import colors  # noqa: E402
from reportlab.lib.enums import TA_CENTER  # noqa: E402
from reportlab.lib.pagesizes import letter  # noqa: E402
from reportlab.lib.styles import ParagraphStyle  # noqa: E402
from reportlab.lib.units import inch  # noqa: E402
from reportlab.platypus import Image, Paragraph, SimpleDocTemplate, Spacer, Table  # noqa: E402

router = APIRouter()

DATE_PARAM_RE = re.compile(r"^\d{8}$")


class SessionTimezoneUpdate(BaseModel):
    machine_tz: str


class SessionNoteUpdate(BaseModel):
    note: str | None = None


def _parse_yyyymmdd(value: str, name: str) -> date:
    if not DATE_PARAM_RE.match(value):
        raise HTTPException(status_code=400, detail=f"{name} must use YYYYMMDD format")
    try:
        return datetime.strptime(value, "%Y%m%d").date()
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=f"{name} must be a valid calendar date in YYYYMMDD format") from exc


def _session_column_exists(db: Session, column_name: str) -> bool:
    return bool(db.execute(
        text("""
            SELECT EXISTS (
                SELECT 1
                FROM information_schema.columns
                WHERE table_name = 'sessions'
                  AND column_name = :column_name
            )
        """),
        {"column_name": column_name},
    ).scalar())


def _manufacturer_select_expression(db: Session) -> str:
    if _session_column_exists(db, "manufacturer"):
        return (
            "COALESCE("
            "(array_agg(s.manufacturer ORDER BY s.duration_seconds DESC) "
            "FILTER (WHERE s.manufacturer IS NOT NULL))[1], "
            "'Unknown'"
            ") AS manufacturer"
        )
    return "'Unknown'::text AS manufacturer"


def _format_date_range(start: date, end: date) -> str:
    start_month = start.strftime("%b")
    end_month = end.strftime("%b")
    if start == end:
        return f"{start_month} {start.day}, {start.year}"
    if start.year == end.year and start.month == end.month:
        return f"{start_month} {start.day} - {end.day}, {end.year}"
    if start.year == end.year:
        return f"{start_month} {start.day} - {end_month} {end.day}, {end.year}"
    return f"{start_month} {start.day}, {start.year} - {end_month} {end.day}, {end.year}"


def _format_metric(value, suffix: str = "") -> str:
    if value is None:
        return "Unavailable"
    return f"{float(value):.1f}{suffix}"


def _group_contiguous_dates(dates: list[date]) -> str:
    if not dates:
        return "Unavailable"
    ranges: list[str] = []
    start = previous = dates[0]
    for current in dates[1:]:
        if (current - previous).days == 1:
            previous = current
            continue
        ranges.append(_format_night_range(start, previous))
        start = previous = current
    ranges.append(_format_night_range(start, previous))
    return ", ".join(ranges)


def _format_night_range(start: date, end: date) -> str:
    if start == end:
        return start.isoformat()
    return f"{start.isoformat()} to {end.isoformat()}"


def _mask_device_serial(serial: str) -> str:
    value = serial.strip()
    if len(value) <= 5:
        return f"...{value}"
    return f"...{value[-5:]}"


def _build_ahi_chart(nights: list[dict]) -> BytesIO:
    chart_buffer = BytesIO()
    chart_nights = nights[-30:]
    labels = [night["folder_date"].strftime("%m/%d") for night in chart_nights]
    values = [float(night["ahi"]) if night["ahi"] is not None else None for night in chart_nights]

    fig, ax = plt.subplots(figsize=(6.9, 2.0), dpi=160)
    x_values = list(range(len(labels)))
    ax.plot(x_values, values, color="#4f46a5", linewidth=1.4, marker="o", markersize=3)
    ax.axhline(5, color="#9ca3af", linewidth=0.8, linestyle="--")
    ax.text(0.99, 5.15, "Controlled threshold", color="#6b7280", fontsize=7, ha="right", va="bottom", transform=ax.get_yaxis_transform())
    ax.set_ylim(bottom=0)
    if values and all(value is not None for value in values):
        max_value = max(max(values), 5)
        ax.set_ylim(0, max_value * 1.18 if max_value > 0 else 6)
    else:
        ax.set_ylim(0, 6)
    ax.set_title("30-Day AHI Trend", fontsize=9, fontweight="bold", color="#1f2937", pad=8)
    ax.set_ylabel("AHI", fontsize=8)
    ax.grid(True, axis="y", color="#e5e7eb", linewidth=0.55)
    ax.tick_params(axis="both", labelsize=7, colors="#4b5563")
    for spine in ("top", "right"):
        ax.spines[spine].set_visible(False)
    ax.spines["left"].set_color("#d1d5db")
    ax.spines["bottom"].set_color("#d1d5db")
    if labels:
        tick_step = 1 if len(labels) <= 10 else 3 if len(labels) <= 21 else 5
        tick_indexes = list(range(0, len(labels), tick_step))
        if tick_indexes[-1] != len(labels) - 1:
            tick_indexes.append(len(labels) - 1)
        ax.set_xticks(tick_indexes)
        ax.set_xticklabels([labels[index] for index in tick_indexes], rotation=20, ha="right")
    fig.tight_layout()
    fig.savefig(chart_buffer, format="png", bbox_inches="tight")
    plt.close(fig)
    chart_buffer.seek(0)
    return chart_buffer


def _footer(canvas, _doc):
    canvas.saveState()
    width, height = letter
    canvas.setFillColor(colors.HexColor("#4f46a5"))
    canvas.rect(0, height - 0.12 * inch, width, 0.12 * inch, stroke=0, fill=1)
    canvas.setStrokeColor(colors.HexColor("#e5e7eb"))
    canvas.setLineWidth(0.5)
    canvas.line(0.45 * inch, 0.48 * inch, width - 0.45 * inch, 0.48 * inch)
    canvas.setFillColor(colors.HexColor("#6b7280"))
    canvas.setFont("Helvetica", 7)
    canvas.drawString(0.45 * inch, 0.28 * inch, f"SleepLab - Page {canvas.getPageNumber()}")
    canvas.restoreState()


def _build_pdf_report(_start_raw: str, _end_raw: str, start: date, end: date, nights: list[dict]) -> BytesIO:
    buffer = BytesIO()
    title_style = ParagraphStyle(
        "ReportTitle",
        alignment=TA_CENTER,
        fontName="Helvetica-Bold",
        fontSize=18,
        leading=22,
        textColor=colors.HexColor("#1f2937"),
    )
    subtitle_style = ParagraphStyle(
        "ReportSubtitle",
        alignment=TA_CENTER,
        fontName="Helvetica",
        fontSize=9,
        leading=12,
        textColor=colors.HexColor("#6b7280"),
    )
    body_style = ParagraphStyle(
        "ReportBody",
        fontName="Helvetica",
        fontSize=8,
        leading=10.5,
        textColor=colors.HexColor("#4b5563"),
    )
    section_style = ParagraphStyle(
        "Section",
        fontName="Helvetica-Bold",
        fontSize=10,
        leading=12,
        textColor=colors.HexColor("#1f2937"),
        spaceBefore=9,
        spaceAfter=5,
    )
    note_style = ParagraphStyle(
        "Note",
        parent=body_style,
        fontSize=7.5,
        leading=9.5,
        textColor=colors.HexColor("#6b7280"),
    )

    doc = SimpleDocTemplate(
        buffer,
        pagesize=letter,
        leftMargin=0.45 * inch,
        rightMargin=0.45 * inch,
        topMargin=0.42 * inch,
        bottomMargin=0.58 * inch,
        pageCompression=0,
    )

    total_nights = (end - start).days + 1
    nights_used = len(nights)
    compliance_pct = round((nights_used / total_nights) * 100, 1) if total_nights > 0 else 0.0

    avg_pressures = [float(night["avg_pressure"]) for night in nights if night["avg_pressure"] is not None]
    p95_pressures = [float(night["p95_pressure"]) for night in nights if night["p95_pressure"] is not None]
    leaks = [float(night["avg_leak"]) for night in nights if night["avg_leak"] is not None]
    avg_pressure = sum(avg_pressures) / len(avg_pressures) if avg_pressures else None
    p95_pressure = sum(p95_pressures) / len(p95_pressures) if p95_pressures else None
    avg_leak = sum(leaks) / len(leaks) if leaks else None

    manufacturers: dict[str, list[date]] = defaultdict(list)
    device_serials = set()
    therapy_modes = set()
    mask_types = set()
    for night in nights:
        manufacturers[night["manufacturer"] or "Unknown"].append(night["folder_date"])
        if night["device_serial"]:
            device_serials.add(night["device_serial"])
        if night["therapy_mode"]:
            therapy_modes.add(night["therapy_mode"])
        if night["mask_type"]:
            mask_types.add(night["mask_type"])

    known_manufacturers = {
        manufacturer: dates
        for manufacturer, dates in manufacturers.items()
        if manufacturer and manufacturer != "Unknown"
    }
    if not known_manufacturers:
        manufacturer_summary = None
    elif len(known_manufacturers) == 1:
        manufacturer_summary = next(iter(known_manufacturers))
    else:
        manufacturer_summary = "; ".join(
            f"{manufacturer} - {_group_contiguous_dates(sorted(dates))}"
            for manufacturer, dates in sorted(known_manufacturers.items())
        )

    equipment_candidates = [
        ("Manufacturer", manufacturer_summary),
        ("Device serial / identifier", ", ".join(_mask_device_serial(serial) for serial in sorted(device_serials)) or None),
        ("Therapy mode", ", ".join(sorted(therapy_modes)) or None),
        ("Mask", ", ".join(sorted(mask_types)) or None),
    ]
    equipment_rows = [[label, value] for label, value in equipment_candidates if value]
    missing_equipment_count = 1 + sum(1 for _label, value in equipment_candidates if not value)
    missing_equipment_details = missing_equipment_count > 1

    summary_rows = [
        ["Compliance", f"{compliance_pct:.1f}% ({nights_used}/{total_nights} nights)"],
        ["Total nights recorded", str(nights_used)],
        ["Average pressure", _format_metric(avg_pressure, " cmH2O")],
        ["P95 pressure", _format_metric(p95_pressure, " cmH2O")],
        ["Average leak", _format_metric(avg_leak * 1000 if avg_leak is not None else None, " mL/s")],
    ]

    story = [
        Paragraph("SleepLab Therapy Report", title_style),
        Paragraph(_format_date_range(start, end), subtitle_style),
        Spacer(1, 0.1 * inch),
        Image(_build_ahi_chart(nights), width=7.0 * inch, height=2.05 * inch),
        Paragraph("Summary", section_style),
        Table(summary_rows, colWidths=[2.05 * inch, 4.95 * inch], style=[
            ("FONTNAME", (0, 0), (0, -1), "Helvetica"),
            ("TEXTCOLOR", (0, 0), (0, -1), colors.HexColor("#4b5563")),
            ("TEXTCOLOR", (1, 0), (1, -1), colors.HexColor("#111827")),
            ("FONTSIZE", (0, 0), (-1, -1), 8.2),
            ("LEADING", (0, 0), (-1, -1), 10),
            ("LINEBELOW", (0, 0), (-1, -2), 0.25, colors.HexColor("#e5e7eb")),
            ("BACKGROUND", (0, 0), (0, -1), colors.HexColor("#f5f7fa")),
            ("VALIGN", (0, 0), (-1, -1), "TOP"),
            ("LEFTPADDING", (0, 0), (-1, -1), 6),
            ("RIGHTPADDING", (0, 0), (-1, -1), 6),
            ("TOPPADDING", (0, 0), (-1, -1), 4),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
        ]),
        Paragraph("Equipment", section_style),
    ]

    if equipment_rows:
        story.append(Table(equipment_rows, colWidths=[2.05 * inch, 4.95 * inch], style=[
            ("FONTNAME", (0, 0), (0, -1), "Helvetica"),
            ("TEXTCOLOR", (0, 0), (0, -1), colors.HexColor("#4b5563")),
            ("TEXTCOLOR", (1, 0), (1, -1), colors.HexColor("#111827")),
            ("FONTSIZE", (0, 0), (-1, -1), 8.0),
            ("LEADING", (0, 0), (-1, -1), 9.5),
            ("LINEBELOW", (0, 0), (-1, -2), 0.25, colors.HexColor("#e5e7eb")),
            ("BACKGROUND", (0, 0), (0, -1), colors.HexColor("#f5f7fa")),
            ("VALIGN", (0, 0), (-1, -1), "TOP"),
            ("LEFTPADDING", (0, 0), (-1, -1), 6),
            ("RIGHTPADDING", (0, 0), (-1, -1), 6),
            ("TOPPADDING", (0, 0), (-1, -1), 4),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
        ]))
    notes = [
        "AHI is calculated from recorded apnea and hypopnea events over recorded therapy hours.",
        "Leak values follow SleepLab's existing session display convention.",
    ]
    if missing_equipment_details:
        notes.append("Some equipment details were not available for this device.")
    if nights_used < 7:
        notes.append("This report includes fewer than 7 nights of data and may not be representative.")

    story.extend([
        Spacer(1, 0.12 * inch),
        Table([[""]], colWidths=[7.0 * inch], style=[
            ("LINEABOVE", (0, 0), (-1, -1), 0.5, colors.HexColor("#e5e7eb")),
            ("TOPPADDING", (0, 0), (-1, -1), 4),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
        ]),
        *[Paragraph(note, note_style) for note in notes],
    ])

    doc.build(story, onFirstPage=_footer, onLaterPages=_footer)
    buffer.seek(0)
    return buffer


@router.get("/export/pdf")
def export_sessions_pdf(
    from_: str = Query(..., alias="from"),
    to: str = Query(...),
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    start = _parse_yyyymmdd(from_, "from")
    end = _parse_yyyymmdd(to, "to")
    if end < start:
        raise HTTPException(status_code=400, detail="to must be on or after from")

    manufacturer_select = _manufacturer_select_expression(db)

    rows = db.execute(
        text(f"""
            WITH night AS (
                SELECT
                    s.folder_date,
                    SUM(s.duration_seconds) AS duration_seconds,
                    SUM(s.total_ahi_events) AS total_ahi_events,
                    AVG(s.avg_pressure) AS avg_pressure,
                    MAX(s.p95_pressure) AS p95_pressure,
                    AVG(s.avg_leak) AS avg_leak,
                    (array_agg(s.device_serial ORDER BY s.duration_seconds DESC) FILTER (WHERE s.device_serial IS NOT NULL))[1] AS device_serial,
                    (array_agg(s.therapy_mode ORDER BY s.duration_seconds DESC) FILTER (WHERE s.therapy_mode IS NOT NULL))[1] AS therapy_mode,
                    (array_agg(s.mask_type ORDER BY s.duration_seconds DESC) FILTER (WHERE s.mask_type IS NOT NULL))[1] AS mask_type,
                    {manufacturer_select}
                FROM sessions s
                WHERE s.user_id = CAST(:uid AS uuid)
                  AND s.folder_date >= :start
                  AND s.folder_date <= :end
                  AND s.duration_seconds >= 600
                GROUP BY s.folder_date
            )
            SELECT
                folder_date,
                duration_seconds,
                CASE
                    WHEN duration_seconds > 0
                    THEN ROUND((total_ahi_events / (duration_seconds / 3600.0))::numeric, 2)
                    ELSE NULL
                END AS ahi,
                ROUND(avg_pressure::numeric, 2) AS avg_pressure,
                ROUND(p95_pressure::numeric, 2) AS p95_pressure,
                ROUND(avg_leak::numeric, 4) AS avg_leak,
                device_serial,
                therapy_mode,
                mask_type,
                manufacturer
            FROM night
            ORDER BY folder_date
        """),
        {"uid": current_user["id"], "start": start, "end": end},
    ).mappings().all()

    pdf = _build_pdf_report(from_, to, start, end, [dict(row) for row in rows])
    filename = f"sleeplab-report-{from_}-{to}.pdf"
    return StreamingResponse(
        pdf,
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )


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


@router.get("/", response_model=list[SessionSummary])
def list_sessions(
    page: int = Query(1, ge=1),
    per_page: int = Query(30, ge=1, le=600),
    date_from: date | None = None,
    date_to: date | None = None,
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


@router.get("/tag-insights", response_model=list[TagInsight])
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
                NULL AS manufacturer,
                TRUE AS parser_validated,
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
    return _session_detail_response(row, current_user["id"], db)


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


def _f(val) -> float | None:
    """Convert Decimal to float for JSON serialization."""
    return float(val) if val is not None else None


def _reinterpret_with_timezone(value, old_zone: ZoneInfo, new_zone: ZoneInfo):
    wall_time = value.astimezone(old_zone).replace(tzinfo=None)
    return wall_time.replace(tzinfo=new_zone)


def _session_detail_response(row, user_id: str, db: Session) -> SessionDetail:
    data = dict(row)
    therapy_score = compute_therapy_score(data)
    data["therapy_score"] = therapy_score
    data["score_vs_30d_avg"] = _score_vs_30d_avg(
        user_id=user_id,
        folder_date=data["folder_date"],
        current_score=therapy_score.total,
        db=db,
    )
    data.pop("manufacturer", None)
    data.pop("parser_validated", None)
    return SessionDetail.model_validate(data)


def _score_vs_30d_avg(user_id: str, folder_date: date, current_score: int, db: Session) -> float | None:
    rows = db.execute(
        text("""
            SELECT
                folder_date,
                SUM(duration_seconds) AS duration_seconds,
                SUM(total_ahi_events) AS total_ahi_events,
                AVG(avg_leak) AS avg_leak,
                BOOL_OR(has_spo2) AS has_spo2,
                CASE WHEN SUM(duration_seconds) > 0
                     THEN ROUND((SUM(total_ahi_events) / (SUM(duration_seconds) / 3600.0))::numeric, 2)
                     ELSE NULL END AS ahi,
                AVG(avg_spo2) AS avg_spo2,
                MIN(min_spo2) AS min_spo2,
                NULL AS manufacturer,
                TRUE AS parser_validated
            FROM sessions
            WHERE user_id = CAST(:uid AS uuid)
              AND duration_seconds >= 600
              AND folder_date >= CAST(:folder_date AS date) - INTERVAL '30 days'
              AND folder_date < CAST(:folder_date AS date)
            GROUP BY folder_date
            ORDER BY folder_date
        """),
        {"uid": user_id, "folder_date": folder_date},
    ).mappings().all()
    if not rows:
        return None

    scores = [compute_therapy_score(dict(row)).total for row in rows]
    if not scores:
        return None
    average = sum(scores) / len(scores)
    return round(current_score - average, 1)


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
                ), ARRAY[]::text[]) AS tags,
                NULL AS manufacturer,
                TRUE AS parser_validated
            FROM sessions s
            JOIN night n ON s.folder_date = n.folder_date AND s.user_id = n.user_id
            WHERE s.duration_seconds >= 600
            GROUP BY s.folder_date
        """),
        {"date": folder_date, "uid": current_user["id"]},
    ).mappings().first()
    if not row:
        raise HTTPException(status_code=404, detail="No session found for this date")
    return _session_detail_response(row, current_user["id"], db)
