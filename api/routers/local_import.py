"""
Server-path import router.

Endpoints
---------
GET  /import/settings          Read own import configuration (JWT)
PUT  /import/settings          Create / update own import configuration (JWT)
GET  /import/status            Last import result for the current user (JWT)
POST /import/trigger           Run an import now for the current user (JWT)
POST /import/trigger/all       Trigger all auto-import users (webhook secret)

Environment variables
---------------------
IMPORT_BASE_DIR          Root directory that user datalog paths must be under.
                         Defaults to /data/imports.  Any path submitted that
                         does not resolve inside this directory is rejected.
IMPORT_WEBHOOK_SECRET    Bearer token required for POST /import/trigger/all.
                         When unset the endpoint returns 503.
"""

import os
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, BackgroundTasks, Depends, Header, HTTPException
from pydantic import BaseModel, field_validator
from sqlalchemy import text
from sqlalchemy.orm import Session

from ..auth import get_current_user
from ..database import get_db

router = APIRouter()

IMPORTER_SCRIPT = (
    Path(__file__).resolve().parent.parent.parent / "importer" / "import_sessions.py"
)
IMPORT_BASE_DIR = Path(os.environ.get("IMPORT_BASE_DIR", "/data/imports"))


# ---------------------------------------------------------------------------
# Pydantic models
# ---------------------------------------------------------------------------

class ImportSettingsIn(BaseModel):
    datalog_path: Optional[str] = None
    auto_import_enabled: bool = False
    poll_frequency: str = "daily"
    lookback_days: int = 7

    @field_validator("poll_frequency")
    @classmethod
    def _valid_frequency(cls, v: str) -> str:
        if v not in ("hourly", "daily", "weekly"):
            raise ValueError("poll_frequency must be 'hourly', 'daily', or 'weekly'")
        return v

    @field_validator("datalog_path")
    @classmethod
    def _safe_path(cls, v: Optional[str]) -> Optional[str]:
        if v is None or v.strip() == "":
            return None
        resolved = Path(v).resolve()
        try:
            resolved.relative_to(IMPORT_BASE_DIR.resolve())
        except ValueError:
            raise ValueError(
                f"datalog_path must be under {IMPORT_BASE_DIR}"
            )
        return str(resolved)

    @field_validator("lookback_days")
    @classmethod
    def _valid_lookback(cls, v: int) -> int:
        if not (1 <= v <= 365):
            raise ValueError("lookback_days must be between 1 and 365")
        return v


class ImportSettingsOut(BaseModel):
    datalog_path: Optional[str]
    auto_import_enabled: bool
    poll_frequency: str
    lookback_days: int
    last_import_at: Optional[str]
    last_import_status: Optional[str]
    last_import_message: Optional[str]


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _get_settings(db: Session, user_id: str) -> Optional[dict]:
    row = db.execute(
        text("""
            SELECT datalog_path, auto_import_enabled, poll_frequency, lookback_days,
                   last_import_at, last_import_status, last_import_message
            FROM user_import_settings
            WHERE user_id = CAST(:uid AS uuid)
        """),
        {"uid": user_id},
    ).mappings().first()
    return dict(row) if row else None


def _upsert_settings(db: Session, user_id: str, data: dict) -> None:
    db.execute(
        text("""
            INSERT INTO user_import_settings
                (user_id, datalog_path, auto_import_enabled, poll_frequency,
                 lookback_days, updated_at)
            VALUES
                (CAST(:uid AS uuid), :datalog_path, :auto_import_enabled,
                 :poll_frequency, :lookback_days, NOW())
            ON CONFLICT (user_id) DO UPDATE SET
                datalog_path        = EXCLUDED.datalog_path,
                auto_import_enabled = EXCLUDED.auto_import_enabled,
                poll_frequency      = EXCLUDED.poll_frequency,
                lookback_days       = EXCLUDED.lookback_days,
                updated_at          = NOW()
        """),
        {"uid": user_id, **data},
    )
    db.commit()


def _record_import_result(
    db: Session,
    user_id: str,
    status: str,
    message: str,
) -> None:
    db.execute(
        text("""
            UPDATE user_import_settings
            SET last_import_at      = NOW(),
                last_import_status  = :status,
                last_import_message = :message,
                updated_at          = NOW()
            WHERE user_id = CAST(:uid AS uuid)
        """),
        {"uid": user_id, "status": status, "message": message},
    )
    db.commit()


