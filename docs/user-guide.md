# SleepLab User Guide

Welcome to the SleepLab User Guide. This comprehensive guide helps you understand, configure, and operate SleepLab to monitor and analyze your sleep therapy data.

---

## 1. Core Concepts

SleepLab is a local-first, privacy-focused health data platform designed to process, store, and visualize CPAP therapy metrics alongside optional wearable telemetry. All data remains in your control, stored in your local PostgreSQL database.

### Data Ingestion Pipeline

SleepLab supports three main ingestion paths:
1. **Manual SD Card Uploads:** Upload raw `DATALOG` folders directly via the web interface.
2. **SleepHQ Cloud Sync:** Import historical records directly via the SleepHQ API.
3. **Automated Webhooks:** Trigger automated imports when syncing via hardware uploaders like the ESP32-based `CPAP_data_uploader`.

---

## 2. CPAP SD Card Ingestion

SleepLab parses ResMed CPAP data from the standard `DATALOG` folder structure found on your CPAP machine's SD card.

### Importing Data via Web Interface

Follow these steps to upload your CPAP SD card data:

1. Insert your CPAP machine's SD card into your computer.
2. Log in to the SleepLab web interface.
3. Navigate to the **Import** screen.
4. Click **Select DATALOG Folder** and choose the `DATALOG` directory on your SD card.
5. Click **Upload and Parse**. The frontend uploads the telemetry files in batches, and the backend processes them in the background.

> [!NOTE]
> Importing large historical DATALOG folders may take several minutes. You can monitor the import status in **Settings → Import Status**.

### Direct CLI Import

If you have direct access to the host machine or container, you can run the import script manually:

```bash
cd importer
python3 import_sessions.py --datalog /absolute/path/to/DATALOG --user-id <user-uuid>
```

#### CLI Options:

- **Filter by specific folder date:**
  ```bash
  python3 import_sessions.py --datalog /path/to/DATALOG --user-id <uuid> --folder 20241215
  ```
- **Filter from a start date:**
  ```bash
  python3 import_sessions.py --datalog /path/to/DATALOG --user-id <uuid> --from 20250101
  ```

---

## 3. SleepHQ Integration

If you store your CPAP logs on SleepHQ, you can sync your sessions directly into SleepLab without manually handling SD cards.

### Prerequisites

You need your SleepHQ OAuth credentials and your Team ID. Obtain these credentials from your SleepHQ developer portal or account settings.

### Configuration

Add your SleepHQ integration credentials in the web UI under **Settings → SleepHQ Integration** or specify them in your `.env` configuration file:

```env
SLEEPHQ_CLIENT_ID=your-client-id
SLEEPHQ_CLIENT_SECRET=your-client-secret
SLEEPHQ_TEAM_ID=your-team-id
```

### Syncing Sessions

1. Open the **Import → Sync from SleepHQ** screen in the dashboard.
2. Click **Sync Now** to start fetching the last 30 days of data.
3. To sync a specific date range, use the CLI importer:
   ```bash
   cd importer
   python3 sleephq_import.py --user-id <user-uuid> --from 2024-01-01 --to 2025-01-01
   ```

> [!TIP]
> Sessions imported from SleepHQ use a unique identifier format `sleephq-{record_id}` to prevent collisions with direct SD card imports.

---

## 4. Timezone Management

Understanding how SleepLab handles timezones is critical for displaying accurate charts and aligning CPAP data with wearable data.

### Configuration Variables

Configure two distinct IANA timezone settings in your `.env` file:

| Environment Variable | Default | Purpose |
|---|---|---|
| `MACHINE_TZ` | `UTC` | The timezone configured on your CPAP machine's internal clock. The importer uses this to convert naive timestamps into UTC before database storage. |
| `DISPLAY_TZ` | `UTC` | The timezone used to render all timeline labels, plot axes, and session durations on the dashboard. |

### Example Setup

If you live in New York and your CPAP clock is set to local time, specify:

```env
MACHINE_TZ=America/New_York
DISPLAY_TZ=America/New_York
```

> [!WARNING]
> Changing `MACHINE_TZ` only affects new imports. To fix existing database sessions imported with the wrong timezone, re-run the importer with the `--from` flag to reparse and overwrite them.

---

## 5. AI-Generated Summaries

SleepLab uses large language models (LLMs) to automatically generate plain-text clinical summaries of your daily sessions and long-term sleep trends.

### Supported Providers

Configure your preferred AI provider in `.env` using these environment variables:

#### 1. OpenAI (Cloud-hosted)
```env
LLM_PROVIDER=openai
OPENAI_API_KEY=your-api-key
OPENAI_MODEL=gpt-4o
```

#### 2. Local Ollama (Self-hosted)
```env
LLM_PROVIDER=ollama
OLLAMA_BASE_URL=http://localhost:11434/v1
OLLAMA_MODEL=llama3.1:8b
```

#### 3. LiteLLM Proxy
```env
LLM_PROVIDER=litellm
LITELLM_BASE_URL=http://localhost:4000/v1
LITELLM_MODEL=gpt-4o-mini
```

#### 4. Custom OpenAI-compatible API
```env
LLM_PROVIDER=custom
LLM_BASE_URL=https://api.yourprovider.com/v1
LLM_API_KEY=your-custom-api-key
LLM_MODEL=your-chosen-model
```

### Health Check

Verify your LLM configuration and connection status using the following API endpoint:

```bash
curl -X GET http://localhost:8000/llm/health
```

---

## 6. Troubleshooting

### Connection and Authentication
- **Problem:** Frontend loads but displays API connection errors.
  - **Solution:** Verify `API_URL` and `CORS_ALLOWED_ORIGINS` in your environment. If the frontend is hosted on a different port or domain, `CORS_ALLOWED_ORIGINS` must include the frontend's origin URL (e.g., `http://localhost:8080`).
- **Problem:** HTTP 403 Forbidden on import webhooks.
  - **Solution:** Verify that the `X-Import-Secret` header in your uploader configuration matches `IMPORT_WEBHOOK_SECRET` in your SleepLab `.env` file.

### Ingestion Issues
- **Problem:** Webhook returns HTTP 400 "path not found".
  - **Solution:** The background importer cannot find the DATALOG folder. Confirm that your Docker volumes are mounted correctly. The NAS share directory must be bind-mounted into the SleepLab container at `/data` as read-only.
- **Problem:** Import finishes successfully but no new sessions appear.
  - **Solution:** The database already contains sessions for the dates being imported. To overwrite them, use the manual import tool with force options.
