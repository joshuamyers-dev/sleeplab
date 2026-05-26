---
name: sync-compose-config
description: When new environment variables or configuration options are added, sync compose.advanced.yaml and .env.example
compatibility: opencode
metadata:
  workflow: compose-config
---

## When to use

When a PR introduces new environment variables, config options, or feature flags to the SleepLab codebase (e.g. in `server.py`, `api/`, `docker/entrypoint.sh`, `docker-compose.yml` or any backend module). This skill ensures the compose configuration files stay in sync.

## Workflow

### 1. Identify new variables

Search the PR diff for new environment variable reads. Common patterns:

```
os.environ.get("VAR_NAME"
os.getenv("VAR_NAME"
os.environ["VAR_NAME"]
${VAR_NAME:-}
${VAR_NAME:?error}
```

Also check for new feature flags or configuration that might need env var support.

### 2. Update `compose.advanced.yaml`

Add the new env var under the appropriate section in `app.environment`:

| Var type | How to add |
|---|---|
| Required secret | `${VAR_NAME:?error}` with a comment explaining how to generate the value |
| Optional with default | `${VAR_NAME:-default}` with a comment explaining what it controls |
| Optional, no default | `${VAR_NAME:-}` with a comment |
| Optional, disabled by default | `${VAR_NAME:-false}` with a comment |

**Section ordering** (maintain this order in the file):

1. `# --- Database ---`
2. `# --- Security ---`
3. `# --- API / Networking ---`
4. `# --- Optional: OpenAI ---`
5. `# --- Optional: SleepHQ cloud import ---`
6. `# --- Optional: Import webhook ---`
7. `# --- Optional: Wearable data integration ---`
8. `# --- Time zones ---`

### 3. Update `.env.example`

Add the matching entry under the correct section with:

- Required vars → `# Required` section, empty value, comment describing how to generate
- Optional vars → relevant section with its default value and a comment
- Keep alphabetical order within each section

### 4. Verify consistency

Check that:

- Variable name matches exactly between both files
- Default value in `.env.example` matches the `${VAR_NAME:-default}` fallback in `compose.advanced.yaml`
- Required vars use `${VAR_NAME:?error}` in the compose file and are empty in `.env.example` under `# Required`
- No env var appears in one file but not the other

## Notes

- The minimal `compose.yaml` does NOT need updating — it intentionally has hardcoded defaults for zero-config startup.
- If the PR removes an env var, remove it from both `compose.advanced.yaml` and `.env.example`.
- Use the same comment language as surrounding entries (imperative tone, tool references like `openssl rand -hex 32` for key generation).
