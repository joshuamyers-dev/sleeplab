# Wearable Data Integration — Design Spec
*Issue #12 | 2026-05-19*

## Context

SleepLab shows CPAP therapy metrics but has no way to correlate them with wearable data (heart rate, SpO₂, sleep stages). This feature adds real-time wearable data overlays to the session detail page and the dashboard trend chart, fetched on demand from a self-hosted wearable API — no storage in the SleepLab database.

Initial integrations: **open-wearables** and **mirobody** (both self-hosted). An abstract adapter interface makes it straightforward for future contributors to add other sources.

---

## Architecture

```
api/
  wearable/
    __init__.py
    base.py            # WearableAdapter ABC + dataclasses
    open_wearables.py  # OpenWearablesAdapter
    mirobody.py        # MirobodyAdapter
    registry.py        # ADAPTERS dict + get_adapter()
  routers/
    wearable.py        # GET /wearable/data, GET /wearable/summary
```

The router reads the authenticated user's `wearable_provider`, `wearable_base_url`, and `wearable_api_key` from `user_import_settings`, instantiates the right adapter via `get_adapter()`, calls `fetch()`, and returns normalised JSON. It never writes to the database.

All adapters and router endpoints are **sync** (consistent with the rest of the codebase). FastAPI runs sync routes in a threadpool automatically.

---

## Backend

