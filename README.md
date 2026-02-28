# SleepLab

SleepLab is a local-first sleep therapy dashboard for importing and exploring ResMed CPAP data. It includes:

- A React + Vite frontend in `frontend/`
- A FastAPI backend in `api/`
- A PostgreSQL-backed importer in `importer/` for ResMed `DATALOG` folders

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

## Quick Start

### 1. Install dependencies

```bash
npm install
cd frontend && npm install
```

### 2. Start Postgres

The repo includes a local Postgres service:

```bash
docker compose up -d
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

## Useful Commands

```bash
npm run dev
npm run api
npm run frontend
cd frontend && npm run build
cd frontend && npm run lint
```

## Notes

- The backend currently uses a hardcoded database URL in [`api/database.py`](/Users/joshuanissenbaum/Desktop/cpap-dashboard/api/database.py).
- The backend uses a fallback development JWT secret if `SECRET_KEY` is not set. Set a real `SECRET_KEY` outside local development.
