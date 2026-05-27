import hashlib
import json
from collections.abc import Mapping
from datetime import date, timedelta
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import text
from sqlalchemy.orm import Session

from ..auth import get_current_user
from ..database import get_db
from ..llm_client import get_llm_client, get_model, get_provider, is_configured
from ..settings_store import get_llm_settings, has_explicit_llm_settings

router = APIRouter()

PROMPT_VERSION = "cpap-pattern-analysis-v1"

CPAP_ANALYST_SYSTEM_PROMPT = """
You are a CPAP therapy data analysis assistant. You help users understand PAP therapy data using OSCAR-style reasoning and practical pattern recognition.

You are not a physician and must not diagnose, prescribe, or tell the user to change treatment settings directly.

Your job is to:
- Explain therapy quality in plain English
- Identify meaningful patterns across pressure, leaks, events, flow limitation, oxygen data, and usage
- Separate high-confidence observations from uncertain possibilities
- Suggest conservative items the user may want to review, test, or discuss with a clinician
- Avoid generic sleep hygiene advice unless directly supported by the data
- Never invent data that is not present

Prioritize event clustering, leak impact, pressure behavior, flow limitation patterns, central vs obstructive balance, possible positional or REM-related patterns, therapy consistency over time, and missing data or uncertainty.

Return valid JSON only with these keys:
headline: one concise sentence
therapy_quality: one short paragraph
high_confidence_observations: array of 2-5 strings
possible_patterns: array of 1-4 strings
things_to_review: array of 1-4 conservative strings
missing_or_uncertain: array of 1-4 strings
flag: one of "good", "watch", "alert"

Use "things_to_review" for review or clinician discussion items, not direct instructions to change settings.
Avoid wording that says a setting "needs adjustment" or that the user should change a setting. Prefer "review whether..." or "discuss whether..." phrasing.
Do not mention advanced mode-specific settings such as backup rate, ASV, bilevel-ST, or trigger/cycle settings unless the supplied data explicitly shows that therapy mode or setting.
Do not assume APAP or auto-adjusting therapy. Use PAP/CPAP language unless the supplied data explicitly identifies an auto-adjusting mode.
""".strip()


class AISummaryResponse(BaseModel):
    headline: Optional[str] = None
    therapy_quality: Optional[str] = None
    high_confidence_observations: Optional[List[str]] = None
    possible_patterns: Optional[List[str]] = None
    things_to_review: Optional[List[str]] = None
    missing_or_uncertain: Optional[List[str]] = None
    flag: Optional[str] = None
    cached: bool = False
    insights: Optional[str] = None
    going_well: Optional[List[str]] = None
    whats_not: Optional[List[str]] = None
    recommended_changes: Optional[List[str]] = None
    disclaimer: Optional[str] = None
    error: Optional[str] = None


class SessionAISummaryResponse(BaseModel):
    headline: Optional[str] = None
    therapy_quality: Optional[str] = None
    high_confidence_observations: Optional[List[str]] = None
    possible_patterns: Optional[List[str]] = None
    things_to_review: Optional[List[str]] = None
    missing_or_uncertain: Optional[List[str]] = None
    observations: Optional[List[str]] = None
    recommendations: Optional[List[str]] = None
    flag: Optional[str] = None
    cached: bool = False
    error: Optional[str] = None


class TrendAISummaryResponse(BaseModel):
    headline: Optional[str] = None
    therapy_quality: Optional[str] = None
    high_confidence_observations: Optional[List[str]] = None
    possible_patterns: Optional[List[str]] = None
    things_to_review: Optional[List[str]] = None
    missing_or_uncertain: Optional[List[str]] = None
    anomalies: Optional[List[str]] = None
    trend_direction: Optional[str] = None
    flag: Optional[str] = None
    cached: bool = False
    error: Optional[str] = None


