# Implementation Plan: open-cpap-parser Integration

**Spec:** `docs/superpowers/specs/2026-05-21-open-cpap-parser-design.md`
**Issues:** joshuamyers-dev/sleeplab#38, joshuamyers-dev/sleeplab#19
**Upstream blocker:** cpap-parser#14 (start_time, SpO2 summary fields, arousal_count)
**Prerequisites:** PR #42 (GPLv3 adoption) and PR #43 (PyJWT dep fix) merged into main first.

---

## Context

open-cpap-parser ships a first-party SleepLab adapter at
`open_cpap_parser.adapters.sleeplab_output`. This plan wires it into
SleepLab's import infrastructure. Most field-derivation work is already
done in the library; SleepLab's job is routing, new column population,
migration, and error handling.

### Key files to understand before starting

- `importer/open_cpap_import.py` — scaffold with full docstrings; implement the stubs here
- `importer/import_sessions.py` — routing hook marked `TODO(open-cpap-parser)`
- `importer/db.py::upsert_session()` — three new columns marked `TODO(open-cpap-parser)`
- `migrations/013_add_manufacturer_and_source.sql` — already written; run it
- `open_cpap_parser.adapters.sleeplab_output` — read this before writing anything
- `open_cpap_parser.core.create_parser` / `UniversalCPAPParser` — entry point API

---

## Steps

### Step 1 — Run migration 013

```sql
-- Run migrations/013_add_manufacturer_and_source.sql against the DB
-- Verify:
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'sessions'
  AND column_name IN ('manufacturer', 'data_source', 'parser_validated');
-- Expected: 3 rows returned
```

**Validation:** migration runs without error; existing session rows now have
`data_source = 'resmed_native'` and `parser_validated = true`.

---

### Step 2 — Extend `importer/db.py::upsert_session()`

Add `manufacturer`, `data_source`, `parser_validated` to the INSERT column
list, VALUES clause, and ON CONFLICT DO UPDATE SET block.

The INSERT already has `therapy_mode`, `mask_type`, `humidity_level`,
`temperature_c` — the new columns go right before `user_id`.

Update the native ResMed path in `import_sessions.py::import_folder()` to
pass the three new keys:

```python
session_data = {
    ...
    "manufacturer":     None,
    "data_source":      "resmed_native",
    "parser_validated": True,
    ...
}
```

**Validation:**
```bash
uv run pytest tests/test_auth.py tests/test_sessions.py -v --tb=short
# All previously-passing tests must still pass.
# DB-marked tests can be skipped if no Postgres available locally.
```

---

### Step 3 — Implement `importer/open_cpap_import.py`

#### 3a. `detect_open_cpap_layout(directory: Path) -> bool`

```python
from open_cpap_parser.core import create_parser
from open_cpap_parser.adapters.base import UnsupportedDirectoryError

def detect_open_cpap_layout(directory: Path) -> bool:
    parser = create_parser()
    try:
        parser.parse(directory)
        return True
    except UnsupportedDirectoryError:
        return False
```

Note: this calls `.parse()` twice if detection succeeds (once here, once in
`run_open_cpap_import`). For large directories this is wasteful. A future
optimisation is to cache the `CPAPDirectory` result and pass it through, but
the double-parse is acceptable for the initial implementation.

#### 3b. `run_open_cpap_import(user_id, datalog_path, from_date=None) -> dict`

```python
def run_open_cpap_import(user_id, datalog_path, from_date=None):
    from open_cpap_parser.core import create_parser
    from open_cpap_parser.adapters.sleeplab_output import map_directory_to_sleeplab

    datalog = Path(datalog_path)
    if not datalog.exists():
        raise FileNotFoundError(f"DATALOG path not found: {datalog_path}")

    parser = create_parser()
    directory = parser.parse(datalog)  # raises UnsupportedDirectoryError if no adapter matches

    mapped = map_directory_to_sleeplab(directory, user_id)
    # mapped = {"sessions": [...], "events": [...], "metrics": [...], "spo2": [...]}

    # Optionally filter by from_date
    if from_date:
        mapped["sessions"] = [
            s for s in mapped["sessions"]
            if s["folder_date"].strftime("%Y%m%d") >= from_date
        ]

    series = directory.machine.series  # e.g. "ResMed", "Lowenstein"
    validated = MANUFACTURER_VALIDATED.get(series, False)

    conn = get_conn()
    stats = {"imported": 0, "folders": 0, "errors": 0}
    try:
        for session_data in mapped["sessions"]:
            session_id = session_data["session_id"]
            try:
                if session_exists(conn, user_id, session_id):
                    continue

                # Inject SleepLab-specific columns not produced by the shared adapter
                session_data["manufacturer"]     = series or None
                session_data["data_source"]      = "open_cpap_parser"
                session_data["parser_validated"] = validated

                # The adapter does not yet populate these (blocked on open-cpap-parser#14);
                # ensure they default to None rather than raising a KeyError.
                session_data.setdefault("therapy_mode",    None)
                session_data.setdefault("mask_type",       None)
                session_data.setdefault("humidity_level",  None)
                session_data.setdefault("temperature_c",   None)
                session_data.setdefault("pld_start_datetime", session_data["start_datetime"])

                session_db_id = upsert_session(conn, session_data)
                # Events — adapter returns flat (type, onset_sec, dur_sec, session_start) tuples
                replace_session_events(conn, session_db_id, mapped["events"], session_data["start_datetime"])
                # Metrics and SpO2 — pass through if available
                if mapped["metrics"]:
                    replace_session_metrics(conn, session_db_id, None, mapped["metrics"])
                if mapped["spo2"]:
                    replace_session_spo2(conn, session_db_id, None, mapped["spo2"])
                conn.commit()
                stats["imported"] += 1
                stats["folders"] += 1
            except Exception as e:
                conn.rollback()
                print(f"    ERROR session {session_id}: {e}")
                stats["errors"] += 1
    finally:
        conn.close()
    return stats
```

