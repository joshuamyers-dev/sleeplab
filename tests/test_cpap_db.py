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
    conn.cursor.return_value.execute.assert_called_once_with(
        "DELETE FROM session_metrics WHERE session_id = %s", (1,)
    )


def test_replace_session_spo2_cpap_empty():
    sys.path.insert(0, "importer")
    from db import replace_session_spo2_cpap
    conn = _make_conn()
    replace_session_spo2_cpap(conn, 1, [])
    conn.cursor.return_value.execute.assert_called_once_with(
        "DELETE FROM session_spo2 WHERE session_id = %s", (1,)
    )
