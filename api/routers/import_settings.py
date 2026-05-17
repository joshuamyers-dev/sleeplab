import sys
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import text
from sqlalchemy.orm import Session

from ..auth import get_current_user
from ..database import get_db
from .upload import IMPORT_JOBS, _mark_import_running, _mark_import_finished

router = APIRouter()

SLEEPHQ_IMPORTER = Path(__file__).resolve().parent.parent.parent / "importer" / "sleephq_import.py"


class ImportSettingsResponse(BaseModel):
    sleephq_client_id: Optional[str] = None
    sleephq_client_secret: Optional[str] = None  # always None in responses
    sleephq_team_id: Optional[int] = None
    sleephq_machine_id: Optional[int] = None
    auto_import_sleephq: bool = False
    lookback_days: int = 30


class ImportSettingsUpdate(BaseModel):
    sleephq_client_id: Optional[str] = None
    sleephq_client_secret: Optional[str] = None
    sleephq_team_id: Optional[int] = None
    sleephq_machine_id: Optional[int] = None
    auto_import_sleephq: Optional[bool] = None
    lookback_days: Optional[int] = None


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

    return ImportSettingsResponse(
        sleephq_client_id=row["sleephq_client_id"],
        sleephq_client_secret=None,  # never expose
        sleephq_team_id=row["sleephq_team_id"],
        sleephq_machine_id=row["sleephq_machine_id"],
        auto_import_sleephq=row["auto_import_sleephq"],
        lookback_days=row["lookback_days"],
    )


@router.put("/settings", response_model=ImportSettingsResponse)
def save_import_settings(
    body: ImportSettingsUpdate,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
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
                     auto_import_sleephq, lookback_days, updated_at)
                VALUES
                    (CAST(:uid AS uuid), :client_id, :client_secret,
                     :team_id, :machine_id,
                     :auto_import, :lookback, NOW())
            """),
            {
                "uid": current_user["id"],
                "client_id": body.sleephq_client_id,
                "client_secret": body.sleephq_client_secret,
                "team_id": body.sleephq_team_id,
                "machine_id": body.sleephq_machine_id,
                "auto_import": body.auto_import_sleephq if body.auto_import_sleephq is not None else False,
                "lookback": body.lookback_days if body.lookback_days is not None else 30,
            },
        )
    else:
        fields = {"uid": current_user["id"], "updated_at": "NOW()"}
        set_clauses = ["updated_at = NOW()"]

        if body.sleephq_client_id is not None:
            set_clauses.append("sleephq_client_id = :client_id")
            fields["client_id"] = body.sleephq_client_id

        # Only update secret if a real new value is provided (not null/"***")
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
    finally:
        _mark_import_finished(user_id)


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
