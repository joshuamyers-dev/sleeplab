BEGIN;

CREATE TABLE IF NOT EXISTS users (
    id            SERIAL PRIMARY KEY,
    email         TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    created_at    TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE sessions
    ADD COLUMN IF NOT EXISTS user_id INTEGER;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'sessions_user_id_fkey'
    ) THEN
        ALTER TABLE sessions
            ADD CONSTRAINT sessions_user_id_fkey
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions (user_id);

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM sessions WHERE user_id IS NULL) THEN
        -- Wipe existing single-user data; cascade clears events/metrics/spo2.
        TRUNCATE sessions CASCADE;
        ALTER TABLE sessions ALTER COLUMN user_id SET NOT NULL;
    ELSIF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'sessions'
          AND column_name = 'user_id'
          AND is_nullable = 'YES'
    ) THEN
        ALTER TABLE sessions ALTER COLUMN user_id SET NOT NULL;
    END IF;
END $$;

COMMIT;
