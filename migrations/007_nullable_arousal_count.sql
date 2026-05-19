BEGIN;

-- SleepHQ machine_dates does not provide arousal data; allow NULL so
-- SleepHQ-imported sessions can be inserted without a fake zero.
ALTER TABLE sessions
    ALTER COLUMN arousal_count DROP NOT NULL,
    ALTER COLUMN arousal_count DROP DEFAULT;

COMMIT;
