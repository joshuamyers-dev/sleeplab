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
    """Retrieve the configured test database connection URL.

    Checks standard environment variables and ensures the DATABASE_URL is safe
    for testing (e.g. contains 'test' in the string).

    Returns:
        The database URL string, or None if no valid test DB is configured.
    """
    url = os.environ.get("DATABASE_URL", "")
    if "test" in url.lower() or "TEST_DATABASE_URL" in os.environ:
        return os.environ.get("TEST_DATABASE_URL", url)
    return None


@pytest.fixture(scope="session", autouse=True)
def migrations_applied():
    """Run database migrations once per test session.

    Autouse is enabled so every test runs against a fully migrated database structure.
    """
    url = _get_test_db_url()
    if url is None:
        return
    engine = create_engine(url, pool_pre_ping=True)
    from server import run_migrations

    run_migrations()
    engine.dispose()


@pytest.fixture(scope="session")
def db_engine():
    """Provide a session-scoped SQLAlchemy Engine instance.

    Yields:
        An active SQLAlchemy Engine instance for the duration of the test session.
    """
    url = _get_test_db_url()
    if url is None:
        pytest.skip("No test database URL configured — set TEST_DATABASE_URL or include 'test' in DATABASE_URL")
    engine = create_engine(url, pool_pre_ping=True)
    yield engine
    engine.dispose()


@pytest.fixture(scope="session")
def db_session_factory(db_engine):
    """Provide a session-scoped SQLAlchemy sessionmaker factory.

    Args:
        db_engine: The active SQLAlchemy Engine fixture.

    Returns:
        A configured SQLAlchemy sessionmaker instance.
    """
    return sessionmaker(autocommit=False, autoflush=False, bind=db_engine)


@pytest.fixture(scope="function")
def db(db_engine, db_session_factory):
    """Provide a transactional function-scoped SQLAlchemy Session instance.

    This ensures each unit test runs in an isolated transaction that is rolled
    back automatically after completion.

    Args:
        db_engine: The active SQLAlchemy Engine.
        db_session_factory: The SQLAlchemy sessionmaker factory.

    Yields:
        An isolated SQLAlchemy Session instance.
    """
    connection = db_engine.connect()
    transaction = connection.begin()
    session = db_session_factory(bind=connection)

    yield session

    session.close()
    transaction.rollback()
    connection.close()


@pytest.fixture
def test_user(db):
    """Create a temporary test user in the database.

    Args:
        db: The active transactional database Session.

    Returns:
        A dictionary containing the generated test user's id and email.
    """
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
    """Provide authorization headers containing a JWT token for the test user.

    Args:
        test_user: The created test user dict.

    Returns:
        A dictionary mapping Authorization header to Bearer token.
    """
    token = create_access_token(test_user["id"], test_user["email"])
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
def client(db):
    """Provide a configured FastAPI TestClient with overridden database dependencies.

    Overriding the DB dependency ensures all endpoint calls utilize the same test-scoped
    transactional database session.

    Args:
        db: The active transactional database Session.

    Yields:
        An active FastAPI TestClient instance.
    """

    def _override():
        """FastAPI database override generator."""
        yield db

    app.dependency_overrides[get_db] = _override
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()
