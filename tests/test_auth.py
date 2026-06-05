from fastapi.testclient import TestClient

from api.routers import auth


class TestRegistrationSettings:
    """Test suite for registration settings."""

    def test_registration_disabled_flag_accepts_true(self, monkeypatch):
        """Test registration disabled flag accepts true."""
        monkeypatch.setenv("DISABLE_USER_REGISTRATION", "true")

        assert auth.is_registration_disabled() is True


class TestRegister:
    """Test suite for register."""

    def test_register_disabled(self, client: TestClient, monkeypatch):
        """Test register disabled."""
        monkeypatch.setenv("DISABLE_USER_REGISTRATION", "true")

        resp = client.post(
            "/auth/register",
            json={
                "email": "disabled@example.com",
                "password": "StrongPass1!",
            },
        )

        assert resp.status_code == 403
        assert resp.json()["detail"] == "User registration is disabled"

    def test_register_success(self, client: TestClient):
        """Test register success."""
        resp = client.post(
            "/auth/register",
            json={
                "email": "newuser@example.com",
                "password": "StrongPass1!",
                "first_name": "New",
                "last_name": "User",
            },
        )
        assert resp.status_code == 201
        data = resp.json()
        assert "token" in data
        assert data["user"]["email"] == "newuser@example.com"
        assert "user_id" in data["user"]

    def test_register_duplicate_email(self, client: TestClient, test_user):
        """Test register duplicate email."""
        resp = client.post(
            "/auth/register",
            json={
                "email": test_user["email"],
                "password": "StrongPass1!",
                "first_name": "Another",
                "last_name": "User",
            },
        )
        assert resp.status_code == 409

    def test_register_weak_password(self, client: TestClient):
        """Test register weak password."""
        resp = client.post(
            "/auth/register",
            json={
                "email": "weak@example.com",
                "password": "short",
                "first_name": "Weak",
                "last_name": "Pass",
            },
        )
        assert resp.status_code == 422


class TestLogin:
    """Test suite for login."""

    def test_login_success(self, client: TestClient, test_user):
        """Test login success."""
        resp = client.post(
            "/auth/login",
            json={
                "email": test_user["email"],
                "password": "test-password-123",
            },
        )
        assert resp.status_code == 200
        data = resp.json()
        assert "token" in data
        assert data["user"]["email"] == test_user["email"]

    def test_login_wrong_password(self, client: TestClient, test_user):
        """Test login wrong password."""
        resp = client.post(
            "/auth/login",
            json={
                "email": test_user["email"],
                "password": "wrong-password",
            },
        )
        assert resp.status_code == 401

    def test_login_nonexistent_user(self, client: TestClient):
        """Test login nonexistent user."""
        resp = client.post(
            "/auth/login",
            json={
                "email": "nobody@example.com",
                "password": "doesntmatter",
            },
        )
        assert resp.status_code == 401


class TestMe:
    """Test suite for me."""

    def test_me_authenticated(self, client: TestClient, auth_headers, test_user):
        """Test me authenticated."""
        resp = client.get("/auth/me", headers=auth_headers)
        assert resp.status_code == 200
        data = resp.json()
        assert data["email"] == test_user["email"]
        assert data["first_name"] == "Test"

    def test_me_unauthenticated(self, client: TestClient):
        """Test me unauthenticated."""
        resp = client.get("/auth/me")
        assert resp.status_code == 401
