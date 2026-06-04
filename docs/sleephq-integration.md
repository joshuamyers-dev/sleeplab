# SleepHQ Integration Guide

This guide explains how to connect SleepLab with [SleepHQ](https://sleephq.com) to automatically bridge your CPAP session summary data. 

The SleepHQ integration operates as a bridge that pulls nightly CPAP summaries from the SleepHQ API and writes them directly to SleepLab's PostgreSQL database.

---

## 1. How It Works

The bridge acts as an import adapter:
- **API Ingestion:** SleepLab connects to the SleepHQ developer API using OAuth2 credentials.
- **Session Resolution:** The importer resolves your active team and CPAP machine profile automatically.
- **Collision Avoidance:** Imported sessions are prefixed with `sleephq-{record_id}` to prevent overwrite collisions with raw EDF files imported directly from your SD card.

---

## 2. Configuration Settings

Configure your connection credentials under **Settings → SleepHQ Integration** in the web UI, or set them directly in your environment (`.env`) file:

| Environment Variable | Required | Description |
|---|---|---|
| `SLEEPHQ_CLIENT_ID` | Yes | Your SleepHQ OAuth2 developer client ID. |
| `SLEEPHQ_CLIENT_SECRET` | Yes | Your SleepHQ OAuth2 developer client secret. |
| `SLEEPHQ_TEAM_ID` | No | Optional. Explicit team ID to skip automated API resolution. |
| `SLEEPHQ_MACHINE_ID` | No | Optional. Explicit CPAP machine profile ID to skip automated API resolution. |

> [!NOTE]
> OAuth2 credentials can be obtained from your SleepHQ account developer settings dashboard.

---

## 3. Operations and Import Workflows

### UI-Driven Synchronisation

1. Navigate to **Import → Sync from SleepHQ** in the web dashboard.
2. Click **Sync Now** to trigger an automated request.
3. The backend fetches records from the last 30 days and stores them in your local database.

### CLI Import Command

You can run sync scripts directly using the backend importer CLI for backfills or cron automated runs:

```bash
cd importer
# Sync records from the last 30 days
python3 sleephq_import.py --user-id <user-uuid> --days 30

# Sync a specific historical date range
python3 sleephq_import.py --user-id <user-uuid> --from 2024-01-01 --to 2024-12-31

# Execute a dry run without modifying the local database
python3 sleephq_import.py --user-id <user-uuid> --days 7 --dry-run

# Force re-import and overwrite existing sessions
python3 sleephq_import.py --user-id <user-uuid> --days 7 --force
```

---

## 4. API Robustness & Rate-Limiting

The SleepHQ API imposes strict rate limits. The SleepLab bridge incorporates robust handler logic to prevent failures during large backfills:

1. **Jittered Exponential Backoff:** When hitting rate limits (HTTP 429) or server errors (HTTP 5xx), the importer waits using exponential backoff with full randomized jitter (`_backoff_delay`).
2. **Retry-After Header Compliance:** The importer respects and complies with the standard `Retry-After` HTTP headers returned by the SleepHQ API.
3. **Polite Pagination Pauses:** The bridge inserts a polite `1.5-second` delay (`_PAGE_DELAY`) between consecutive page requests to maintain API traffic within safe bounds.

---

## 5. Programmatic Backend Integration

For custom scripting or pipeline integration, import the Python entry point directly:

```python
from importer.sleephq_import import run_sleephq_import

stats = run_sleephq_import(user_id="your-user-uuid", days=30)
# Returns: {"inserted": 12, "updated": 2, "skipped": 16, "errors": 0}
```
