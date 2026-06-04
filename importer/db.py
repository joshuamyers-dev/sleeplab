"""
PostgreSQL connection and upsert helpers for the CPAP importer.
"""

import os
from pathlib import Path

import psycopg2
import psycopg2.extras
from datetime import datetime, timedelta


def _load_dotenv() -> None:
    env_path = Path(__file__).resolve().parent.parent / ".env"
    if not env_path.exists():
        return
    for raw_line in env_path.read_text().splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        os.environ.setdefault(key.strip(), value.strip())


_load_dotenv()

_raw_dsn = os.environ.get("DATABASE_URL", "dbname=cpap")
DB_DSN = _raw_dsn.replace("postgresql+psycopg2://", "postgresql://", 1)


def get_conn():
    return psycopg2.connect(DB_DSN)


def session_exists(conn, user_id: str, session_id: str) -> bool:
    with conn.cursor() as cur:
        cur.execute(
            "SELECT 1 FROM sessions WHERE user_id = %s AND session_id = %s",
            (user_id, session_id),
        )
        return cur.fetchone() is not None


def get_session_db_id(conn, user_id: str, session_id: str) -> str | None:
    with conn.cursor() as cur:
        cur.execute(
            "SELECT id FROM sessions WHERE user_id = %s AND session_id = %s",
            (user_id, session_id),
        )
        row = cur.fetchone()
        return row[0] if row else None


def upsert_session(conn, data: dict) -> int:
    """
    Insert or update a session row. Returns the session's integer id.
    data must contain all columns defined in the sessions table.
    """
    sql = """
    INSERT INTO sessions (
        session_id, folder_date, block_index, start_datetime, pld_start_datetime,
        duration_seconds, device_serial, ahi,
        central_apnea_count, obstructive_apnea_count, hypopnea_count,
        apnea_count, arousal_count, total_ahi_events,
        avg_pressure, p95_pressure, avg_leak, avg_resp_rate, avg_tidal_vol,
        avg_min_vent, avg_snore, avg_flow_lim, has_spo2,
        therapy_mode, mask_type, humidity_level, temperature_c,
        machine_tz, user_id, updated_at
    ) VALUES (
        %(session_id)s, %(folder_date)s, %(block_index)s, %(start_datetime)s, %(pld_start_datetime)s,
        %(duration_seconds)s, %(device_serial)s, %(ahi)s,
        %(central_apnea_count)s, %(obstructive_apnea_count)s, %(hypopnea_count)s,
        %(apnea_count)s, %(arousal_count)s, %(total_ahi_events)s,
        %(avg_pressure)s, %(p95_pressure)s, %(avg_leak)s, %(avg_resp_rate)s, %(avg_tidal_vol)s,
        %(avg_min_vent)s, %(avg_snore)s, %(avg_flow_lim)s, %(has_spo2)s,
        %(therapy_mode)s, %(mask_type)s, %(humidity_level)s, %(temperature_c)s,
        %(machine_tz)s, %(user_id)s, NOW()
    )
    ON CONFLICT (user_id, session_id) DO UPDATE SET
        folder_date             = EXCLUDED.folder_date,
        block_index             = EXCLUDED.block_index,
        start_datetime          = EXCLUDED.start_datetime,
        pld_start_datetime      = EXCLUDED.pld_start_datetime,
        duration_seconds        = EXCLUDED.duration_seconds,
        device_serial           = EXCLUDED.device_serial,
        ahi                     = EXCLUDED.ahi,
        central_apnea_count     = EXCLUDED.central_apnea_count,
        obstructive_apnea_count = EXCLUDED.obstructive_apnea_count,
        hypopnea_count          = EXCLUDED.hypopnea_count,
        apnea_count             = EXCLUDED.apnea_count,
        arousal_count           = EXCLUDED.arousal_count,
        total_ahi_events        = EXCLUDED.total_ahi_events,
        avg_pressure            = EXCLUDED.avg_pressure,
        p95_pressure            = EXCLUDED.p95_pressure,
        avg_leak                = EXCLUDED.avg_leak,
        avg_resp_rate           = EXCLUDED.avg_resp_rate,
        avg_tidal_vol           = EXCLUDED.avg_tidal_vol,
        avg_min_vent            = EXCLUDED.avg_min_vent,
        avg_snore               = EXCLUDED.avg_snore,
        avg_flow_lim            = EXCLUDED.avg_flow_lim,
        has_spo2                = EXCLUDED.has_spo2,
        therapy_mode            = EXCLUDED.therapy_mode,
        mask_type               = EXCLUDED.mask_type,
        humidity_level          = EXCLUDED.humidity_level,
        temperature_c           = EXCLUDED.temperature_c,
        machine_tz              = EXCLUDED.machine_tz,
        -- user_id intentionally excluded: re-import must not change ownership
        updated_at              = NOW()
    RETURNING id
    """
    with conn.cursor() as cur:
        cur.execute(sql, data)
        return cur.fetchone()[0]


