# Automated CPAP Import via CPAP_data_uploader

This guide explains how to wire [CPAP_data_uploader](https://github.com/amanuense/CPAP_data_uploader) (an ESP32-based CPAP data collector) to SleepLab so that every SD-card sync automatically triggers an import — no manual uploads needed.

The two projects are independent: CPAP_data_uploader works with any HTTP webhook target (Healthchecks.io, Home Assistant, etc.). If SleepLab isn't reachable when the ESP32 fires, it logs the error and continues — your sync is never blocked.

---

## Data flow

```
CPAP machine SD card
      │
      ▼
ESP32 (CPAP_data_uploader)
      │  reads SD → writes to NAS via SMB
      │
      ▼
NAS share  (e.g. /mnt/nas/cpap-data/DATALOG)
      │  bind-mounted into SleepLab container at /data
      │
      ▼
SleepLab  POST /import/webhook/{userId}
      │  triggers background local import from /data
      │
      ▼
SleepLab database  ──►  dashboard
      │
      ▼ (optional)
Healthchecks.io / Home Assistant  ◄── health ping
```

---

## SleepLab docker-compose.yml

```yaml
services:
  postgres:
    image: postgres:16
    environment:
      POSTGRES_DB: cpap
      POSTGRES_USER: cpap
      POSTGRES_PASSWORD: cpap          # change in production
    volumes:
      - sleeplab_postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U cpap -d cpap"]
      interval: 10s
      timeout: 5s
      retries: 5

  app:
    image: ghcr.io/joshuamyers-dev/sleeplab:latest
    depends_on:
      postgres:
        condition: service_healthy
    environment:
      DATABASE_URL: postgresql+psycopg2://cpap:cpap@postgres:5432/cpap
      SECRET_KEY: change-me-to-a-long-random-string

      # Shared secret validated on every webhook request.
      # Must match SLEEPLAB_SECRET in CPAP_uploader config.txt.
      IMPORT_WEBHOOK_SECRET: change-me-to-a-random-secret

    volumes:
      # Bind-mount the NAS share that CPAP_uploader writes to.
      # Adjust the host path to wherever your NAS is mounted.
      - /mnt/nas/cpap-data/DATALOG:/data:ro

    ports:
      - "8080:8080"
      - "8000:8000"

volumes:
  sleeplab_postgres_data:
```

After starting the stack, open SleepLab → **Settings → Local DATALOG Import** and set the server path to `/data`.

---

## CPAP_data_uploader config.txt

```ini
# SMB target — the same share mounted into SleepLab above
SMB_DOMAIN    = nas.local
SMB_SHARE     = cpap-data
SMB_USER      = cpap_user
SMB_PASS      = cpap_pass

# SleepLab per-user webhook
# Find your User ID in SleepLab → Settings (shown next to your account).
SLEEPLAB_DOMAIN  = http://sleeplab.local:8000
SLEEPLAB_USER_ID = <your-sleeplab-user-uuid>
SLEEPLAB_SECRET  = change-me-to-a-random-secret   # must match IMPORT_WEBHOOK_SECRET above

# Optional: health-check ping (Healthchecks.io, UptimeRobot, Home Assistant webhook, etc.)
GENERIC_WEBHOOK_URL = https://hc-ping.com/your-uuid
```

Leave `SLEEPLAB_USER_ID` **blank** to use the multi-user broadcast endpoint (`POST /import/trigger/all`) instead of the per-user one. Use blank when a single NAS share is shared by multiple SleepLab users.

---

## Webhook endpoints

| Scenario | Endpoint | When to use |
|---|---|---|
| Single user | `POST /import/webhook/{userId}` | `SLEEPLAB_USER_ID` is set in config.txt |
| Multiple users on shared NAS | `POST /import/trigger/all` | `SLEEPLAB_USER_ID` is blank |

Both endpoints require the `X-Import-Secret` header to match `IMPORT_WEBHOOK_SECRET`.

**Security note:** `IMPORT_WEBHOOK_SECRET` is an operator-level secret — anyone holding it can trigger imports for any user. Keep it out of version control and rotate it if compromised.

### Per-user request format

```
POST /import/webhook/{userId}
X-Import-Secret: <secret>
Content-Type: application/json

{"event": "cpap_sync_session", "status": "success" | "error"}
```

- `status: "success"` — import runs in the background; `last_import_at` and `last_import_status` update in Settings when it finishes.
- `status: "error"` — the uploader reported a failed SMB sync; no import is triggered, but `last_import_status` is updated to `"upstream error: CPAP uploader reported a failed sync"` so you can see it in Settings.

### All-users request format

```
POST /import/trigger/all
X-Import-Secret: <secret>

(no body required)
```

Returns `{"triggered": N}` where N is the number of users for whom a background import was started.

---

## Finding your User ID

1. Log in to SleepLab.
2. Go to **Settings**.
3. Your User ID (UUID) is shown in the **Local DATALOG Import** card or can be copied from the URL bar on your profile page.

Alternatively, query the database directly:

```sql
SELECT id, email FROM users;
```

---

## Troubleshooting

| Symptom | Likely cause |
|---|---|
| 403 from SleepLab | `SLEEPLAB_SECRET` doesn't match `IMPORT_WEBHOOK_SECRET` |
| 404 from SleepLab | `SLEEPLAB_USER_ID` is wrong or the user has no import settings row |
| 400 "path not found" | The `/data` bind-mount is missing or the path in Settings is wrong |
| Import runs but no sessions appear | DATALOG directory is empty or EDF files are for dates already imported (use force re-import) |
| `last_import_status` shows "upstream error" | ESP32 reported a failed SMB sync; check CPAP_uploader logs |
