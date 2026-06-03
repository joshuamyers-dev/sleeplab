# SleepLab Makefile
#
# Common development tasks. All targets assume you are at the project root.
# Backend commands use `uv`; frontend commands use `npm` (run inside frontend/).
#
# Usage:
#   make <target>
#
# Quick-start:
#   make install     — install all dependencies (backend + frontend)
#   make dev         — start the FastAPI dev server on port 8000
#   make ci          — run the full CI suite (lint, type-check, all tests)

.PHONY: help install install-backend install-frontend \
        lint fmt \
        test test-backend test-frontend \
        typecheck build \
        dev \
        up down \
        ci

# ── Utilities ────────────────────────────────────────────────────────────────

## Print this help message
help:
	@awk 'BEGIN {FS = ":.*##"; printf "\nUsage:\n  make \033[36m<target>\033[0m\n\nTargets:\n"} \
	     /^[a-zA-Z_-]+:.*##/ { printf "  \033[36m%-20s\033[0m %s\n", $$1, $$2 }' $(MAKEFILE_LIST)

# ── Dependencies ─────────────────────────────────────────────────────────────

## Install backend + frontend dependencies
install: install-backend install-frontend

## Install Python dependencies (including dev extras) via uv
install-backend:
	uv sync --group dev

## Install Node dependencies for the frontend
install-frontend:
	npm ci --prefix frontend

# ── Linting & Formatting ─────────────────────────────────────────────────────

## Lint Python source and tests with ruff
lint:
	uv run ruff check tests/

## Auto-format Python source with ruff
fmt:
	uv run ruff format .

# ── Testing ───────────────────────────────────────────────────────────────────

## Run backend + frontend tests
test: test-backend test-frontend

## Run backend tests with pytest (DB tests skipped without Postgres)
test-backend:
	uv run pytest -v --tb=short

## Run frontend unit tests with vitest
test-frontend:
	npx --prefix frontend vitest run

# ── Type-checking & Build ────────────────────────────────────────────────────

## Type-check the frontend with TypeScript
typecheck:
	npx tsc --noEmit -p frontend/tsconfig.app.json

## Build the frontend for production
build:
	npm run build --prefix frontend

# ── Dev Server ────────────────────────────────────────────────────────────────

## Start the FastAPI development server (hot-reload, port 8000)
dev:
	uv run uvicorn server:app --reload --host 0.0.0.0 --port 8000

# ── Docker Compose ───────────────────────────────────────────────────────────

## Start all services defined in compose.yaml
up:
	docker compose up

## Stop and remove all compose services
down:
	docker compose down

# ── CI ────────────────────────────────────────────────────────────────────────

## Run the full CI suite: lint → typecheck → test-backend → test-frontend
ci: lint typecheck test-backend test-frontend
