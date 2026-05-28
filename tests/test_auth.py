from fastapi.testclient import TestClient

from api.routers import auth


class TestRegistrationSettings:
    def test_registration_disabled_flag_accepts_true(self, monkeypatch):
        monkeypatch.setenv("DISABLE_USER_REGISTRATION", "true")

        assert auth.is_registration_disabled() is True


class TestRegister:
    def test_register_disabled(self, client: TestClient, monkeypatch):
        monkeypatch.setenv("DISABLE_USER_REGISTRATION", "true")

        resp = client.post("/auth/register", json={
            "email": "disabled@example.com",
            "password": "StrongPass1!",
        })

        assert resp.status_code == 403
        assert resp.json()["detail"] == "User registration is disabled"

    def test_register_success(self, client: TestClient):
        resp = client.post("/auth/register", json={
            "email": "newuser@example.com",
            "password": "StrongPass1!",
            "first_name": "New",
            "last_name": "User",
        })
        assert resp.status_code == 201
        data = resp.json()
        assert "token" in data
        assert data["user"]["email"] == "newuser@example.com"
        assert "user_id" in data["user"]

    def test_register_duplicate_email(self, client: TestClient, test_user):
        resp = client.post("/auth/register", json={
            "email": test_user["email"],
            "password": "StrongPass1!",
            "first_name": "Another",
            "last_name": "User",
        })
        assert resp.status_code == 409

    def test_register_weak_password(self, client: TestClient):
        resp = client.post("/auth/register", json={
            "email": "weak@example.com",
            "password": "short",
            "first_name": "Weak",
            "last_name": "Pass",
        })
        assert resp.status_code == 422


class TestLogin:
    def test_login_success(self, client: TestClient, test_user):
        resp = client.post("/auth/login", json={
            "email": test_user["email"],
            "password": "test-password-123",
        })
        assert resp.status_code == 200
        data = resp.json()
        assert "token" in data
        assert data["user"]["email"] == test_user["email"]

    def test_login_wrong_password(self, client: TestClient, test_user):
        resp = client.post("/auth/login", json={
            "email": test_user["email"],
            "password": "wrong-password",
        })
        assert resp.status_code == 401

    def test_login_nonexistent_user(self, client: TestClient):
        resp = client.post("/auth/login", json={
            "email": "nobody@example.com",
            "password": "doesntmatter",
        })
        assert resp.status_code == 401


class TestMe:
    def test_me_authenticated(self, client: TestClient, auth_headers, test_user):
        resp = client.get("/auth/me", headers=auth_headers)
        assert resp.status_code == 200
        data = resp.json()
        assert data["email"] == test_user["email"]
        assert data["first_name"] == "Test"

    def test_me_unauthenticated(self, client: TestClient):
        resp = client.get("/auth/me")
        assert resp.status_code == 401
