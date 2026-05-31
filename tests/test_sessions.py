import uuid
from datetime import UTC, date, datetime

from fastapi.testclient import TestClient
from sqlalchemy import text


def _seed_session(
    db,
    user_id: str,
    folder_date: date | None = None,
    note: str | None = None,
    tags: list[str] | None = None,
    duration_seconds: int = 28800,
):
    if folder_date is None:
        folder_date = date.today()
    session_id = str(uuid.uuid4())
    db.execute(
        text("""
            INSERT INTO sessions (
                id, session_id, folder_date, start_datetime, pld_start_datetime,
                duration_seconds, device_serial, has_spo2, user_id, note, tags
            ) VALUES (
                CAST(:sid AS uuid), :sid, :fd, :start, :start,
                :duration_seconds, 'SN12345', FALSE, CAST(:uid AS uuid), :note, CAST(:tags AS text[])
            )
        """),
        {
            "sid": session_id,
            "fd": folder_date,
            "start": datetime(2025, 1, 15, 22, 0, 0, tzinfo=UTC),
            "uid": user_id,
            "note": note,
            "tags": tags,
            "duration_seconds": duration_seconds,
        },
    )
    db.commit()
    return session_id


class TestListSessions:
    def test_list_authenticated(self, client: TestClient, auth_headers, test_user, db):
        _seed_session(db, test_user["id"])
        resp = client.get("/sessions/", headers=auth_headers)
        assert resp.status_code == 200
        data = resp.json()
        assert isinstance(data, list)
        assert len(data) >= 1

    def test_list_unauthenticated(self, client: TestClient):
        resp = client.get("/sessions/")
        assert resp.status_code == 401


class TestGetSession:
    def test_get_detail(self, client: TestClient, auth_headers, test_user, db):
        sid = _seed_session(db, test_user["id"])
        resp = client.get(f"/sessions/{sid}", headers=auth_headers)
        assert resp.status_code == 200
        data = resp.json()
        assert data["id"] == sid
        assert data["session_id"] == sid
        assert data["duration_seconds"] == 28800
        assert data.get("therapy_mode") is None
        assert data.get("mask_type") is None
        assert data.get("humidity_level") is None
        assert data.get("temperature_c") is None
        assert data.get("machine_tz") is None
        assert data.get("note") is None
        assert data.get("tags") == []

    def test_get_detail_includes_note(self, client: TestClient, auth_headers, test_user, db):
        sid = _seed_session(db, test_user["id"], note="Tried mouth tape")
        resp = client.get(f"/sessions/{sid}", headers=auth_headers)
        assert resp.status_code == 200
        assert resp.json()["note"] == "Tried mouth tape"

    def test_get_detail_includes_tags(self, client: TestClient, auth_headers, test_user, db):
        sid = _seed_session(db, test_user["id"], tags=["Travel", "Sick"])
        resp = client.get(f"/sessions/{sid}", headers=auth_headers)
        assert resp.status_code == 200
        assert resp.json()["tags"] == ["Travel", "Sick"]

    def test_get_nonexistent(self, client: TestClient, auth_headers):
        fake_id = "00000000-0000-0000-0000-000000000000"
        resp = client.get(f"/sessions/{fake_id}", headers=auth_headers)
        assert resp.status_code == 404


