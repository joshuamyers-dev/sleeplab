BEGIN;

CREATE TABLE IF NOT EXISTS user_import_settings (
    user_id               UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    sleephq_client_id     TEXT,
    sleephq_client_secret TEXT,
    sleephq_team_id       INTEGER,
    sleephq_machine_id    INTEGER,
    auto_import_sleephq   BOOLEAN NOT NULL DEFAULT FALSE,
    lookback_days         INTEGER NOT NULL DEFAULT 30,
    updated_at            TIMESTAMPTZ DEFAULT NOW()
);

COMMIT;
