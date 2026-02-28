BEGIN;

ALTER TABLE sessions DROP CONSTRAINT IF EXISTS sessions_session_id_key;

DROP INDEX IF EXISTS sessions_session_id_key;

CREATE UNIQUE INDEX IF NOT EXISTS uq_sessions_user_session_id
    ON sessions (user_id, session_id);

COMMIT;
