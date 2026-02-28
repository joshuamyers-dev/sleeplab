from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session
from sqlalchemy import text

from ..database import get_db
from ..auth import hash_password, verify_password, create_access_token, get_current_user

router = APIRouter()


class RegisterRequest(BaseModel):
    email: str
    password: str


class LoginRequest(BaseModel):
    email: str
    password: str


class UserResponse(BaseModel):
    user_id: str
    email: str
    first_name: str
    last_name: str


class AuthResponse(BaseModel):
    token: str
    user: UserResponse


class UpdateProfileRequest(BaseModel):
    first_name: str
    last_name: str
    email: str


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str


def _normalize_name(value: str) -> str:
    return value.strip()


def _serialize_user(row: dict) -> UserResponse:
    return UserResponse(
        user_id=row["id"],
        email=row["email"],
        first_name=row["first_name"],
        last_name=row["last_name"],
    )


@router.post("/register", response_model=AuthResponse, status_code=201)
def register(body: RegisterRequest, db: Session = Depends(get_db)):
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
    row = db.execute(
        text(
            "INSERT INTO users (email, password_hash, first_name, last_name) "
            "VALUES (:email, :hash, '', '') "
            "RETURNING id::text AS id, email, first_name, last_name"
        ),
        {"email": email, "hash": hashed},
    ).mappings().first()
    db.commit()

    token = create_access_token(row["id"], email)
    return AuthResponse(token=token, user=_serialize_user(row))


@router.post("/login", response_model=AuthResponse)
def login(body: LoginRequest, db: Session = Depends(get_db)):
    email = body.email.lower().strip()
    row = db.execute(
        text(
            "SELECT id::text AS id, email, first_name, last_name, password_hash "
            "FROM users WHERE email = :email"
        ),
        {"email": email},
    ).mappings().first()

    if not row or not verify_password(body.password, row["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid email or password")

    token = create_access_token(row["id"], row["email"])
    return AuthResponse(token=token, user=_serialize_user(row))


@router.post("/logout", status_code=200)
def logout():
    return {"status": "logged out"}


@router.get("/me", response_model=UserResponse)
def me(current_user: dict = Depends(get_current_user)):
    return _serialize_user(current_user)


@router.put("/profile", response_model=UserResponse)
def update_profile(
    body: UpdateProfileRequest,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    email = body.email.lower().strip()
    first_name = _normalize_name(body.first_name)
    last_name = _normalize_name(body.last_name)

    if not email:
        raise HTTPException(status_code=422, detail="Email is required")

    existing = db.execute(
        text("SELECT id::text AS id FROM users WHERE email = :email AND id != CAST(:id AS uuid)"),
        {"email": email, "id": current_user["id"]},
    ).mappings().first()
    if existing:
        raise HTTPException(status_code=409, detail="Email already registered")

    row = db.execute(
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
    ).mappings().first()
    db.commit()

    return _serialize_user(row)


@router.put("/password", status_code=200)
def change_password(
    body: ChangePasswordRequest,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if len(body.new_password) < 8:
        raise HTTPException(status_code=422, detail="New password must be at least 8 characters")

    row = db.execute(
        text("SELECT password_hash FROM users WHERE id = CAST(:id AS uuid)"),
        {"id": current_user["id"]},
    ).mappings().first()

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