**Validation:**
```bash
# With a real ResMed or Lowenstein fixture directory:
cd importer
uv run python -c "
from open_cpap_import import run_open_cpap_import
stats = run_open_cpap_import('test-user-uuid', '/path/to/fixture/DATALOG')
print(stats)  # expect: {'imported': N, 'folders': N, 'errors': 0}
"
```

---

### Step 4 — Wire routing into `import_sessions.py::run_local_import()`

Uncomment and implement the routing block marked `TODO(open-cpap-parser)`:

```python
from open_cpap_import import detect_open_cpap_layout, run_open_cpap_import
from open_cpap_parser.adapters.base import UnsupportedDirectoryError

def run_local_import(user_id, datalog_path, from_date=None):
    datalog = Path(datalog_path)
    if not datalog.exists():
        raise FileNotFoundError(...)

    # Detection: try open-cpap-parser first
    try:
        if detect_open_cpap_layout(datalog):
            return run_open_cpap_import(user_id, datalog_path, from_date)
    except UnsupportedDirectoryError:
        pass  # fall through to native ResMed EDF path

    # ... existing per-folder loop unchanged ...
```

**Validation:**
```bash
# Native ResMed directory → existing path (UnsupportedDirectoryError caught, falls through)
# Lowenstein directory → open_cpap_import path used
uv run pytest tests/test_local_import.py -v --tb=short -m "not db"
```

---

### Step 5 — Populate `MANUFACTURER_VALIDATED`

Fill the dict in `open_cpap_import.py` with confirmed series strings.
Coordinate with @joshuamyers-dev on the full list of expected
`MachineInfo.series` values per adapter.

Initial minimum:
```python
MANUFACTURER_VALIDATED = {
    "ResMed": True,
    "Lowenstein": False,  # pending pressure regression vs OSCAR
}
```

**Note:** Until open-cpap-parser documents expected `pressure_mode` string
values per manufacturer (requested in open-cpap-parser#14), this dict may
need adjustment. When in doubt, default to `False`.

---

### Step 6 — Update `MANUFACTURER_VALIDATED` and add `parser_validated` badge to the UI (frontend)

This step requires frontend work and is lower priority for the initial PR.
The `parser_validated` column is already stored; the UI badge can be added
in a follow-on PR once the import path is validated end-to-end.

Criteria from sleeplab#38:
> ⚠ Imported via community parser — some metrics may be incomplete or approximate.

The sessions API response model (`api/models.py`) should expose
`parser_validated: bool` and `manufacturer: str | None` so the frontend
can conditionally render the badge.

---

### Step 7 — Write tests

File: `tests/test_open_cpap_import.py`

Required tests (no DB needed — use mocks for `get_conn`, `upsert_session`, etc.):

| Test | What it checks |
|------|---------------|
| `test_detect_layout_recognised` | Returns True for a fixture directory that matches a known adapter |
| `test_detect_layout_unrecognised` | Returns False for an empty or unknown directory |
| `test_run_import_stats_shape` | Return dict has `imported`, `folders`, `errors` keys |
| `test_manufacturer_validated_defaults_false` | Unknown `series` value defaults `parser_validated=False` |
| `test_data_source_always_open_cpap_parser` | `data_source` is `"open_cpap_parser"` for all sessions |
| `test_session_id_stability` | Same input produces the same `session_id` on re-import (idempotency) |

**Validation:**
```bash
uv run ruff check tests/
uv run pytest tests/test_open_cpap_import.py -v --tb=short
```

---

### Step 8 — Full regression run

```bash
uv run ruff check tests/
uv run pytest -v --tb=short -m "not db"
# All 30 previously-passing tests must still pass.
```

---

## Blocked on open-cpap-parser#14

The following will improve automatically once the upstream schema additions merge
and the git dep is re-resolved:

- `start_datetime` populated from actual `start_time` (not midnight)
- `has_spo2` reflecting real oximetry presence
- `avg_spo2` and `min_spo2` populated from summary aggregates
- `arousal_count` populated for devices that report arousals
- `session_id` using `YYYYMMDD_HHMMSS` format (multi-block night support)

No SleepLab code changes are required to pick these up — the adapter handles it.
Coordinate with @joshuamyers-dev on timing.

---

## Coordination notes for Joshua (@joshuamyers-dev)

**Parser side (open-cpap-parser):**
- open-cpap-parser#14: schema additions to `CPAPSessionSummary`
- Documenting expected `MachineInfo.series` string values per adapter
- Documenting expected `pressure_mode` string values per manufacturer
- `parser_validated` list: confirm which manufacturers are ready for `True`

**SleepLab side (this repo):**
- Steps 1–7 above
- Frontend badge (Step 6, follow-on PR)
- Upload error UX: adding an error field to `ImportJobStatus` so browser uploads
  surface `UnsupportedDirectoryError` to the user (currently only in logs)
