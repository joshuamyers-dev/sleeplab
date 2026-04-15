# SleepLab — Claude Context

## Project structure
- `importer/` — standalone Python scripts; run directly, not via the FastAPI app
- `importer/db.py` — shared Postgres helpers (`get_conn`, `upsert_session`, `session_exists`, etc.)
- `server.py` / `api/` — FastAPI backend
- `frontend/` — React frontend

## Git
- Feature work goes on named branches (`feature/<topic>`) with one PR per feature
- `git config` identity is set globally (`camden.bock@maine.edu` / Camden Bock) — commits work fine

## Private files
- `.newfeatures` — local implementation notes, never commit or push

## Importer conventions
- Session IDs from EDF files: `YYYYMMDD_HHMMSS`
- Session IDs from SleepHQ: `sleephq-{record_id}` (namespaced to avoid collisions)
- Always check `session_exists()` before upsert; use `--force` / `skip_existing=False` to overwrite

## Dependencies
- `requirements.txt` uses pinned versions for PyPI packages
- Git-sourced deps use PEP 440 direct-reference syntax: `pkg @ git+https://...`
