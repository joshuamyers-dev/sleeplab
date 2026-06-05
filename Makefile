# SleepLab Makefile
#
# Common development tasks. All targets assume you are at the project root.
# Backend commands use `uv`; frontend commands use `npm` (run inside frontend/).
#
# Quick-start:
#   make install   — install all dependencies (backend + frontend)
#   make dev       — start the FastAPI dev server (port 8000)
#   make ci        — run the full CI suite (lint, type-check, all tests)

.PHONY: help \
        install install-backend install-frontend \
        lint lint-backend lint-frontend \
        fmt \
        test test-backend test-backend-db test-frontend test-watch \
        typecheck build preview \
        check-migrations \
        dev dev-frontend \
        up up-advanced up-build down \
        ci docs-capture clean

# ── Help ─────────────────────────────────────────────────────────────────────

help: ## Show this help
	@awk 'BEGIN {FS = ":.*##"; printf "\nUsage:\n  make \033[36m<target>\033[0m\n\nTargets:\n"} \
	     /^[a-zA-Z_-]+:.*##/ { printf "  \033[36m%-22s\033[0m %s\n", $$1, $$2 }' $(MAKEFILE_LIST)

# ── Dependencies ─────────────────────────────────────────────────────────────

install: install-backend install-frontend ## Install all dependencies (backend + frontend)

install-backend: ## Install Python dependencies via uv (includes dev group)
	uv sync --group dev

install-frontend: ## Install Node dependencies for the frontend
	npm ci --prefix frontend
	npx playwright install --with-deps chromium

# ── Linting & Formatting ─────────────────────────────────────────────────────

lint: lint-backend lint-frontend ## Lint backend (ruff) and frontend (eslint)

lint-backend: ## Lint Python tests/ with ruff
	uv run ruff check tests/

lint-frontend: ## Lint frontend source with eslint
	npm run lint --prefix frontend

fmt: ## Auto-format Python source with ruff
	uv run ruff format .

# ── Testing ───────────────────────────────────────────────────────────────────

test: test-backend test-frontend ## Run all tests (backend + frontend)

test-backend: ## Run backend tests with pytest (DB tests skipped without Postgres)
	uv run pytest -v --tb=short

test-backend-db: ## Run only DB-marked backend tests (requires Postgres)
	uv run pytest -v --tb=short -m db

test-frontend: ## Run frontend unit tests with vitest (single run)
	npm test --prefix frontend

test-storybook: ## Run Storybook components tests with vitest (requires browser)
	npm run test:storybook --prefix frontend

test-watch: ## Run frontend tests in watch mode
	npm run test:watch --prefix frontend

# ── Type-checking & Build ────────────────────────────────────────────────────

typecheck: ## Type-check the frontend with TypeScript
	npx tsc --noEmit -p frontend/tsconfig.app.json

build: ## Build the frontend for production (tsc + vite)
	npm run build --prefix frontend

preview: ## Preview the production frontend build locally
	npm run preview --prefix frontend

# ── Migrations ───────────────────────────────────────────────────────────────

check-migrations: ## Verify migration files are sequentially numbered
	uv run python scripts/check_migrations.py

# ── Dev Servers ───────────────────────────────────────────────────────────────

dev: ## Start the FastAPI backend with hot-reload (port 8000)
	uv run uvicorn server:app --reload --host 0.0.0.0 --port 8000

dev-frontend: ## Start the Vite frontend dev server
	npm run dev --prefix frontend

# ── Docker Compose ───────────────────────────────────────────────────────────

up: ## Start all services (compose.yaml)
	docker compose up

up-advanced: ## Start all services using the advanced compose config
	docker compose -f compose.advanced.yaml up

up-build: ## Rebuild images then start all services
	docker compose up --build

down: ## Stop and remove all compose services
	docker compose down

# ── CI ────────────────────────────────────────────────────────────────────────

ci: lint typecheck test-backend test-frontend ## Full CI suite: lint → typecheck → test-backend → test-frontend

docs-capture: build docs-storybook ## Capture full-page app screenshots and all Storybook story PNGs
	npm run docs-capture
	npm run storybook-capture:no-build

storybook: ## Start the Storybook server
	npx nx run frontend:storybook

docs-storybook: ## Build Storybook static documentation
	npx nx run frontend:build-storybook

clean: ## Remove build artifacts and reset Nx cache
	rm -rf frontend/dist node_modules docs/public/ui-snapshots
	npx nx reset
