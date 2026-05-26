CREATE INDEX IF NOT EXISTS idx_session_events_session_id_datetime
    ON session_events (session_id, event_datetime);

CREATE INDEX IF NOT EXISTS idx_session_metrics_session_id_ts
    ON session_metrics (session_id, ts);

CREATE INDEX IF NOT EXISTS idx_session_spo2_session_id_ts
    ON session_spo2 (session_id, ts);
