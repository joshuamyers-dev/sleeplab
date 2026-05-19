import logging
import os
import sys
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, BackgroundTasks, Depends, Header, HTTPException
from pydantic import BaseModel
from sqlalchemy import text
from sqlalchemy.orm import Session

from ..auth import get_current_user
from ..database import get_db
from .upload import IMPORT_JOBS, _mark_import_running, _mark_import_finished

router = APIRouter()
logger = logging.getLogger(__name__)

SLEEPHQ_IMPORTER = Path(__file__).resolve().parent.parent.parent / "importer" / "sleephq_import.py"
LOCAL_IMPORTER = Path(__file__).resolve().parent.parent.parent / "importer" / "import_sessions.py"

LOCAL_DATA_ROOT = Path("/data")


class ImportSettingsResponse(BaseModel):
    sleephq_client_id: Optional[str] = None
    sleephq_client_secret: Optional[str] = None  # always None in responses
    sleephq_team_id: Optional[int] = None
    sleephq_machine_id: Optional[int] = None
    auto_import_sleephq: bool = False
    lookback_days: int = 30
    local_datalog_path: Optional[str] = None
    local_import_frequency: str = "daily"
    last_local_import_at: Optional[str] = None
    last_local_import_status: Optional[str] = None


class ImportSettingsUpdate(BaseModel):
    sleephq_client_id: Optional[str] = None
    sleephq_client_secret: Optional[str] = None
    sleephq_team_id: Optional[int] = None
    sleephq_machine_id: Optional[int] = None
    auto_import_sleephq: Optional[bool] = None
    lookback_days: Optional[int] = None
    local_datalog_path: Optional[str] = None
    local_import_frequency: Optional[str] = None


def _validate_local_path(raw: str) -> Path:
    """
    Resolve the path and confirm it sits inside LOCAL_DATA_ROOT (/data).
    Raises HTTPException 400 on any traversal attempt or wrong root.
    """
    try:
        p = Path(raw).resolve()
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid path.")
    if not p.is_relative_to(LOCAL_DATA_ROOT):
        raise HTTPException(
            status_code=400,
            detail=f"Path must be inside {LOCAL_DATA_ROOT}. Example: /data/cpap/DATALOG",
        )
    return p


