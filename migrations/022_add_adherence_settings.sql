BEGIN;

ALTER TABLE user_import_settings
    ADD COLUMN IF NOT EXISTS adherence_threshold_hours  NUMERIC,
    ADD COLUMN IF NOT EXISTS adherence_borderline_hours NUMERIC,
    ADD COLUMN IF NOT EXISTS adherence_target_pct       NUMERIC,
    ADD COLUMN IF NOT EXISTS adherence_window_days      INTEGER,
    ADD COLUMN IF NOT EXISTS adherence_evaluation_days  INTEGER,
    ADD COLUMN IF NOT EXISTS adherence_window_logic     TEXT,
    ADD COLUMN IF NOT EXISTS adherence_lookback_days    INTEGER;

COMMIT;
