BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

ALTER TABLE users
    ADD COLUMN IF NOT EXISTS public_id UUID DEFAULT gen_random_uuid();

UPDATE users
SET public_id = gen_random_uuid()
WHERE public_id IS NULL;

ALTER TABLE users
    ALTER COLUMN public_id SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_users_public_id
    ON users (public_id);

ALTER TABLE sessions
    ADD COLUMN IF NOT EXISTS public_id UUID DEFAULT gen_random_uuid();

UPDATE sessions
SET public_id = gen_random_uuid()
WHERE public_id IS NULL;

ALTER TABLE sessions
    ALTER COLUMN public_id SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_sessions_public_id
    ON sessions (public_id);

COMMIT;
