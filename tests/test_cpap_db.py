import sys
from unittest.mock import MagicMock


def _make_conn():
    conn = MagicMock()
    conn.cursor.return_value.__enter__ = lambda s: s
    conn.cursor.return_value.__exit__ = MagicMock(return_value=False)
    return conn


def test_replace_session_metrics_cpap_empty():
    sys.path.insert(0, "importer")
    from db import replace_session_metrics_cpap

    conn = _make_conn()
    replace_session_metrics_cpap(conn, 1, [])
    conn.cursor.return_value.execute.assert_called_once_with("DELETE FROM session_metrics WHERE session_id = %s", (1,))


def test_replace_session_spo2_cpap_empty():
    sys.path.insert(0, "importer")
    from db import replace_session_spo2_cpap

    conn = _make_conn()
    replace_session_spo2_cpap(conn, 1, [])
    conn.cursor.return_value.execute.assert_called_once_with("DELETE FROM session_spo2 WHERE session_id = %s", (1,))


def test_find_or_create_machine_equipment_creates_new_record():
    sys.path.insert(0, "importer")
    from db import find_or_create_machine_equipment

    conn = _make_conn()
    new_uuid = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee"
    # First fetchone: SELECT returns None (no existing); second: INSERT RETURNING
    conn.cursor.return_value.fetchone.side_effect = [None, (new_uuid,)]
    result = find_or_create_machine_equipment(conn, "user-1", "ResMed", "SN12345", "AirSense 11", True)
    assert result == new_uuid
    calls = conn.cursor.return_value.execute.call_args_list
    # First call must be a SELECT, second an INSERT
    assert "SELECT" in calls[0][0][0]
    assert "INSERT" in calls[1][0][0]
    assert "machine" in calls[1][0][0]


def test_find_or_create_machine_equipment_returns_existing_record():
    sys.path.insert(0, "importer")
    from db import find_or_create_machine_equipment

    conn = _make_conn()
    existing_uuid = "11111111-2222-3333-4444-555555555555"
    conn.cursor.return_value.fetchone.return_value = (existing_uuid,)
    result = find_or_create_machine_equipment(conn, "user-1", "ResMed", "SN12345", None, False)
    assert result == existing_uuid
    calls = conn.cursor.return_value.execute.call_args_list
    # SELECT + UPDATE only, no INSERT
    assert len(calls) == 2
    assert "SELECT" in calls[0][0][0]
    assert "UPDATE" in calls[1][0][0]


def test_find_or_create_machine_equipment_returns_none_when_both_absent():
    sys.path.insert(0, "importer")
    from db import find_or_create_machine_equipment

    conn = _make_conn()
    result = find_or_create_machine_equipment(conn, "user-1", None, None, None, True)
    assert result is None
    conn.cursor.return_value.execute.assert_not_called()


def test_update_session_machine_equipment_executes_update():
    sys.path.insert(0, "importer")
    from db import update_session_machine_equipment

    conn = _make_conn()
    update_session_machine_equipment(conn, "session-uuid-1", "machine-uuid-1")
    conn.cursor.return_value.execute.assert_called_once_with(
        "UPDATE sessions SET machine_equipment_id = %s WHERE id = %s",
        ("machine-uuid-1", "session-uuid-1"),
    )
