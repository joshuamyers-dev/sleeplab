import os

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import text
from sqlalchemy.orm import Session

from ..auth import create_access_token, get_current_user, hash_password, verify_password
from ..database import get_db

router = APIRouter()


class RegisterRequest(BaseModel):
    """Pydantic model representing a registration request payload.

    Attributes:
        email: The email address for the new user.
        password: The plaintext password for the new user.
    """

    email: str
    password: str


class LoginRequest(BaseModel):
    """Pydantic model representing a login request payload.

    Attributes:
        email: The email address of the user.
        password: The plaintext password of the user.
    """

    email: str
    password: str


class UserResponse(BaseModel):
    """Pydantic model representing serialized user profile information.

    Attributes:
        user_id: The unique primary database ID string of the user.
        email: The email address of the user.
        first_name: The user's first name.
        last_name: The user's last name.
    """

    user_id: str
    email: str
    first_name: str
    last_name: str


class AuthResponse(BaseModel):
    """Pydantic model representing successful login/registration authentication response.

    Attributes:
        token: The signed JWT access token string.
        user: The serialized user profile details.
    """

    token: str
    user: UserResponse


class UpdateProfileRequest(BaseModel):
    """Pydantic model representing profile update request payload.

    Attributes:
        first_name: The new first name.
        last_name: The new last name.
        email: The new email address.
    """

    first_name: str
    last_name: str
    email: str


class ChangePasswordRequest(BaseModel):
    """Pydantic model representing password change request payload.

    Attributes:
        current_password: The user's current password.
        new_password: The desired new password.
    """

    current_password: str
    new_password: str


def _normalize_name(value: str) -> str:
    """Normalize a name value by stripping whitespace.

    Args:
        value: The raw name string.

    Returns:
        The normalized name string.
    """
    return value.strip()


def _serialize_user(row: dict) -> UserResponse:
    """Map a database row dictionary to a structured UserResponse.

    Args:
        row: A dictionary representing a user row from the database.

    Returns:
        A UserResponse populated with row values.
    """
    return UserResponse(
        user_id=row["id"],
        email=row["email"],
        first_name=row["first_name"],
        last_name=row["last_name"],
    )


def is_registration_disabled() -> bool:
    """Determine whether new user registration has been disabled via environment variable.

    Returns:
        True if the DISABLE_USER_REGISTRATION env var is set to a truthy value, otherwise False.
    """
    return os.environ.get("DISABLE_USER_REGISTRATION", "").strip().lower() in {"1", "true", "yes", "on"}


@router.post("/register", response_model=AuthResponse, status_code=201)
def register(body: RegisterRequest, db: Session = Depends(get_db)):
    """Register a new user in the database and authenticate them.

    Args:
        body: The RegisterRequest registration payload.
        db: The SQLAlchemy database session.

    Returns:
        An AuthResponse containing the JWT token and serialized User profile.

    Raises:
        HTTPException: If user registration is disabled, if email is already
            registered, or if password length is less than 8 characters.
    """
    if is_registration_disabled():
        raise HTTPException(status_code=403, detail="User registration is disabled")

    email = body.email.lower().strip()

    existing = db.execute(
        text("SELECT id FROM users WHERE email = :email"),
        {"email": email},
    ).first()
    if existing:
        raise HTTPException(status_code=409, detail="Email already registered")

    if len(body.password) < 8:
        raise HTTPException(status_code=422, detail="Password must be at least 8 characters")

    hashed = hash_password(body.password)
    row = (
        db.execute(
            text(
                "INSERT INTO users (email, password_hash, first_name, last_name) "
                "VALUES (:email, :hash, '', '') "
                "RETURNING id::text AS id, email, first_name, last_name"
            ),
            {"email": email, "hash": hashed},
        )
        .mappings()
        .first()
    )
    db.commit()

    token = create_access_token(row["id"], email)
    return AuthResponse(token=token, user=_serialize_user(row))


