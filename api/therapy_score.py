from __future__ import annotations

from dataclasses import dataclass
from math import isfinite
from typing import Mapping

from .models import TherapyScore, TherapyScoreComponent, TherapyScoreComponents


BASE_WEIGHTS = {
    "ahi": 40,
    "leak": 25,
    "duration": 20,
    "spo2": 15,
}

RESMED_LARGE_LEAK_LPM = 24.0


@dataclass(frozen=True)
class _AvailableComponent:
    key: str
    base_weight: int
    label: str
    percent: float
    value: float | None = None
    unit: str | None = None


def compute_therapy_score(session: Mapping[str, object]) -> TherapyScore:
    """Compute a nightly therapy score from already-available session fields."""
    parser_validated = bool(session.get("parser_validated", True))
    available: list[_AvailableComponent] = []

    ahi = _number(session.get("ahi"))
    if ahi is not None:
        available.append(_AvailableComponent(
            key="ahi",
            base_weight=BASE_WEIGHTS["ahi"],
            label="AHI",
            percent=_score_ahi(ahi),
            value=round(ahi, 2),
            unit="events/hr",
        ))

    leak_lps = _number(session.get("avg_leak"))
    leak_threshold_lps = _large_leak_threshold_lps(session)
    if leak_lps is not None and leak_threshold_lps is not None:
        available.append(_AvailableComponent(
            key="leak",
            base_weight=BASE_WEIGHTS["leak"],
            label="Large leak",
            percent=_score_leak(leak_lps, leak_threshold_lps),
            value=round(leak_lps * 60, 2),
            unit="L/min",
        ))

    duration_seconds = _number(session.get("duration_seconds"))
    if duration_seconds is not None:
        duration_hours = max(0.0, duration_seconds / 3600)
        available.append(_AvailableComponent(
            key="duration",
            base_weight=BASE_WEIGHTS["duration"],
            label="Usage duration",
            percent=_score_duration(duration_hours),
            value=round(duration_hours, 2),
            unit="hours",
        ))

    has_spo2 = bool(session.get("has_spo2", False))
    avg_spo2 = _number(session.get("avg_spo2"))
    min_spo2 = _number(session.get("min_spo2"))
    if has_spo2 and (avg_spo2 is not None or min_spo2 is not None):
        available.append(_AvailableComponent(
            key="spo2",
            base_weight=BASE_WEIGHTS["spo2"],
            label="Oxygen levels",
            percent=_score_spo2(avg_spo2, min_spo2),
            value=round(avg_spo2 if avg_spo2 is not None else min_spo2, 1),
            unit="%",
        ))

    if not available:
        callout = "Therapy score could not be computed from the available session data."
        if not parser_validated:
            callout = f"{callout} Scoring confidence is lower because this session was not parser-validated."
        return TherapyScore(
            total=0,
            grade="F",
            low_confidence=not parser_validated,
            callout=callout,
            components=TherapyScoreComponents(),
        )

    max_scores = _redistributed_max_scores(available)
    components: dict[str, TherapyScoreComponent | None] = {
        "ahi": None,
        "leak": None,
        "duration": None,
        "spo2": None,
    }
    total = 0
    for component in available:
        max_score = max_scores[component.key]
        score = round(max_score * component.percent)
        total += score
        components[component.key] = TherapyScoreComponent(
            score=score,
            max_score=max_score,
            label=component.label,
            value=component.value,
            unit=component.unit,
        )

    total = _clamp_int(total, 0, 100)
    callout = _callout(available, session, leak_threshold_lps)
    if not parser_validated:
        callout = f"{callout} Scoring confidence is lower because this session was not parser-validated."

    return TherapyScore(
        total=total,
        grade=grade_for_score(total),
        low_confidence=not parser_validated,
        callout=callout,
        components=TherapyScoreComponents(**components),
    )


def grade_for_score(score: int) -> str:
    if score >= 90:
        return "A"
    if score >= 80:
        return "B"
    if score >= 70:
        return "C"
    if score >= 60:
        return "D"
    return "F"


def _score_ahi(ahi: float) -> float:
    ahi = _clamp(ahi, 0.0, 20.0)
    if ahi <= 5:
        return _clamp(1.0 - 0.15 * (ahi / 5) ** 1.5, 0.0, 1.0)
    return _clamp(0.85 * (1.0 - ((ahi - 5) / 15) ** 1.1), 0.0, 1.0)


def _score_leak(leak_lps: float, threshold_lps: float) -> float:
    if leak_lps <= threshold_lps:
        return 1.0
    zero_at = threshold_lps * 2.5
    return _clamp(1.0 - ((leak_lps - threshold_lps) / (zero_at - threshold_lps)), 0.0, 1.0)


def _score_duration(duration_hours: float) -> float:
    if duration_hours >= 7:
        return 1.0
    if duration_hours < 2:
        return 0.0
    return _clamp((duration_hours - 2) / 5, 0.0, 1.0)


def _score_spo2(avg_spo2: float | None, min_spo2: float | None) -> float:
    avg_score = 1.0
    if avg_spo2 is not None:
        avg_score = _clamp((avg_spo2 - 88) / 7, 0.0, 1.0)
    if min_spo2 is not None and min_spo2 < 88:
        dip_cap = 0.45 if min_spo2 < 85 else 0.65
        return min(avg_score, dip_cap)
    return avg_score


def _large_leak_threshold_lps(session: Mapping[str, object]) -> float | None:
    manufacturer = str(session.get("manufacturer") or "ResMed").strip().lower()
    if manufacturer == "resmed":
        return RESMED_LARGE_LEAK_LPM / 60
    return None


def _redistributed_max_scores(components: list[_AvailableComponent]) -> dict[str, int]:
    total_weight = sum(component.base_weight for component in components)
    raw = [(component.key, component.base_weight * 100 / total_weight) for component in components]
    floors = {key: int(value) for key, value in raw}
    remaining = 100 - sum(floors.values())
    by_remainder = sorted(raw, key=lambda item: item[1] - int(item[1]), reverse=True)
    for key, _ in by_remainder[:remaining]:
        floors[key] += 1
    return floors


def _callout(
    available: list[_AvailableComponent],
    session: Mapping[str, object],
    leak_threshold_lps: float | None,
) -> str:
    worst = max(available, key=lambda component: 1.0 - component.percent)
    messages = {
        "ahi": "AHI was the biggest drag on tonight's score.",
        "leak": "Large leak was the biggest drag on tonight's score.",
        "duration": "Short usage duration was the biggest drag on tonight's score.",
        "spo2": "Oxygen levels were the biggest drag on tonight's score.",
    }
    callout = messages[worst.key]
    ahi = _number(session.get("ahi"))
    leak_lps = _number(session.get("avg_leak"))
    if leak_threshold_lps is not None and leak_lps is not None and ahi is not None:
        if leak_lps > leak_threshold_lps and ahi < 3:
            callout = (
                "Large leak was the biggest drag on tonight's score, and the low AHI may be "
                "understated because leak was above the large-leak threshold."
            )
    return callout


def _number(value: object) -> float | None:
    if value is None:
        return None
    try:
        result = float(value)
    except (TypeError, ValueError):
        return None
    return result if isfinite(result) else None


def _clamp(value: float, minimum: float, maximum: float) -> float:
    return max(minimum, min(maximum, value))


def _clamp_int(value: int, minimum: int, maximum: int) -> int:
    return max(minimum, min(maximum, value))
