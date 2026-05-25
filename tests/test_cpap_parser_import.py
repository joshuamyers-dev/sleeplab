import sys
from datetime import UTC
from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest

sys.path.insert(0, "importer")


def _mock_cpap_parser(sessions=None, events=None, metrics=None, spo2=None):
    """Return mock cpap_parser and cpap_parser.core modules."""
    mock_dir = MagicMock()
    mock_dir.machine.series = "TestDevice"

    # Build mock CPAPSession objects so _folder_for_block() works.
    # start_time must be a real timezone-aware datetime whose naive value matches
    # the session's start_datetime (cpap-parser "local-as-UTC" convention).
    mock_cpap_sessions = []
    for sd in (sessions or []):
        if sd.get("start_datetime") is None:
            continue
        ms = MagicMock()
        naive = sd["start_datetime"]
        ms.start_time = naive.replace(tzinfo=UTC)
        mock_cpap_sessions.append(ms)
    mock_dir.sessions = mock_cpap_sessions

    result = {
        "sessions": sessions or [],
        "events": events or [],
        "metrics": metrics or [],
        "spo2": spo2 or [],
    }

    err_cls = type("UnsupportedDirectoryError", (Exception,), {})

    mock_mod = MagicMock()
    mock_mod.map_directory_to_sleeplab.return_value = result

    mock_core = MagicMock()
    mock_core.UnsupportedDirectoryError = err_cls
    mock_core.create_parser.return_value.parse.return_value = mock_dir

    # mock_sleeplab_output: map_timeseries_to_metrics returns the test metrics for
    # the first date's session; map_timeseries_to_spo2 returns the test spo2 rows.
    mock_sleeplab_output = MagicMock()
    mock_sleeplab_output.map_timeseries_to_metrics.return_value = metrics or []
    mock_sleeplab_output.map_timeseries_to_spo2.return_value = spo2 or []

    return mock_mod, mock_core, mock_dir, err_cls, mock_sleeplab_output


def _patch_modules(mock_mod, mock_core, mock_sleeplab_output=None):
    mocks = {
        "cpap_parser": mock_mod,
        "cpap_parser.core": mock_core,
        "cpap_parser.adapters": MagicMock(),
        "cpap_parser.adapters.base": MagicMock(),
        "cpap_parser.adapters.sleeplab_output": mock_sleeplab_output or MagicMock(),
    }
    return patch.dict("sys.modules", mocks)


def test_detect_returns_true_for_recognised_layout(tmp_path):
    mock_mod, mock_core, _, _, mock_sl = _mock_cpap_parser()
    with _patch_modules(mock_mod, mock_core, mock_sl):
        import importlib

        import cpap_parser_import
        importlib.reload(cpap_parser_import)
        assert cpap_parser_import.detect_open_cpap_layout(tmp_path) is True


def test_detect_returns_false_for_unrecognised_layout(tmp_path):
    mock_mod, mock_core, _, err_cls, mock_sl = _mock_cpap_parser()
    mock_core.create_parser.return_value.parse.side_effect = err_cls("nope")
    with _patch_modules(mock_mod, mock_core, mock_sl):
        import importlib

        import cpap_parser_import
        importlib.reload(cpap_parser_import)
        assert cpap_parser_import.detect_open_cpap_layout(tmp_path) is False


def test_detect_raises_on_missing_directory():
    mock_mod, mock_core, _, _, mock_sl = _mock_cpap_parser()
    with _patch_modules(mock_mod, mock_core, mock_sl):
        import importlib

        import cpap_parser_import
        importlib.reload(cpap_parser_import)
        with pytest.raises(NotADirectoryError):
            cpap_parser_import.detect_open_cpap_layout(Path("/nonexistent/path"))


def test_run_import_empty_result(tmp_path):
    mock_mod, mock_core, _, _, mock_sl = _mock_cpap_parser()
    with _patch_modules(mock_mod, mock_core, mock_sl):
        import importlib

        import cpap_parser_import
        importlib.reload(cpap_parser_import)
        with patch.object(cpap_parser_import, "get_conn") as mock_get_conn:
            mock_get_conn.return_value = MagicMock()
            stats = cpap_parser_import.run_open_cpap_import("user-1", str(tmp_path))
    assert stats == {"imported": 0, "folders": 0, "errors": 0}


