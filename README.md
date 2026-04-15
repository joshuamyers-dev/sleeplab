# SleepLab

SleepLab is a local-first sleep therapy dashboard for importing and exploring ResMed CPAP data. It includes:

- A React + Vite frontend in `frontend/`
- A FastAPI backend in `api/`
- A PostgreSQL-backed importer in `importer/` for ResMed `DATALOG` folders

## Screenshots

![SleepLab dashboard screenshot 1](https://sleeplab-static.s3.ap-southeast-2.amazonaws.com/screenshot-1.png)
![SleepLab dashboard screenshot 2](https://sleeplab-static.s3.ap-southeast-2.amazonaws.com/screenshot-2.png)
![SleepLab dashboard screenshot 3](https://sleeplab-static.s3.ap-southeast-2.amazonaws.com/screenshot-3.png)

## Stack

- Frontend: React 19, Vite, TypeScript, Tailwind
- Backend: FastAPI, SQLAlchemy, Uvicorn
- Database: PostgreSQL 16
- Workspace tooling: Nx

## Requirements

- Node.js 20+
- npm
- Python 3.12
- PostgreSQL 16

## Self-Hosting With Docker Compose

SleepLab can run as a self-hosted Docker stack with:

- PostgreSQL
- FastAPI backend
- Nginx-served frontend
- automatic schema migrations at API startup
- a prebuilt Docker image, so no local image build is required

Key files:

- [`docker-compose.yml`](/Users/joshuanissenbaum/Desktop/cpap-dashboard/docker-compose.yml)
- [`docker/entrypoint.sh`](/Users/joshuanissenbaum/Desktop/cpap-dashboard/docker/entrypoint.sh)
- [`docker/nginx.conf`](/Users/joshuanissenbaum/Desktop/cpap-dashboard/docker/nginx.conf)
- [`.env.selfhost.example`](/Users/joshuanissenbaum/Desktop/cpap-dashboard/.env.selfhost.example)

The default self-hosted image is:

```text
joshuaaaronmyers/sleeplab:latest
```

### Required Configuration

Create an env file for deployment by copying [`.env.selfhost.example`](/Users/joshuanissenbaum/Desktop/cpap-dashboard/.env.selfhost.example).

Set at minimum:

- `SECRET_KEY`

Optional but commonly needed:

- `OPENAI_API_KEY`
- `CORS_ALLOWED_ORIGINS`
- `API_URL`

Recommended values for a local/self-hosted machine:

```env
SECRET_KEY=replace-me-with-a-long-random-secret
OPENAI_API_KEY=
CORS_ALLOWED_ORIGINS=*
API_URL=http://localhost:8000
```

The self-hosted compose stack always uses the internal Postgres DSN:

```text
postgresql+psycopg2://cpap:cpap@postgres:5432/cpap
```

For the default self-hosted setup, `CORS_ALLOWED_ORIGINS` is `*` so the frontend can talk to the API regardless of whether you access it via `localhost`, `127.0.0.1`, or a LAN hostname/IP. If you expose the app publicly, tighten that value to your actual frontend origin(s).

### Start The Stack

```bash
docker compose up -d
```

If you want the newest published image first:

```bash
docker compose pull
docker compose up -d
```

### View Logs

```bash
docker compose logs -f
```

### Stop The Stack

```bash
docker compose down
```

### Copy-Paste `docker-compose.yml`

If you want to self-host quickly on a server, you can use this `docker-compose.yml` directly:

```yaml
services:
  postgres:
    image: postgres:16
    restart: unless-stopped
    environment:
      POSTGRES_DB: cpap
      POSTGRES_USER: cpap
      POSTGRES_PASSWORD: cpap
    volumes:
      - sleeplab_postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U cpap -d cpap"]
      interval: 10s
      timeout: 5s
      retries: 5

  app:
    image: joshuaaaronmyers/sleeplab:latest
    restart: unless-stopped
    depends_on:
      postgres:
        condition: service_healthy
    environment:
      DATABASE_URL: postgresql+psycopg2://cpap:cpap@postgres:5432/cpap
      SECRET_KEY: replace-me-with-a-long-random-secret
      OPENAI_API_KEY: ""
      CORS_ALLOWED_ORIGINS: "*"
      API_URL: http://localhost:8000
      API_HOST: 0.0.0.0
      API_PORT: 8000
    ports:
      - "8080:8080"
      - "8000:8000"

volumes:
  sleeplab_postgres_data:
```

Then start it with:

```bash
docker compose up -d
```

### `docker run` Command

If you already have PostgreSQL running separately, you can run just the SleepLab app container:

```bash
docker run -d \
  --name sleeplab \
  --restart unless-stopped \
  -p 8080:8080 \
  -p 8000:8000 \
  -e DATABASE_URL="postgresql+psycopg2://USER:PASSWORD@HOST:5432/cpap" \
  -e SECRET_KEY="replace-me-with-a-long-random-secret" \
  -e OPENAI_API_KEY="" \
  -e CORS_ALLOWED_ORIGINS="*" \
  -e API_URL="http://localhost:8000" \
  joshuaaaronmyers/sleeplab:latest
```

Notes:

- `docker run` does not include PostgreSQL. You must provide your own database.
- `API_URL` should be the URL the browser will use to reach the API.
- If the app is exposed publicly, replace `CORS_ALLOWED_ORIGINS="*"` with your real frontend origin(s).

### Default Self-Hosted URLs

- Frontend: `http://localhost:8080`
- API: `http://localhost:8000`

### What The Compose File Does

- starts PostgreSQL with a named volume
- pulls `joshuaaaronmyers/sleeplab:latest`
- exposes the frontend on `8080`
- exposes the API on `8000`
- waits for Postgres to become healthy
- runs migrations automatically at API startup

### Persistence

Database data is stored in the named volume:

- `sleeplab_postgres_data`

### Upgrade Workflow

```bash
git pull
docker compose pull
docker compose up -d
```

Migrations run automatically through [`server.py`](/Users/joshuanissenbaum/Desktop/cpap-dashboard/server.py) when the API starts.

### Troubleshooting

- If Docker Compose says the image is missing, run `docker login` and `docker compose pull`.
- If the frontend loads but API requests fail, verify `API_URL` and `CORS_ALLOWED_ORIGINS`.
- If the API container exits early, inspect `docker compose logs app` for DB or migration errors.
- If AI summaries are unavailable, confirm `OPENAI_API_KEY` is set.
- If you are deploying to a Linux server, use the published multi-arch image tag rather than an old locally built arm-only image.

## Quick Start

### 1. Install dependencies

```bash
npm install
cd frontend && npm install
```

### 2. Start Postgres

The repo includes a local Postgres service inside Docker Compose:

```bash
docker compose up -d postgres
```

Default database settings from [`docker-compose.yml`](/Users/joshuanissenbaum/Desktop/cpap-dashboard/docker-compose.yml):

- Database: `cpap`
- Username: `cpap`
- Password: `cpap`
- Port: `5432`

The API currently connects to:

```python
postgresql+psycopg2://localhost/cpap
```

That is defined in [`api/database.py`](/Users/joshuanissenbaum/Desktop/cpap-dashboard/api/database.py). If your local database setup differs, update that file or add your own configuration layer.

### 3. Apply schema migrations

Run the SQL files in `migrations/` against the `cpap` database in order:

```bash
psql -d cpap -f migrations/001_add_auth.sql
psql -d cpap -f migrations/002_scope_sessions_per_user.sql
psql -d cpap -f migrations/003_add_public_ids.sql
psql -d cpap -f migrations/004_reset_uuid_ids.sql
psql -d cpap -f migrations/005_add_user_profile_fields.sql
psql -d cpap -f migrations/007_add_wearable_samples.sql
```

### 4. Run the app

Start frontend and backend together:

```bash
npm run dev
```

Or run them separately:

```bash
npm run api
npm run frontend
```

Default local URLs:

- Frontend: `http://127.0.0.1:5173`
- API: `http://127.0.0.1:8000`

## Auth

SleepLab uses bearer-token auth.

- `POST /auth/register` and `POST /auth/login` return `{ token, user }`
- The frontend stores the JWT in browser `localStorage`
- Authenticated API requests send `Authorization: Bearer <token>`

Relevant files:

- [`api/auth.py`](/Users/joshuanissenbaum/Desktop/cpap-dashboard/api/auth.py)
- [`api/routers/auth.py`](/Users/joshuanissenbaum/Desktop/cpap-dashboard/api/routers/auth.py)
- [`frontend/src/api/client.ts`](/Users/joshuanissenbaum/Desktop/cpap-dashboard/frontend/src/api/client.ts)
- [`frontend/src/context/AuthContext.tsx`](/Users/joshuanissenbaum/Desktop/cpap-dashboard/frontend/src/context/AuthContext.tsx)

## Importing Data

SleepLab imports ResMed SD card data from a `DATALOG` folder.

In the UI:

1. Create an account or log in.
2. Open the import screen.
3. Select the `DATALOG` folder from the SD card.
4. The frontend uploads the files in batches to the API.
5. The API runs the importer in the background and writes parsed sessions into Postgres.

The upload/import endpoints are implemented in [`api/routers/upload.py`](/Users/joshuanissenbaum/Desktop/cpap-dashboard/api/routers/upload.py), and the importer lives in [`importer/import_sessions.py`](/Users/joshuanissenbaum/Desktop/cpap-dashboard/importer/import_sessions.py).

You can also run the importer manually:

```bash
cd importer
python3.12 import_sessions.py --datalog /absolute/path/to/DATALOG --user-id <user-uuid>
```

Optional filters:

```bash
python3.12 import_sessions.py --datalog /absolute/path/to/DATALOG --user-id <user-uuid> --folder 20241215
python3.12 import_sessions.py --datalog /absolute/path/to/DATALOG --user-id <user-uuid> --from 20250101
```

## Wearable Data

SleepLab can display heart rate, SpO₂, and sleep stage data from external wearables alongside CPAP session data on the session detail page.

### Supported devices

Data can be ingested from any device that exports to JSON. Stage label normalisation is built-in for:

| Device | Stage labels recognised |
|---|---|
| Withings | `deep_sleep`, `light_sleep`, `rem_sleep`, `awake` |
| Oura Ring | `deep`, `light`, `rem`, `awake` |
| Fitbit | `deep`, `light`, `rem`, `wake` |
| Apple Watch / Health | `asleepDeep`, `asleepCore`, `asleepREM`, `awake`, `asleepUnspecified`, `inBed` |

All labels are matched case-insensitively.

### Sleep stage encoding

| Value | Stage |
|---|---|
| 1 | Deep (N3 / SWS / slow-wave) |
| 2 | Light (N1 / N2 / Core / unspecified) |
| 3 | REM |
| 4 | Awake |

### Ingesting data

```bash
# Bulk upload samples via the API
curl -X POST http://localhost:8000/wearable/samples \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "source": "oura",
    "samples": [
      {"ts": "2025-01-15T22:00:00Z", "heart_rate": 62, "spo2": 97.5, "sleep_stage": "light"},
      {"ts": "2025-01-15T22:30:00Z", "heart_rate": 58, "sleep_stage": "deep"}
    ]
  }'
```

Duplicate `(user, timestamp, source)` rows are upserted — safe to re-run exports.

### Viewing data

When wearable samples exist for a session date, two additional charts appear at the bottom of the session detail page:

- **Heart Rate & SpO₂** — dual-axis line chart
- **Sleep Stages** — step-style hypnogram (deep at bottom, awake at top)

Charts are silently omitted when no wearable data is available for that date.

## AI Summaries

Some summary endpoints depend on `OPENAI_API_KEY`.

Without it, core dashboard features still work, but AI summary endpoints will not return generated output.

## Project Layout

```text
api/         FastAPI application
frontend/    React/Vite client
importer/    ResMed EDF parsing and import pipeline
migrations/  SQL migrations
```

## Contributing

For local development:

1. Install dependencies:

```bash
npm install
cd frontend && npm install
```

2. Start Postgres:

```bash
docker compose up -d postgres
```

3. Run the app:

```bash
npm run dev
```

Useful commands:

```bash
npm run api
npm run frontend
cd frontend && npm run build
cd frontend && npm run lint
```

Before opening a PR, make sure:

- the frontend builds successfully
- lint passes for the frontend
- any README or env changes are documented
- self-hosting changes are reflected in [`docker-compose.yml`](/Users/joshuanissenbaum/Desktop/cpap-dashboard/docker-compose.yml) and [`.env.selfhost.example`](/Users/joshuanissenbaum/Desktop/cpap-dashboard/.env.selfhost.example) where relevant

## Useful Commands

```bash
npm run dev
npm run api
npm run frontend
cd frontend && npm run build
cd frontend && npm run lint
```

## Notes

- The backend reads `DATABASE_URL` from environment and falls back to a local development default in [`api/database.py`](/Users/joshuanissenbaum/Desktop/cpap-dashboard/api/database.py).
- The backend uses a fallback development JWT secret if `SECRET_KEY` is not set. Set a real `SECRET_KEY` outside local development.
