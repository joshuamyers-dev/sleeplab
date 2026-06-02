import logging
import os
import sys
import uuid
from pathlib import Path
from typing import Literal

from fastapi import APIRouter, BackgroundTasks, Depends, Header, HTTPException
from pydantic import BaseModel
from sqlalchemy import text
from sqlalchemy.orm import Session

from ..auth import get_current_user
from ..database import get_db
from ..llm_client import is_configured
from ..settings_store import (
    get_adherence_settings,
    get_llm_settings,
    get_timezone_settings,
    get_user_import_settings_row,
    has_explicit_llm_settings,
    normalize_llm_provider,
    normalize_timezone,
)
from .upload import IMPORT_JOBS, _mark_import_finished, _mark_import_running

router = APIRouter()
logger = logging.getLogger(__name__)

SLEEPHQ_IMPORTER = Path(__file__).resolve().parent.parent.parent / "importer" / "sleephq_import.py"
LOCAL_IMPORTER = Path(__file__).resolve().parent.parent.parent / "importer" / "import_sessions.py"

LOCAL_DATA_ROOT = Path("/data")


class ImportSettingsResponse(BaseModel):
    sleephq_client_id: str | None = None
    sleephq_client_secret: str | None = None  # always None — use has_client_secret to check if one is saved
    has_client_secret: bool = False
    sleephq_team_id: int | None = None
    sleephq_machine_id: int | None = None
    auto_import_sleephq: bool = False
    lookback_days: int = 30
    sleephq_enabled: bool = False
    local_datalog_path: str | None = None
    local_import_frequency: str = "daily"
    last_local_import_at: str | None = None
    last_local_import_status: str | None = None
    wearable_provider: str | None = None
    wearable_base_url: str | None = None
    wearable_api_key: str | None = None  # always None in responses
    machine_tz: str = "UTC"
    display_tz: str = "UTC"
    has_machine_tz: bool = False
    has_display_tz: bool = False
    llm_provider: str = "ollama"
    llm_base_url: str | None = None
    llm_model: str | None = None
    llm_api_key: str | None = None  # always None in responses
    has_llm_api_key: bool = False
    llm_configured: bool = False
    usage_threshold_hours: float = 4.0
    borderline_threshold_hours: float | None = None
    target_adherence_pct: float = 70.0
    adherence_window_days: int = 30
    evaluation_period_days: int = 90
    window_evaluation_logic: str = "best_consecutive"
    maintenance_lookback_days: int = 90


class WebhookPayload(BaseModel):
    event: str
    status: Literal["success", "error"]