### New migration
Three new columns on `user_import_settings`:
```sql
ALTER TABLE user_import_settings
    ADD COLUMN IF NOT EXISTS wearable_provider TEXT,
    ADD COLUMN IF NOT EXISTS wearable_base_url TEXT,
    ADD COLUMN IF NOT EXISTS wearable_api_key TEXT;
```
Migration number chosen after all pending PRs (#27–#29, #37) merge and the highest existing number is known.

### Adapter interface — `api/wearable/base.py`

```python
@dataclass
class Sample:
    timestamp: str  # ISO-8601 UTC
    value: float

@dataclass
class StageSample:
    timestamp: str  # ISO-8601 UTC, start of epoch
    stage: int      # 1=awake 2=light 3=deep 4=rem

@dataclass
class WearablePayload:
    hr: list[Sample] = field(default_factory=list)
    spo2: list[Sample] = field(default_factory=list)
    stages: list[StageSample] = field(default_factory=list)

    def is_empty(self) -> bool: ...

class WearableAdapter(ABC):
    @abstractmethod
    def fetch(self, user_id: str, target_date: date) -> WearablePayload: ...
```

All docstrings in `api/wearable/` use **Google style** (Args, Returns, Raises).

### Endpoints — `api/routers/wearable.py`

**`GET /wearable/data?date=YYYY-MM-DD`**
Returns raw samples for one night. Used by session detail page.
Response: `{ hr: [{timestamp, value}], spo2: [...], stages: [{timestamp, stage}] }`

**`GET /wearable/summary?date_from=YYYY-MM-DD&date_to=YYYY-MM-DD`**
Calls `fetch()` once per date in the range, returns daily aggregates.
Response: `[{ date, avg_hr, avg_spo2, awake_h, light_h, deep_h, rem_h }, ...]`
Used by dashboard trend chart. Date range matches the existing summary stats `days` param so any future changes are inherited automatically.

### Import settings extensions
`ImportSettingsResponse` and `ImportSettingsUpdate` in `api/routers/import_settings.py` each get three new optional fields: `wearable_provider`, `wearable_base_url`, `wearable_api_key`. In responses, `wearable_api_key` is always `null` (masked), following the existing SleepHQ secret pattern from PR #26.

---

## Frontend

### Settings page
New **"Wearable Data"** card after the Local DATALOG Import card:
- Provider selector: None / open-wearables / mirobody
- Base URL text input
- API key password input
- Saved via existing `PUT /import/settings` — no new API method, just three new fields added to `ImportSettings` in `client.ts`

### Session detail page
Two new components rendered below the CPAP Oximetry section (PR #25), fetched non-blocking after the main session load via `GET /wearable/data?date=<session.folder_date>`. Both silently omitted when the response is empty.

- **`WearableHRChart.tsx`** — HR + SpO₂ dual-axis line chart. Two stacked panels sharing a time axis, consistent styling with `SpO2Chart` (PR #25): dark tooltip, 30-min x-axis ticks, `#334155` grid.
- **`WearableSleepStageChart.tsx`** — sleep stage hypnogram. Step chart, discrete Y-axis (Awake / Light / Deep / REM).

### Dashboard/trend view
Stacked bar chart added to the summary stats page alongside the AHI trend. Each bar = one night, segments = hours in Awake / Light / Deep / REM. Fetched via `GET /wearable/summary` with the same date range as the existing summary stats call. Silently omitted when empty.

### New `client.ts` additions
```typescript
interface WearableData {
  hr: { timestamp: string; value: number }[]
  spo2: { timestamp: string; value: number }[]
  stages: { timestamp: string; stage: number }[]
}

interface WearableDailySummary {
  date: string
  avg_hr: number | null
  avg_spo2: number | null
  awake_h: number
  light_h: number
  deep_h: number
  rem_h: number
}

// api object additions:
getWearableData: (date: string) => get<WearableData>('/wearable/data', { date })
getWearableSummary: (dateFrom: string, dateTo: string) => get<WearableDailySummary[]>('/wearable/summary', { date_from: dateFrom, date_to: dateTo })
```

---

## Error handling

| Condition | Behaviour |
|-----------|-----------|
| No wearable provider configured | Return empty payload immediately, no HTTP call |
| `httpx.ConnectError` | Return empty payload (`200`) |
| Any non-auth HTTP error (5xx, 404) | Return empty payload (`200`) |
| 401 or 403 from wearable API | `502 Bad Gateway` with detail message |
| All `httpx` calls | 5-second timeout |

The invariant: wearable unavailability must never break or error-state the sleep/dashboard page.

---

## Testing

### Unit tests — `tests/test_wearable.py`
- Registry: correct adapter class per provider; `ValueError` on unknown provider
- Stage normalisation: each `_STAGE_MAP` entry maps correctly; unknown label → `1`
- `ConnectError` → `200` with empty arrays
- 401 from stub → `502` with detail
- No provider configured → `200` with empty arrays
- Unauthenticated request → `401`
- `wearable_api_key` masked to `null` in GET `/import/settings` response
- Summary aggregation: `fetch()` output correctly collapsed to `avg_hr`, `avg_spo2`, stage hours per day

### Manual integration test
Podman compose (postgres + local sleeplab image) + stub HTTP server returning fixture JSON for the wearable API endpoints. Same procedure as PR #37.

### Frontend
- `npx tsc --noEmit` clean
- `npx vitest run` — chart components render without crashing for empty and non-empty payloads
- Visual spot-check: wearable charts appear after CPAP charts; stacked bar chart aligns with AHI trend dates

---

## Pending PR conflicts (blocking)

This branch is started from current `main` before the following PRs merge. Rebase onto `main` after each merges and resolve conflicts at that point.

| PR | Files in conflict |
|----|-------------------|
| #25 — SpO2/pulse chart | `SessionDetail.tsx` — wearable charts go below the SpO2 section #25 adds |
| #26 — SleepHQ secret masking | `import_settings.py` — `wearable_api_key` masking follows same pattern |
| #27 — SleepHQ Machine ID | `import_settings.py`, `api/models.py`, `Settings.tsx` |
| #28 — Equipment catalog | `import_settings.py`, `api/models.py`, `Settings.tsx`, migration numbering |
| #29 — Equipment CRUD API/UI | Same as #28 plus `api/main.py`, `sessions.py` |
| #33 — opt-in SleepHQ client | `import_settings.py`, `Settings.tsx`, `docker-compose.yml` |
| #36 — timezone settings | `api/main.py`, `Settings.tsx`, `client.ts`, `SessionDetail.tsx` |
| #37 — local DATALOG import | `import_settings.py`, `Settings.tsx`, `client.ts`, migration numbering |

Migration number: inspect `migrations/` after all pending PRs merge and use the next available number.