def test_run_import_single_session(tmp_path):
    from datetime import datetime

    start = datetime(2025, 1, 15, 22, 0, 0)
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

    mock_mod, mock_core, _, _, mock_sl = _mock_cpap_parser(sessions=[session])
    with _patch_modules(mock_mod, mock_core, mock_sl):
        import importlib

        import cpap_parser_import
        importlib.reload(cpap_parser_import)
        with patch.object(cpap_parser_import, "get_conn") as mock_get_conn, \
             patch.object(cpap_parser_import, "session_exists", return_value=False), \
             patch.object(cpap_parser_import, "upsert_session", return_value=42) as mock_upsert, \
             patch.object(cpap_parser_import, "replace_session_events"), \
             patch.object(cpap_parser_import, "replace_session_metrics_cpap"), \
             patch.object(cpap_parser_import, "replace_session_spo2_cpap"):
            mock_get_conn.return_value = MagicMock()
            stats = cpap_parser_import.run_open_cpap_import("user-1", str(tmp_path))

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

    mock_mod, mock_core, _, _, mock_sl = _mock_cpap_parser(sessions=[session])
    with _patch_modules(mock_mod, mock_core, mock_sl):
        import importlib

        import cpap_parser_import
        importlib.reload(cpap_parser_import)
        with patch.object(cpap_parser_import, "get_conn"), \
             patch.object(cpap_parser_import, "session_exists", return_value=True), \
             patch.object(cpap_parser_import, "upsert_session") as mock_upsert:
            stats = cpap_parser_import.run_open_cpap_import("user-1", str(tmp_path))

    mock_upsert.assert_not_called()
    assert stats["imported"] == 0


def test_run_import_localizes_naive_datetime(tmp_path):
    from datetime import datetime

    start = datetime(2025, 1, 15, 22, 0, 0)
    session = {
        "session_id": "open-cpap-20250115_220000",
        "folder_date": "2025-01-15",
        "block_index": 0,
        "start_datetime": start,
        "pld_start_datetime": start,
        "duration_seconds": 3600,
        "device_serial": None,
        "ahi": 1.0,
        "central_apnea_count": 0,
        "obstructive_apnea_count": 1,
        "hypopnea_count": 0,
        "apnea_count": 0,
        "arousal_count": None,
        "total_ahi_events": 1,
        "avg_pressure": 9.0,
        "p95_pressure": 11.0,
        "avg_leak": 2.0,
        "avg_resp_rate": 14.0,
        "avg_tidal_vol": 460.0,
        "avg_min_vent": 6.5,
        "avg_snore": 0.0,
        "avg_flow_lim": 0.0,
        "has_spo2": False,
        "spo2_avg": None,
        "spo2_min": None,
        "therapy_mode": "CPAP",
        "mask_type": None,
        "humidity_level": None,
        "temperature_c": None,
        "user_id": "user-1",
        "meta": {},
    }

    mock_mod, mock_core, _, _, mock_sl = _mock_cpap_parser(sessions=[session])
    with _patch_modules(mock_mod, mock_core, mock_sl):
        import importlib

        import cpap_parser_import
        importlib.reload(cpap_parser_import)
        with patch.object(cpap_parser_import, "get_conn") as mock_get_conn, \
             patch.object(cpap_parser_import, "session_exists", return_value=False), \
             patch.object(cpap_parser_import, "upsert_session", return_value=99) as mock_upsert, \
             patch.object(cpap_parser_import, "replace_session_events"), \
             patch.object(cpap_parser_import, "replace_session_metrics_cpap"), \
             patch.object(cpap_parser_import, "replace_session_spo2_cpap"):
            mock_get_conn.return_value = MagicMock()
            cpap_parser_import.run_open_cpap_import("user-1", str(tmp_path))

    upserted = mock_upsert.call_args[0][1]
    assert upserted["start_datetime"].tzinfo is not None
    assert upserted["pld_start_datetime"].tzinfo is not None


def _minimal_session(device_serial="SN999"):
    from datetime import datetime
    start = datetime(2025, 3, 1, 22, 0, 0)
    return {
        "session_id": "open-cpap-20250301_220000",
        "folder_date": "2025-03-01",
        "block_index": 0,
        "start_datetime": start,
        "pld_start_datetime": start,
        "duration_seconds": 28800,
        "device_serial": device_serial,
        "ahi": 2.0,
        "central_apnea_count": 0,
        "obstructive_apnea_count": 2,
        "hypopnea_count": 2,
        "apnea_count": 0,
        "arousal_count": None,
        "total_ahi_events": 4,
        "avg_pressure": 9.0,
        "p95_pressure": 11.0,
        "avg_leak": 3.0,
        "avg_resp_rate": 14.0,
        "avg_tidal_vol": 460.0,
        "avg_min_vent": 6.5,
        "avg_snore": 0.0,
        "avg_flow_lim": 0.0,
        "has_spo2": False,
        "spo2_avg": None,
        "spo2_min": None,
        "therapy_mode": "APAP",
        "mask_type": None,
        "humidity_level": None,
        "temperature_c": None,
        "user_id": "user-1",
        "meta": {"validation_status": "validated"},
    }


