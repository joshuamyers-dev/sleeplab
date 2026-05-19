import os
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