def replace_session_events(conn, session_db_id: int, events: list, csl_start: datetime):
    """Delete existing events for this session and insert the new list."""
    with conn.cursor() as cur:
        cur.execute("DELETE FROM session_events WHERE session_id = %s", (session_db_id,))

    if not events:
        return

    rows = []
    for onset, duration, event_type in _dedupe_events(events):
        event_dt = csl_start + timedelta(seconds=onset)
        rows.append((session_db_id, event_type, onset, duration if duration is not None else None, event_dt))

    sql = """
    INSERT INTO session_events (session_id, event_type, onset_seconds, duration_seconds, event_datetime)
    VALUES %s
    """
    with conn.cursor() as cur:
        psycopg2.extras.execute_values(cur, sql, rows)


def replace_session_metrics(conn, session_db_id: int, header, channels: dict, start_datetime: datetime | None = None):
    """Delete existing metrics for this session and bulk-insert all PLD time-series rows."""
    with conn.cursor() as cur:
        cur.execute("DELETE FROM session_metrics WHERE session_id = %s", (session_db_id,))

    LABELS = ['MaskPress.2s', 'Press.2s', 'EprPress.2s', 'Leak.2s', 'RespRate.2s',
              'TidVol.2s', 'MinVent.2s', 'Snore.2s', 'FlowLim.2s']

    # Determine samples per record from first non-Crc16 signal
    data_signals = [s for s in header.signals if s.label != 'Crc16']
    spr = data_signals[0].num_samples_per_record  # 30 samples per 60s record = 2s epochs
    dur = header.duration_per_record               # 60.0 seconds
    epoch = dur / spr                              # 2.0 seconds
    pld_start = start_datetime or header.start_datetime

    rows = []
    total_samples = spr * header.num_records
    for rec in range(header.num_records):
        for si in range(spr):
            abs_idx = rec * spr + si
            ts = pld_start + timedelta(seconds=rec * dur + si * epoch)
            row = [session_db_id, ts]
            for label in LABELS:
                vals = channels.get(label)
                row.append(round(vals[abs_idx], 4) if vals and abs_idx < len(vals) else None)
            rows.append(tuple(row))

    sql = """
    INSERT INTO session_metrics
        (session_id, ts, mask_pressure, pressure, epr_pressure, leak, resp_rate,
         tidal_vol, min_vent, snore, flow_lim)
    VALUES %s
    """
    with conn.cursor() as cur:
        psycopg2.extras.execute_values(cur, sql, rows, page_size=5000)


def replace_session_spo2(conn, session_db_id: int, header, spo2_data: tuple, start_datetime: datetime | None = None):
    """Delete existing SpO2 rows and insert new ones."""
    with conn.cursor() as cur:
        cur.execute("DELETE FROM session_spo2 WHERE session_id = %s", (session_db_id,))

    pulse_vals, spo2_vals = spo2_data
    spo2_sig = header.signals[1]   # SpO2.1s at 1 Hz
    spr = spo2_sig.num_samples_per_record  # 1 sample/second per record
    dur = header.duration_per_record
    pld_start = start_datetime or header.start_datetime

    rows = []
    for rec in range(header.num_records):
        for si in range(spr):
            abs_idx = rec * spr + si
            ts = pld_start + timedelta(seconds=rec * dur + si)
            p = pulse_vals[abs_idx] if abs_idx < len(pulse_vals) else None
            s = spo2_vals[abs_idx] if abs_idx < len(spo2_vals) else None
            rows.append((session_db_id, ts, s if s != -1 else None, p if p != -1 else None))

    sql = "INSERT INTO session_spo2 (session_id, ts, spo2, pulse) VALUES %s"
    with conn.cursor() as cur:
        psycopg2.extras.execute_values(cur, sql, rows, page_size=5000)