def test_run_import_calls_machine_equipment_helpers(tmp_path):
    session = _minimal_session(device_serial="SN999")
    mock_mod, mock_core, _, _, mock_sl = _mock_cpap_parser(sessions=[session])
    with _patch_modules(mock_mod, mock_core, mock_sl):
        import importlib

        import cpap_parser_import
        importlib.reload(cpap_parser_import)
        with patch.object(cpap_parser_import, "get_conn") as mock_get_conn, \
             patch.object(cpap_parser_import, "session_exists", return_value=False), \
             patch.object(cpap_parser_import, "upsert_session", return_value="db-id-42"), \
             patch.object(cpap_parser_import, "replace_session_events"), \
             patch.object(cpap_parser_import, "replace_session_metrics_cpap"), \
             patch.object(cpap_parser_import, "replace_session_spo2_cpap"), \
             patch.object(cpap_parser_import, "find_or_create_machine_equipment",
                          return_value="machine-uuid-1") as mock_find, \
             patch.object(cpap_parser_import, "update_session_machine_equipment") as mock_update:
            mock_get_conn.return_value = MagicMock()
            cpap_parser_import.run_open_cpap_import("user-1", str(tmp_path))

    mock_find.assert_called_once()
    find_kwargs = mock_find.call_args
    assert find_kwargs[1]["manufacturer"] == "TestDevice"
    assert find_kwargs[1]["device_serial"] == "SN999"
    assert find_kwargs[1]["parser_validated"] is True
    mock_update.assert_called_once_with(mock_get_conn.return_value, "db-id-42", "machine-uuid-1")


def test_run_import_machine_helpers_skipped_when_find_returns_none(tmp_path):
    session = _minimal_session(device_serial=None)
    session["device_serial"] = None
    mock_mod, mock_core, mock_dir, _, mock_sl = _mock_cpap_parser(sessions=[session])
    mock_dir.machine.series = None
    with _patch_modules(mock_mod, mock_core, mock_sl):
        import importlib

        import cpap_parser_import
        importlib.reload(cpap_parser_import)
        with patch.object(cpap_parser_import, "get_conn") as mock_get_conn, \
             patch.object(cpap_parser_import, "session_exists", return_value=False), \
             patch.object(cpap_parser_import, "upsert_session", return_value="db-id-77"), \
             patch.object(cpap_parser_import, "replace_session_events"), \
             patch.object(cpap_parser_import, "replace_session_metrics_cpap"), \
             patch.object(cpap_parser_import, "replace_session_spo2_cpap"), \
             patch.object(cpap_parser_import, "find_or_create_machine_equipment",
                          return_value=None) as mock_find, \
             patch.object(cpap_parser_import, "update_session_machine_equipment") as mock_update:
            mock_get_conn.return_value = MagicMock()
            cpap_parser_import.run_open_cpap_import("user-1", str(tmp_path))

    mock_find.assert_called_once()
    mock_update.assert_not_called()


def test_run_import_machine_helpers_not_called_for_skipped_session(tmp_path):
    session = _minimal_session()
    mock_mod, mock_core, _, _, mock_sl = _mock_cpap_parser(sessions=[session])
    with _patch_modules(mock_mod, mock_core, mock_sl):
        import importlib

        import cpap_parser_import
        importlib.reload(cpap_parser_import)
        with patch.object(cpap_parser_import, "get_conn"), \
             patch.object(cpap_parser_import, "session_exists", return_value=True), \
             patch.object(cpap_parser_import, "find_or_create_machine_equipment") as mock_find, \
             patch.object(cpap_parser_import, "update_session_machine_equipment") as mock_update:
            cpap_parser_import.run_open_cpap_import("user-1", str(tmp_path))

    mock_find.assert_not_called()
    mock_update.assert_not_called()


