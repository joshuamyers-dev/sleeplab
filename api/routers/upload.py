import logging
import shutil
import subprocess
import sys
import tempfile
import uuid
from dataclasses import dataclass
from datetime import UTC, datetime
from pathlib import Path
from typing import Literal

from fastapi import APIRouter, BackgroundTasks, Depends, File, Form, HTTPException, UploadFile
from pydantic import BaseModel
from sqlalchemy import text
from sqlalchemy.orm import Session

from ..auth import get_current_user
from ..database import get_db
from ..oximeter import OximeterParseError, OximeterRecording, parse_viatom_binary
from ..settings_store import get_timezone_settings, normalize_timezone

router = APIRouter()
logger = logging.getLogger(__name__)

IMPORTER_SCRIPT = Path(__file__).resolve().parent.parent.parent / "importer" / "import_sessions.py"


@dataclass
class UploadSession:
    """Transient state for a multi-batch DATALOG upload.

    Created on POST /datalog/start and deleted once the import background task
    is queued via POST /datalog/{upload_id}/finish.
    """

    user_id: str
    temp_root: Path
    datalog_path: Path
    from_date: str | None
    file_count: int = 0


UPLOAD_SESSIONS: dict[str, UploadSession] = {}


class StartUploadRequest(BaseModel):
    """Pydantic model representing CPAP datalog upload initiation payload.

    Attributes:
        root_name: The root folder name of the ResMed DATALOG directory.
        from_date: Optional start date threshold in YYYY-MM-DD format.
    """

    root_name: str
    from_date: str | None = None


class OximeterImportResult(BaseModel):
    """Pydantic model representing the result of importing a single oximeter file.

    Attributes:
        filename: The original imported file name.
        status: The resulting status label ('imported', 'skipped', 'unmatched', 'failed').
        message: Informational details or error message.
        session_id: The ID string of the matched CPAP session, if matched.
        folder_date: The date directory string of the session, if matched.
        sample_count: Count of telemetry samples imported, if successful.
    """

    filename: str
    status: Literal["imported", "skipped", "unmatched", "failed"]
    message: str
    session_id: str | None = None
    folder_date: str | None = None
    sample_count: int | None = None


class OximeterImportResponse(BaseModel):
    """Pydantic model representing aggregated results for multiple oximeter file imports.

    Attributes:
        status: Overall import outcome — completed, partial, or failed.
        message: Human-readable summary message for the import run.
        imported: Total number of files successfully imported.
        skipped: Total number of files skipped (e.g. already had SpO2 data).
        unmatched: Total number of files that could not be matched to a session.
        failed: Total number of files that failed during parsing.
        results: Detailed list of import outcomes per file.
    """

    status: Literal["completed", "partial", "failed"]
    message: str
    imported: int
    skipped: int
    unmatched: int
    failed: int
    results: list[OximeterImportResult]


@dataclass
class ImportJobStatus:
    """Dataclass representing the current runtime execution status of a datalog import background job.

    Attributes:
        running: True if a background import job is currently executing for the user.
        started_at: ISO-8601 UTC timestamp of when the job started.
    """

    running: bool
    started_at: str | None = None
    status: Literal["running", "completed", "failed"] = "completed"
    message: str | None = None


IMPORT_JOBS: dict[str, ImportJobStatus] = {}


def _mark_import_running(user_id: str) -> None:
    """Mark the import job status as active for a specific user.

    Args:
        user_id: The unique user identifier.
    """
    IMPORT_JOBS[user_id] = ImportJobStatus(
        running=True,
        started_at=datetime.now(UTC).isoformat(),
        status="running",
        message="Import is running.",
    )


def _mark_import_finished(
    user_id: str,
    status: Literal["completed", "failed"] = "completed",
    message: str | None = None,
) -> None:
    """Mark the import job status as inactive for a specific user.

    Args:
        user_id: The unique user identifier.
        status: Final job status — completed or failed.
        message: Optional message summarising the outcome.
    """
    IMPORT_JOBS[user_id] = ImportJobStatus(
        running=False,
        started_at=None,
        status=status,
        message=message,
    )


