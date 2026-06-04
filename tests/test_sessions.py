import uuid
from datetime import UTC, date, datetime

from fastapi.testclient import TestClient
from sqlalchemy import text

from api.routers.sessions import _build_pdf_report, _manufacturer_select_expression, _mask_device_serial


class _ScalarResult:
    def __init__(self, value: bool):
        self.value = value

    def scalar(self):
        return self.value


class _ColumnExistsDb:
    def __init__(self, value: bool):
        self.value = value

    def execute(self, *_args, **_kwargs):
        return _ScalarResult(self.value)


def _seed_session(
    db,
    user_id: str,
    folder_date: date | None = None,
    *,
    note: str | None = None,
    total_ahi_events: int = 16,
    avg_pressure: float | None = 10.2,
    p95_pressure: float | None = 12.4,
    avg_leak: float | None = 0.012,
    device_serial: str | None = "SN12345",
    therapy_mode: str | None = None,
    mask_type: str | None = None,
    manufacturer: str | None = None,
    include_manufacturer: bool = False,
):
    if folder_date is None:
        folder_date = date.today()
    session_id = str(uuid.uuid4())
    manufacturer_column = ", manufacturer" if include_manufacturer else ""
    manufacturer_value = ", :manufacturer" if include_manufacturer else ""
    db.execute(
        text(f"""
            INSERT INTO sessions (
                id, session_id, folder_date, start_datetime, pld_start_datetime,
                duration_seconds, device_serial, has_spo2, user_id,
                total_ahi_events, avg_pressure, p95_pressure, avg_leak, therapy_mode, mask_type, note{manufacturer_column}
            ) VALUES (
                CAST(:sid AS uuid), :sid, :fd, :start, :start,
                28800, :device_serial, FALSE, CAST(:uid AS uuid),
                :total_ahi_events, :avg_pressure, :p95_pressure, :avg_leak, :therapy_mode, :mask_type, :note{manufacturer_value}
            )
        """),
        {
            "sid": session_id,
            "fd": folder_date,
            "start": datetime(2025, 1, 15, 22, 0, 0, tzinfo=UTC),
            "uid": user_id,
            "note": note,
            "total_ahi_events": total_ahi_events,
            "avg_pressure": avg_pressure,
            "p95_pressure": p95_pressure,
            "avg_leak": avg_leak,
            "device_serial": device_serial,
            "therapy_mode": therapy_mode,
            "mask_type": mask_type,
            "manufacturer": manufacturer,
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

    def test_get_detail_includes_note(self, client: TestClient, auth_headers, test_user, db):
        sid = _seed_session(db, test_user["id"], note="Tried mouth tape")
        resp = client.get(f"/sessions/{sid}", headers=auth_headers)
        assert resp.status_code == 200
        assert resp.json()["note"] == "Tried mouth tape"

    def test_get_nonexistent(self, client: TestClient, auth_headers):
        fake_id = "00000000-0000-0000-0000-000000000000"
        resp = client.get(f"/sessions/{fake_id}", headers=auth_headers)
        assert resp.status_code == 404


class TestExportSessionPdf:
    def test_mask_device_serial(self):
        assert _mask_device_serial("SN1234505581") == "...05581"
        assert _mask_device_serial("1234") == "...1234"

    def test_manufacturer_fallback_sql_uses_typed_constant(self):
        expression = _manufacturer_select_expression(_ColumnExistsDb(False))

        assert expression == "'Unknown'::text AS manufacturer"
        assert "array_agg('Unknown'" not in expression

    def test_manufacturer_column_sql_aggregates_column_with_unknown_fallback(self):
        expression = _manufacturer_select_expression(_ColumnExistsDb(True))

        assert "array_agg(s.manufacturer ORDER BY s.duration_seconds DESC)" in expression
        assert "FILTER (WHERE s.manufacturer IS NOT NULL)" in expression
        assert "'Unknown'" in expression

    def test_pdf_omits_repeated_unavailable_equipment_rows(self):
        pdf = _build_pdf_report(
            "20260511",
            "20260515",
            date(2026, 5, 11),
            date(2026, 5, 15),
            [
                {
                    "folder_date": date(2026, 5, 11),
                    "ahi": 1.2,
                    "avg_pressure": 5.1,
                    "p95_pressure": 7.2,
                    "avg_leak": 0.0349,
                    "manufacturer": "Unknown",
                    "device_serial": "SN1234505581",
                    "therapy_mode": None,
                    "mask_type": None,
                }
            ],
        ).getvalue()

        assert b"Device serial / identifier" in pdf
        assert b"...05581" in pdf
        assert b"SN1234505581" not in pdf
        assert b"Machine model/type" not in pdf
        assert b"Manufacturer" not in pdf
        assert b"Unavailable" not in pdf
        assert b"Some equipment details were not available for this device." in pdf
        assert b"20260511" not in pdf

    def test_pdf_keeps_short_range_note(self):
        pdf = _build_pdf_report(
            "20260511",
            "20260515",
            date(2026, 5, 11),
            date(2026, 5, 15),
            [
                {
                    "folder_date": date(2026, 5, 11),
                    "ahi": 1.2,
                    "avg_pressure": 5.1,
                    "p95_pressure": 7.2,
                    "avg_leak": 0.0349,
                    "manufacturer": "Unknown",
                    "device_serial": "SN123",
                    "therapy_mode": None,
                    "mask_type": None,
                }
            ],
        ).getvalue()

        assert b"This report includes fewer than 7 nights of data and may not be representative." in pdf

    def test_requires_auth(self, client: TestClient):
        resp = client.get("/sessions/export/pdf?from=20260501&to=20260530")
        assert resp.status_code == 401

    def test_rejects_invalid_date_format(self, client: TestClient, auth_headers):
        resp = client.get("/sessions/export/pdf?from=2026-05-01&to=20260530", headers=auth_headers)
        assert resp.status_code == 400
        assert "YYYYMMDD" in resp.json()["detail"]

    def test_rejects_invalid_calendar_date(self, client: TestClient, auth_headers):
        resp = client.get("/sessions/export/pdf?from=20260501&to=20260230", headers=auth_headers)
        assert resp.status_code == 400
        assert "valid calendar date" in resp.json()["detail"]

    def test_rejects_to_before_from(self, client: TestClient, auth_headers):
        resp = client.get("/sessions/export/pdf?from=20260530&to=20260501", headers=auth_headers)
        assert resp.status_code == 400
        assert "to must be on or after from" in resp.json()["detail"]

    def test_valid_request_returns_pdf_with_filename(self, client: TestClient, auth_headers, test_user, db):
        _seed_session(db, test_user["id"], date(2026, 5, 1), therapy_mode="APAP", mask_type="Nasal")
        resp = client.get("/sessions/export/pdf?from=20260501&to=20260530", headers=auth_headers)

        assert resp.status_code == 200
        assert resp.headers["content-type"].startswith("application/pdf")
        assert resp.headers["content-disposition"] == "attachment; filename=sleeplab-report-20260501-20260530.pdf"
        assert resp.content.startswith(b"%PDF")

    def test_short_range_warns_about_representativeness(self, client: TestClient, auth_headers, test_user, db):
        _seed_session(db, test_user["id"], date(2026, 5, 1))
        resp = client.get("/sessions/export/pdf?from=20260501&to=20260503", headers=auth_headers)

        assert resp.status_code == 200
        assert b"fewer than 7 nights of data" in resp.content

    def test_known_manufacturer_is_reported_without_prominent_unknown(self, client: TestClient, auth_headers, test_user, db):
        db.execute(text("ALTER TABLE sessions ADD COLUMN IF NOT EXISTS manufacturer TEXT"))
        _seed_session(
            db,
            test_user["id"],
            date(2026, 5, 1),
            manufacturer="ResMed",
            include_manufacturer=True,
        )
        _seed_session(
            db,
            test_user["id"],
            date(2026, 5, 2),
            manufacturer=None,
            include_manufacturer=True,
        )

        resp = client.get("/sessions/export/pdf?from=20260501&to=20260502", headers=auth_headers)

        assert resp.status_code == 200
        assert b"ResMed" in resp.content
        assert b"Manufacturer" in resp.content
        assert b"Unknown" not in resp.content

    def test_missing_optional_metrics_do_not_crash(self, client: TestClient, auth_headers, test_user, db):
        _seed_session(
            db,
            test_user["id"],
            date(2026, 5, 1),
            avg_pressure=None,
            p95_pressure=None,
            avg_leak=None,
            device_serial=None,
        )

        resp = client.get("/sessions/export/pdf?from=20260501&to=20260501", headers=auth_headers)

        assert resp.status_code == 200
        assert resp.content.startswith(b"%PDF")
        assert b"Unavailable" in resp.content


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
