import json
import os
import re
import time
from copy import deepcopy
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


app = FastAPI(
    title="SleepLab API",
    version=get_app_version(),
    openapi_tags=[
        {"name": "auth", "description": "User authentication and profile management"},
        {"name": "sessions", "description": "CPAP session listing, detail, events, metrics, and reports"},
        {"name": "stats", "description": "Aggregated therapy statistics and adherence tracking"},
        {"name": "equipment", "description": "CPAP accessory/equipment tracking and replacement dates"},
        {"name": "wearable", "description": "Wearable sensor data (HR, SpO2, sleep stages)"},
        {"name": "upload", "description": "DATALOG and oximeter file upload workflows"},
        {"name": "ai-summary", "description": "AI-generated therapy analysis and trend insights"},
        {"name": "import", "description": "Import settings and triggers (internal use)"},
        {"name": "config", "description": "Runtime configuration for the frontend (internal use)"},
        {"name": "llm", "description": "LLM backend health check (internal use)"},
    ],
)


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

API_V1 = "/api/v1"

app.include_router(sessions.router, prefix=f"{API_V1}/sessions", tags=["sessions"])
app.include_router(stats.router, prefix=f"{API_V1}/stats", tags=["stats"])
app.include_router(auth_router.router, prefix=f"{API_V1}/auth", tags=["auth"])
app.include_router(upload.router, prefix=f"{API_V1}/upload", tags=["upload"])
app.include_router(ai_summary.router, prefix=f"{API_V1}/stats", tags=["ai-summary"])
app.include_router(llm.router, prefix=f"{API_V1}/llm", tags=["llm"])
app.include_router(import_settings_router.router, prefix=f"{API_V1}/import", tags=["import"])
app.include_router(config.router, prefix=f"{API_V1}/config", tags=["config"])
app.include_router(equipment_router.router, prefix=f"{API_V1}/equipment", tags=["equipment"])
app.include_router(wearable_router.router, prefix=f"{API_V1}/wearable", tags=["wearable"])


@app.get(f"{API_V1}/health")
def health():
    return {"status": "ok"}


@app.get(f"{API_V1}/version")
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


PUBLIC_TAGS = {"sessions", "stats", "equipment", "auth", "wearable", "upload", "ai-summary"}
INTERNAL_TAGS = {"import", "config", "llm"}


def _filter_openapi_by_tags(spec: dict, allowed_tags: set[str]) -> dict:
    filtered = deepcopy(spec)
    filtered_paths = {}
    for path, methods in filtered.get("paths", {}).items():
        filtered_methods = {}
        for method, operation in methods.items():
            if method in ("get", "post", "put", "delete", "patch"):
                op_tags = set(operation.get("tags", []))
                if op_tags & allowed_tags:
                    filtered_methods[method] = operation
        if filtered_methods:
            filtered_paths[path] = filtered_methods
    filtered["paths"] = filtered_paths
    filtered_tags = [t for t in filtered.get("tags", []) if t["name"] in allowed_tags]
    filtered["tags"] = filtered_tags
    return filtered


@app.get(f"{API_V1}/openapi-public.json")
def get_public_openapi():
    """Return the OpenAPI spec filtered to public-facing endpoints only."""
    spec = app.openapi()
    return _filter_openapi_by_tags(spec, PUBLIC_TAGS)


@app.get(f"{API_V1}/openapi-internal.json")
def get_internal_openapi():
    """Return the OpenAPI spec filtered to internal/frontend-facing endpoints only."""
    spec = app.openapi()
    return _filter_openapi_by_tags(spec, INTERNAL_TAGS)


# --- MCP Server (feature-gated) ---
if os.environ.get("MCP_ENABLED", "false").lower() in ("true", "1", "on"):
    try:
        from fastapi_mcp import AuthConfig, FastApiMCP

        mcp = FastApiMCP(
            app,
            name="SleepLab",
            description="Sleep therapy data analysis platform — MCP tools for AI agents to query CPAP session data, therapy stats, equipment, and wearable sensors.",
            include_tags=list(PUBLIC_TAGS),
            describe_all_responses=True,
            describe_full_response_schema=True,
            auth_config=AuthConfig(
                dependencies=[],
            ),
        )
        mcp.mount_http()
    except ImportError:
        pass