def _run_import(datalog_path: str, user_id: str, from_date: str | None, cleanup_dir: str | None = None) -> None:
    """Execute the import background script as a subprocess and clean up.

    Args:
        datalog_path: The filesystem path to the uploaded DATALOG folder.
        user_id: The unique user identifier.
        from_date: Optional start date filter for imported data.
        cleanup_dir: Optional directory to recursively remove after completion.
    """
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
        result = subprocess.run(cmd, cwd=str(IMPORTER_SCRIPT.parent), check=False)
        if result.returncode == 0:
            _mark_import_finished(user_id, "completed", "Import completed.")
        else:
            logger.error("DATALOG import failed for user %s with exit code %s", user_id, result.returncode)
            _mark_import_finished(user_id, "failed", "Import failed. Check the uploaded files and try again.")
    except Exception:
        logger.exception("DATALOG import failed for user %s", user_id)
        _mark_import_finished(user_id, "failed", "Import failed. Check the uploaded files and try again.")
    finally:
        if cleanup_dir:
            shutil.rmtree(cleanup_dir, ignore_errors=True)


@router.post("/datalog/start")
def start_datalog_upload(
    body: StartUploadRequest,
    current_user: dict = Depends(get_current_user),
):
    """Initiate a multi-file datalog upload session.

    Args:
        body: The StartUploadRequest payload.
        current_user: The authenticated user's details.

    Returns:
        A dictionary containing the generated upload_id and status message.

    Raises:
        HTTPException: If from_date is malformed, root_name is invalid or unsafe,
            or the backend importer script is missing.
    """
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
    """Upload a batch of files for an active datalog upload session.

    Args:
        upload_id: The unique identifier of the active upload session.
        files: The list of UploadFile items.
        current_user: The authenticated user's details.

    Returns:
        A dictionary showing acceptance status, uploaded file count, and total files in session.

    Raises:
        HTTPException: If the upload session is not found/authorized, if no files are provided,
            or if any file path is malformed or unsafe.
    """
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
    """Complete a datalog upload session and launch a background import job.

    Args:
        upload_id: The unique identifier of the active upload session.
        background_tasks: FastAPI background tasks dependency.
        current_user: The authenticated user's details.

    Returns:
        A status dictionary confirming the import has been scheduled.

    Raises:
        HTTPException: If the upload session is not found/authorized or if no files were uploaded.
    """
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
    """Retrieve an active upload session, validating ownership.

    Args:
        upload_id: The unique upload session ID.
        user_id: The expected user owner ID.

    Returns:
        The matching UploadSession instance.

    Raises:
        HTTPException: If the session does not exist or does not belong to the user.
    """
    session = UPLOAD_SESSIONS.get(upload_id)
    if session is None or session.user_id != user_id:
        raise HTTPException(status_code=404, detail="Upload session not found")
    return session


@router.get("/status")
def get_upload_status(current_user: dict = Depends(get_current_user)):
    """Retrieve the current import status for the logged-in user.

    Args:
        current_user: The authenticated user's details.

    Returns:
        A dictionary containing running status and start timestamp.
    """
    job = IMPORT_JOBS.get(current_user["id"])
    if job is None:
        return {"running": False, "started_at": None, "status": "completed", "message": None}
    return {
        "running": job.running,
        "started_at": job.started_at,
        "status": job.status,
        "message": job.message,
    }