class TestSessionNotes:
    def test_save_note_persists(self, client: TestClient, auth_headers, test_user, db):
        sid = _seed_session(db, test_user["id"])
        resp = client.put(f"/sessions/{sid}/note", headers=auth_headers, json={"note": "Had 2 beers"})
        assert resp.status_code == 200
        assert resp.json()["note"] == "Had 2 beers"

        detail = client.get(f"/sessions/{sid}", headers=auth_headers)
        assert detail.status_code == 200
        assert detail.json()["note"] == "Had 2 beers"

    def test_update_note_replaces_existing_note(self, client: TestClient, auth_headers, test_user, db):
        sid = _seed_session(db, test_user["id"], note="Old mask")
        resp = client.put(f"/sessions/{sid}/note", headers=auth_headers, json={"note": "New mask cushion"})
        assert resp.status_code == 200
        assert resp.json()["note"] == "New mask cushion"

    def test_whitespace_note_clears_existing_note(self, client: TestClient, auth_headers, test_user, db):
        sid = _seed_session(db, test_user["id"], note="Felt congested")
        resp = client.put(f"/sessions/{sid}/note", headers=auth_headers, json={"note": "   "})
        assert resp.status_code == 200
        assert resp.json()["note"] is None

        detail = client.get(f"/sessions/{sid}", headers=auth_headers)
        assert detail.status_code == 200
        assert detail.json()["note"] is None

    def test_save_note_for_missing_session_returns_safe_error(self, client: TestClient, auth_headers):
        fake_id = "00000000-0000-0000-0000-000000000000"
        resp = client.put(f"/sessions/{fake_id}/note", headers=auth_headers, json={"note": "Used new pillow"})
        assert resp.status_code == 404
        assert resp.json() == {"detail": "Session not found"}

    def test_invalid_note_payload_returns_validation_error(self, client: TestClient, auth_headers, test_user, db):
        sid = _seed_session(db, test_user["id"], note="Keep my draft server-side")
        resp = client.put(f"/sessions/{sid}/note", headers=auth_headers, json={"note": {"text": "not plain text"}})
        assert resp.status_code == 422

        detail = client.get(f"/sessions/{sid}", headers=auth_headers)
        assert detail.status_code == 200
        assert detail.json()["note"] == "Keep my draft server-side"


class TestSessionTags:
    def test_save_tags_persists(self, client: TestClient, auth_headers, test_user, db):
        sid = _seed_session(db, test_user["id"])
        resp = client.put(f"/sessions/{sid}/tags", headers=auth_headers, json={"tags": ["Travel", "Alcohol"]})
        assert resp.status_code == 200
        assert resp.json()["tags"] == ["Travel", "Alcohol"]

        detail = client.get(f"/sessions/{sid}", headers=auth_headers)
        assert detail.status_code == 200
        assert detail.json()["tags"] == ["Travel", "Alcohol"]

    def test_save_tags_applies_to_all_blocks_for_night(self, client: TestClient, auth_headers, test_user, db):
        folder_date = date(2025, 1, 16)
        shorter_sid = _seed_session(db, test_user["id"], folder_date=folder_date, duration_seconds=3600)
        longer_sid = _seed_session(db, test_user["id"], folder_date=folder_date, duration_seconds=7200)

        resp = client.put(f"/sessions/{shorter_sid}/tags", headers=auth_headers, json={"tags": ["New mask", "Good sleep"]})
        assert resp.status_code == 200
        assert resp.json()["tags"] == ["New mask", "Good sleep"]

        rows = db.execute(
            text("""
                SELECT tags
                FROM sessions
                WHERE user_id = CAST(:uid AS uuid)
                  AND folder_date = :folder_date
                ORDER BY duration_seconds
            """),
            {"uid": test_user["id"], "folder_date": folder_date},
        ).mappings().all()
        assert [row["tags"] for row in rows] == [["New mask", "Good sleep"], ["New mask", "Good sleep"]]

        detail = client.get(f"/sessions/{longer_sid}", headers=auth_headers)
        assert detail.status_code == 200
        assert detail.json()["tags"] == ["New mask", "Good sleep"]

    def test_clear_tags_with_empty_array(self, client: TestClient, auth_headers, test_user, db):
        sid = _seed_session(db, test_user["id"], tags=["Camping"])
        resp = client.put(f"/sessions/{sid}/tags", headers=auth_headers, json={"tags": []})
        assert resp.status_code == 200
        assert resp.json()["tags"] == []

        detail = client.get(f"/sessions/{sid}", headers=auth_headers)
        assert detail.status_code == 200
        assert detail.json()["tags"] == []

    def test_invalid_tag_is_rejected_without_partial_update(self, client: TestClient, auth_headers, test_user, db):
        sid = _seed_session(db, test_user["id"], note="Keep note", tags=["Travel"])
        resp = client.put(f"/sessions/{sid}/tags", headers=auth_headers, json={"tags": ["Travel", "Bookmark"]})
        assert resp.status_code == 422
        assert resp.json() == {"detail": "Invalid session tag: Bookmark"}

        detail = client.get(f"/sessions/{sid}", headers=auth_headers)
        assert detail.status_code == 200
        assert detail.json()["tags"] == ["Travel"]
        assert detail.json()["note"] == "Keep note"
