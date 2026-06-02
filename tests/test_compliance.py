from datetime import date, timedelta

import pytest

from api.compliance import (
    ComplianceConfig,
    ComplianceStatus,
    NightRecord,
    classify_night,
    compute_compliance,
)


def _nights(start: date, durations_seconds: list[int | None]) -> list[NightRecord]:
    return [
        NightRecord(folder_date=start + timedelta(days=i), duration_seconds=d)
        for i, d in enumerate(durations_seconds)
    ]


FULL = 14401   # just over 4 hours
BELOW = 7200   # 2 hours
BORDER = 12600  # 3.5 hours — between 3h borderline and 4h threshold


class TestComplianceStatusValues:
    def test_full_is_3(self):
        assert int(ComplianceStatus.FULL) == 3

    def test_borderline_is_2(self):
        assert int(ComplianceStatus.BORDERLINE) == 2

    def test_none_is_0(self):
        assert int(ComplianceStatus.NONE) == 0


class TestComplianceConfigDefaults:
    def test_defaults(self):
        cfg = ComplianceConfig()
        assert cfg.usage_threshold_hours == 4.0
        assert cfg.borderline_threshold_hours is None
        assert cfg.target_compliance_pct == 70.0
        assert cfg.compliance_window_days == 30
        assert cfg.evaluation_period_days == 90


class TestClassifyNight:
    def test_full_at_threshold(self):
        cfg = ComplianceConfig(usage_threshold_hours=4.0)
        assert classify_night(14400, cfg) == ComplianceStatus.FULL

    def test_full_above_threshold(self):
        cfg = ComplianceConfig(usage_threshold_hours=4.0)
        assert classify_night(18000, cfg) == ComplianceStatus.FULL

    def test_none_below_threshold_no_borderline(self):
        cfg = ComplianceConfig(usage_threshold_hours=4.0, borderline_threshold_hours=None)
        assert classify_night(7200, cfg) == ComplianceStatus.NONE

    def test_borderline_between_thresholds(self):
        cfg = ComplianceConfig(usage_threshold_hours=4.0, borderline_threshold_hours=3.0)
        assert classify_night(BORDER, cfg) == ComplianceStatus.BORDERLINE

    def test_none_below_borderline(self):
        cfg = ComplianceConfig(usage_threshold_hours=4.0, borderline_threshold_hours=3.0)
        assert classify_night(3600, cfg) == ComplianceStatus.NONE

    def test_none_for_zero(self):
        cfg = ComplianceConfig()
        assert classify_night(0, cfg) == ComplianceStatus.NONE

    def test_none_for_null(self):
        cfg = ComplianceConfig()
        assert classify_night(None, cfg) == ComplianceStatus.NONE

    def test_borderline_at_borderline_threshold(self):
        cfg = ComplianceConfig(usage_threshold_hours=4.0, borderline_threshold_hours=3.0)
        assert classify_night(10800, cfg) == ComplianceStatus.BORDERLINE


class TestComputeCompliance:
    def _run(self, durations: list[int | None], days: int = None, **kwargs):
        start = date(2026, 1, 1)
        nights = _nights(start, durations)
        end = start + timedelta(days=(days or len(durations)) - 1)
        cfg = ComplianceConfig(**kwargs)
        return compute_compliance(nights, start, end, cfg)

    def test_all_compliant(self):
        result = self._run([FULL, FULL, FULL])
        assert result.overall.compliant_nights == 3
        assert result.overall.total_nights == 3
        assert result.overall.compliance_pct == 100.0
        assert result.overall.passes is True

    def test_partial_compliance(self):
        result = self._run([FULL, BELOW, FULL, BELOW])
        assert result.overall.compliant_nights == 2
        assert result.overall.compliance_pct == 50.0
        assert result.overall.passes is False

    def test_empty_nights_list(self):
        start = date(2026, 1, 1)
        end = date(2026, 1, 3)
        result = compute_compliance([], start, end, ComplianceConfig())
        assert result.overall.total_nights == 3
        assert result.overall.compliant_nights == 0
        assert result.overall.compliance_pct == 0.0
        assert result.streak_longest == 0
        assert result.streak_current == 0

    def test_passes_flag_at_threshold(self):
        result = self._run([FULL] * 7 + [BELOW] * 3, target_compliance_pct=70.0)
        assert result.overall.compliance_pct == 70.0
        assert result.overall.passes is True

    def test_nightly_breakdown_length(self):
        result = self._run([FULL, BELOW, FULL])
        assert len(result.nightly_breakdown) == 3

    def test_nightly_breakdown_status_values(self):
        result = self._run([FULL, BELOW])
        statuses = [n["status"] for n in result.nightly_breakdown]
        assert statuses[0] == int(ComplianceStatus.FULL)
        assert statuses[1] == int(ComplianceStatus.NONE)

    def test_nightly_breakdown_has_date_string(self):
        result = self._run([FULL])
        assert result.nightly_breakdown[0]["date"] == "2026-01-01"

    def test_nightly_breakdown_usage_hours(self):
        result = self._run([14400])
        assert result.nightly_breakdown[0]["usage_hours"] == pytest.approx(4.0, abs=0.01)

    def test_streak_longest(self):
        result = self._run([FULL, FULL, BELOW, FULL])
        assert result.streak_longest == 2

    def test_streak_all_compliant(self):
        result = self._run([FULL, FULL, FULL])
        assert result.streak_longest == 3

    def test_streak_none(self):
        result = self._run([BELOW, BELOW])
        assert result.streak_longest == 0

    def test_best_window_found(self):
        # 4 compliant in first 5 days, then 0
        durations = [FULL, FULL, FULL, FULL, BELOW] + [BELOW] * 85
        result = self._run(durations, days=90, compliance_window_days=5, evaluation_period_days=90)
        assert result.best_window is not None
        assert result.best_window.compliant_nights == 4

    def test_last_consecutive_mode(self):
        start = date(2026, 1, 1)
        nights = _nights(start, [FULL] * 30)
        end = start + timedelta(days=89)
        cfg = ComplianceConfig(compliance_window_days=30, evaluation_period_days=90, window_evaluation_logic="last_consecutive")
        result = compute_compliance(nights, start, end, cfg)
        assert result.best_window is not None
        assert result.best_window.end_date == end

    def test_overall_avg_hours(self):
        result = self._run([14400, 18000])
        assert result.overall.avg_hours == pytest.approx(4.5, abs=0.1)

    def test_rolling_compliance_produced(self):
        durations = [FULL] * 30
        result = self._run(durations, days=30)
        assert isinstance(result.rolling_compliance, list)

    def test_sequential_windows_non_empty_with_enough_data(self):
        result = self._run([FULL] * 90, days=90, compliance_window_days=30, evaluation_period_days=90)
        assert len(result.sequential_windows) >= 1
