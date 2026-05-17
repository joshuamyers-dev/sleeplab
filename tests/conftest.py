import os
import uuid

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker

from api.auth import create_access_token, hash_password
from api.database import get_db
from api.main import app


def _get_test_db_url() -> str | None:
    url = os.environ.get("DATABASE_URL", "")
    if "test" in url.lower() or "TEST_DATABASE_URL" in os.environ:
        return os.environ.get("TEST_DATABASE_URL", url)
    return None


@pytest.fixture(scope="session", autouse=True)
def migrations_applied():
    """Run migrations once per test session (autouse so every test gets a clean DB)."""
    url = _get_test_db_url()
    if url is None:
        return
    engine = create_engine(url, pool_pre_ping=True)
    from server import run_migrations
    run_migrations()
    engine.dispose()


@pytest.fixture(scope="session")
def db_engine():
    url = _get_test_db_url()
    if url is None:
        pytest.skip("No test database URL configured — set TEST_DATABASE_URL or include 'test' in DATABASE_URL")
    engine = create_engine(url, pool_pre_ping=True)
    yield engine
    engine.dispose()


@pytest.fixture(scope="session")
def db_session_factory(db_engine):
    return sessionmaker(autocommit=False, autoflush=False, bind=db_engine)


@pytest.fixture(scope="function")
def db(db_engine, db_session_factory):
    connection = db_engine.connect()
    transaction = connection.begin()
    session = db_session_factory(bind=connection)

    yield session

    session.close()
    transaction.rollback()
    connection.close()


@pytest.fixture
def test_user(db):
    user_id = str(uuid.uuid4())
    email = f"test-{uuid.uuid4().hex[:8]}@example.com"
    hashed = hash_password("test-password-123")
    db.execute(
        text("""
            INSERT INTO users (id, email, first_name, last_name, password_hash, created_at)
            VALUES (CAST(:id AS uuid), :email, 'Test', 'User', :pw, NOW())
        """),
        {"id": user_id, "email": email, "pw": hashed},
    )
    db.commit()
    return {"id": user_id, "email": email}


@pytest.fixture
def auth_headers(test_user):
    token = create_access_token(test_user["id"], test_user["email"])
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
def client(db):
    """Override the DB dependency with our test-scoped session."""
    def _override():
        yield db
    app.dependency_overrides[get_db] = _override
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()
