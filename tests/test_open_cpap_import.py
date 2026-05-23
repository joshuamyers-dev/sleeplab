import sys
import pytest
from unittest.mock import MagicMock, patch
from pathlib import Path


sys.path.insert(0, "importer")


def _mock_cpap_parser(sessions=None, events=None, metrics=None, spo2=None):
    """Return a mock cpap_parser module that yields controlled output."""
    mock_dir = MagicMock()
    mock_dir.machine.series = "TestDevice"

    result = {
        "sessions": sessions or [],
        "events": events or [],
        "metrics": metrics or [],
        "spo2": spo2 or [],
    }

    mock_mod = MagicMock()
    mock_mod.UniversalCPAPParser.return_value.parse.return_value = mock_dir
    mock_mod.map_directory_to_sleeplab.return_value = result
    mock_mod.UnsupportedDirectoryError = type("UnsupportedDirectoryError", (Exception,), {})
    return mock_mod, mock_dir


def test_detect_returns_true_for_recognised_layout(tmp_path):
    mock_mod, _ = _mock_cpap_parser()
    with patch.dict("sys.modules", {"cpap_parser": mock_mod,
                                     "cpap_parser.adapters": MagicMock(),
                                     "cpap_parser.adapters.base": MagicMock()}):
        import importlib
        import open_cpap_import
        importlib.reload(open_cpap_import)
        assert open_cpap_import.detect_open_cpap_layout(tmp_path) is True


def test_detect_returns_false_for_unrecognised_layout(tmp_path):
    mock_mod, _ = _mock_cpap_parser()
    err_cls = type("UnsupportedDirectoryError", (Exception,), {})
    mock_mod.UniversalCPAPParser.return_value.parse.side_effect = err_cls("nope")
    mock_adapters_base = MagicMock()
    mock_adapters_base.UnsupportedDirectoryError = err_cls
    with patch.dict("sys.modules", {"cpap_parser": mock_mod,
                                     "cpap_parser.adapters": MagicMock(),
                                     "cpap_parser.adapters.base": mock_adapters_base}):
        import importlib
        import open_cpap_import
        importlib.reload(open_cpap_import)
        assert open_cpap_import.detect_open_cpap_layout(tmp_path) is False


def test_detect_raises_on_missing_directory():
    mock_mod, _ = _mock_cpap_parser()
    with patch.dict("sys.modules", {"cpap_parser": mock_mod,
                                     "cpap_parser.adapters": MagicMock(),
                                     "cpap_parser.adapters.base": MagicMock()}):
        import importlib
        import open_cpap_import
        importlib.reload(open_cpap_import)
        with pytest.raises(NotADirectoryError):
            open_cpap_import.detect_open_cpap_layout(Path("/nonexistent/path"))


def test_run_import_empty_result(tmp_path):
    mock_mod, _ = _mock_cpap_parser()
    with patch.dict("sys.modules", {"cpap_parser": mock_mod,
                                     "cpap_parser.adapters": MagicMock(),
                                     "cpap_parser.adapters.base": MagicMock()}):
        import importlib
        import open_cpap_import
        importlib.reload(open_cpap_import)
        with patch.object(open_cpap_import, "get_conn") as mock_get_conn:
            mock_get_conn.return_value = MagicMock()
            stats = open_cpap_import.run_open_cpap_import("user-1", str(tmp_path))
    assert stats == {"imported": 0, "folders": 0, "errors": 0}


