-- Store fixed preset tags at the same nightly scope as session notes.
ALTER TABLE sessions
    ADD COLUMN IF NOT EXISTS tags TEXT[];
