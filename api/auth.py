import os
import warnings
from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt
from passlib.context import CryptContext
from sqlalchemy import text
from sqlalchemy.orm import Session

from .database import get_db

# --- Secret key ---
SECRET_KEY = os.environ.get("SECRET_KEY", "dev-insecure-key-change-in-production-f3a9b2c1")
if SECRET_KEY == "dev-insecure-key-change-in-production-f3a9b2c1":
    warnings.warn("SECRET_KEY is not set — using insecure dev default. Set SECRET_KEY env var in production.")

ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_DAYS = 30

# --- Crypto context ---
# Use pbkdf2_sha256 to avoid local bcrypt backend incompatibilities.
pwd_context = CryptContext(schemes=["pbkdf2_sha256"], deprecated="auto")

bearer_scheme = HTTPBearer(auto_error=False)


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)


def create_access_token(user_id: str, email: str) -> str:
    expire = datetime.now(timezone.utc) + timedelta(days=ACCESS_TOKEN_EXPIRE_DAYS)
    payload = {"sub": user_id, "email": email, "exp": expire}
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)


def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(bearer_scheme),
    db: Session = Depends(get_db),
) -> dict:
    """FastAPI dependency. Reads JWT from Authorization: Bearer. Returns {'id': int, 'email': str}."""
    if credentials is None or credentials.scheme.lower() != "bearer":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
        )
    token = credentials.credentials
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id_str: Optional[str] = payload.get("sub")
        if user_id_str is None:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")
    except JWTError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired token")

    row = db.execute(
        text(
            "SELECT id::text AS id, email, first_name, last_name "
            "FROM users WHERE id = CAST(:id AS uuid)"
        ),
        {"id": user_id_str},
    ).mappings().first()

    if row is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")

    return dict(row)
