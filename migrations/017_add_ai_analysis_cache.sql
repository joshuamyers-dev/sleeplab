BEGIN;

CREATE TABLE IF NOT EXISTS ai_analysis_cache (
    id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id              UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    analysis_type        TEXT NOT NULL,
    cache_key            TEXT NOT NULL,
    input_fingerprint    TEXT NOT NULL,
    settings_fingerprint TEXT NOT NULL,
    response_payload     JSONB NOT NULL,
    created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_ai_analysis_cache_user_type_key
    ON ai_analysis_cache (user_id, analysis_type, cache_key);

CREATE INDEX IF NOT EXISTS idx_ai_analysis_cache_user_type
    ON ai_analysis_cache (user_id, analysis_type);

COMMIT;
