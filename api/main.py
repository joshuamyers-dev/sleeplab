import json
import os
import re
import time
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .env import load_env
from .routers import (
    ai_summary,
    config,
    llm,
    sessions,
    stats,
    upload,
)
from .routers import auth as auth_router
from .routers import (
    equipment as equipment_router,
)
from .routers import (
    import_settings as import_settings_router,
)
from .routers import (
    wearable as wearable_router,
)

load_env()

VERSION_FILE = Path(__file__).resolve().parent.parent / "VERSION"
DEFAULT_VERSION = "0.0.0-dev"
RELEASES_API_URL = "https://api.github.com/repos/joshuamyers-dev/sleeplab/releases/latest"
RELEASE_CHECK_TTL_SECONDS = 6 * 60 * 60
_release_cache: dict[str, object] = {"checked_at": 0.0, "payload": None}


def normalize_version(version: str | None) -> str | None:
    """Normalize a version string by removing whitespace and leading 'v' prefix.

    Args:
        version: The raw version string to normalize.

    Returns:
        The normalized version string, or None if the input is empty or invalid.
    """
    if not version:
        return None
    normalized = version.strip()
    if normalized.startswith("v"):
        normalized = normalized[1:]
    return normalized or None


def parse_version_parts(version: str | None) -> tuple[int, ...] | None:
    """Parse a normalized version string into a tuple of integers for comparison.

    Args:
        version: The normalized version string (e.g., '1.2.3').

    Returns:
        A tuple of integers (e.g., (1, 2, 3)) representing the version parts,
        or None if the version is invalid or empty.
    """
    normalized = normalize_version(version)
    if not normalized:
        return None

    parts: list[int] = []
    for piece in normalized.split("."):
        if not piece.isdigit():
            return None
        parts.append(int(piece))
    return tuple(parts)


def is_newer_version(candidate: str | None, current: str) -> bool:
    """Check if a candidate version is newer than the current version.

    Args:
        candidate: The candidate version string to check.
        current: The current version string to compare against.

    Returns:
        True if the candidate version is strictly newer than the current version,
        False otherwise.
    """
    candidate_parts = parse_version_parts(candidate)
    current_parts = parse_version_parts(current)
    if candidate_parts is None or current_parts is None:
        return False
    return candidate_parts > current_parts


def get_latest_release() -> dict[str, str | None]:
    """Fetch the latest release information from the GitHub repository API.

    Uses an in-memory cache with a TTL of 6 hours to prevent rate limits.

    Returns:
        A dictionary containing the latest version and the release HTML URL.
    """
    now = time.time()
    cached_payload = _release_cache.get("payload")
    checked_at = float(_release_cache.get("checked_at") or 0.0)

    if cached_payload is not None and now - checked_at < RELEASE_CHECK_TTL_SECONDS:
        return cached_payload  # type: ignore[return-value]

    payload: dict[str, str | None] = {"latest_version": None, "release_url": None}
    request = Request(
        RELEASES_API_URL,
        headers={
            "Accept": "application/vnd.github+json",
            "User-Agent": "SleepLab",
        },
    )

    try:
        with urlopen(request, timeout=3) as response:
            data = json.loads(response.read().decode("utf-8"))
            payload = {
                "latest_version": normalize_version(data.get("tag_name")),
                "release_url": data.get("html_url"),
            }
    except (HTTPError, URLError, TimeoutError, json.JSONDecodeError):
        payload = {"latest_version": None, "release_url": None}

    _release_cache["checked_at"] = now
    _release_cache["payload"] = payload
    return payload


def get_app_version() -> str:
    """Retrieve the application's current version.

    First checks the 'SLEEPLAB_VERSION' environment variable. If empty,
    reads and parses the local 'VERSION' file.

    Returns:
        The current version string, falling back to '0.0.0-dev' if not found.
    """
    configured = os.environ.get("SLEEPLAB_VERSION", "").strip()
    if configured:
        return configured

    try:
        content = VERSION_FILE.read_text(encoding="utf-8").strip()
        if not content:
            return DEFAULT_VERSION
        # VERSION format: "calver [semver]" - extract semver from brackets.
        match = re.search(r"\[([^\]]+)\]", content)
        if match:
            return match.group(1)
        return content
    except FileNotFoundError:
        return DEFAULT_VERSION


app = FastAPI(title="SleepLab API", version=get_app_version())


def _get_allowed_origins() -> list[str]:
    configured = os.environ.get("CORS_ALLOWED_ORIGINS", "").strip()
    if configured:
        if configured == "*":
            return ["*"]
        return [origin.strip() for origin in configured.split(",") if origin.strip()]

    return [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:8080",
        "http://127.0.0.1:8080",
    ]


app.add_middleware(
    CORSMiddleware,
    allow_origins=_get_allowed_origins(),
    allow_methods=["*"],
    allow_headers=["*"],
    allow_credentials=False,
)

app.include_router(sessions.router, prefix="/sessions", tags=["sessions"])
app.include_router(stats.router, prefix="/stats", tags=["stats"])
app.include_router(auth_router.router, prefix="/auth", tags=["auth"])
app.include_router(upload.router, prefix="/upload", tags=["upload"])
app.include_router(ai_summary.router, prefix="/stats", tags=["stats"])
app.include_router(llm.router, prefix="/llm", tags=["llm"])
app.include_router(import_settings_router.router, prefix="/import", tags=["import"])
app.include_router(config.router, prefix="/config", tags=["config"])
app.include_router(equipment_router.router, prefix="/equipment", tags=["equipment"])
app.include_router(wearable_router.router, prefix="/wearable", tags=["wearable"])


@app.get("/health")
def health():
    return {"status": "ok"}


@app.get("/version")
def version():
    current_version = get_app_version()
    release = get_latest_release()
    latest_version = release["latest_version"]

    return {
        "version": current_version,
        "latest_version": latest_version,
        "update_available": is_newer_version(latest_version, current_version),
        "release_url": release["release_url"],
    }
