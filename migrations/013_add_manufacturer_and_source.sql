-- Migration 013: add manufacturer provenance columns to sessions
--
-- Context: open-cpap-parser integration (sleeplab#38).
-- These three columns let the API and UI distinguish sessions imported
-- via the native ResMed EDF path from those parsed by open-cpap-parser,
-- and flag sessions where the community has not yet validated the parser
-- output against OSCAR or device-exported reports.
--
-- data_source values:
--   'resmed_native'      — existing sessions parsed by importer/edf_parser.py
--   'open_cpap_parser'   — parsed by open-cpap-parser (any manufacturer)
--   'sleephq'            — imported via SleepHQ API
--
-- parser_validated:
--   true  (default) — either native path or a validated open-cpap-parser adapter
--   false           — open-cpap-parser adapter is implemented but not yet
--                     regression-tested against OSCAR for this manufacturer.
--                     UI should show a warning badge on these sessions.

ALTER TABLE sessions
    ADD COLUMN IF NOT EXISTS manufacturer     TEXT,
    ADD COLUMN IF NOT EXISTS data_source      TEXT NOT NULL DEFAULT 'resmed_native',
    ADD COLUMN IF NOT EXISTS parser_validated BOOLEAN NOT NULL DEFAULT true;

-- Existing rows: native ResMed path, validated.
UPDATE sessions
SET    data_source      = 'resmed_native',
       parser_validated = true
WHERE  data_source IS NULL
   OR  data_source = 'resmed_native';
