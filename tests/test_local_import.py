import os
import uuid
from unittest.mock import patch


def test_save_local_path_roundtrip(client, auth_headers):
    resp = client.put(
        "/import/settings",
        json={"local_datalog_path": "/data/DATALOG"},
        headers=auth_headers,
    )
    assert resp.status_code == 200
    assert resp.json()["local_datalog_path"] == "/data/DATALOG"


def test_save_local_path_traversal_rejected(client, auth_headers):
    resp = client.put(
        "/import/settings",
        json={"local_datalog_path": "../../etc/passwd"},
        headers=auth_headers,
    )
    assert resp.status_code == 400


def test_save_local_path_subdir_accepted(client, auth_headers):
    resp = client.put(
        "/import/settings",
        json={"local_datalog_path": "/data/cpap/DATALOG"},
        headers=auth_headers,
    )
    assert resp.status_code == 200
    assert resp.json()["local_datalog_path"] == "/data/cpap/DATALOG"


def test_trigger_local_no_path(client, auth_headers):
    resp = client.post("/import/trigger-local", headers=auth_headers)
    assert resp.status_code == 400


def test_trigger_all_no_secret(client):
    resp = client.post("/import/trigger/all")
    assert resp.status_code == 403


def test_trigger_all_wrong_secret(client):
    with patch.dict(os.environ, {"IMPORT_WEBHOOK_SECRET": "correct-secret"}):
        resp = client.post(
            "/import/trigger/all",
            headers={"X-Import-Secret": "wrong-secret"},
        )
    assert resp.status_code == 403


def test_trigger_all_correct_secret_no_users(client):
    with patch.dict(os.environ, {"IMPORT_WEBHOOK_SECRET": "correct-secret"}):
        resp = client.post(
            "/import/trigger/all",
            headers={"X-Import-Secret": "correct-secret"},
        )
    assert resp.status_code == 200
    assert resp.json()["triggered"] == 0


def test_save_local_frequency(client, auth_headers):
    resp = client.put(
        "/import/settings",
        json={"local_import_frequency": "hourly"},
        headers=auth_headers,
    )
    assert resp.status_code == 200
    assert resp.json()["local_import_frequency"] == "hourly"


def test_trigger_local_path_not_found(client, auth_headers):
    client.put(
        "/import/settings",
        json={"local_datalog_path": "/data/nonexistent-path"},
        headers=auth_headers,
    )
    resp = client.post("/import/trigger-local", headers=auth_headers)
    assert resp.status_code == 400
    assert "not found" in resp.json()["detail"].lower()


# ── per-user webhook tests ──────────────────────────────────────────────────

def _webhook_url(user_id: str) -> str:
    return f"/import/webhook/{user_id}"


def test_webhook_per_user_no_secret(client, test_user):
    url = _webhook_url(test_user["id"])
    resp = client.post(url, json={"event": "cpap_sync_session", "status": "success"})
    assert resp.status_code == 403


def test_webhook_per_user_wrong_secret(client, test_user):
    with patch.dict(os.environ, {"IMPORT_WEBHOOK_SECRET": "correct-secret"}):
        resp = client.post(
            _webhook_url(test_user["id"]),
            json={"event": "cpap_sync_session", "status": "success"},
            headers={"X-Import-Secret": "wrong-secret"},
        )
    assert resp.status_code == 403


def test_webhook_per_user_malformed_uuid(client):
    with patch.dict(os.environ, {"IMPORT_WEBHOOK_SECRET": "correct-secret"}):
        resp = client.post(
            "/import/webhook/not-a-uuid",
            json={"event": "cpap_sync_session", "status": "success"},
            headers={"X-Import-Secret": "correct-secret"},
        )
    assert resp.status_code == 422


def test_webhook_per_user_unknown_uuid(client):
    unknown = str(uuid.uuid4())
    with patch.dict(os.environ, {"IMPORT_WEBHOOK_SECRET": "correct-secret"}):
        resp = client.post(
            _webhook_url(unknown),
            json={"event": "cpap_sync_session", "status": "success"},
            headers={"X-Import-Secret": "correct-secret"},
        )
    assert resp.status_code == 404


def test_webhook_per_user_status_error_skipped(client, auth_headers, test_user):
    # Ensure import settings row exists
    client.put("/import/settings", json={"local_datalog_path": "/data/DATALOG"}, headers=auth_headers)
    with patch.dict(os.environ, {"IMPORT_WEBHOOK_SECRET": "correct-secret"}):
        resp = client.post(
            _webhook_url(test_user["id"]),
            json={"event": "cpap_sync_session", "status": "error"},
            headers={"X-Import-Secret": "correct-secret"},
        )
    assert resp.status_code == 200
    assert resp.json()["status"] == "skipped"
    # Error status should be recorded
    settings = client.get("/import/settings", headers=auth_headers).json()
    assert settings["last_local_import_status"] is not None
    assert "upstream error" in settings["last_local_import_status"]


def test_webhook_per_user_no_path_configured(client, test_user):
    # Insert settings row with no path
    with patch.dict(os.environ, {"IMPORT_WEBHOOK_SECRET": "correct-secret"}):
        resp = client.post(
            _webhook_url(test_user["id"]),
            json={"event": "cpap_sync_session", "status": "success"},
            headers={"X-Import-Secret": "correct-secret"},
        )
    assert resp.status_code in (400, 404)
