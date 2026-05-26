BEGIN;

ALTER TABLE user_import_settings
    ADD COLUMN IF NOT EXISTS machine_tz TEXT,
    ADD COLUMN IF NOT EXISTS display_tz TEXT,
    ADD COLUMN IF NOT EXISTS llm_provider TEXT,
    ADD COLUMN IF NOT EXISTS llm_base_url TEXT,
    ADD COLUMN IF NOT EXISTS llm_api_key TEXT,
    ADD COLUMN IF NOT EXISTS llm_model TEXT;

COMMIT;
