BEGIN;

-- Replace the original 'mask' catch-all with 'cushion' and 'headgear'.
-- Cushion covers nasal pillows, nasal cushions, and full-face cushions.
-- Headgear covers the frame/strap assembly, which wears at a different rate.

ALTER TABLE user_equipment
    DROP CONSTRAINT IF EXISTS user_equipment_equipment_type_check;

ALTER TABLE user_equipment
    ADD CONSTRAINT user_equipment_equipment_type_check
        CHECK (equipment_type IN ('cushion', 'headgear', 'tubing', 'humidifier_chamber', 'filter'));

-- Migrate any existing 'mask' rows to 'cushion' (best-fit default).
UPDATE user_equipment SET equipment_type = 'cushion' WHERE equipment_type = 'mask';

COMMIT;