def test_run_import_single_session(tmp_path):
    from datetime import datetime

    start = datetime(2025, 1, 15, 22, 0, 0)  # naive
    session = {
        "session_id": "open-cpap-20250115_220000",
        "folder_date": "2025-01-15",
        "block_index": 0,
        "start_datetime": start,
        "pld_start_datetime": start,
        "duration_seconds": 28800,
        "device_serial": "SN12345",
        "ahi": 3.5,
        "central_apnea_count": 0,
        "obstructive_apnea_count": 5,
        "hypopnea_count": 8,
        "apnea_count": 5,
        "arousal_count": None,
        "total_ahi_events": 13,
        "avg_pressure": 10.0,
        "p95_pressure": 12.0,
        "avg_leak": 4.5,
        "avg_resp_rate": 14.2,
        "avg_tidal_vol": 480.0,
        "avg_min_vent": 6.8,
        "avg_snore": 0.1,
        "avg_flow_lim": 0.05,
        "has_spo2": True,
        "spo2_avg": 96.5,
        "spo2_min": 89.0,
        "therapy_mode": "APAP",
        "mask_type": "nasal",
        "humidity_level": 3,
        "temperature_c": 27.0,
        "user_id": "user-1",
        "meta": {"validation_status": "validated", "validation_notes": ""},
    }

    mock_mod, mock_dir = _mock_cpap_parser(sessions=[session])
    with patch.dict("sys.modules", {"cpap_parser": mock_mod,
                                     "cpap_parser.adapters": MagicMock(),
                                     "cpap_parser.adapters.base": MagicMock()}):
        import importlib
        import open_cpap_import
        importlib.reload(open_cpap_import)
        with patch.object(open_cpap_import, "get_conn") as mock_get_conn, \
             patch.object(open_cpap_import, "session_exists", return_value=False), \
             patch.object(open_cpap_import, "upsert_session", return_value=42) as mock_upsert, \
             patch.object(open_cpap_import, "replace_session_events"), \
             patch.object(open_cpap_import, "replace_session_metrics_cpap"), \
             patch.object(open_cpap_import, "replace_session_spo2_cpap"):
            mock_get_conn.return_value = MagicMock()
            stats = open_cpap_import.run_open_cpap_import("user-1", str(tmp_path))

    assert stats["imported"] == 1
    assert stats["errors"] == 0
    upserted = mock_upsert.call_args[0][1]
    assert "avg_spo2" in upserted
    assert "min_spo2" in upserted
    assert "spo2_avg" not in upserted
    assert upserted["avg_spo2"] == 96.5
    assert upserted["parser_validated"] is True
    assert upserted["data_source"] == "open_cpap_parser"
    assert upserted["manufacturer"] == "TestDevice"


def test_run_import_skips_existing_session(tmp_path):
    from datetime import datetime
    start = datetime(2025, 1, 15, 22, 0, 0)
    session = {
        "session_id": "open-cpap-20250115_220000",
        "user_id": "user-1",
        "start_datetime": start,
        "pld_start_datetime": start,
        "meta": {},
        **{k: None for k in [
            "folder_date", "block_index", "duration_seconds", "device_serial",
            "ahi", "central_apnea_count", "obstructive_apnea_count", "hypopnea_count",
            "apnea_count", "arousal_count", "total_ahi_events", "avg_pressure",
            "p95_pressure", "avg_leak", "avg_resp_rate", "avg_tidal_vol", "avg_min_vent",
            "avg_snore", "avg_flow_lim", "has_spo2", "spo2_avg", "spo2_min",
            "therapy_mode", "mask_type", "humidity_level", "temperature_c"]},
    }

    mock_mod, _ = _mock_cpap_parser(sessions=[session])
    with patch.dict("sys.modules", {"cpap_parser": mock_mod,
                                     "cpap_parser.adapters": MagicMock(),
                                     "cpap_parser.adapters.base": MagicMock()}):
        import importlib
        import open_cpap_import
        importlib.reload(open_cpap_import)
        with patch.object(open_cpap_import, "get_conn"), \
             patch.object(open_cpap_import, "session_exists", return_value=True), \
             patch.object(open_cpap_import, "upsert_session") as mock_upsert:
            stats = open_cpap_import.run_open_cpap_import("user-1", str(tmp_path))

    mock_upsert.assert_not_called()
    assert stats["imported"] == 0