def _run_local_import(user_id: str, datalog_path: str, lookback_days: int) -> None:
    """Background task: run import_sessions.py for a server-mounted DATALOG path."""
    from ..database import SessionLocal  # avoid circular import at module level

    db = SessionLocal()
    try:
        _record_import_result(db, user_id, "running", "Import started")

        cmd = [
            sys.executable,
            str(IMPORTER_SCRIPT),
            "--datalog", datalog_path,
            "--user-id", user_id,
            "--from", _lookback_date(lookback_days),
        ]
        result = subprocess.run(
            cmd,
            cwd=str(IMPORTER_SCRIPT.parent),
            capture_output=True,
            text=True,
        )

        if result.returncode == 0:
            _record_import_result(db, user_id, "ok", result.stdout.strip()[-200:] or "Import complete")
        else:
            _record_import_result(db, user_id, "error", result.stderr.strip()[-200:] or "Import failed")
    except Exception as exc:
        _record_import_result(db, user_id, "error", str(exc)[:200])
    finally:
        db.close()


def _lookback_date(days: int) -> str:
    from datetime import timedelta
    d = datetime.now(timezone.utc).date() - timedelta(days=days)
    return d.strftime("%Y%m%d")


def _require_webhook_secret(authorization: Optional[str] = Header(None)) -> None:
    """Dependency: validate Bearer token against IMPORT_WEBHOOK_SECRET."""
    secret = os.environ.get("IMPORT_WEBHOOK_SECRET", "")
    if not secret:
        raise HTTPException(status_code=503, detail="Webhook trigger is not configured on this server")
    expected = f"Bearer {secret}"
    if authorization != expected:
        raise HTTPException(status_code=401, detail="Invalid or missing webhook secret")


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.get("/settings", response_model=ImportSettingsOut)
def get_import_settings(
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    row = _get_settings(db, current_user["id"])
    if row is None:
        return ImportSettingsOut(
            datalog_path=None,
            auto_import_enabled=False,
            poll_frequency="daily",
            lookback_days=7,
            last_import_at=None,
            last_import_status=None,
            last_import_message=None,
        )
    return ImportSettingsOut(
        **{k: (v.isoformat() if isinstance(v, datetime) else v) for k, v in row.items()}
    )


@router.put("/settings", response_model=ImportSettingsOut)
def save_import_settings(
    body: ImportSettingsIn,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _upsert_settings(db, current_user["id"], body.model_dump())
    return get_import_settings(current_user=current_user, db=db)


@router.get("/status")
def get_import_status(
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    row = _get_settings(db, current_user["id"])
    if row is None:
        return {"last_import_at": None, "last_import_status": None, "last_import_message": None}
    return {
        "last_import_at": row["last_import_at"].isoformat() if row["last_import_at"] else None,
        "last_import_status": row["last_import_status"],
        "last_import_message": row["last_import_message"],
    }


@router.post("/trigger")
def trigger_import(
    background_tasks: BackgroundTasks,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Trigger an immediate import for the current user using their saved datalog path."""
    row = _get_settings(db, current_user["id"])
    if not row or not row.get("datalog_path"):
        raise HTTPException(
            status_code=400,
            detail="No datalog path configured. Set one in Settings first.",
        )

    path = row["datalog_path"]
    if not Path(path).exists():
        raise HTTPException(
            status_code=400,
            detail=f"Datalog path does not exist on the server: {path}",
        )

    background_tasks.add_task(
        _run_local_import,
        current_user["id"],
        path,
        row["lookback_days"],
    )
    return {"status": "accepted", "message": "Import started in the background."}


@router.post("/trigger/all")
def trigger_all_imports(
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    _: None = Depends(_require_webhook_secret),
):
    """
    Trigger imports for every user with auto_import_enabled = true.
    Secured by IMPORT_WEBHOOK_SECRET bearer token.
    """
    rows = db.execute(
        text("""
            SELECT user_id::text AS user_id, datalog_path, lookback_days
            FROM user_import_settings
            WHERE auto_import_enabled = TRUE
              AND datalog_path IS NOT NULL
        """)
    ).mappings().all()

    queued = 0
    for row in rows:
        path = row["datalog_path"]
        if Path(path).exists():
            background_tasks.add_task(
                _run_local_import,
                row["user_id"],
                path,
                row["lookback_days"],
            )
            queued += 1

    return {"status": "accepted", "queued": queued}
