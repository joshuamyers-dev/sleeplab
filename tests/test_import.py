from unittest.mock import patch

import pytest
from fastapi.testclient import TestClient


class TestGetSettings:
    """Test suite for get settings."""

    def test_defaults(self, client: TestClient, auth_headers):
        """Test defaults."""
        resp = client.get("/import/settings", headers=auth_headers)
        assert resp.status_code == 200
        data = resp.json()
        assert data["sleephq_client_id"] is None
        assert data["sleephq_client_secret"] is None
        assert data["has_client_secret"] is False
        assert data["auto_import_sleephq"] is False
        assert data["lookback_days"] == 30
        assert data["sleephq_enabled"] is False

    def test_after_save(self, client: TestClient, auth_headers):
        """Test after save."""
        client.put(
            "/import/settings",
            headers=auth_headers,
            json={
                "sleephq_client_id": "test-client-id",
                "sleephq_client_secret": "test-secret",
            },
        )
        resp = client.get("/import/settings", headers=auth_headers)
        assert resp.status_code == 200
        data = resp.json()
        assert data["sleephq_client_id"] == "test-client-id"
        assert data["sleephq_client_secret"] is None
        assert data["has_client_secret"] is True

    def test_unauthenticated(self, client: TestClient):
        """Test unauthenticated."""
        resp = client.get("/import/settings")
        assert resp.status_code == 401


class TestPutSettings:
    """Test suite for put settings."""

    def test_save_and_overwrite(self, client: TestClient, auth_headers):
        """Test save and overwrite."""
        resp = client.put(
            "/import/settings",
            headers=auth_headers,
            json={
                "sleephq_client_id": "client-1",
                "sleephq_client_secret": "secret-1",
                "lookback_days": 14,
            },
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["sleephq_client_id"] == "client-1"
        assert data["lookback_days"] == 14

        resp2 = client.put(
            "/import/settings",
            headers=auth_headers,
            json={
                "lookback_days": 60,
            },
        )
        assert resp2.status_code == 200
        data2 = resp2.json()
        assert data2["sleephq_client_id"] == "client-1"
        assert data2["lookback_days"] == 60

    def test_does_not_overwrite_secret_on_null(self, client: TestClient, auth_headers):
        """Test does not overwrite secret on null."""
        client.put(
            "/import/settings",
            headers=auth_headers,
            json={
                "sleephq_client_secret": "real-secret",
            },
        )
        resp = client.put(
            "/import/settings",
            headers=auth_headers,
            json={
                "sleephq_client_secret": None,
            },
        )
        assert resp.status_code == 200
        assert resp.json()["has_client_secret"] is True

    def test_unauthenticated(self, client: TestClient):
        """Test unauthenticated."""
        resp = client.put("/import/settings", json={"lookback_days": 7})
        assert resp.status_code == 401


class TestTrigger:
    """Test suite for trigger."""

    def test_disabled(self, client: TestClient, auth_headers):
        # SLEEPHQ_ENABLED unset (default) → 503 before credential check
        """Test disabled."""
        resp = client.post("/import/trigger", headers=auth_headers)
        assert resp.status_code == 503
        assert "SLEEPHQ_ENABLED" in resp.json()["detail"]

    def test_without_credentials(self, client: TestClient, auth_headers):
        """Test without credentials."""
        with patch.dict("os.environ", {"SLEEPHQ_ENABLED": "true"}):
            resp = client.post("/import/trigger", headers=auth_headers)
        assert resp.status_code == 400
        assert "credentials" in resp.json()["detail"].lower()

    def test_with_credentials(self, client: TestClient, auth_headers):
        """Test with credentials."""
        pytest.importorskip("sleephq")
        client.put(
            "/import/settings",
            headers=auth_headers,
            json={
                "sleephq_client_id": "test-id",
                "sleephq_client_secret": "test-secret",
            },
        )
        with patch.dict("os.environ", {"SLEEPHQ_ENABLED": "true"}):
            resp = client.post("/import/trigger", headers=auth_headers)
        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] == "started"

    def test_unauthenticated(self, client: TestClient):
        """Test unauthenticated."""
        resp = client.post("/import/trigger")
        assert resp.status_code == 401
