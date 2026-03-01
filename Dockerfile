FROM node:20-bookworm AS frontend-build

WORKDIR /build

COPY frontend/package.json frontend/package-lock.json ./frontend/
RUN cd frontend && npm ci

COPY frontend ./frontend
RUN cd frontend && npm run build


FROM python:3.12-slim AS runtime

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    API_HOST=0.0.0.0 \
    API_PORT=8000

WORKDIR /app

RUN apt-get update \
    && apt-get install -y --no-install-recommends nginx curl tini \
    && rm -rf /var/lib/apt/lists/*

COPY api/requirements.txt /tmp/requirements.txt
RUN pip install --no-cache-dir -r /tmp/requirements.txt

COPY api ./api
COPY importer ./importer
COPY migrations ./migrations
COPY docker ./docker
COPY schema.sql server.py ./
COPY --from=frontend-build /build/frontend/dist ./frontend/dist

RUN rm -f /etc/nginx/sites-enabled/default /etc/nginx/conf.d/default.conf \
    && mkdir -p /usr/share/nginx/html /var/log/nginx /var/lib/nginx /run \
    && cp -r /app/frontend/dist/. /usr/share/nginx/html/ \
    && chmod +x /app/docker/entrypoint.sh

EXPOSE 8080 8000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=5 \
  CMD curl -fsS http://127.0.0.1:8000/health || exit 1

ENTRYPOINT ["/usr/bin/tini", "--", "/app/docker/entrypoint.sh"]
