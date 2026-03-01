import json
import os
from datetime import date, timedelta
from typing import Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from openai import OpenAI
from pydantic import BaseModel
from sqlalchemy import text
from sqlalchemy.orm import Session

from ..auth import get_current_user
from ..database import get_db

router = APIRouter()

SYSTEM_PROMPT = (
    "You are a helpful sleep therapy assistant. The user has an APAP "
    "(automatic positive airway pressure) machine and you are reviewing "
    "their therapy data. Return valid JSON only. The JSON must contain these keys: "
    "insights, going_well, whats_not, recommended_changes, disclaimer. "
    "`insights` must be exactly two sentences in direct, conversational plain English for a non-expert. "
    "It must focus on the most recent use if there is one, explain what it likely means for their sleep or expected outcome, "
    "and if there has been no recent use it must say that clearly and explain why that matters. "
    "Avoid jargon where possible, and if you use a term like AHI or leak, explain it in simple words in the same sentence. "
    "`going_well`, `whats_not`, and `recommended_changes` must each be arrays of 2 to 4 short bullet strings. "
    "Each item in `recommended_changes` must be specific and practical. When the data supports it, explicitly name the setting to review, "
    "such as minimum pressure, maximum pressure, EPR, ramp, humidity, or mask fit, and state the direction to discuss, like raise, lower, shorten, turn on, or check. "
    "If the data does not support a settings change, say that clearly instead of guessing. Be encouraging but honest. Do not diagnose or replace medical advice."
)


class AISummaryResponse(BaseModel):
    insights: Optional[str] = None
    going_well: Optional[List[str]] = None
    whats_not: Optional[List[str]] = None
    recommended_changes: Optional[List[str]] = None
    disclaimer: Optional[str] = None
    error: Optional[str] = None


