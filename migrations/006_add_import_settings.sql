BEGIN;

-- Per-user configuration for server-path (local filesystem) imports.
-- datalog_path must point to a DATALOG directory mounted into the container.
-- poll_frequency controls how often an external cron job or webhook should
-- trigger imports ('hourly', 'daily', 'weekly').
CREATE TABLE IF NOT EXISTS user_import_settings (
    id                  SERIAL PRIMARY KEY,
    user_id             UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,

    -- Filesystem import
    datalog_path        TEXT,
    auto_import_enabled BOOLEAN NOT NULL DEFAULT FALSE,
    poll_frequency      TEXT    NOT NULL DEFAULT 'daily'
                        CHECK (poll_frequency IN ('hourly', 'daily', 'weekly')),
    lookback_days       INTEGER NOT NULL DEFAULT 7,

    -- Bookkeeping
    last_import_at      TIMESTAMPTZ,
    last_import_status  TEXT,    -- 'ok' | 'error' | 'running'
    last_import_message TEXT,

    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMIT;
