from __future__ import annotations

from dataclasses import dataclass
from datetime import date, timedelta
from enum import IntEnum


class ComplianceStatus(IntEnum):
    NONE = 0
    BORDERLINE = 2
    FULL = 3


@dataclass
class ComplianceConfig:
    usage_threshold_hours: float = 4.0
    borderline_threshold_hours: float | None = None
    target_compliance_pct: float = 70.0
    compliance_window_days: int = 30
    evaluation_period_days: int = 90
    window_evaluation_logic: str = "best_consecutive"
    maintenance_lookback_days: int = 90


@dataclass
class NightRecord:
    folder_date: date
    duration_seconds: int | None
    ahi: float | None = None
    avg_leak: float | None = None


@dataclass
class WindowStat:
    start_date: date
    end_date: date
    total_nights: int
    compliant_nights: int
    compliance_pct: float
    avg_hours: float
    passes: bool


@dataclass
class ComplianceResult:
    overall: WindowStat
    best_window: WindowStat | None
    sequential_windows: list[WindowStat]
    nightly_breakdown: list[dict]
    rolling_compliance: list[dict]
    streak_longest: int
    streak_current: int


def classify_night(duration_seconds: int | None, config: ComplianceConfig) -> ComplianceStatus:
    if not duration_seconds:
        return ComplianceStatus.NONE
    hours = duration_seconds / 3600.0
    if hours >= config.usage_threshold_hours:
        return ComplianceStatus.FULL
    if config.borderline_threshold_hours is not None and hours >= config.borderline_threshold_hours:
        return ComplianceStatus.BORDERLINE
    return ComplianceStatus.NONE


def _window_stat(nights_by_date: dict[date, NightRecord], window_start: date, window_end: date, config: ComplianceConfig) -> WindowStat:
    total = (window_end - window_start).days + 1
    compliant = 0
    total_hours = 0.0
    for i in range(total):
        d = window_start + timedelta(days=i)
        rec = nights_by_date.get(d)
        hours = (rec.duration_seconds or 0) / 3600.0 if rec else 0.0
        total_hours += hours
        if rec and classify_night(rec.duration_seconds, config) == ComplianceStatus.FULL:
            compliant += 1
    compliance_pct = round(compliant / total * 100, 1) if total > 0 else 0.0
    avg_hours = round(total_hours / total, 2) if total > 0 else 0.0
    passes = compliance_pct >= config.target_compliance_pct
    return WindowStat(
        start_date=window_start,
        end_date=window_end,
        total_nights=total,
        compliant_nights=compliant,
        compliance_pct=compliance_pct,
        avg_hours=avg_hours,
        passes=passes,
    )


def compute_compliance(
    nights: list[NightRecord],
    period_start: date,
    period_end: date,
    config: ComplianceConfig,
) -> ComplianceResult:
    nights_by_date: dict[date, NightRecord] = {n.folder_date: n for n in nights}

    overall = _window_stat(nights_by_date, period_start, period_end, config)

    # Build nightly breakdown for every calendar day in the period
    nightly_breakdown: list[dict] = []
    total_days = (period_end - period_start).days + 1
    for i in range(total_days):
        d = period_start + timedelta(days=i)
        rec = nights_by_date.get(d)
        status = classify_night(rec.duration_seconds if rec else None, config)
        usage_hours = round((rec.duration_seconds or 0) / 3600.0, 2) if rec else 0.0
        nightly_breakdown.append({
            "date": d.isoformat(),
            "usage_hours": usage_hours,
            "status": int(status),
            "ahi": rec.ahi if rec else None,
            "avg_leak": rec.avg_leak if rec else None,
        })

    # Sequential non-overlapping windows (most recent first) for the window breakdown table
    window_size = config.compliance_window_days
    sequential_windows: list[WindowStat] = []
    eval_days = config.evaluation_period_days
    eval_start = period_end - timedelta(days=eval_days - 1)
    w_end = period_end
    while w_end >= eval_start:
        w_start = max(w_end - timedelta(days=window_size - 1), eval_start)
        if (w_end - w_start).days + 1 >= window_size // 2:
            sequential_windows.append(_window_stat(nights_by_date, w_start, w_end, config))
        w_end = w_start - timedelta(days=1)

    # Best / last window
    best_window: WindowStat | None = None
    if config.evaluation_period_days >= config.compliance_window_days:
        candidate_end = period_end
        candidate_start = candidate_end - timedelta(days=eval_days - 1)
        if config.window_evaluation_logic == "last_consecutive":
            w_start = period_end - timedelta(days=window_size - 1)
            if w_start >= candidate_start:
                best_window = _window_stat(nights_by_date, w_start, period_end, config)
        else:
            # Slide a window across the evaluation period, pick the best
            best: WindowStat | None = None
            scan_end = period_end
            while scan_end >= candidate_start + timedelta(days=window_size - 1):
                scan_start = scan_end - timedelta(days=window_size - 1)
                if scan_start < candidate_start:
                    break
                w = _window_stat(nights_by_date, scan_start, scan_end, config)
                if best is None or w.compliance_pct > best.compliance_pct:
                    best = w
                scan_end -= timedelta(days=1)
            best_window = best

    # Rolling compliance: one data point per week, each representing the last 30 days
    rolling_compliance: list[dict] = []
    roll_window = 30
    step = 7
    roll_start = period_start + timedelta(days=roll_window - 1)
    d = roll_start
    while d <= period_end:
        w_s = d - timedelta(days=roll_window - 1)
        w = _window_stat(nights_by_date, w_s, d, config)
        rolling_compliance.append({"date": d.isoformat(), "compliance_pct": w.compliance_pct})
        d += timedelta(days=step)

    # Streaks: consecutive FULL nights
    full_dates = sorted(d for d, r in nights_by_date.items() if classify_night(r.duration_seconds, config) == ComplianceStatus.FULL)

    streak_longest = 0
    streak_current = 0
    if full_dates:
        current_run = 1
        longest_run = 1
        for i in range(1, len(full_dates)):
            if (full_dates[i] - full_dates[i - 1]).days == 1:
                current_run += 1
                longest_run = max(longest_run, current_run)
            else:
                current_run = 1
        streak_longest = longest_run

        today = date.today()
        for i, d in enumerate(reversed(full_dates)):
            expected = today - timedelta(days=i)
            if d == expected:
                streak_current += 1
            else:
                break

    return ComplianceResult(
        overall=overall,
        best_window=best_window,
        sequential_windows=sequential_windows,
        nightly_breakdown=nightly_breakdown,
        rolling_compliance=rolling_compliance,
        streak_longest=streak_longest,
        streak_current=streak_current,
    )
