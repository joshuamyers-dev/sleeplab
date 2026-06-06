ALTER TABLE user_import_settings
    ADD COLUMN IF NOT EXISTS adherence_enabled BOOLEAN DEFAULT TRUE;