@router.get("/settings", response_model=ImportSettingsResponse)
def get_import_settings(
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    row = db.execute(
        text("SELECT * FROM user_import_settings WHERE user_id = CAST(:uid AS uuid)"),
        {"uid": current_user["id"]},
    ).mappings().first()

    if row is None:
        return ImportSettingsResponse()

    last_at = row["last_local_import_at"]
    return ImportSettingsResponse(
        sleephq_client_id=row["sleephq_client_id"],
        sleephq_client_secret=None,  # never expose
        sleephq_team_id=row["sleephq_team_id"],
        sleephq_machine_id=row["sleephq_machine_id"],
        auto_import_sleephq=row["auto_import_sleephq"],
        lookback_days=row["lookback_days"],
        local_datalog_path=row["local_datalog_path"],
        local_import_frequency=row["local_import_frequency"] or "daily",
        last_local_import_at=last_at.isoformat() if last_at else None,
        last_local_import_status=row["last_local_import_status"],
    )


@router.put("/settings", response_model=ImportSettingsResponse)
def save_import_settings(
    body: ImportSettingsUpdate,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    # Validate local path if provided
    if body.local_datalog_path is not None and body.local_datalog_path != "":
        _validate_local_path(body.local_datalog_path)

    existing = db.execute(
        text("SELECT * FROM user_import_settings WHERE user_id = CAST(:uid AS uuid)"),
        {"uid": current_user["id"]},
    ).mappings().first()

    if existing is None:
        db.execute(
            text("""
                INSERT INTO user_import_settings
                    (user_id, sleephq_client_id, sleephq_client_secret,
                     sleephq_team_id, sleephq_machine_id,
                     auto_import_sleephq, lookback_days,
                     local_datalog_path, local_import_frequency, updated_at)
                VALUES
                    (CAST(:uid AS uuid), :client_id, :client_secret,
                     :team_id, :machine_id,
                     :auto_import, :lookback,
                     :local_path, :local_freq, NOW())
            """),
            {
                "uid": current_user["id"],
                "client_id": body.sleephq_client_id,
                "client_secret": body.sleephq_client_secret,
                "team_id": body.sleephq_team_id,
                "machine_id": body.sleephq_machine_id,
                "auto_import": body.auto_import_sleephq if body.auto_import_sleephq is not None else False,
                "lookback": body.lookback_days if body.lookback_days is not None else 30,
                "local_path": body.local_datalog_path or None,
                "local_freq": body.local_import_frequency or "daily",
            },
        )
    else:
        fields = {"uid": current_user["id"]}
        set_clauses = ["updated_at = NOW()"]

        if body.sleephq_client_id is not None:
            set_clauses.append("sleephq_client_id = :client_id")
            fields["client_id"] = body.sleephq_client_id

        if body.sleephq_client_secret is not None and body.sleephq_client_secret != "***":
            set_clauses.append("sleephq_client_secret = :client_secret")
            fields["client_secret"] = body.sleephq_client_secret

        if body.sleephq_team_id is not None:
            set_clauses.append("sleephq_team_id = :team_id")
            fields["team_id"] = body.sleephq_team_id

        if body.sleephq_machine_id is not None:
            set_clauses.append("sleephq_machine_id = :machine_id")
            fields["machine_id"] = body.sleephq_machine_id

        if body.auto_import_sleephq is not None:
            set_clauses.append("auto_import_sleephq = :auto_import")
            fields["auto_import"] = body.auto_import_sleephq

        if body.lookback_days is not None:
            set_clauses.append("lookback_days = :lookback")
            fields["lookback"] = body.lookback_days

        if "local_datalog_path" in body.model_fields_set:
            set_clauses.append("local_datalog_path = :local_path")
            fields["local_path"] = body.local_datalog_path or None

        if body.local_import_frequency is not None:
            set_clauses.append("local_import_frequency = :local_freq")
            fields["local_freq"] = body.local_import_frequency

        db.execute(
            text(f"UPDATE user_import_settings SET {', '.join(set_clauses)} WHERE user_id = CAST(:uid AS uuid)"),
            fields,
        )

    db.commit()
    return get_import_settings(current_user=current_user, db=db)


def _run_sleephq_import_task(
    user_id: str,
    client_id: str,
    client_secret: str,
    team_id: Optional[int],
    machine_id: Optional[int],
    lookback_days: int,
) -> None:
    try:
        sys.path.insert(0, str(SLEEPHQ_IMPORTER.parent))
        from sleephq_import import run_sleephq_import  # type: ignore
        run_sleephq_import(
            user_id=user_id,
            days=lookback_days,
            client_id=client_id,
            client_secret=client_secret,
            team_id=team_id,
            machine_id=machine_id,
        )
    except Exception:
        logger.exception("SleepHQ import failed for user %s", user_id)
    finally:
        _mark_import_finished(user_id)


def _run_local_import_task(user_id: str, datalog_path: str) -> None:
    from ..database import SessionLocal  # import here to avoid circular import at module load
    status: str
    try:
        sys.path.insert(0, str(LOCAL_IMPORTER.parent))
        from import_sessions import run_local_import  # type: ignore
        stats = run_local_import(user_id=user_id, datalog_path=datalog_path)
        status = f"ok: {stats['imported']} sessions across {stats['folders']} nights"
    except Exception:
        logger.exception("Local import failed for user %s", user_id)
        status = "error: import failed — check server logs"
    finally:
        _mark_import_finished(user_id)
    try:
        db = SessionLocal()
        db.execute(
            text("""
                UPDATE user_import_settings
                SET last_local_import_at = NOW(), last_local_import_status = :status
                WHERE user_id = CAST(:uid AS uuid)
            """),
            {"uid": user_id, "status": status},
        )
        db.commit()
        db.close()
    except Exception:
        logger.exception("Failed to write import status for user %s", user_id)


@router.post("/trigger")
def trigger_sleephq_import(
    background_tasks: BackgroundTasks,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    row = db.execute(
        text("SELECT * FROM user_import_settings WHERE user_id = CAST(:uid AS uuid)"),
        {"uid": current_user["id"]},
    ).mappings().first()

    if row is None or not row["sleephq_client_id"] or not row["sleephq_client_secret"]:
        raise HTTPException(
            status_code=400,
            detail="No SleepHQ credentials saved. Configure them in Settings first.",
        )

    job = IMPORT_JOBS.get(current_user["id"])
    if job and job.running:
        return {"status": "already_running", "message": "A SleepHQ import is already in progress."}

    _mark_import_running(current_user["id"])
    background_tasks.add_task(
        _run_sleephq_import_task,
        current_user["id"],
        row["sleephq_client_id"],
        row["sleephq_client_secret"],
        row["sleephq_team_id"],
        row["sleephq_machine_id"],
        row["lookback_days"],
    )

    return {"status": "started", "message": "SleepHQ import started."}


@router.post("/trigger-local")
def trigger_local_import(
    background_tasks: BackgroundTasks,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    row = db.execute(
        text("SELECT * FROM user_import_settings WHERE user_id = CAST(:uid AS uuid)"),
        {"uid": current_user["id"]},
    ).mappings().first()

    if row is None or not row.get("local_datalog_path"):
        raise HTTPException(
            status_code=400,
            detail="No local DATALOG path saved. Configure it in Settings first.",
        )

    # Re-validate path at trigger time (defence-in-depth)
    path = _validate_local_path(row["local_datalog_path"])
    if not path.exists():
        raise HTTPException(
            status_code=400,
            detail=f"Path not found on server: {path}. Check the /data mount and path.",
        )

    job = IMPORT_JOBS.get(current_user["id"])
    if job and job.running:
        return {"status": "already_running", "message": "An import is already in progress."}

    _mark_import_running(current_user["id"])
    background_tasks.add_task(
        _run_local_import_task,
        current_user["id"],
        str(path),
    )

    return {"status": "started", "message": "Local DATALOG import started."}


@router.post("/trigger/all")
def trigger_all_local_imports(
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    x_import_secret: Optional[str] = Header(default=None),
):
    secret = os.environ.get("IMPORT_WEBHOOK_SECRET", "")
    if not secret or x_import_secret != secret:
        raise HTTPException(status_code=403, detail="Invalid or missing X-Import-Secret header.")

    rows = db.execute(
        text("SELECT user_id, local_datalog_path FROM user_import_settings WHERE local_datalog_path IS NOT NULL"),
    ).mappings().all()

    triggered = 0
    for row in rows:
        user_id = str(row["user_id"])
        path_str = row["local_datalog_path"]
        try:
            path = _validate_local_path(path_str)
        except HTTPException:
            continue
        if not path.exists():
            continue
        job = IMPORT_JOBS.get(user_id)
        if job and job.running:
            continue
        _mark_import_running(user_id)
        background_tasks.add_task(_run_local_import_task, user_id, str(path))
        triggered += 1

    return {"triggered": triggered}
