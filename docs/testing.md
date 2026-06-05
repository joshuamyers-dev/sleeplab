# SleepLab Testing Guide

This guide details the testing framework, test conventions, and validation workflows in SleepLab. Keeping our test suites healthy ensures long-term stability and security.

---

## 1. Test Architecture Overview

SleepLab maintains two independent test suites:
1. **Backend Test Suite (Python/pytest):** Located in `tests/`. Tests FastAPI routers, authentication services, EDF parsing, and ingestion models.
2. **Frontend Test Suite (TypeScript/vitest):** Located in `frontend/src/`. Uses Vitest and React Testing Library to test key React components, page layouts, and state management.

---

## 2. Backend Testing (`pytest`)

The backend testing suite utilizes `pytest` along with `httpx` to mock request cycles.

### Prerequisites

Ensure you have your environment configured and the required Python tools available.
```bash
uv run pytest --version
```

### Running Backend Tests

Run all unit and integration tests from the root directory:

```bash
uv run pytest
```

To run a specific test file:

```bash
uv run pytest tests/test_auth.py
```

To view verbose logs with short traceback paths:

```bash
uv run pytest -v --tb=short
```

> [!NOTE]
> Integration tests requiring a live PostgreSQL instance automatically detect the `DATABASE_URL` environment variable. If PostgreSQL is unavailable, database-dependent tests are automatically skipped without failing the test suite.

### Writing Backend Tests

1. Create a new test file in `tests/` with the prefix `test_` (e.g., `tests/test_new_feature.py`).
2. Implement your test cases using descriptive function names starting with `test_`.
3. Use Google-style docstrings on all helper functions or complex test blocks.

#### Example Pytest Test Case:

```python
import pytest
from fastapi import status
from fastapi.testclient import TestClient

def test_health_check_endpoint(client: TestClient) -> None:
    """Verify that the health check endpoint returns a 200 OK status.

    Args:
        client: The test client instance with preconfigured routing.
    """
    response = client.get("/health")
    assert response.status_code == status.HTTP_200_OK
    assert response.json() == {"status": "ok"}
```

---

## 3. Frontend Testing (`vitest`)

The frontend application uses Vitest and React Testing Library for fast, reliable unit and component integration tests.

### Running Frontend Tests

Navigate to the frontend directory and launch the Vitest runner:

```bash
cd frontend
npx vitest run
```

To run Vitest in interactive development/watch mode:

```bash
cd frontend
npx vitest
```

### Writing Frontend Tests

1. Add your test files next to the component being tested using the `.test.tsx` or `.spec.tsx` suffix.
2. Ensure you mock external dependencies, context providers (like `AuthContext`), and HTTP requests using MSW (Mock Service Worker) or simple Vitest mocks.

#### Example React Component Test:

```tsx
import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import StatusBadge from './StatusBadge';

describe('StatusBadge Component', () => {
  it('renders the active state correctly', () => {
    render(<StatusBadge status="active" />);
    const badgeElement = screen.getByText(/active/i);
    expect(badgeElement).toBeInTheDocument();
    expect(badgeElement).toHaveClass('bg-green-100');
  });

  it('renders the inactive state correctly', () => {
    render(<StatusBadge status="inactive" />);
    const badgeElement = screen.getByText(/inactive/i);
    expect(badgeElement).toBeInTheDocument();
    expect(badgeElement).toHaveClass('bg-red-100');
  });
});
```

---

## 4. Continuous Integration (CI) Checks

The project runs the entire test suite on every pull request via GitHub Actions.

### Automated Checks

Your PR will automatically execute the following checks:
1. **Python Linter:** `uv run ruff check tests/ --output-format=github`
2. **Python Tests:** `uv run pytest -v --tb=short`
3. **TypeScript Compiler:** `npx tsc --noEmit`
4. **Frontend Unit Tests:** `npx vitest run`

Please ensure that you run these commands locally before pushing your branch to prevent CI failures.
