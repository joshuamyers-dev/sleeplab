WITH cross_block_duplicates AS (
    SELECT
        se.id,
        ROW_NUMBER() OVER (
            PARTITION BY s.user_id, s.folder_date, se.event_type, se.event_datetime, COALESCE(se.duration_seconds, 0)
            ORDER BY
                CASE
                    WHEN se.event_datetime >= s.start_datetime
                     AND se.event_datetime <= s.start_datetime + (s.duration_seconds * INTERVAL '1 second')
                    THEN 0
                    ELSE 1
                END,
                s.start_datetime,
                se.id
        ) AS rn
    FROM session_events se
    JOIN sessions s ON s.id = se.session_id
)
DELETE FROM session_events se
USING cross_block_duplicates dup
WHERE se.id = dup.id
  AND dup.rn > 1;

WITH duplicate_events AS (
    SELECT
        id,
        ROW_NUMBER() OVER (
            PARTITION BY session_id, event_type, event_datetime, COALESCE(duration_seconds, 0)
            ORDER BY id
        ) AS rn
    FROM session_events
)
DELETE FROM session_events se
USING duplicate_events de
WHERE se.id = de.id
  AND de.rn > 1;

CREATE UNIQUE INDEX IF NOT EXISTS uq_session_events_identity
    ON session_events (session_id, event_type, event_datetime, (COALESCE(duration_seconds, 0)));
