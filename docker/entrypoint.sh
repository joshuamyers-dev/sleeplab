#!/usr/bin/env bash
set -euo pipefail

: "${DATABASE_URL:?DATABASE_URL is required}"
: "${SECRET_KEY:?SECRET_KEY is required}"

export API_HOST="${API_HOST:-0.0.0.0}"
export API_PORT="${API_PORT:-8000}"
export API_URL="${API_URL:-http://127.0.0.1:${API_PORT}}"

if [ "${SLEEPHQ_ENABLED:-false}" = "true" ]; then
  pip install --quiet --no-cache-dir \
    "sleephq-client @ git+https://github.com/frohoff/sleephq-client.git"
fi

python /app/docker/wait_for_db.py

python - <<'PY' > /usr/share/nginx/html/config.js
import os
from pathlib import Path

template = Path("/app/docker/runtime-config.template.js").read_text()
config = template
config = config.replace("${API_URL}", os.environ.get("API_URL", "http://127.0.0.1:8000"))
config = config.replace("${DISABLE_USER_REGISTRATION}", os.environ.get("DISABLE_USER_REGISTRATION", "false"))
print(config)
PY

nginx -c /app/docker/nginx.conf -g 'daemon off;' &
NGINX_PID=$!

python -m uvicorn server:app --host "${API_HOST}" --port "${API_PORT}" &
API_PID=$!

cleanup() {
  kill "${NGINX_PID}" "${API_PID}" 2>/dev/null || true
}

trap cleanup INT TERM

set +e
wait -n "${NGINX_PID}" "${API_PID}"
STATUS=$?
set -e

cleanup
wait "${NGINX_PID}" 2>/dev/null || true
wait "${API_PID}" 2>/dev/null || true

exit "${STATUS}"