def test_run_import_events_regrouped(tmp_path):
    from datetime import datetime

    start = datetime(2025, 1, 15, 22, 0, 0)
    session = {
        "session_id": "open-cpap-20250115_220000",
        "folder_date": "2025-01-15",
        "block_index": 0,
        "start_datetime": start,
        "pld_start_datetime": start,
        "duration_seconds": 3600,
        "device_serial": None,
        "ahi": 2.0,
        "central_apnea_count": 0,
        "obstructive_apnea_count": 1,
        "hypopnea_count": 1,
        "apnea_count": 0,
        "arousal_count": None,
        "total_ahi_events": 2,
        "avg_pressure": 9.0,
        "p95_pressure": 11.0,
        "avg_leak": 2.0,
        "avg_resp_rate": 14.0,
        "avg_tidal_vol": 460.0,
        "avg_min_vent": 6.5,
        "avg_snore": 0.0,
        "avg_flow_lim": 0.0,
        "has_spo2": False,
        "spo2_avg": None,
        "spo2_min": None,
        "therapy_mode": "CPAP",
        "mask_type": None,
        "humidity_level": None,
        "temperature_c": None,
        "user_id": "user-1",
        "meta": {},
    }
    events = [
        ("Obstructive Apnea", 120.0, 15.0, start),
        ("Hypopnea", 600.0, 10.0, start),
    ]

    mock_mod, mock_core, _, _, mock_sl = _mock_cpap_parser(sessions=[session], events=events)
    with _patch_modules(mock_mod, mock_core, mock_sl):
        import importlib

        import cpap_parser_import
        importlib.reload(cpap_parser_import)
        with patch.object(cpap_parser_import, "get_conn") as mock_get_conn, \
             patch.object(cpap_parser_import, "session_exists", return_value=False), \
             patch.object(cpap_parser_import, "upsert_session", return_value=77), \
             patch.object(cpap_parser_import, "replace_session_events") as mock_events, \
             patch.object(cpap_parser_import, "replace_session_metrics_cpap"), \
             patch.object(cpap_parser_import, "replace_session_spo2_cpap"):
            mock_get_conn.return_value = MagicMock()
            cpap_parser_import.run_open_cpap_import("user-1", str(tmp_path))

    _, call_db_id, call_events, _ = mock_events.call_args[0]
    assert call_db_id == 77
    assert call_events == [(120.0, 15.0, "Obstructive Apnea"), (600.0, 10.0, "Hypopnea")]


def test_run_import_events_from_secondary_block(tmp_path):
    """Events whose session_start matches a sub-block (not the summary) are still stored."""
    from datetime import datetime

    summary_start = datetime(2025, 1, 15, 21, 17, 45)  # naive, matches summary
    block2_start  = datetime(2025, 1, 15, 21, 52, 42)  # naive, a later sub-block

    session = {
        "session_id": "open-cpap-20250115",
        "folder_date": "2025-01-15",
        "block_index": 0,
        "start_datetime": summary_start,
        "pld_start_datetime": summary_start,
        "duration_seconds": 14018,
        "device_serial": None,
        "ahi": None,
        "central_apnea_count": 0,
        "obstructive_apnea_count": 0,
        "hypopnea_count": 0,
        "apnea_count": 0,
        "arousal_count": None,
        "total_ahi_events": 0,
        "avg_pressure": 6.0,
        "p95_pressure": 6.0,
        "avg_leak": None,
        "avg_resp_rate": None,
        "avg_tidal_vol": None,
        "avg_min_vent": None,
        "avg_snore": None,
        "avg_flow_lim": None,
        "has_spo2": False,
        "spo2_avg": None,
        "spo2_min": None,
        "therapy_mode": "APAP",
        "mask_type": None,
        "humidity_level": None,
        "temperature_c": None,
        "user_id": "user-1",
        "meta": {},
    }
    # Event's session_start is block2_start (UTC-tagged), not the summary start.
    events = [
        ("ObstructiveApnea", 300.0, 15.0, block2_start.replace(tzinfo=UTC)),
    ]

    mock_mod, mock_core, _, _, mock_sl = _mock_cpap_parser(sessions=[session], events=events)
    with _patch_modules(mock_mod, mock_core, mock_sl):
        import importlib

        import cpap_parser_import
        importlib.reload(cpap_parser_import)
        with patch.object(cpap_parser_import, "get_conn") as mock_get_conn, \
             patch.object(cpap_parser_import, "session_exists", return_value=False), \
             patch.object(cpap_parser_import, "upsert_session", return_value=88), \
             patch.object(cpap_parser_import, "replace_session_events") as mock_events, \
             patch.object(cpap_parser_import, "replace_session_metrics_cpap"), \
             patch.object(cpap_parser_import, "replace_session_spo2_cpap"):
            mock_get_conn.return_value = MagicMock()
            cpap_parser_import.run_open_cpap_import("user-1", str(tmp_path))

    _, call_db_id, call_events, _ = mock_events.call_args[0]
    assert call_db_id == 88
    assert len(call_events) == 1
    # Onset normalized: offset(block2 - summary) + 300 = (21:52:42 - 21:17:45) + 300 = 2097 + 300
    onset, dur, ev_type = call_events[0]
    assert abs(onset - (2097 + 300)) < 1
    assert ev_type == "ObstructiveApnea"


