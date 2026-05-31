import uuid
from datetime import UTC, date, datetime

from fastapi.testclient import TestClient
from sqlalchemy import text


def _seed_session(
    db,
    user_id: str,
    folder_date: date | None = None,
    duration_seconds: int = 28800,
    total_ahi_events: int = 0,
    avg_leak: float | None = None,
    has_spo2: bool = False,
    avg_spo2: float | None = None,
    min_spo2: float | None = None,
):
    if folder_date is None:
        folder_date = date.today()
    session_id = str(uuid.uuid4())
    db.execute(
        text("""
            INSERT INTO sessions (
                id, session_id, folder_date, start_datetime, pld_start_datetime,
                duration_seconds, device_serial, has_spo2, avg_spo2, min_spo2,
                total_ahi_events, avg_leak, user_id
            ) VALUES (
                CAST(:sid AS uuid), :sid, :fd, :start, :start,
                :duration_seconds, 'SN12345', :has_spo2, :avg_spo2, :min_spo2,
                :total_ahi_events, :avg_leak, CAST(:uid AS uuid)
            )
        """),
        {
            "sid": session_id,
            "fd": folder_date,
            "start": datetime(2025, 1, 15, 22, 0, 0, tzinfo=UTC),
            "uid": user_id,
            "duration_seconds": duration_seconds,
            "total_ahi_events": total_ahi_events,
            "avg_leak": avg_leak,
            "has_spo2": has_spo2,
            "avg_spo2": avg_spo2,
            "min_spo2": min_spo2,
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
        assert data["therapy_score"]["total"] == 100
        assert data["therapy_score"]["grade"] == "A"
        assert data["score_vs_30d_avg"] is None

    def test_get_detail_includes_score_vs_30d_avg(self, client: TestClient, auth_headers, test_user, db):
        _seed_session(
            db,
            test_user["id"],
            folder_date=date(2025, 1, 14),
            total_ahi_events=80,
            avg_leak=0.8,
            duration_seconds=4 * 3600,
        )
        sid = _seed_session(
            db,
            test_user["id"],
            folder_date=date(2025, 1, 15),
            total_ahi_events=4,
            avg_leak=0.1,
            duration_seconds=8 * 3600,
        )

        resp = client.get(f"/sessions/{sid}", headers=auth_headers)
        assert resp.status_code == 200
        assert resp.json()["score_vs_30d_avg"] is not None

    def test_get_nonexistent(self, client: TestClient, auth_headers):
        fake_id = "00000000-0000-0000-0000-000000000000"
        resp = client.get(f"/sessions/{fake_id}", headers=auth_headers)
        assert resp.status_code == 404