@router.post("/login", response_model=AuthResponse)
def login(body: LoginRequest, db: Session = Depends(get_db)):
    """Authenticate an existing user via email and password credentials.

    Args:
        body: The LoginRequest login payload.
        db: The SQLAlchemy database session.

    Returns:
        An AuthResponse containing the JWT token and serialized User profile.

    Raises:
        HTTPException: If email does not exist or password verification fails.
    """
    email = body.email.lower().strip()
    row = (
        db.execute(
            text("SELECT id::text AS id, email, first_name, last_name, password_hash FROM users WHERE email = :email"),
            {"email": email},
        )
        .mappings()
        .first()
    )

    if not row or not verify_password(body.password, row["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid email or password")

    token = create_access_token(row["id"], row["email"])
    return AuthResponse(token=token, user=_serialize_user(row))


@router.post("/logout", status_code=200)
def logout():
    """Invalidate or perform logout of the current user session on client side.

    Returns:
        A status dictionary indicating successful logout.
    """
    return {"status": "logged out"}


@router.get("/me", response_model=UserResponse)
def me(current_user: dict = Depends(get_current_user)):
    """Retrieve the currently authenticated user's profile details.

    Args:
        current_user: The authenticated user's details injected from JWT token dependency.

    Returns:
        A UserResponse containing the user's details.
    """
    return _serialize_user(current_user)


@router.put("/profile", response_model=UserResponse)
def update_profile(
    body: UpdateProfileRequest,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Update the current authenticated user's profile information.

    Args:
        body: The UpdateProfileRequest containing new profile details.
        current_user: The current authenticated user's details.
        db: The SQLAlchemy database session.

    Returns:
        A UserResponse containing the updated user details.

    Raises:
        HTTPException: If the email is missing, or if the new email is already
            registered to a different user.
    """
    email = body.email.lower().strip()
    first_name = _normalize_name(body.first_name)
    last_name = _normalize_name(body.last_name)

    if not email:
        raise HTTPException(status_code=422, detail="Email is required")

    existing = (
        db.execute(
            text("SELECT id::text AS id FROM users WHERE email = :email AND id != CAST(:id AS uuid)"),
            {"email": email, "id": current_user["id"]},
        )
        .mappings()
        .first()
    )
    if existing:
        raise HTTPException(status_code=409, detail="Email already registered")

    row = (
        db.execute(
            text(
                "UPDATE users "
                "SET email = :email, first_name = :first_name, last_name = :last_name "
                "WHERE id = CAST(:id AS uuid) "
                "RETURNING id::text AS id, email, first_name, last_name"
            ),
            {
                "id": current_user["id"],
                "email": email,
                "first_name": first_name,
                "last_name": last_name,
            },
        )
        .mappings()
        .first()
    )
    db.commit()

    return _serialize_user(row)


@router.put("/password", status_code=200)
def change_password(
    body: ChangePasswordRequest,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Change the current authenticated user's password.

    Args:
        body: The ChangePasswordRequest containing current and new passwords.
        current_user: The current authenticated user's details.
        db: The SQLAlchemy database session.

    Returns:
        A status dictionary indicating the password was successfully updated.

    Raises:
        HTTPException: If the new password is less than 8 characters, if the
            current password verification fails, or if the new password is the
            same as the current password.
    """
    if len(body.new_password) < 8:
        raise HTTPException(status_code=422, detail="New password must be at least 8 characters")

    row = (
        db.execute(
            text("SELECT password_hash FROM users WHERE id = CAST(:id AS uuid)"),
            {"id": current_user["id"]},
        )
        .mappings()
        .first()
    )

    if row is None or not verify_password(body.current_password, row["password_hash"]):
        raise HTTPException(status_code=401, detail="Current password is incorrect")

    if verify_password(body.new_password, row["password_hash"]):
        raise HTTPException(status_code=422, detail="New password must be different from your current password")

    db.execute(
        text("UPDATE users SET password_hash = :password_hash WHERE id = CAST(:id AS uuid)"),
        {
            "id": current_user["id"],
            "password_hash": hash_password(body.new_password),
        },
    )
    db.commit()

    return {"status": "password_updated"}
