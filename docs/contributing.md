# SleepLab Contributing Guide

Thank you for your interest in contributing to SleepLab. This guide outlines the development setup, code styles, testing workflows, and PR requirements to ensure a smooth contribution process.

---

## 1. Development Workspace Setup

SleepLab uses Nx to manage a monorepo containing a React + Vite frontend, a FastAPI backend, and an importer module.

### Prerequisites

Ensure you have the following installed on your machine:
- **Node.js** 20+ and **npm**
- **Python** 3.12+ (managed with `uv` or `venv`)
- **PostgreSQL** 16+

### Initial Setup

1. **Clone the repository:**
   ```bash
   git clone https://github.com/camden-bock/sleeplab.git
   cd sleeplab
   ```
2. **Install project dependencies:**
   ```bash
   npm install
   cd frontend && npm install
   cd ..
   ```
3. **Start PostgreSQL database:**
   The repository includes a local PostgreSQL Docker Compose service. Start it with:
   ```bash
   docker compose up -d postgres
   ```
   *Default Credentials:*
   - **Database:** `cpap`
   - **Username:** `cpap`
   - **Password:** `cpap`
   - **Port:** `5432`

4. **Apply SQL Schema Migrations:**
   Run the migration scripts in `migrations/` against the `cpap` database sequentially:
   ```bash
   psql -h localhost -U cpap -d cpap -f migrations/001_add_auth.sql
   psql -h localhost -U cpap -d cpap -f migrations/002_scope_sessions_per_user.sql
   psql -h localhost -U cpap -d cpap -f migrations/003_add_public_ids.sql
   psql -h localhost -U cpap -d cpap -f migrations/004_reset_uuid_ids.sql
   psql -h localhost -U cpap -d cpap -f migrations/005_add_user_profile_fields.sql
   ```

5. **Start Dev Servers:**
   Launch both backend and frontend applications concurrently using Nx:
   ```bash
   npm run dev
   ```
   - **Frontend:** [http://127.0.0.1:5173](http://127.0.0.1:5173)
   - **FastAPI API:** [http://127.0.0.1:8000](http://127.0.0.1:8000)

---

## 2. Coding Standards

### Frontend (React/TypeScript)

- **Linter & Formatter:** We use **TS-ESLint** with the StandardTS ruleset and **Prettier** for formatting.
- **Rules:** Ensure strong type safety and robust error handling. Do not mock error catch blocks.
- **Commands:**
  - Lint check: `cd frontend && npm run lint`
  - Type check: `cd frontend && npx tsc --noEmit -p tsconfig.app.json`

### Backend (Python)

- **Style:** All backend code must be PEP 8 compliant. We use **Ruff** for linting and formatting.
- **Docstrings:** All Python functions and classes must document their parameters, returns, and raises using **Google Style Docstrings**.
- **Commands:**
  - Run linting: `uv run ruff check .`
  - Run formatter check: `uv run ruff format --check .`

#### Google Docstring Style Example:

```python
def calculate_ahi(apneas: int, hypopneas: int, duration_seconds: float) -> float:
    """Calculate the Apnea-Hypopnea Index (AHI) for a session.

    Args:
        apneas: Total count of obstructive, central, and mixed apnea events.
        hypopneas: Total count of hypopnea events.
        duration_seconds: Total sleep duration in seconds.

    Returns:
        The computed AHI value representing events per hour.

    Raises:
        ValueError: If duration_seconds is less than or equal to zero.
    """
    if duration_seconds <= 0:
        raise ValueError("Duration must be greater than zero.")
    return (apneas + hypopneas) / (duration_seconds / 3600.0)
```

---

## 3. Web Accessibility (WCAG 2.1 AA)

All new UI components, styling updates, and markdown documentation must comply with the Web Content Accessibility Guidelines (WCAG) 2.1 Level AA:

1. **Semantic Headers:** Maintain strict header hierarchies (`#`, `##`, `###`). Never skip a header level (e.g., do not jump from `##` to `####`).
2. **Descriptive Alternative Text:** All images must include informative `alt` text explaining what the visual presents. Do not use phrases like "image of..." or "screenshot of...".
3. **Contrast Ratio:** Standard body text must maintain a minimum contrast ratio of `4.5:1` against its background. Large text (18pt/24px or bold 14pt/18.67px) must maintain at least `3:1`.
4. **Keyboard Navigability:** Interactive elements must be focusable using the `Tab` key and display clear, visible focus states.

---

## 4. Git and Commit Conventions

We follow a strict Conventional Commits system. Commit messages and pull request titles must be prefixed with one of the following tags:

- `feat:` for adding a new user-facing feature.
- `fix:` for fixing a bug.
- `docs:` for adding or modifying documentation.
- `refactor:` for code changes that neither fix a bug nor add a feature.
- `test:` for adding or correcting tests.
- `chore:` for updating builds, config files, or dependencies.

### Commit Example:

```text
feat(wearable): add open-wearables and mirobody API adapters
```

---

## 5. Development Quality Gates

Before pushing changes or submitting a PR, your changes must pass the following local quality checks:

1. **Backend Lint:** `uv run ruff check .`
2. **Backend Format Check:** `uv run ruff format --check .`
3. **Backend Tests:** `uv run pytest`
4. **Frontend Build:** `npm run build`
5. **Frontend Lint:** `cd frontend && npm run lint`
6. **Frontend Unit Tests:** `cd frontend && npx vitest run`