def test_run_import_spo2_zero_filtered(tmp_path):
    """spo2_avg/spo2_min of 0.0 (no oximeter attached) are stored as NULL."""
    from datetime import datetime

    start = datetime(2025, 1, 15, 22, 0, 0)
    session = {
        "session_id": "open-cpap-20250115",
        "folder_date": "2025-01-15",
        "block_index": 0,
        "start_datetime": start,
        "pld_start_datetime": start,
        "duration_seconds": 3600,
        "device_serial": None,
        "ahi": None,
        "central_apnea_count": 0,
        "obstructive_apnea_count": 0,
        "hypopnea_count": 0,
        "apnea_count": 0,
        "arousal_count": None,
        "total_ahi_events": 0,
        "avg_pressure": 6.0,
        "p95_pressure": 6.0,
        "avg_leak": None,
        "avg_resp_rate": None,
        "avg_tidal_vol": None,
        "avg_min_vent": None,
        "avg_snore": None,
        "avg_flow_lim": None,
        "has_spo2": True,
        "spo2_avg": 0.0,
        "spo2_min": 0.0,
        "therapy_mode": "APAP",
        "mask_type": None,
        "humidity_level": None,
        "temperature_c": None,
        "user_id": "user-1",
        "meta": {},
    }

    mock_mod, mock_core, _, _, mock_sl = _mock_cpap_parser(sessions=[session])
    with _patch_modules(mock_mod, mock_core, mock_sl):
        import importlib

        import cpap_parser_import
        importlib.reload(cpap_parser_import)
        with patch.object(cpap_parser_import, "get_conn") as mock_get_conn, \
             patch.object(cpap_parser_import, "session_exists", return_value=False), \
             patch.object(cpap_parser_import, "upsert_session", return_value=55) as mock_upsert, \
             patch.object(cpap_parser_import, "replace_session_events"), \
             patch.object(cpap_parser_import, "replace_session_metrics_cpap"), \
             patch.object(cpap_parser_import, "replace_session_spo2_cpap"):
            mock_get_conn.return_value = MagicMock()
            cpap_parser_import.run_open_cpap_import("user-1", str(tmp_path))

    upserted = mock_upsert.call_args[0][1]
    assert upserted["avg_spo2"] is None, "spo2_avg=0.0 should be nulled out"
    assert upserted["min_spo2"] is None, "spo2_min=0.0 should be nulled out"


