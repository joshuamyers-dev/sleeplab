BEGIN;

ALTER TABLE sessions
    ADD COLUMN IF NOT EXISTS machine_tz TEXT;

UPDATE sessions
SET machine_tz = COALESCE(
    machine_tz,
    (SELECT user_import_settings.machine_tz
     FROM user_import_settings
     WHERE user_import_settings.user_id = sessions.user_id),
    'UTC'
)
WHERE machine_tz IS NULL;

COMMIT;