@router.post("/oximeter", response_model=OximeterImportResponse)
async def upload_oximeter_files(
    files: list[UploadFile] = File(...),
    machine_tz: str | None = Form(default=None),
    overwrite: bool = Form(default=False),
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Import Viatom/Wellue binary oximeter files into existing CPAP sessions."""
    if not files:
        raise HTTPException(status_code=400, detail="No oximeter files were uploaded")

    if machine_tz is not None:
        try:
            timezone_name = (
                normalize_timezone(machine_tz) or get_timezone_settings(db, current_user["id"])["machine_tz"]
            )
        except ValueError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc
    else:
        timezone_name = get_timezone_settings(db, current_user["id"])["machine_tz"]

    results: list[OximeterImportResult] = []
    for upload in files:
        filename = upload.filename or "oximeter-file"
        try:
            payload = await upload.read()
            recording = parse_viatom_binary(payload, filename, timezone_name)
            results.append(_import_oximeter_recording(db, current_user["id"], filename, recording, overwrite))
        except OximeterParseError as exc:
            results.append(OximeterImportResult(filename=filename, status="failed", message=str(exc)))
        except Exception:
            logger.exception("Oximeter import failed for user %s file %s", current_user["id"], filename)
            results.append(
                OximeterImportResult(
                    filename=filename,
                    status="failed",
                    message="Could not import this oximeter file. Check the file and try again.",
                ),
            )
        finally:
            await upload.close()

    db.commit()
    imported = sum(1 for result in results if result.status == "imported")
    skipped = sum(1 for result in results if result.status == "skipped")
    unmatched = sum(1 for result in results if result.status == "unmatched")
    failed = sum(1 for result in results if result.status == "failed")
    status: Literal["completed", "partial", "failed"]
    if failed and imported + skipped + unmatched == 0:
        status = "failed"
        message = "No oximeter files could be imported."
    elif failed:
        status = "partial"
        message = "Some oximeter files could not be imported."
    else:
        status = "completed"
        message = "Oximeter import completed."
    return OximeterImportResponse(
        status=status,
        message=message,
        imported=imported,
        skipped=skipped,
        unmatched=unmatched,
        failed=failed,
        results=results,
    )


def _import_oximeter_recording(
    db: Session,
    user_id: str,
    filename: str,
    recording: OximeterRecording,
    overwrite: bool,
) -> OximeterImportResult:
    """Match a parsed oximeter recording to a session by date and import its SpO2/pulse samples.

    Returns a result with status 'imported', 'skipped' (already has SpO2 data and overwrite=False),
    'unmatched' (no session found for the recording date), or 'failed' (unexpected error).
    """
    session = (
        db.execute(
            text("""
            WITH candidates AS (
                SELECT
                    id::text AS id,
                    folder_date::text AS folder_date,
                    start_datetime,
                    start_datetime + (duration_seconds * INTERVAL '1 second') AS end_datetime,
                    GREATEST(
                        0,
                        EXTRACT(EPOCH FROM (
                            LEAST(start_datetime + (duration_seconds * INTERVAL '1 second'), :record_end)
                            - GREATEST(start_datetime, :record_start)
                        ))
                    ) AS overlap_seconds
                FROM sessions
                WHERE user_id = CAST(:uid AS uuid)
                  AND duration_seconds >= 600
                  AND start_datetime < :record_end
                  AND start_datetime + (duration_seconds * INTERVAL '1 second') > :record_start
            )
            SELECT id, folder_date, overlap_seconds
            FROM candidates
            ORDER BY overlap_seconds DESC, ABS(EXTRACT(EPOCH FROM (start_datetime - :record_start))) ASC
            LIMIT 1
        """),
            {"uid": user_id, "record_start": recording.started_at, "record_end": recording.ended_at},
        )
        .mappings()
        .first()
    )

    if session is None:
        return OximeterImportResult(
            filename=filename,
            status="unmatched",
            message="No existing CPAP session overlaps this oximeter recording",
            sample_count=len(recording.samples),
        )

    session_id = str(session["id"])
    existing_count = db.execute(
        text("SELECT COUNT(*) FROM session_spo2 WHERE session_id = CAST(:sid AS uuid)"),
        {"sid": session_id},
    ).scalar_one()
    if existing_count and not overwrite:
        return OximeterImportResult(
            filename=filename,
            status="skipped",
            message="Session already has SpO2 data",
            session_id=session_id,
            folder_date=str(session["folder_date"]),
            sample_count=len(recording.samples),
        )

    if existing_count:
        db.execute(text("DELETE FROM session_spo2 WHERE session_id = CAST(:sid AS uuid)"), {"sid": session_id})

    rows = [
        {"sid": session_id, "ts": sample.timestamp, "spo2": sample.spo2, "pulse": sample.pulse}
        for sample in recording.samples
    ]
    if rows:
        db.execute(
            text("""
                INSERT INTO session_spo2 (session_id, ts, spo2, pulse)
                VALUES (CAST(:sid AS uuid), :ts, :spo2, :pulse)
            """),
            rows,
        )

    db.execute(
        text("""
            UPDATE sessions
            SET
                has_spo2 = EXISTS (
                    SELECT 1 FROM session_spo2 WHERE session_id = CAST(:sid AS uuid) AND spo2 IS NOT NULL
                ),
                avg_spo2 = (
                    SELECT ROUND(AVG(spo2)::numeric, 1)
                    FROM session_spo2 WHERE session_id = CAST(:sid AS uuid) AND spo2 IS NOT NULL
                ),
                min_spo2 = (
                    SELECT MIN(spo2)
                    FROM session_spo2 WHERE session_id = CAST(:sid AS uuid) AND spo2 IS NOT NULL
                ),
                updated_at = NOW()
            WHERE id = CAST(:sid AS uuid)
        """),
        {"sid": session_id},
    )

    return OximeterImportResult(
        filename=filename,
        status="imported",
        message="Imported oximeter data",
        session_id=session_id,
        folder_date=str(session["folder_date"]),
        sample_count=len(recording.samples),
    )
