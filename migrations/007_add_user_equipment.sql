BEGIN;

CREATE TABLE user_equipment (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id          UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    equipment_type   TEXT NOT NULL
                         CHECK (equipment_type IN ('mask', 'tubing', 'humidifier_chamber', 'filter')),
    start_date       DATE NOT NULL,
    replacement_days INTEGER,

    -- Mask-specific fields (NULL for other equipment types)
    mask_category    TEXT,
    brand            TEXT,
    model            TEXT,

    notes            TEXT,
    created_at       TIMESTAMPTZ DEFAULT NOW(),
    updated_at       TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_user_equipment_user_id   ON user_equipment (user_id);
CREATE INDEX idx_user_equipment_user_date ON user_equipment (user_id, equipment_type, start_date DESC);

COMMIT;
