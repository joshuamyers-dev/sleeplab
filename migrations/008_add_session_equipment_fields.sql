BEGIN;

-- Machine settings imported from SleepHQ per session
ALTER TABLE sessions
    ADD COLUMN IF NOT EXISTS therapy_mode   TEXT,
    ADD COLUMN IF NOT EXISTS mask_type      TEXT,
    ADD COLUMN IF NOT EXISTS humidity_level SMALLINT,
    ADD COLUMN IF NOT EXISTS temperature_c  NUMERIC(4,1);

-- Optional per-session equipment overrides; NULL = infer from user_equipment catalog
ALTER TABLE sessions
    ADD COLUMN IF NOT EXISTS mask_equipment_id       UUID REFERENCES user_equipment(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS tubing_equipment_id     UUID REFERENCES user_equipment(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS humidifier_equipment_id UUID REFERENCES user_equipment(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS filter_equipment_id     UUID REFERENCES user_equipment(id) ON DELETE SET NULL;

CREATE INDEX idx_sessions_mask_equipment_id       ON sessions (mask_equipment_id);
CREATE INDEX idx_sessions_tubing_equipment_id     ON sessions (tubing_equipment_id);
CREATE INDEX idx_sessions_humidifier_equipment_id ON sessions (humidifier_equipment_id);
CREATE INDEX idx_sessions_filter_equipment_id     ON sessions (filter_equipment_id);

COMMIT;