def replace_session_waveform(
    conn,
    session_db_id: int,
    header,
    channels: dict,
    events: list | None = None,
    before_seconds: int = 120,
    after_seconds: int = 180,
    start_datetime=None,
    csl_start_datetime=None,
    delete_existing: bool = True,
):
    """
    Delete existing BRP waveform rows and bulk-insert event-focused samples.

    Full-night BRP is large: a typical 7-hour night is ~630k rows at 25 Hz.
    The Event Inspector only needs windows around scored events, so by default
    we store merged event windows rather than the entire night.
    """
    if delete_existing:
        clear_session_waveform(conn, session_db_id)

    flow_vals = channels.get("Flow.40ms")
    pressure_vals = channels.get("Press.40ms")
    if not flow_vals and not pressure_vals:
        return

    data_signals = [s for s in header.signals if s.label != "Crc16"]
    if not data_signals:
        return

    spr = data_signals[0].num_samples_per_record
    dur = header.duration_per_record
    if spr <= 0 or dur <= 0:
        return

    epoch = dur / spr
    start = start_datetime or header.start_datetime
    total_samples = spr * header.num_records
    windows = _merge_waveform_windows(
        _events_relative_to_waveform(events or [], csl_start_datetime, start),
        before_seconds,
        after_seconds,
    )
    if not windows:
        return

    rows = []
    for start_idx, end_idx in windows:
        start_idx = max(0, int(start_idx / epoch))
        end_idx = min(total_samples, int(end_idx / epoch) + 1)
        for idx in range(start_idx, end_idx):
            ts = start + timedelta(seconds=idx * epoch)
            flow = flow_vals[idx] if flow_vals and idx < len(flow_vals) else None
            pressure = pressure_vals[idx] if pressure_vals and idx < len(pressure_vals) else None
            rows.append((
                session_db_id,
                ts,
                round(flow, 4) if flow is not None else None,
                round(pressure, 2) if pressure is not None else None,
            ))

    if not rows:
        return

    sql = "INSERT INTO session_waveform (session_id, ts, flow, pressure) VALUES %s"
    with conn.cursor() as cur:
        psycopg2.extras.execute_values(cur, sql, rows, page_size=5000)


def clear_session_waveform(conn, session_db_id: int):
    with conn.cursor() as cur:
        cur.execute("DELETE FROM session_waveform WHERE session_id = %s", (session_db_id,))


def _dedupe_events(events: list) -> list:
    deduped = []
    seen = set()
    for onset, duration, event_type in events:
        key = (event_type, round(float(onset), 1), None if duration is None else round(float(duration), 1))
        if key in seen:
            continue
        seen.add(key)
        deduped.append((onset, duration, event_type))
    return deduped


def _events_relative_to_waveform(events: list, csl_start: datetime | None, waveform_start: datetime) -> list:
    if csl_start is None:
        return events

    relative_events = []
    for onset, duration, event_type in events:
        event_dt = csl_start + timedelta(seconds=onset)
        relative_onset = (event_dt - waveform_start).total_seconds()
        relative_events.append((relative_onset, duration, event_type))
    return relative_events


def _merge_waveform_windows(events: list, before_seconds: int, after_seconds: int) -> list[tuple[float, float]]:
    windows = []
    for onset, duration, _event_type in events:
        duration = duration or 0
        windows.append((max(0, onset - before_seconds), onset + duration + after_seconds))
    if not windows:
        return []

    windows.sort()
    merged = [windows[0]]
    for start, end in windows[1:]:
        prev_start, prev_end = merged[-1]
        if start <= prev_end:
            merged[-1] = (prev_start, max(prev_end, end))
        else:
            merged.append((start, end))
    return merged
