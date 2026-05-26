CREATE TABLE IF NOT EXISTS session_waveform (
    id         BIGSERIAL PRIMARY KEY,
    session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    ts         TIMESTAMPTZ NOT NULL,
    flow       NUMERIC(7,4),
    pressure   NUMERIC(6,2)
);

CREATE INDEX IF NOT EXISTS idx_session_waveform_session_id_ts
    ON session_waveform (session_id, ts);