def test_run_import_summary_derived_from_timeseries(tmp_path):
    """avg_leak/avg_resp_rate etc. are computed from timeseries when adapter returns None."""
    from datetime import datetime

    start = datetime(2025, 1, 15, 22, 0, 0)
    session = {
        "session_id": "open-cpap-20250115",
        "folder_date": "2025-01-15",
        "block_index": 0,
        "start_datetime": start,
        "pld_start_datetime": start,
        "duration_seconds": 3600,
        "device_serial": None,
        "ahi": None,
        "central_apnea_count": 0,
        "obstructive_apnea_count": 0,
        "hypopnea_count": 0,
        "apnea_count": 0,
        "arousal_count": None,
        "total_ahi_events": 0,
        "avg_pressure": 6.0,
        "p95_pressure": 6.0,
        "avg_leak": None,
        "avg_resp_rate": None,
        "avg_tidal_vol": None,
        "avg_min_vent": None,
        "avg_snore": None,
        "avg_flow_lim": None,
        "has_spo2": False,
        "spo2_avg": None,
        "spo2_min": None,
        "therapy_mode": "APAP",
        "mask_type": None,
        "humidity_level": None,
        "temperature_c": None,
        "user_id": "user-1",
        "meta": {},
    }
    metrics = [
        {"ts": start.replace(tzinfo=UTC).timestamp() + i,
         "mask_pressure": 6.0, "pressure": None, "epr_pressure": None,
         "leak": 10.0, "resp_rate": 14.0, "tidal_vol": 450.0,
         "min_vent": 6.3, "snore": None, "flow_lim": None}
        for i in range(10)
    ]

    mock_mod, mock_core, mock_dir, _, mock_sl = _mock_cpap_parser(
        sessions=[session], metrics=metrics
    )
    # Give the mock block the same start_time so _folder_for_block assigns it correctly.
    mock_dir.sessions[0].start_time = start.replace(tzinfo=UTC)
    mock_sl.map_timeseries_to_metrics.return_value = metrics
    mock_sl.map_timeseries_to_spo2.return_value = []

    with _patch_modules(mock_mod, mock_core, mock_sl):
        import importlib

        import cpap_parser_import
        importlib.reload(cpap_parser_import)
        with patch.object(cpap_parser_import, "get_conn") as mock_get_conn, \
             patch.object(cpap_parser_import, "session_exists", return_value=False), \
             patch.object(cpap_parser_import, "upsert_session", return_value=66) as mock_upsert, \
             patch.object(cpap_parser_import, "replace_session_events"), \
             patch.object(cpap_parser_import, "replace_session_metrics_cpap"), \
             patch.object(cpap_parser_import, "replace_session_spo2_cpap"):
            mock_get_conn.return_value = MagicMock()
            cpap_parser_import.run_open_cpap_import("user-1", str(tmp_path))

    upserted = mock_upsert.call_args[0][1]
    assert upserted["avg_leak"] == 10.0
    assert upserted["avg_resp_rate"] == 14.0
    assert upserted["avg_tidal_vol"] == 450.0
    assert upserted["avg_min_vent"] == 6.3


def test_run_import_ahi_derived_from_events(tmp_path):
    """AHI and event counts are computed from parsed events when the adapter reports zeros."""
    from datetime import datetime

    start = datetime(2025, 1, 15, 22, 0, 0)
    session = {
        "session_id": "open-cpap-20250115",
        "folder_date": "2025-01-15",
        "block_index": 0,
        "start_datetime": start,
        "pld_start_datetime": start,
        "duration_seconds": 3600,  # 1 hour
        "device_serial": None,
        "ahi": None,
        "central_apnea_count": 0,
        "obstructive_apnea_count": 0,
        "hypopnea_count": 0,
        "apnea_count": 0,
        "arousal_count": None,
        "total_ahi_events": 0,
        "avg_pressure": 6.0,
        "p95_pressure": 6.0,
        "avg_leak": None,
        "avg_resp_rate": None,
        "avg_tidal_vol": None,
        "avg_min_vent": None,
        "avg_snore": None,
        "avg_flow_lim": None,
        "has_spo2": False,
        "spo2_avg": None,
        "spo2_min": None,
        "therapy_mode": "APAP",
        "mask_type": None,
        "humidity_level": None,
        "temperature_c": None,
        "user_id": "user-1",
        "meta": {},
    }
    events = [
        ("ObstructiveApnea", 300.0, 15.0, start.replace(tzinfo=UTC)),
        ("ObstructiveApnea", 600.0, 12.0, start.replace(tzinfo=UTC)),
        ("Hypopnea",         900.0, 10.0, start.replace(tzinfo=UTC)),
    ]

    mock_mod, mock_core, _, _, mock_sl = _mock_cpap_parser(sessions=[session], events=events)
    with _patch_modules(mock_mod, mock_core, mock_sl):
        import importlib

        import cpap_parser_import
        importlib.reload(cpap_parser_import)
        with patch.object(cpap_parser_import, "get_conn") as mock_get_conn, \
             patch.object(cpap_parser_import, "session_exists", return_value=False), \
             patch.object(cpap_parser_import, "upsert_session", return_value=77) as mock_upsert, \
             patch.object(cpap_parser_import, "replace_session_events"), \
             patch.object(cpap_parser_import, "replace_session_metrics_cpap"), \
             patch.object(cpap_parser_import, "replace_session_spo2_cpap"):
            mock_get_conn.return_value = MagicMock()
            cpap_parser_import.run_open_cpap_import("user-1", str(tmp_path))

    upserted = mock_upsert.call_args[0][1]
    assert upserted["obstructive_apnea_count"] == 2
    assert upserted["hypopnea_count"] == 1
    assert upserted["total_ahi_events"] == 3
    assert upserted["ahi"] == 3.0  # 3 events / 1 hour
