BEGIN;

-- Per-user wearable time-series data: heart rate, SpO2, and sleep stages
-- from any external device (Withings, Oura Ring, Fitbit, Apple Watch, etc.).
--
-- Sleep stage encoding (matches conventional hypnogram orientation):
--   1 = Deep   (N3 / SWS / slow-wave)
--   2 = Light  (N1 / N2 / Core / unspecified asleep)
--   3 = REM
--   4 = Awake  (in-bed but awake)
--
-- raw_stage preserves the original label from the source device for auditability.
-- Multiple rows for the same user+ts can exist if they come from different sources.

CREATE TABLE wearable_samples (
    id          BIGSERIAL PRIMARY KEY,
    user_id     UUID      NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    ts          TIMESTAMPTZ NOT NULL,
    heart_rate  SMALLINT,           -- bpm
    spo2        NUMERIC(5,2),       -- % (0–100)
    sleep_stage SMALLINT            -- 1=deep, 2=light, 3=rem, 4=awake
        CHECK (sleep_stage BETWEEN 1 AND 4),
    raw_stage   TEXT,               -- original label from the device
    source      TEXT                -- 'withings' | 'oura' | 'fitbit' | 'apple_health'
);

-- Fast range queries by user + time
CREATE INDEX idx_wearable_user_ts ON wearable_samples (user_id, ts);

-- Upsert key: one row per user × timestamp × source
CREATE UNIQUE INDEX uq_wearable_user_ts_source
    ON wearable_samples (user_id, ts, source);

COMMIT;
