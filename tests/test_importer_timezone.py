"""
Unit tests for _machine_tz() and _localize() in the importer.

These are pure-Python helpers with no DB or file I/O, so no fixtures needed.
"""

import sys
import os
from datetime import datetime, timezone
from pathlib import Path
from zoneinfo import ZoneInfo

import pytest

# importer/ is not a package — add it to sys.path so we can import directly
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "importer"))

from import_sessions import _localize, _machine_tz


class TestMachineTz:
    def test_defaults_to_utc(self, monkeypatch):
        monkeypatch.delenv("MACHINE_TZ", raising=False)
        assert _machine_tz() == ZoneInfo("UTC")

    def test_valid_iana_name(self, monkeypatch):
        monkeypatch.setenv("MACHINE_TZ", "America/New_York")
        assert _machine_tz() == ZoneInfo("America/New_York")

    def test_invalid_name_falls_back_to_utc(self, monkeypatch, capsys):
        monkeypatch.setenv("MACHINE_TZ", "Not/A/Real/Zone")
        result = _machine_tz()
        assert result == ZoneInfo("UTC")
        captured = capsys.readouterr()
        assert "WARNING" in captured.out
        assert "Not/A/Real/Zone" in captured.out

    def test_empty_string_falls_back_to_utc(self, monkeypatch, capsys):
        monkeypatch.setenv("MACHINE_TZ", "")
        result = _machine_tz()
        assert result == ZoneInfo("UTC")

    def test_various_valid_zones(self, monkeypatch):
        for tz_name in ("Europe/London", "Asia/Tokyo", "US/Pacific", "UTC"):
            monkeypatch.setenv("MACHINE_TZ", tz_name)
            assert _machine_tz() == ZoneInfo(tz_name)


class TestLocalize:
    def test_attaches_timezone_to_naive(self, monkeypatch):
        monkeypatch.setenv("MACHINE_TZ", "America/New_York")
        naive = datetime(2025, 1, 15, 23, 0, 0)
        result = _localize(naive)
        assert result.tzinfo == ZoneInfo("America/New_York")
        assert result.year == 2025
        assert result.hour == 23

    def test_utc_offset_correct_for_eastern(self, monkeypatch):
        monkeypatch.setenv("MACHINE_TZ", "America/New_York")
        # Jan 15 23:00 Eastern Standard Time = Jan 16 04:00 UTC
        naive = datetime(2025, 1, 15, 23, 0, 0)
        result = _localize(naive)
        utc = result.astimezone(timezone.utc)
        assert utc.day == 16
        assert utc.hour == 4

    def test_utc_offset_correct_for_tokyo(self, monkeypatch):
        monkeypatch.setenv("MACHINE_TZ", "Asia/Tokyo")
        # Jan 15 08:00 JST (UTC+9) = Jan 14 23:00 UTC
        naive = datetime(2025, 1, 15, 8, 0, 0)
        result = _localize(naive)
        utc = result.astimezone(timezone.utc)
        assert utc.day == 14
        assert utc.hour == 23

    def test_dst_aware_summer_eastern(self, monkeypatch):
        monkeypatch.setenv("MACHINE_TZ", "America/New_York")
        # Jul 15 22:00 EDT (UTC-4) = Jul 16 02:00 UTC
        naive = datetime(2025, 7, 15, 22, 0, 0)
        result = _localize(naive)
        utc = result.astimezone(timezone.utc)
        assert utc.day == 16
        assert utc.hour == 2

    def test_invalid_tz_falls_back_to_utc(self, monkeypatch):
        monkeypatch.setenv("MACHINE_TZ", "Fake/Zone")
        naive = datetime(2025, 1, 15, 22, 0, 0)
        result = _localize(naive)
        assert result.tzinfo == ZoneInfo("UTC")
        # UTC offset is 0 so UTC equivalent equals the naive time
        utc = result.astimezone(timezone.utc)
        assert utc.hour == 22
