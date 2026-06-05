from fastapi.testclient import TestClient

from api.main import app


def test_health():
    """Verify that the /health endpoint is live and returns a status of 'ok'."""
    client = TestClient(app)
    resp = client.get("/health")
    assert resp.status_code == 200
    assert resp.json() == {"status": "ok"}
