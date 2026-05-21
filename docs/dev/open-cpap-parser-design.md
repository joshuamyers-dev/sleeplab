# Design: open-cpap-parser Integration

**Date:** 2026-05-21
**Issues:** joshuamyers-dev/sleeplab#38, joshuamyers-dev/sleeplab#19
**Upstream:** open-cpap/open-cpap-parser#14 (schema additions in progress)
**Branch:** feat/open-cpap-parser (based on feat/licensing — GPLv3 prerequisite)

---

## Context

SleepLab currently parses only ResMed AirSense SD-card EDF files via `importer/edf_parser.py`. Issue #19 requested Lowenstein Prisma support; issue #38 generalises this to all manufacturers via [open-cpap-parser](https://gitlab.com/open-cpap/open-cpap-parser) — a Rust/Python library covering 8 CPAP device families, GPLv3-licensed (OSCAR-derived). GPLv3 adoption is handled in the prerequisite PR #42; this branch builds on that.

open-cpap-parser already ships a first-party SleepLab adapter (`open_cpap_parser.adapters.sleeplab_output`) that maps `CPAPDirectory` output to the dict shape expected by `importer/db.py::upsert_session()`. Most of the field-mapping work lives in the library, not in this repo.

---

## Architecture

### Parser detection and routing

Both import entry points funnel through `importer/import_sessions.py`. Detection runs at the top of `run_local_import()`:

1. Call `create_parser().parse(datalog_path)` on the SD card root.
2. On success → delegate to `run_open_cpap_import()` in the new `importer/open_cpap_import.py`.
3. On `UnsupportedDirectoryError` → fall through to the existing ResMed EDF path.

The browser upload path (`api/routers/upload.py`) spawns `import_sessions.py` as a subprocess; it inherits routing automatically with no changes.

### Adapter boundary

`open_cpap_parser.adapters.sleeplab_output.map_directory_to_sleeplab(directory, user_id)` returns:

```python
{
    "sessions": [session_data_dict, ...],   # for upsert_session()
    "events":   [(type, onset, dur, ts), ...],  # for replace_session_events()
    "metrics":  [metric_dict, ...],             # for replace_session_metrics()
    "spo2":     [spo2_dict, ...],               # for replace_session_spo2()
}
```

SleepLab's `open_cpap_import.py` consumes this output and calls the existing DB helpers — no field derivation happens on SleepLab's side.

### Columns not yet populated (blocked on open-cpap-parser#14)

The upstream schema additions tracked in open-cpap-parser issue #14 are not yet merged. Until they are, the following columns default or are hardcoded by the adapter:

| Column | Blocked field | Current default |
|--------|--------------|-----------------|
| `start_datetime` | `CPAPSessionSummary.start_time` | midnight of session date |
| `arousal_count` | `arousal_count` | `None` |
| `has_spo2` | `has_spo2` | `False` |
| `avg_spo2` / `min_spo2` | `spo2_avg` / `spo2_min` | `None` |

These fields will auto-populate once open-cpap-parser#14 merges and the library is updated.

### New columns (migration 013)

```sql
ALTER TABLE sessions
    ADD COLUMN IF NOT EXISTS manufacturer      TEXT,
    ADD COLUMN IF NOT EXISTS data_source       TEXT NOT NULL DEFAULT 'resmed_native',
    ADD COLUMN IF NOT EXISTS parser_validated  BOOLEAN NOT NULL DEFAULT true;
```

The sleeplab_output adapter must be extended to populate all three. `parser_validated` defaults `true` for ResMed and `false` for unvalidated manufacturers (Lowenstein until pressure regression is confirmed).

### Session ID stability (multi-block nights)

The current adapter generates `session_id = f"open-cpap-{summary.date.isoformat()}"`, which collapses multi-block nights. The correct approach (once `start_time` is available from open-cpap-parser#14) is `f"open-cpap-{summary.date.isoformat()}_{start_time.strftime('%H%M%S')}"`, matching the ResMed native `YYYYMMDD_HHMMSS` format. This is a blocker for multi-block nights; single-block nights upsert correctly today.

### Upload error UX

The browser upload path calls the importer as a background subprocess and exposes no result payload (only `running`/`started_at`). Surfacing `UnsupportedDirectoryError` to the UI requires adding an error field to `ImportJobStatus` and returning it from `GET /upload/status`. This is a follow-on task; initial implementation surfaces errors only in server logs.

---

## New files

| File | Role |
|------|------|
| `importer/open_cpap_import.py` | Stub: detection, adapter call, DB upsert loop |
| `migrations/013_add_manufacturer_and_source.sql` | Adds `manufacturer`, `data_source`, `parser_validated` |

## Modified files

| File | Change |
|------|--------|
| `importer/import_sessions.py` | Add open-cpap-parser routing hook in `run_local_import()` |
| `importer/db.py` | `upsert_session()` gains three new nullable columns |
| `pyproject.toml` / `requirements.txt` / `api/requirements.txt` | Add `open-cpap-parser` git dep |

---

## Testing

Initial target: ResMed AirSense 10/11 (regression) + Lowenstein Prisma (new). Criteria from sleeplab#38:

- Lowenstein directory → sessions imported; AHI, counts, pressure populated; `parser_validated=false` badge
- ResMed directory → existing metrics unchanged; `data_source='open_cpap_parser'` (or fall-through to native)
- Unsupported directory → `UnsupportedDirectoryError` caught; logged; status updated
- Duplicate import → upsert, no duplicate rows
- Missing optional fields → stored as `NULL`, no crash

Full test criteria: see joshuamyers-dev/sleeplab#38 testing section.

---

## Open questions / coordination with Joshua

1. **open-cpap-parser#14 timeline** — `start_time`, SpO2 summaries, `arousal_count`, `has_spo2` are all blocked on this. Session ID stability for multi-block nights is also blocked. @joshuamyers-dev owns the parser-side additions.

2. **`parser_validated` per manufacturer** — Which manufacturers should default `false`? ResMed starts `true`; Lowenstein starts `false` (pending pressure regression). Needs agreement on the full list.

3. **`pressure_mode` string values** — The issue requests documenting expected strings per manufacturer so the adapter can normalise consistently. Currently undocumented in open-cpap-parser.

4. **Upload error UX** — Out of scope for initial implementation; `ImportJobStatus` error field is a follow-on.