@router.get("/ai-summary", response_model=AISummaryResponse)
def get_ai_summary(
    days: int = Query(30, ge=1, le=365),
    force: bool = Query(False),
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    llm_settings = get_llm_settings(db, current_user["id"])
    if not has_explicit_llm_settings(db, current_user["id"]) or not is_configured(llm_settings):
        return AISummaryResponse(error="LLM backend not configured")

    context = _build_general_context(db, current_user["id"], days)
    return _cached_or_generated(
        db=db,
        user_id=current_user["id"],
        analysis_type="general",
        cache_key=f"days:{days}",
        context=context,
        force=force,
        response_model=AISummaryResponse,
        llm_settings=llm_settings,
        prompt=(
            "Analyze this multi-night PAP therapy summary. Focus on practical CPAP pattern recognition, "
            "not generic wellness advice. Mention absent data under missing_or_uncertain.\n\n"
            f"{_json_for_prompt(context)}"
        ),
        enrich=_enrich_general_payload,
    )


@router.get("/sessions/{session_id}/ai-summary", response_model=SessionAISummaryResponse)
def get_session_ai_summary(
    session_id: str,
    force: bool = Query(False),
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    llm_settings = get_llm_settings(db, current_user["id"])
    if not has_explicit_llm_settings(db, current_user["id"]) or not is_configured(llm_settings):
        return SessionAISummaryResponse(error="LLM backend not configured")

    context = _build_session_context(db, current_user["id"], session_id)
    if context is None:
        raise HTTPException(status_code=404, detail="Session not found")

    return _cached_or_generated(
        db=db,
        user_id=current_user["id"],
        analysis_type="session",
        cache_key=f"session:{session_id}",
        context=context,
        force=force,
        response_model=SessionAISummaryResponse,
        llm_settings=llm_settings,
        prompt=(
            "Analyze this single PAP therapy session. Look for event clustering, leak impact, pressure response, "
            "flow limitation, oxygen data if present, and central-vs-obstructive balance. Do not invent unavailable "
            "waveform interpretation.\n\n"
            f"{_json_for_prompt(context)}"
        ),
        enrich=_enrich_session_payload,
    )


@router.get("/trend-ai", response_model=TrendAISummaryResponse)
def get_trend_ai_summary(
    force: bool = Query(False),
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    llm_settings = get_llm_settings(db, current_user["id"])
    if not has_explicit_llm_settings(db, current_user["id"]) or not is_configured(llm_settings):
        return TrendAISummaryResponse(error="LLM backend not configured")

    context = _build_trend_context(db, current_user["id"])
    if not context["nights"]:
        return TrendAISummaryResponse(error="No session data available.")

    return _cached_or_generated(
        db=db,
        user_id=current_user["id"],
        analysis_type="trend",
        cache_key="last-30-primary-nights",
        context=context,
        force=force,
        response_model=TrendAISummaryResponse,
        llm_settings=llm_settings,
        prompt=(
            "Analyze this PAP therapy trend. Focus on whether the recent pattern is stable, improving, worsening, "
            "or variable, and explain what relationships between AHI, event type, pressure, leak, flow limitation, "
            "and usage are actually supported by the data.\n\n"
            f"{_json_for_prompt(context)}"
        ),
        enrich=_enrich_trend_payload,
    )


def _cached_or_generated(
    *,
    db: Session,
    user_id: str,
    analysis_type: str,
    cache_key: str,
    context: Dict[str, Any],
    force: bool,
    response_model: type[BaseModel],
    llm_settings: Mapping[str, str | None],
    prompt: str,
    enrich,
):
    settings_fp = _settings_fingerprint(llm_settings)
    input_fp = _fingerprint({"prompt_version": PROMPT_VERSION, "context": context})

    if not force:
        cached = _read_cache(db, user_id, analysis_type, cache_key, input_fp, settings_fp)
        if cached is not None:
            cached["cached"] = True
            return response_model.model_validate(cached)

    try:
        client = get_llm_client(llm_settings)
        response = client.chat.completions.create(
            model=get_model(llm_settings),
            messages=[
                {"role": "system", "content": CPAP_ANALYST_SYSTEM_PROMPT},
                {"role": "user", "content": prompt},
            ],
        )
        payload = _parse_ai_payload((response.choices[0].message.content or "").strip())
        payload = enrich(_normalize_structured_payload(payload))
        _write_cache(db, user_id, analysis_type, cache_key, input_fp, settings_fp, payload)
        return response_model.model_validate(payload)
    except Exception as exc:
        return response_model(error=f"AI summary unavailable: {exc}")


def _build_general_context(db: Session, user_id: str, days: int) -> Dict[str, Any]:
    start_date = date.today() - timedelta(days=days - 1)
    rows = db.execute(
        text(
            """
            SELECT DISTINCT ON (folder_date)
                id::text AS id, folder_date, duration_seconds, ahi, avg_pressure, p95_pressure,
                avg_leak, avg_flow_lim, central_apnea_count, obstructive_apnea_count,
                hypopnea_count, apnea_count, total_ahi_events, has_spo2, avg_spo2,
                min_spo2, updated_at
            FROM sessions
            WHERE user_id = CAST(:uid AS uuid)
              AND folder_date >= :start_date
              AND duration_seconds >= 600
            ORDER BY folder_date DESC, duration_seconds DESC
            """
        ),
        {"uid": user_id, "start_date": start_date},
    ).mappings().all()

    nights = [_night_dict(r) for r in rows]
    ahi_values = [n["ahi"] for n in nights if n["ahi"] is not None]
    pressure_values = [n["avg_pressure"] for n in nights if n["avg_pressure"] is not None]
    leak_values = [n["avg_leak_lpm"] for n in nights if n["avg_leak_lpm"] is not None]

    return {
        "analysis_window_days": days,
        "nights_with_data": len(nights),
        "possible_nights": days,
        "compliance_pct": round((len(nights) / days) * 100, 1) if days else 0,
        "latest_night": nights[0] if nights else None,
        "days_since_latest": (date.today() - rows[0]["folder_date"]).days if rows else None,
        "averages": {
            "ahi": _avg(ahi_values),
            "pressure_cm_h2o": _avg(pressure_values),
            "leak_lpm": _avg(leak_values),
        },
        "ahi_distribution": {
            "under_5": sum(1 for n in nights if n["ahi"] is not None and n["ahi"] < 5),
            "5_to_15": sum(1 for n in nights if n["ahi"] is not None and 5 <= n["ahi"] < 15),
            "15_to_30": sum(1 for n in nights if n["ahi"] is not None and 15 <= n["ahi"] < 30),
            "30_plus": sum(1 for n in nights if n["ahi"] is not None and n["ahi"] >= 30),
        },
        "event_totals": _event_totals(nights),
        "recent_nights_newest_first": nights[:14],
        "missing_or_limited_data": _missing_general(nights),
        "data_marker": _data_marker(rows),
    }


def _build_trend_context(db: Session, user_id: str) -> Dict[str, Any]:
    rows = db.execute(
        text(
            """
            SELECT DISTINCT ON (folder_date)
                id::text AS id, folder_date, duration_seconds, ahi, avg_pressure, p95_pressure,
                avg_leak, avg_flow_lim, central_apnea_count, obstructive_apnea_count,
                hypopnea_count, apnea_count, total_ahi_events, has_spo2, min_spo2,
                updated_at
            FROM sessions
            WHERE user_id = CAST(:uid AS uuid)
              AND duration_seconds >= 600
            ORDER BY folder_date DESC, duration_seconds DESC
            LIMIT 30
            """
        ),
        {"uid": user_id},
    ).mappings().all()

    nights = [_night_dict(r) for r in rows]
    recent_7 = [n for n in nights[:7] if n["ahi"] is not None]
    prior_7 = [n for n in nights[7:14] if n["ahi"] is not None]
    recent_avg = _avg([n["ahi"] for n in recent_7])
    prior_avg = _avg([n["ahi"] for n in prior_7])

    return {
        "nights": list(reversed(nights)),
        "recent_7_avg_ahi": recent_avg,
        "prior_7_avg_ahi": prior_avg,
        "recent_vs_prior_delta": (
            round(recent_avg - prior_avg, 2)
            if recent_avg is not None and prior_avg is not None
            else None
        ),
        "rising_ahi_streak": _has_rising_streak(nights),
        "event_totals": _event_totals(nights),
        "missing_or_limited_data": _missing_general(nights),
        "data_marker": _data_marker(rows),
    }


def _build_session_context(db: Session, user_id: str, session_id: str) -> Optional[Dict[str, Any]]:
    row = db.execute(
        text(
            """
            WITH night AS (
                SELECT folder_date, user_id
                FROM sessions
                WHERE id = CAST(:id AS uuid) AND user_id = CAST(:uid AS uuid)
            )
            SELECT
                (array_agg(s.id::text ORDER BY s.duration_seconds DESC))[1] AS id,
                s.folder_date,
                MIN(s.start_datetime) AS start_datetime,
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
                AVG(s.avg_flow_lim) AS avg_flow_lim,
                BOOL_OR(s.has_spo2) AS has_spo2,
                AVG(s.avg_spo2) AS avg_spo2,
                MIN(s.min_spo2) AS min_spo2,
                (array_agg(s.therapy_mode ORDER BY s.duration_seconds DESC))[1] AS therapy_mode,
                (array_agg(s.mask_type ORDER BY s.duration_seconds DESC))[1] AS mask_type,
                (array_agg(s.humidity_level ORDER BY s.duration_seconds DESC))[1] AS humidity_level,
                (array_agg(s.temperature_c ORDER BY s.duration_seconds DESC))[1] AS temperature_c,
                MAX(s.updated_at) AS updated_at,
                CASE WHEN SUM(s.duration_seconds) > 0
                     THEN ROUND((SUM(s.total_ahi_events) / (SUM(s.duration_seconds) / 3600.0))::numeric, 2)
                     ELSE 0 END AS ahi
            FROM sessions s
            JOIN night n ON s.folder_date = n.folder_date AND s.user_id = n.user_id
            WHERE s.duration_seconds >= 600
            GROUP BY s.folder_date
            """
        ),
        {"id": session_id, "uid": user_id},
    ).mappings().first()
    if not row:
        return None

    events = db.execute(
        text(
            """
            SELECT se.event_type, se.onset_seconds, se.duration_seconds
            FROM session_events se
            JOIN sessions s ON se.session_id = s.id
            WHERE s.folder_date = :folder_date
              AND s.user_id = CAST(:uid AS uuid)
            ORDER BY se.onset_seconds
            """
        ),
        {"folder_date": row["folder_date"], "uid": user_id},
    ).mappings().all()
    metrics = db.execute(
        text(
            """
            SELECT
                COUNT(*) AS samples,
                AVG(leak) AS avg_leak,
                MAX(leak) AS max_leak,
                AVG(flow_lim) AS avg_flow_lim,
                MAX(flow_lim) AS max_flow_lim,
                MIN(pressure) AS min_pressure,
                MAX(pressure) AS max_pressure,
                percentile_cont(0.95) WITHIN GROUP (ORDER BY leak) AS p95_leak
            FROM session_metrics
            WHERE session_id = CAST(:sid AS uuid)
            """
        ),
        {"sid": row["id"]},
    ).mappings().first()

    return {
        "session_id": session_id,
        "folder_date": row["folder_date"].isoformat(),
        "duration_hours": round(int(row["duration_seconds"] or 0) / 3600, 2),
        "ahi": _float(row["ahi"]),
        "event_counts": {
            "central": int(row["central_apnea_count"] or 0),
            "obstructive": int(row["obstructive_apnea_count"] or 0),
            "hypopnea": int(row["hypopnea_count"] or 0),
            "unclassified_apnea": int(row["apnea_count"] or 0),
            "arousal": int(row["arousal_count"] or 0),
            "total_ahi_events": int(row["total_ahi_events"] or 0),
        },
        "event_clustering": _event_cluster_summary(events, int(row["duration_seconds"] or 0)),
        "pressure": {
            "avg_cm_h2o": _float(row["avg_pressure"]),
            "p95_cm_h2o": _float(row["p95_pressure"]),
            "min_sample_cm_h2o": _float(metrics["min_pressure"] if metrics else None),
            "max_sample_cm_h2o": _float(metrics["max_pressure"] if metrics else None),
        },
        "leak": {
            "avg_lpm": _lps_to_lpm(row["avg_leak"]),
            "sample_avg_lpm": _lps_to_lpm(metrics["avg_leak"] if metrics else None),
            "p95_lpm": _lps_to_lpm(metrics["p95_leak"] if metrics else None),
            "max_lpm": _lps_to_lpm(metrics["max_leak"] if metrics else None),
            "large_leak_reference_lpm": 24,
        },
        "flow_limitation": {
            "avg": _float(row["avg_flow_lim"]),
            "sample_avg": _float(metrics["avg_flow_lim"] if metrics else None),
            "max": _float(metrics["max_flow_lim"] if metrics else None),
        },
        "oxygen": {
            "available": bool(row["has_spo2"]),
            "avg_spo2": _float(row["avg_spo2"]),
            "min_spo2": _float(row["min_spo2"]),
        },
        "machine_context": {
            "therapy_mode": row["therapy_mode"],
            "mask_type": row["mask_type"],
            "humidity_level": row["humidity_level"],
            "temperature_c": _float(row["temperature_c"]),
        },
        "missing_or_limited_data": _missing_session(row, metrics),
        "data_marker": _data_marker([row]),
    }


def _night_dict(row: Mapping[str, Any]) -> Dict[str, Any]:
    return {
        "date": row["folder_date"].isoformat(),
        "duration_hours": round(int(row["duration_seconds"] or 0) / 3600, 2),
        "ahi": _float(row["ahi"]),
        "avg_pressure": _float(row["avg_pressure"]),
        "p95_pressure": _float(row["p95_pressure"]),
        "avg_leak_lpm": _lps_to_lpm(row["avg_leak"]),
        "avg_flow_lim": _float(row["avg_flow_lim"]),
        "event_counts": {
            "central": int(row["central_apnea_count"] or 0),
            "obstructive": int(row["obstructive_apnea_count"] or 0),
            "hypopnea": int(row["hypopnea_count"] or 0),
            "unclassified_apnea": int(row["apnea_count"] or 0),
            "total_ahi_events": int(row["total_ahi_events"] or 0),
        },
        "oxygen_available": bool(row.get("has_spo2", False)),
        "min_spo2": _float(row.get("min_spo2")),
        "updated_at": row["updated_at"].isoformat() if row.get("updated_at") else None,
    }


def _event_cluster_summary(events: List[Mapping[str, Any]], duration_seconds: int) -> Dict[str, Any]:
    by_type: Dict[str, int] = {}
    onsets = []
    for event in events:
        by_type[event["event_type"]] = by_type.get(event["event_type"], 0) + 1
        onsets.append(float(event["onset_seconds"]))

    cluster_windows = 0
    for onset in onsets:
        if sum(1 for other in onsets if onset <= other <= onset + 600) >= 3:
            cluster_windows += 1

    first_half = sum(1 for onset in onsets if onset <= duration_seconds / 2)
    return {
        "total_events_with_timestamps": len(onsets),
        "event_types": by_type,
        "ten_minute_windows_with_3_plus_events": cluster_windows,
        "first_half_events": first_half,
        "second_half_events": len(onsets) - first_half,
    }


def _enrich_general_payload(payload: Dict[str, Any]) -> Dict[str, Any]:
    payload["insights"] = payload.get("therapy_quality") or payload.get("headline")
    payload["going_well"] = payload.get("high_confidence_observations", [])[:3]
    payload["whats_not"] = (payload.get("possible_patterns", []) + payload.get("missing_or_uncertain", []))[:3]
    payload["recommended_changes"] = payload.get("things_to_review", [])[:3]
    payload["disclaimer"] = "AI-generated pattern review, not medical advice. Discuss important treatment questions with a clinician."
    return payload


def _enrich_session_payload(payload: Dict[str, Any]) -> Dict[str, Any]:
    payload["observations"] = payload.get("high_confidence_observations", [])
    payload["recommendations"] = payload.get("things_to_review", [])
    return payload


def _enrich_trend_payload(payload: Dict[str, Any]) -> Dict[str, Any]:
    payload["anomalies"] = payload.get("possible_patterns", [])
    headline = " ".join(str(payload.get("headline", "")).lower().split())
    if "improv" in headline:
        payload["trend_direction"] = "improving"
    elif "worsen" in headline or "rising" in headline or "higher" in headline:
        payload["trend_direction"] = "worsening"
    elif "variable" in headline or "mixed" in headline:
        payload["trend_direction"] = "variable"
    else:
        payload["trend_direction"] = "stable"
    return payload


def _normalize_structured_payload(payload: Dict[str, Any]) -> Dict[str, Any]:
    flag = str(payload.get("flag") or "watch").lower()
    if flag not in {"good", "watch", "alert"}:
        flag = "watch"
    return {
        "headline": str(payload.get("headline") or "").strip(),
        "therapy_quality": str(payload.get("therapy_quality") or "").strip(),
        "high_confidence_observations": _ensure_list(payload.get("high_confidence_observations")),
        "possible_patterns": _ensure_list(payload.get("possible_patterns")),
        "things_to_review": _ensure_list(payload.get("things_to_review")),
        "missing_or_uncertain": _ensure_list(payload.get("missing_or_uncertain")),
        "flag": flag,
        "cached": False,
    }


def _read_cache(
    db: Session,
    user_id: str,
    analysis_type: str,
    cache_key: str,
    input_fingerprint: str,
    settings_fingerprint: str,
) -> Optional[Dict[str, Any]]:
    row = db.execute(
        text(
            """
            SELECT response_payload
            FROM ai_analysis_cache
            WHERE user_id = CAST(:uid AS uuid)
              AND analysis_type = :analysis_type
              AND cache_key = :cache_key
              AND input_fingerprint = :input_fingerprint
              AND settings_fingerprint = :settings_fingerprint
            """
        ),
        {
            "uid": user_id,
            "analysis_type": analysis_type,
            "cache_key": cache_key,
            "input_fingerprint": input_fingerprint,
            "settings_fingerprint": settings_fingerprint,
        },
    ).mappings().first()
    return dict(row["response_payload"]) if row else None


def _write_cache(
    db: Session,
    user_id: str,
    analysis_type: str,
    cache_key: str,
    input_fingerprint: str,
    settings_fingerprint: str,
    payload: Dict[str, Any],
) -> None:
    db.execute(
        text(
            """
            INSERT INTO ai_analysis_cache
                (user_id, analysis_type, cache_key, input_fingerprint, settings_fingerprint, response_payload)
            VALUES
                (CAST(:uid AS uuid), :analysis_type, :cache_key, :input_fingerprint, :settings_fingerprint, CAST(:payload AS jsonb))
            ON CONFLICT (user_id, analysis_type, cache_key) DO UPDATE SET
                input_fingerprint = EXCLUDED.input_fingerprint,
                settings_fingerprint = EXCLUDED.settings_fingerprint,
                response_payload = EXCLUDED.response_payload,
                updated_at = NOW()
            """
        ),
        {
            "uid": user_id,
            "analysis_type": analysis_type,
            "cache_key": cache_key,
            "input_fingerprint": input_fingerprint,
            "settings_fingerprint": settings_fingerprint,
            "payload": json.dumps(payload),
        },
    )
    db.commit()


def _settings_fingerprint(llm_settings: Mapping[str, str | None]) -> str:
    return _fingerprint(
        {
            "provider": get_provider(llm_settings),
            "model": get_model(llm_settings),
            "base_url": llm_settings.get("llm_base_url"),
            "prompt_version": PROMPT_VERSION,
        }
    )


def _fingerprint(value: Dict[str, Any]) -> str:
    return hashlib.sha256(_json_for_prompt(value).encode("utf-8")).hexdigest()


def _json_for_prompt(value: Any) -> str:
    return json.dumps(value, sort_keys=True, default=str, separators=(",", ":"))


def _parse_ai_payload(raw_text: str) -> Dict[str, Any]:
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
        return json.loads(cleaned[start : end + 1])


def _ensure_list(value: object) -> List[str]:
    if value is None:
        return []
    if isinstance(value, list):
        return [str(item).strip() for item in value if str(item).strip()]
    if isinstance(value, str):
        return [value.strip()] if value.strip() else []
    return [str(value).strip()]


def _event_totals(nights: List[Dict[str, Any]]) -> Dict[str, int]:
    totals = {"central": 0, "obstructive": 0, "hypopnea": 0, "unclassified_apnea": 0, "total_ahi_events": 0}
    for night in nights:
        for key in totals:
            totals[key] += int(night["event_counts"].get(key, 0))
    return totals


def _missing_general(nights: List[Dict[str, Any]]) -> List[str]:
    missing = []
    if not nights:
        return ["No imported PAP sessions were available for this analysis window."]
    if not any(n["avg_flow_lim"] is not None for n in nights):
        missing.append("Flow limitation data is not available in the analyzed nights.")
    if not any(n["oxygen_available"] for n in nights):
        missing.append("Oxygen data is not available, so desaturation patterns cannot be assessed.")
    missing.append("The summary uses nightly aggregates and cannot confirm breath-by-breath waveform shapes.")
    return missing


def _missing_session(row: Mapping[str, Any], metrics: Mapping[str, Any] | None) -> List[str]:
    missing = []
    if not row["has_spo2"]:
        missing.append("No oximetry data is attached to this session.")
    if row["avg_flow_lim"] is None and (not metrics or metrics["avg_flow_lim"] is None):
        missing.append("Flow limitation samples are not available for this session.")
    if not metrics or int(metrics["samples"] or 0) == 0:
        missing.append("Detailed pressure/leak time-series samples are not available.")
    return missing or ["Waveform-level interpretation is limited to the imported summary and event data."]


def _has_rising_streak(nights: List[Dict[str, Any]]) -> bool:
    newest_first = [n["ahi"] for n in nights[:3] if n["ahi"] is not None]
    return len(newest_first) == 3 and newest_first[0] > newest_first[1] > newest_first[2]


def _data_marker(rows: List[Mapping[str, Any]]) -> Dict[str, Any]:
    return {
        "row_count": len(rows),
        "latest_updated_at": max((r["updated_at"] for r in rows if r.get("updated_at")), default=None),
        "latest_folder_date": max((r["folder_date"] for r in rows if r.get("folder_date")), default=None),
    }


def _avg(values: List[float]) -> Optional[float]:
    return round(sum(values) / len(values), 2) if values else None


def _float(value: object) -> Optional[float]:
    return round(float(value), 4) if value is not None else None


def _lps_to_lpm(value: object) -> Optional[float]:
    return round(float(value) * 60, 2) if value is not None else None