class ImportSettingsUpdate(BaseModel):
    sleephq_client_id: str | None = None
    sleephq_client_secret: str | None = None
    sleephq_team_id: int | None = None
    sleephq_machine_id: int | None = None
    auto_import_sleephq: bool | None = None
    lookback_days: int | None = None
    local_datalog_path: str | None = None
    local_import_frequency: str | None = None
    wearable_provider: str | None = None
    wearable_base_url: str | None = None
    wearable_api_key: str | None = None
    machine_tz: str | None = None
    display_tz: str | None = None
    llm_provider: str | None = None
    llm_base_url: str | None = None
    llm_api_key: str | None = None
    llm_model: str | None = None
    usage_threshold_hours: float | None = None
    borderline_threshold_hours: float | None = None
    target_adherence_pct: float | None = None
    adherence_window_days: int | None = None
    evaluation_period_days: int | None = None
    window_evaluation_logic: str | None = None
    maintenance_lookback_days: int | None = None


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
    row = get_user_import_settings_row(db, current_user["id"])

    enabled = os.environ.get("SLEEPHQ_ENABLED", "false").lower() == "true"
    tz = get_timezone_settings(db, current_user["id"])
    llm = get_llm_settings(db, current_user["id"])
    llm_configured = has_explicit_llm_settings(db, current_user["id"]) and is_configured(llm)
    comp = get_adherence_settings(db, current_user["id"])

    if row is None:
        return ImportSettingsResponse(
            sleephq_enabled=enabled,
            machine_tz=tz["machine_tz"],
            display_tz=tz["display_tz"],
            llm_provider=str(llm["llm_provider"]),
            llm_base_url=llm["llm_base_url"],
            llm_model=llm["llm_model"],
            has_llm_api_key=bool(llm["llm_api_key"] and llm["llm_api_key"] not in {"ollama", "litellm"}),
            llm_configured=llm_configured,
            **comp,
        )

    last_at = row["last_local_import_at"]
    return ImportSettingsResponse(
        sleephq_client_id=row["sleephq_client_id"],
        sleephq_client_secret=None,  # never expose
        has_client_secret=bool(row["sleephq_client_secret"]),
        sleephq_team_id=row["sleephq_team_id"],
        sleephq_machine_id=row["sleephq_machine_id"],
        auto_import_sleephq=row["auto_import_sleephq"],
        lookback_days=row["lookback_days"],
        sleephq_enabled=enabled,
        local_datalog_path=row["local_datalog_path"],
        local_import_frequency=row["local_import_frequency"] or "daily",
        last_local_import_at=last_at.isoformat() if last_at else None,
        last_local_import_status=row["last_local_import_status"],
        wearable_provider=row["wearable_provider"],
        wearable_base_url=row["wearable_base_url"],
        wearable_api_key=None,  # never expose
        machine_tz=tz["machine_tz"],
        display_tz=tz["display_tz"],
        has_machine_tz=bool(row["machine_tz"]),
        has_display_tz=bool(row["display_tz"]),
        llm_provider=str(llm["llm_provider"]),
        llm_base_url=llm["llm_base_url"],
        llm_model=llm["llm_model"],
        llm_api_key=None,
        has_llm_api_key=bool(row["llm_api_key"]),
        llm_configured=llm_configured,
        **comp,
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
    try:
        body.machine_tz = normalize_timezone(body.machine_tz)
        body.display_tz = normalize_timezone(body.display_tz)
        body.llm_provider = normalize_llm_provider(body.llm_provider)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))

    existing = get_user_import_settings_row(db, current_user["id"])

    if existing is None:
        db.execute(
            text("""
                INSERT INTO user_import_settings
                    (user_id, sleephq_client_id, sleephq_client_secret,
                     sleephq_team_id, sleephq_machine_id,
                     auto_import_sleephq, lookback_days,
                     local_datalog_path, local_import_frequency, updated_at,
                     wearable_provider, wearable_base_url, wearable_api_key,
                     machine_tz, display_tz,
                     llm_provider, llm_base_url, llm_api_key, llm_model,
                     adherence_threshold_hours, adherence_borderline_hours,
                     adherence_target_pct, adherence_window_days,
                     adherence_evaluation_days, adherence_window_logic,
                     adherence_lookback_days)
                VALUES
                    (CAST(:uid AS uuid), :client_id, :client_secret,
                     :team_id, :machine_id,
                     :auto_import, :lookback,
                     :local_path, :local_freq, NOW(),
                     :w_provider, :w_base_url, :w_api_key,
                     :machine_tz, :display_tz,
                     :llm_provider, :llm_base_url, :llm_api_key, :llm_model,
                     :adherence_threshold_hours, :adherence_borderline_hours,
                     :adherence_target_pct, :adherence_window_days,
                     :adherence_evaluation_days, :adherence_window_logic,
                     :adherence_lookback_days)
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
                "w_provider": body.wearable_provider,
                "w_base_url": body.wearable_base_url,
                "w_api_key": body.wearable_api_key,
                "machine_tz": body.machine_tz,
                "display_tz": body.display_tz,
                "llm_provider": body.llm_provider,
                "llm_base_url": body.llm_base_url,
                "llm_api_key": body.llm_api_key,
                "llm_model": body.llm_model,
                "adherence_threshold_hours": body.usage_threshold_hours if body.usage_threshold_hours is not None else 4.0,
                "adherence_borderline_hours": body.borderline_threshold_hours,
                "adherence_target_pct": body.target_adherence_pct if body.target_adherence_pct is not None else 70.0,
                "adherence_window_days": body.adherence_window_days if body.adherence_window_days is not None else 30,
                "adherence_evaluation_days": body.evaluation_period_days if body.evaluation_period_days is not None else 90,
                "adherence_window_logic": body.window_evaluation_logic or "best_consecutive",
                "adherence_lookback_days": body.maintenance_lookback_days if body.maintenance_lookback_days is not None else 90,
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

        if "sleephq_team_id" in body.model_fields_set:
            set_clauses.append("sleephq_team_id = :team_id")
            fields["team_id"] = body.sleephq_team_id

        if "sleephq_machine_id" in body.model_fields_set:
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

        if body.wearable_provider is not None:
            set_clauses.append("wearable_provider = :w_provider")
            fields["w_provider"] = body.wearable_provider

        if body.wearable_base_url is not None:
            set_clauses.append("wearable_base_url = :w_base_url")
            fields["w_base_url"] = body.wearable_base_url

        if body.wearable_api_key is not None:
            set_clauses.append("wearable_api_key = :w_api_key")
            fields["w_api_key"] = body.wearable_api_key

        if "machine_tz" in body.model_fields_set:
            set_clauses.append("machine_tz = :machine_tz")
            fields["machine_tz"] = body.machine_tz

        if "display_tz" in body.model_fields_set:
            set_clauses.append("display_tz = :display_tz")
            fields["display_tz"] = body.display_tz

        if "llm_provider" in body.model_fields_set:
            set_clauses.append("llm_provider = :llm_provider")
            fields["llm_provider"] = body.llm_provider

        if "llm_base_url" in body.model_fields_set:
            set_clauses.append("llm_base_url = :llm_base_url")
            fields["llm_base_url"] = body.llm_base_url or None

        if body.llm_api_key is not None and body.llm_api_key != "***":
            set_clauses.append("llm_api_key = :llm_api_key")
            fields["llm_api_key"] = body.llm_api_key or None

        if "llm_model" in body.model_fields_set:
            set_clauses.append("llm_model = :llm_model")
            fields["llm_model"] = body.llm_model or None

        if "usage_threshold_hours" in body.model_fields_set:
            set_clauses.append("adherence_threshold_hours = :adherence_threshold_hours")
            fields["adherence_threshold_hours"] = body.usage_threshold_hours

        if "borderline_threshold_hours" in body.model_fields_set:
            set_clauses.append("adherence_borderline_hours = :adherence_borderline_hours")
            fields["adherence_borderline_hours"] = body.borderline_threshold_hours

        if "target_adherence_pct" in body.model_fields_set:
            set_clauses.append("adherence_target_pct = :adherence_target_pct")
            fields["adherence_target_pct"] = body.target_adherence_pct

        if "adherence_window_days" in body.model_fields_set:
            set_clauses.append("adherence_window_days = :adherence_window_days")
            fields["adherence_window_days"] = body.adherence_window_days

        if "evaluation_period_days" in body.model_fields_set:
            set_clauses.append("adherence_evaluation_days = :adherence_evaluation_days")
            fields["adherence_evaluation_days"] = body.evaluation_period_days

        if "window_evaluation_logic" in body.model_fields_set:
            set_clauses.append("adherence_window_logic = :adherence_window_logic")
            fields["adherence_window_logic"] = body.window_evaluation_logic

        if "maintenance_lookback_days" in body.model_fields_set:
            set_clauses.append("adherence_lookback_days = :adherence_lookback_days")
            fields["adherence_lookback_days"] = body.maintenance_lookback_days

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
    team_id: int | None,
    machine_id: int | None,
) -> None:
    try:
        sys.path.insert(0, str(SLEEPHQ_IMPORTER.parent))
        from sleephq_import import run_sleephq_import  # type: ignore

        run_sleephq_import(
            user_id=user_id,
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
    row = (
        db.execute(
            text("SELECT * FROM user_import_settings WHERE user_id = CAST(:uid AS uuid)"),
            {"uid": current_user["id"]},
        )
        .mappings()
        .first()
    )

    if os.environ.get("SLEEPHQ_ENABLED", "false").lower() != "true":
        raise HTTPException(
            status_code=503,
            detail="SleepHQ integration is not enabled on this server. Set SLEEPHQ_ENABLED=true to enable it.",
        )

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
    )

    return {"status": "started", "message": "SleepHQ import started."}


@router.post("/trigger-local")
def trigger_local_import(
    background_tasks: BackgroundTasks,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    row = (
        db.execute(
            text("SELECT * FROM user_import_settings WHERE user_id = CAST(:uid AS uuid)"),
            {"uid": current_user["id"]},
        )
        .mappings()
        .first()
    )

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
    x_import_secret: str | None = Header(default=None),
):
    secret = os.environ.get("IMPORT_WEBHOOK_SECRET", "")
    if not secret or x_import_secret != secret:
        raise HTTPException(status_code=403, detail="Invalid or missing X-Import-Secret header.")

    rows = (
        db.execute(
            text("SELECT user_id, local_datalog_path FROM user_import_settings WHERE local_datalog_path IS NOT NULL"),
        )
        .mappings()
        .all()
    )

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


@router.post("/webhook/{user_id}")
def webhook_per_user(
    user_id: uuid.UUID,
    body: WebhookPayload,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    x_import_secret: str | None = Header(default=None),
):
    """Per-user webhook fired by CPAP_data_uploader after each SMB sync session.

    Authenticates with the same IMPORT_WEBHOOK_SECRET as /trigger/all.
    When status='error' the import is skipped but the status row is updated
    so the user can see the upstream failure in Settings.
    """
    secret = os.environ.get("IMPORT_WEBHOOK_SECRET", "")
    if not secret or x_import_secret != secret:
        raise HTTPException(status_code=403, detail="Invalid or missing X-Import-Secret header.")

    row = (
        db.execute(
            text("SELECT user_id, local_datalog_path FROM user_import_settings WHERE user_id = CAST(:uid AS uuid)"),
            {"uid": str(user_id)},
        )
        .mappings()
        .first()
    )

    if row is None:
        raise HTTPException(status_code=404, detail="User not found or no import settings configured.")

    if body.status == "error":
        # Upstream uploader reported a failed sync — no new data to import.
        # Record the failure so the user can see it in Settings.
        try:
            db.execute(
                text("""
                    UPDATE user_import_settings
                    SET last_local_import_at = NOW(),
                        last_local_import_status = 'upstream error: CPAP uploader reported a failed sync'
                    WHERE user_id = CAST(:uid AS uuid)
                """),
                {"uid": str(user_id)},
            )
            db.commit()
        except Exception:
            logger.exception("Failed to write upstream-error status for user %s", user_id)
        return {"status": "skipped", "message": "Upstream sync failed; import not triggered."}

    if not row.get("local_datalog_path"):
        raise HTTPException(
            status_code=400,
            detail="No local DATALOG path configured for this user.",
        )

    path = _validate_local_path(row["local_datalog_path"])
    if not path.exists():
        raise HTTPException(
            status_code=400,
            detail=f"Path not found on server: {path}. Check the /data mount.",
        )

    uid_str = str(user_id)
    job = IMPORT_JOBS.get(uid_str)
    if job and job.running:
        return {"status": "already_running", "message": "An import is already in progress."}

    _mark_import_running(uid_str)
    background_tasks.add_task(_run_local_import_task, uid_str, str(path))
    return {"status": "started", "message": "Local DATALOG import started."}
