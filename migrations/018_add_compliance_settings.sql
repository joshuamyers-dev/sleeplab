BEGIN;

ALTER TABLE user_import_settings
    ADD COLUMN IF NOT EXISTS usage_threshold_hours      NUMERIC,
    ADD COLUMN IF NOT EXISTS borderline_threshold_hours NUMERIC,
    ADD COLUMN IF NOT EXISTS target_compliance_pct      NUMERIC,
    ADD COLUMN IF NOT EXISTS compliance_window_days     INTEGER,
    ADD COLUMN IF NOT EXISTS evaluation_period_days     INTEGER,
    ADD COLUMN IF NOT EXISTS window_evaluation_logic    TEXT,
    ADD COLUMN IF NOT EXISTS maintenance_lookback_days  INTEGER;

COMMIT;
