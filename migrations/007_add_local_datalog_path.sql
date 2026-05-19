BEGIN;

ALTER TABLE user_import_settings
    ADD COLUMN IF NOT EXISTS local_datalog_path TEXT,
    ADD COLUMN IF NOT EXISTS local_import_frequency TEXT DEFAULT 'daily',
    ADD COLUMN IF NOT EXISTS last_local_import_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS last_local_import_status TEXT;

COMMIT;
