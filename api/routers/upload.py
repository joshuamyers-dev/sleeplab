import shutil
import subprocess
import sys
import tempfile
import uuid
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path

from fastapi import APIRouter, BackgroundTasks, Depends, File, HTTPException, UploadFile
from pydantic import BaseModel

from ..auth import get_current_user

router = APIRouter()

IMPORTER_SCRIPT = Path(__file__).resolve().parent.parent.parent / "importer" / "import_sessions.py"


@dataclass
class UploadSession:
    user_id: str
    temp_root: Path
    datalog_path: Path
    from_date: str | None
    file_count: int = 0


UPLOAD_SESSIONS: dict[str, UploadSession] = {}


class StartUploadRequest(BaseModel):
    root_name: str
    from_date: str | None = None


@dataclass
class ImportJobStatus:
    running: bool
    started_at: str | None = None


IMPORT_JOBS: dict[str, ImportJobStatus] = {}


def _mark_import_running(user_id: str) -> None:
    IMPORT_JOBS[user_id] = ImportJobStatus(
        running=True,
        started_at=datetime.now(timezone.utc).isoformat(),
    )


def _mark_import_finished(user_id: str) -> None:
    IMPORT_JOBS[user_id] = ImportJobStatus(running=False, started_at=None)


def _run_import(datalog_path: str, user_id: str, from_date: str | None, cleanup_dir: str | None = None) -> None:
    cmd = [
        sys.executable,
        str(IMPORTER_SCRIPT),
        "--datalog",
        datalog_path,
        "--user-id",
        str(user_id),
    ]

    if from_date:
        cmd.extend(["--from", from_date])

    try:
        subprocess.run(cmd, cwd=str(IMPORTER_SCRIPT.parent), check=False)
    finally:
        _mark_import_finished(user_id)
        if cleanup_dir:
            shutil.rmtree(cleanup_dir, ignore_errors=True)


@router.post("/datalog/start")
def start_datalog_upload(
    body: StartUploadRequest,
    current_user: dict = Depends(get_current_user),
):
    normalized_from_date = None
    if body.from_date:
        normalized_from_date = body.from_date.replace("-", "")
        if not (len(normalized_from_date) == 8 and normalized_from_date.isdigit()):
            raise HTTPException(status_code=400, detail="from_date must be in YYYY-MM-DD format")

    root_name = body.root_name.strip().strip("/\\")
    if not root_name:
        raise HTTPException(status_code=400, detail="Invalid folder name")
    if any(part in {"", ".", ".."} for part in Path(root_name).parts):
        raise HTTPException(status_code=400, detail="Invalid folder name")
    if not IMPORTER_SCRIPT.exists():
        raise HTTPException(status_code=500, detail="Importer script not found")

    temp_root = Path(tempfile.mkdtemp(prefix="cpap-datalog-"))
    datalog_path = temp_root / root_name
    datalog_path.mkdir(parents=True, exist_ok=True)

    upload_id = str(uuid.uuid4())
    UPLOAD_SESSIONS[upload_id] = UploadSession(
        user_id=current_user["id"],
        temp_root=temp_root,
        datalog_path=datalog_path,
        from_date=normalized_from_date,
    )
    return {
        "upload_id": upload_id,
        "message": "Upload session created.",
    }


@router.post("/datalog/{upload_id}/batch")
def upload_datalog_batch(
    upload_id: str,
    files: list[UploadFile] = File(...),
    current_user: dict = Depends(get_current_user),
):
    session = _require_session(upload_id, current_user["id"])

    if not files:
        raise HTTPException(status_code=400, detail="No files were uploaded")

    saved = 0
    for upload in files:
        relative_name = (upload.filename or "").strip().lstrip("/").lstrip("\\")
        if not relative_name:
            continue

        relative_path = Path(relative_name)
        if any(part in {"", ".", ".."} for part in relative_path.parts):
            raise HTTPException(status_code=400, detail="Invalid file path in upload")

        destination = session.datalog_path / relative_path
        destination.parent.mkdir(parents=True, exist_ok=True)

        with destination.open("wb") as output:
            while chunk := upload.file.read(1024 * 1024):
                output.write(chunk)

        saved += 1
        upload.file.close()

    session.file_count += saved
    return {
        "status": "accepted",
        "uploaded_files": saved,
        "total_files": session.file_count,
    }


@router.post("/datalog/{upload_id}/finish")
def finish_datalog_upload(
    upload_id: str,
    background_tasks: BackgroundTasks,
    current_user: dict = Depends(get_current_user),
):
    session = _require_session(upload_id, current_user["id"])
    if session.file_count == 0:
        raise HTTPException(status_code=400, detail="No files uploaded for this import session")

    UPLOAD_SESSIONS.pop(upload_id, None)
    _mark_import_running(session.user_id)
    background_tasks.add_task(
        _run_import,
        str(session.datalog_path),
        session.user_id,
        session.from_date,
        str(session.temp_root),
    )
    return {
        "status": "accepted",
        "message": "Synchronization started.",
    }


def _require_session(upload_id: str, user_id: str) -> UploadSession:
    session = UPLOAD_SESSIONS.get(upload_id)
    if session is None or session.user_id != user_id:
        raise HTTPException(status_code=404, detail="Upload session not found")
    return session


@router.get("/status")
def get_upload_status(current_user: dict = Depends(get_current_user)):
    job = IMPORT_JOBS.get(current_user["id"])
    if job is None:
        return {"running": False, "started_at": None}
    return {
        "running": job.running,
        "started_at": job.started_at,
    }
