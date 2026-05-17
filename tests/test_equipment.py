import uuid

from fastapi.testclient import TestClient


class TestListEquipment:
    def test_empty(self, client: TestClient, auth_headers):
        resp = client.get("/equipment/", headers=auth_headers)
        assert resp.status_code == 200
        assert resp.json() == []

    def test_after_create(self, client: TestClient, auth_headers):
        client.post("/equipment/", headers=auth_headers, json={
            "equipment_type": "cushion",
            "start_date": "2025-06-01",
            "brand": "ResMed",
            "model": "P10",
        })
        resp = client.get("/equipment/", headers=auth_headers)
        assert resp.status_code == 200
        data = resp.json()
        assert len(data) >= 1
        assert any(e["brand"] == "ResMed" for e in data)

    def test_unauthenticated(self, client: TestClient):
        resp = client.get("/equipment/")
        assert resp.status_code == 401


class TestCreateEquipment:
    def test_create_cushion(self, client: TestClient, auth_headers):
        resp = client.post("/equipment/", headers=auth_headers, json={
            "equipment_type": "cushion",
            "start_date": "2025-06-01",
            "mask_category": "Nasal Pillows",
            "brand": "ResMed",
            "model": "P10",
        })
        assert resp.status_code == 201
        data = resp.json()
        assert data["equipment_type"] == "cushion"
        assert data["brand"] == "ResMed"
        assert data["id"] is not None
        assert data["days_in_use"] is not None

    def test_create_tubing(self, client: TestClient, auth_headers):
        resp = client.post("/equipment/", headers=auth_headers, json={
            "equipment_type": "tubing",
            "start_date": "2025-06-15",
            "replacement_days": 90,
        })
        assert resp.status_code == 201
        data = resp.json()
        assert data["equipment_type"] == "tubing"
        assert data["replacement_days"] == 90

    def test_invalid_type(self, client: TestClient, auth_headers):
        resp = client.post("/equipment/", headers=auth_headers, json={
            "equipment_type": "invalid_type",
            "start_date": "2025-06-01",
        })
        assert resp.status_code == 422

    def test_unauthenticated(self, client: TestClient):
        resp = client.post("/equipment/", json={
            "equipment_type": "cushion",
            "start_date": "2025-06-01",
        })
        assert resp.status_code == 401


class TestUpdateEquipment:
    def test_update_start_date(self, client: TestClient, auth_headers):
        create = client.post("/equipment/", headers=auth_headers, json={
            "equipment_type": "filter",
            "start_date": "2025-01-01",
        })
        eq_id = create.json()["id"]
        resp = client.put(f"/equipment/{eq_id}", headers=auth_headers, json={
            "start_date": "2025-03-01",
        })
        assert resp.status_code == 200
        assert resp.json()["start_date"] == "2025-03-01"

    def test_nonexistent(self, client: TestClient, auth_headers):
        fake_id = str(uuid.uuid4())
        resp = client.put(f"/equipment/{fake_id}", headers=auth_headers, json={
            "start_date": "2025-01-01",
        })
        assert resp.status_code == 404

    def test_unauthenticated(self, client: TestClient):
        resp = client.put("/equipment/some-id", json={
            "start_date": "2025-01-01",
        })
        assert resp.status_code == 401


class TestDeleteEquipment:
    def test_delete_existing(self, client: TestClient, auth_headers):
        create = client.post("/equipment/", headers=auth_headers, json={
            "equipment_type": "headgear",
            "start_date": "2025-01-01",
        })
        eq_id = create.json()["id"]
        resp = client.delete(f"/equipment/{eq_id}", headers=auth_headers)
        assert resp.status_code == 204

    def test_nonexistent(self, client: TestClient, auth_headers):
        fake_id = str(uuid.uuid4())
        resp = client.delete(f"/equipment/{fake_id}", headers=auth_headers)
        assert resp.status_code == 404

    def test_unauthenticated(self, client: TestClient):
        resp = client.delete("/equipment/some-id")
        assert resp.status_code == 401


class TestInferredEquipment:
    def test_empty(self, client: TestClient, auth_headers):
        resp = client.get("/equipment/inferred", headers=auth_headers)
        assert resp.status_code == 200
        data = resp.json()
        for eq_type in ("cushion", "headgear", "tubing", "humidifier_chamber", "filter"):
            assert data.get(eq_type) is None

    def test_with_equipment(self, client: TestClient, auth_headers):
        client.post("/equipment/", headers=auth_headers, json={
            "equipment_type": "cushion",
            "start_date": "2025-01-01",
            "brand": "ResMed",
        })
        resp = client.get("/equipment/inferred?ref_date=2025-06-01", headers=auth_headers)
        assert resp.status_code == 200
        data = resp.json()
        assert data.get("cushion") is not None
        assert data["cushion"]["brand"] == "ResMed"
        assert data.get("headgear") is None

    def test_unauthenticated(self, client: TestClient):
        resp = client.get("/equipment/inferred")
        assert resp.status_code == 401
