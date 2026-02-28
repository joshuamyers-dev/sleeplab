BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

DROP TABLE IF EXISTS session_spo2;
DROP TABLE IF EXISTS session_metrics;
DROP TABLE IF EXISTS session_events;
DROP TABLE IF EXISTS sessions;
DROP TABLE IF EXISTS users;

CREATE TABLE users (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email         TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE sessions (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id              TEXT NOT NULL,
    user_id                 UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    folder_date             DATE NOT NULL,
    block_index             INTEGER NOT NULL DEFAULT 0,
    start_datetime          TIMESTAMPTZ NOT NULL,
    pld_start_datetime      TIMESTAMPTZ NOT NULL,
    duration_seconds        INTEGER NOT NULL,
    device_serial           TEXT,
    ahi                     NUMERIC(6,2),
    central_apnea_count     INTEGER NOT NULL DEFAULT 0,
    obstructive_apnea_count INTEGER NOT NULL DEFAULT 0,
    hypopnea_count          INTEGER NOT NULL DEFAULT 0,
    apnea_count             INTEGER NOT NULL DEFAULT 0,
    arousal_count           INTEGER NOT NULL DEFAULT 0,
    total_ahi_events        INTEGER NOT NULL DEFAULT 0,
    avg_pressure            NUMERIC(6,2),
    p95_pressure            NUMERIC(6,2),
    avg_leak                NUMERIC(8,4),
    avg_resp_rate           NUMERIC(6,2),
    avg_tidal_vol           NUMERIC(8,4),
    avg_min_vent            NUMERIC(6,2),
    avg_snore               NUMERIC(6,2),
    avg_flow_lim            NUMERIC(6,4),
    has_spo2                BOOLEAN NOT NULL DEFAULT FALSE,
    avg_spo2                NUMERIC(5,1),
    min_spo2                NUMERIC(5,1),
    created_at              TIMESTAMPTZ DEFAULT NOW(),
    updated_at              TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_sessions_folder_date ON sessions (folder_date);
CREATE INDEX idx_sessions_start_datetime ON sessions (start_datetime);
CREATE INDEX idx_sessions_user_id ON sessions (user_id);
CREATE UNIQUE INDEX uq_sessions_user_session_id ON sessions (user_id, session_id);

CREATE TABLE session_events (
    id               SERIAL PRIMARY KEY,
    session_id       UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    event_type       TEXT NOT NULL,
    onset_seconds    NUMERIC(10,1) NOT NULL,
    duration_seconds NUMERIC(8,1),
    event_datetime   TIMESTAMPTZ NOT NULL
);
CREATE INDEX idx_session_events_session_id ON session_events (session_id);

CREATE TABLE session_metrics (
    id             BIGSERIAL PRIMARY KEY,
    session_id     UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    ts             TIMESTAMPTZ NOT NULL,
    mask_pressure  NUMERIC(6,2),
    pressure       NUMERIC(6,2),
    epr_pressure   NUMERIC(6,2),
    leak           NUMERIC(8,4),
    resp_rate      NUMERIC(6,2),
    tidal_vol      NUMERIC(8,4),
    min_vent       NUMERIC(6,2),
    snore          NUMERIC(6,2),
    flow_lim       NUMERIC(6,4)
);
CREATE INDEX idx_session_metrics_session_id ON session_metrics (session_id);

CREATE TABLE session_spo2 (
    id         BIGSERIAL PRIMARY KEY,
    session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    ts         TIMESTAMPTZ NOT NULL,
    spo2       SMALLINT,
    pulse      SMALLINT
);
CREATE INDEX idx_session_spo2_session_id ON session_spo2 (session_id);

COMMIT;