@router.get("/ai-summary", response_model=AISummaryResponse)
def get_ai_summary(
    days: int = Query(30, ge=1, le=365),
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    api_key = os.environ.get("OPENAI_API_KEY")
    if not api_key:
        return AISummaryResponse(error="OpenAI API key not configured")

    start_date = date.today() - timedelta(days=days - 1)
    row = db.execute(
        text(
            """
            WITH primary_blocks AS (
                SELECT DISTINCT ON (folder_date)
                    folder_date,
                    ahi,
                    avg_pressure,
                    avg_leak,
                    central_apnea_count,
                    obstructive_apnea_count,
                    hypopnea_count,
                    apnea_count,
                    duration_seconds
                FROM sessions
                WHERE user_id = CAST(:uid AS uuid)
                  AND folder_date >= :start_date
                ORDER BY folder_date, duration_seconds DESC
            )
            SELECT
                COUNT(*) AS nights,
                AVG(ahi) AS avg_ahi,
                MIN(ahi) AS min_ahi,
                MAX(ahi) AS max_ahi,
                COALESCE(SUM(central_apnea_count), 0) AS ca,
                COALESCE(SUM(obstructive_apnea_count), 0) AS oa,
                COALESCE(SUM(hypopnea_count), 0) AS h,
                COALESCE(SUM(apnea_count), 0) AS apnea,
                AVG(avg_pressure) AS avg_pressure,
                AVG(avg_leak) AS avg_leak,
                COALESCE(SUM(CASE WHEN ahi < 5 THEN 1 ELSE 0 END), 0) AS nights_normal,
                COALESCE(SUM(CASE WHEN ahi >= 5 AND ahi < 15 THEN 1 ELSE 0 END), 0) AS nights_mild,
                COALESCE(SUM(CASE WHEN ahi >= 15 AND ahi < 30 THEN 1 ELSE 0 END), 0) AS nights_moderate,
                COALESCE(SUM(CASE WHEN ahi >= 30 THEN 1 ELSE 0 END), 0) AS nights_severe
            FROM primary_blocks
            """
        ),
        {"uid": current_user["id"], "start_date": start_date},
    ).mappings().first()

    nights = int(row["nights"] or 0)
    compliance_pct = round((nights / days) * 100, 1) if days > 0 else 0.0

    stats_payload = {
        "days": days,
        "nights": nights,
        "total_possible": days,
        "compliance_pct": compliance_pct,
        "avg_ahi": _fmt_float(row["avg_ahi"]),
        "min_ahi": _fmt_float(row["min_ahi"]),
        "max_ahi": _fmt_float(row["max_ahi"]),
        "ca": int(row["ca"] or 0),
        "oa": int(row["oa"] or 0),
        "h": int(row["h"] or 0),
        "apnea": int(row["apnea"] or 0),
        "avg_pressure": _fmt_float(row["avg_pressure"]),
        "avg_leak": _fmt_float(row["avg_leak"]),
        "nights_normal": int(row["nights_normal"] or 0),
        "nights_mild": int(row["nights_mild"] or 0),
        "nights_moderate": int(row["nights_moderate"] or 0),
        "nights_severe": int(row["nights_severe"] or 0),
    }

    latest_row = db.execute(
        text(
            """
            SELECT
                folder_date,
                ahi,
                avg_pressure,
                avg_leak,
                central_apnea_count,
                obstructive_apnea_count,
                hypopnea_count,
                apnea_count,
                duration_seconds
            FROM sessions
            WHERE user_id = CAST(:uid AS uuid)
            ORDER BY folder_date DESC, duration_seconds DESC
            LIMIT 1
            """
        ),
        {"uid": current_user["id"]},
    ).mappings().first()
    latest_days_ago = (date.today() - latest_row["folder_date"]).days if latest_row else None

    user_prompt = (
        f"Here is the sleep therapy data for the last {days} days:\n"
        f"- Nights with data: {stats_payload['nights']} / {stats_payload['total_possible']}\n"
        f"- Compliance: {stats_payload['compliance_pct']}%\n"
        f"- Average AHI: {stats_payload['avg_ahi']} events/hour\n"
        f"- AHI range: {stats_payload['min_ahi']} - {stats_payload['max_ahi']}\n"
        f"- Event breakdown: {stats_payload['ca']} central apneas, {stats_payload['oa']} obstructive apneas, "
        f"{stats_payload['h']} hypopneas, {stats_payload['apnea']} unclassified apneas\n"
        f"- Average pressure: {stats_payload['avg_pressure']} cmH2O\n"
        f"- Average leak rate: {stats_payload['avg_leak']} L/min\n"
        f"- Nights with AHI < 5 (normal): {stats_payload['nights_normal']}\n"
        f"- Nights with AHI 5-15 (mild): {stats_payload['nights_mild']}\n"
        f"- Nights with AHI 15-30 (moderate): {stats_payload['nights_moderate']}\n"
        f"- Nights with AHI >= 30 (severe): {stats_payload['nights_severe']}\n"
        f"- Most recent reading date: {latest_row['folder_date'] if latest_row else 'n/a'}\n"
        f"- Days since most recent reading: {latest_days_ago if latest_days_ago is not None else 'n/a'}\n"
        f"- Most recent reading AHI: {_fmt_float(latest_row['ahi']) if latest_row else 'n/a'}\n"
        f"- Most recent reading average pressure: {_fmt_float(latest_row['avg_pressure']) if latest_row else 'n/a'}\n"
        f"- Most recent reading average leak: {_fmt_float(latest_row['avg_leak']) if latest_row else 'n/a'}\n"
        f"- Most recent reading event counts: "
        f"{int(latest_row['central_apnea_count'] or 0) if latest_row else 0} central, "
        f"{int(latest_row['obstructive_apnea_count'] or 0) if latest_row else 0} obstructive, "
        f"{int(latest_row['hypopnea_count'] or 0) if latest_row else 0} hypopnea, "
        f"{int(latest_row['apnea_count'] or 0) if latest_row else 0} unclassified\n\n"
        "If the most recent reading is more than 7 days old, treat that as no recent use and say so clearly.\n"
        "The disclaimer must clearly say this is AI guidance and the user should still speak with their doctor, sleep specialist, or GP before making important treatment changes."
    )

    try:
        client = OpenAI(api_key=api_key)
        response = client.responses.create(
            model="gpt-4o",
            input=[
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": user_prompt},
            ],
        )
        payload = _parse_ai_payload((response.output_text or "").strip())
        return AISummaryResponse(
            insights=payload.get("insights"),
            going_well=_ensure_list(payload.get("going_well")),
            whats_not=_ensure_list(payload.get("whats_not")),
            recommended_changes=_ensure_list(payload.get("recommended_changes")),
            disclaimer=payload.get("disclaimer"),
        )
    except Exception as exc:
        return AISummaryResponse(error=f"AI summary unavailable: {exc}")


def _fmt_float(value: object) -> str:
    if value is None:
        return "n/a"
    return f"{float(value):.2f}"


def _parse_ai_payload(raw_text: str) -> Dict:
    cleaned = raw_text.strip()
    if cleaned.startswith("```"):
        lines = cleaned.splitlines()
        if lines and lines[0].startswith("```"):
            lines = lines[1:]
        if lines and lines[-1].startswith("```"):
            lines = lines[:-1]
        cleaned = "\n".join(lines).strip()
        if cleaned.lower().startswith("json"):
            cleaned = cleaned[4:].strip()

    try:
        return json.loads(cleaned)
    except json.JSONDecodeError:
        start = cleaned.find("{")
        end = cleaned.rfind("}")
        if start == -1 or end == -1 or end <= start:
            raise
        return json.loads(cleaned[start:end + 1])


def _ensure_list(value: object) -> List[str]:
    if value is None:
        return []
    if isinstance(value, list):
        return [str(item).strip() for item in value if str(item).strip()]
    if isinstance(value, str):
        return [value.strip()] if value.strip() else []
    return [str(value).strip()]


SESSION_AI_SYSTEM_PROMPT = (
    "You are a helpful sleep therapy assistant reviewing a single night of CPAP therapy data. "
    "Return valid JSON only with these keys: headline, observations, recommendations, flag. "
    "`headline` must be exactly one sentence in plain, non-medical English that describes the most notable aspect of this night. "
    "Start with words like 'Good night', 'Rough night', 'Solid session', etc. based on the data. "
    "`observations` must be an array of 2-4 short strings, each explaining one data point in plain English. "
    "Where relevant, note if a value is above or below the typical target. "
    "`recommendations` must be an array of 1-3 short, practical strings. "
    "Each recommendation must be specific and actionable — if the data supports it, name the setting to review "
    "(e.g. minimum pressure, EPR, mask fit, humidity) and state what direction to discuss with their care team. "
    "If no changes are warranted, return a single item such as 'Keep doing what you are doing — this session looks well-controlled.' "
    "`flag` must be one of: 'good', 'watch', 'alert'. "
    "Use 'good' when AHI < 5 and no obvious issues. "
    "Use 'watch' when AHI is 5-15 or there are moderate leak concerns. "
    "Use 'alert' when AHI >= 15 or there are severe leaks. "
    "Do not diagnose. Do not replace medical advice."
)


class SessionAISummaryResponse(BaseModel):
    headline: Optional[str] = None
    observations: Optional[List[str]] = None
    recommendations: Optional[List[str]] = None
    flag: Optional[str] = None
    error: Optional[str] = None


@router.get("/sessions/{session_id}/ai-summary", response_model=SessionAISummaryResponse)
def get_session_ai_summary(
    session_id: str,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    api_key = os.environ.get("OPENAI_API_KEY")
    if not api_key:
        return SessionAISummaryResponse(error="OpenAI API key not configured")

    row = db.execute(
        text(
            "SELECT id::text AS id, folder_date, ahi, total_ahi_events, "
            "central_apnea_count, obstructive_apnea_count, hypopnea_count, apnea_count, "
            "avg_pressure, p95_pressure, avg_leak, avg_resp_rate, avg_tidal_vol, "
            "avg_spo2, min_spo2, duration_seconds "
            "FROM sessions WHERE id = CAST(:id AS uuid) AND user_id = CAST(:uid AS uuid)"
        ),
        {"id": session_id, "uid": current_user["id"]},
    ).mappings().first()

    if not row:
        raise HTTPException(status_code=404, detail="Session not found")

    hours = int(row["duration_seconds"] or 0) // 3600
    mins = (int(row["duration_seconds"] or 0) % 3600) // 60
    leak_mlps = round(float(row["avg_leak"]) * 1000, 1) if row["avg_leak"] is not None else None

    user_prompt = (
        f"Session date: {row['folder_date']}\n"
        f"Duration: {hours}h {mins}m\n"
        f"AHI: {_fmt_float(row['ahi'])} events/hour\n"
        f"Total events: {row['total_ahi_events']} "
        f"(CA {row['central_apnea_count']}, OA {row['obstructive_apnea_count']}, "
        f"H {row['hypopnea_count']}, unclassified {row['apnea_count']})\n"
        f"Average pressure: {_fmt_float(row['avg_pressure'])} cmH2O\n"
        f"95th percentile pressure: {_fmt_float(row['p95_pressure'])} cmH2O\n"
        f"Average leak: {f'{leak_mlps} mL/s' if leak_mlps is not None else 'n/a'}\n"
        f"Average respiratory rate: {_fmt_float(row['avg_resp_rate'])} breaths/min\n"
        f"Average tidal volume: {_fmt_float(row['avg_tidal_vol'])} L\n"
        f"Average SpO2: {_fmt_float(row['avg_spo2'])}%\n"
        f"Minimum SpO2: {_fmt_float(row['min_spo2'])}%\n\n"
        "Typical targets: AHI < 5 is good control. Leak < 24 L/min (12 mL/s) is acceptable. "
        "SpO2 should ideally stay above 90%. "
        "Give a plain-English summary a patient can understand without medical training."
    )

    try:
        client = OpenAI(api_key=api_key)
        response = client.responses.create(
            model="gpt-4o",
            input=[
                {"role": "system", "content": SESSION_AI_SYSTEM_PROMPT},
                {"role": "user", "content": user_prompt},
            ],
        )
        payload = _parse_ai_payload((response.output_text or "").strip())
        return SessionAISummaryResponse(
            headline=payload.get("headline"),
            observations=_ensure_list(payload.get("observations")),
            recommendations=_ensure_list(payload.get("recommendations")),
            flag=payload.get("flag", "watch"),
        )
    except Exception as exc:
        return SessionAISummaryResponse(error=f"AI summary unavailable: {exc}")


TREND_AI_SYSTEM_PROMPT = (
    "You are a helpful sleep therapy assistant reviewing a patient's AHI trend data over multiple nights. "
    "Return valid JSON only with these keys: headline, anomalies, trend_direction, flag. "
    "`headline` must be one sentence summarising the overall trend pattern in plain English. "
    "`anomalies` must be an array of 1-3 strings, each describing a notable pattern or change detected. "
    "If no anomalies exist, return an array with one string like 'No major changes detected recently.' "
    "`trend_direction` must be one of: 'improving', 'stable', 'worsening', 'variable'. "
    "`flag` must be one of: 'good', 'watch', 'alert'. "
    "Use 'good' when the trend is stable or improving and recent AHI averages are under 5. "
    "Use 'watch' when AHI is creeping up or variable. "
    "Use 'alert' when AHI has risen sharply or recent nights average above 15. "
    "Do not diagnose. Do not replace medical advice."
)


class TrendAISummaryResponse(BaseModel):
    headline: Optional[str] = None
    anomalies: Optional[List[str]] = None
    trend_direction: Optional[str] = None
    flag: Optional[str] = None
    error: Optional[str] = None


@router.get("/trend-ai", response_model=TrendAISummaryResponse)
def get_trend_ai_summary(
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    api_key = os.environ.get("OPENAI_API_KEY")
    if not api_key:
        return TrendAISummaryResponse(error="OpenAI API key not configured")

    rows = db.execute(
        text(
            """
            SELECT DISTINCT ON (folder_date)
                folder_date, ahi, duration_seconds
            FROM sessions
            WHERE user_id = CAST(:uid AS uuid)
            ORDER BY folder_date DESC, duration_seconds DESC
            LIMIT 30
            """
        ),
        {"uid": current_user["id"]},
    ).mappings().all()

    if not rows:
        return TrendAISummaryResponse(error="No session data available.")

    # Build a compact representation of the last 30 nights for the prompt
    nights_text = "\n".join(
        f"  {r['folder_date']}: AHI {_fmt_float(r['ahi'])}"
        for r in reversed(rows)
    )

    recent_7 = [r for r in rows[:7] if r["ahi"] is not None]
    prev_7 = [r for r in rows[7:14] if r["ahi"] is not None]
    avg_recent = round(sum(float(r["ahi"]) for r in recent_7) / len(recent_7), 2) if recent_7 else None
    avg_prev = round(sum(float(r["ahi"]) for r in prev_7) / len(prev_7), 2) if prev_7 else None

    user_prompt = (
        f"Last {len(rows)} nights of AHI data (oldest to newest):\n{nights_text}\n\n"
        f"Average AHI last 7 nights: {avg_recent if avg_recent is not None else 'n/a'}\n"
        f"Average AHI prior 7 nights: {avg_prev if avg_prev is not None else 'n/a'}\n\n"
        "Identify whether AHI is trending up, down, or staying stable. "
        "Flag if AHI has risen 3+ nights in a row, or if recent nights are significantly worse than the prior week. "
        "Be brief and plain. Do not diagnose."
    )

    try:
        client = OpenAI(api_key=api_key)
        response = client.responses.create(
            model="gpt-4o",
            input=[
                {"role": "system", "content": TREND_AI_SYSTEM_PROMPT},
                {"role": "user", "content": user_prompt},
            ],
        )
        payload = _parse_ai_payload((response.output_text or "").strip())
        return TrendAISummaryResponse(
            headline=payload.get("headline"),
            anomalies=_ensure_list(payload.get("anomalies")),
            trend_direction=payload.get("trend_direction", "stable"),
            flag=payload.get("flag", "watch"),
        )
    except Exception as exc:
        return TrendAISummaryResponse(error=f"AI summary unavailable: {exc}")
