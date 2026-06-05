from fastapi.testclient import TestClient

from api.main import app

client = TestClient(app)


class TestGetConfig:
    """Test suite for get config."""

    def test_defaults_to_utc(self, monkeypatch):
        """Test defaults to utc."""
        monkeypatch.delenv("DISPLAY_TZ", raising=False)
        monkeypatch.delenv("MACHINE_TZ", raising=False)
        resp = client.get("/config")
        assert resp.status_code == 200
        data = resp.json()
        assert data["display_tz"] == "UTC"
        assert data["machine_tz"] == "UTC"

    def test_reflects_env_vars(self, monkeypatch):
        """Test reflects env vars."""
        monkeypatch.setenv("DISPLAY_TZ", "America/New_York")
        monkeypatch.setenv("MACHINE_TZ", "America/Chicago")
        resp = client.get("/config")
        assert resp.status_code == 200
        data = resp.json()
        assert data["display_tz"] == "America/New_York"
        assert data["machine_tz"] == "America/Chicago"

    def test_no_auth_required(self):
        """Test no auth required."""
        resp = client.get("/config")
        assert resp.status_code == 200

    def test_response_shape(self):
        """Test response shape."""
        resp = client.get("/config")
        data = resp.json()
        assert set(data.keys()) == {"display_tz", "machine_tz"}
        assert isinstance(data["display_tz"], str)
        assert isinstance(data["machine_tz"], str)
