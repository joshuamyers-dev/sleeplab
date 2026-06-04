"""
CPAP ETL importer: reads all ResMed EDF session files from DATALOG and
inserts/updates records in the local PostgreSQL database.

Run:
    python import_sessions.py
    python import_sessions.py --folder 20241215   # single folder
    python import_sessions.py --from 20250101     # from date onward
"""

import argparse
import os
import statistics
import sys
from datetime import date, datetime
from pathlib import Path
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from db import (
    clear_session_waveform,
    get_conn,
    get_session_db_id,
    replace_session_events,
    replace_session_metrics,
    replace_session_spo2,
    replace_session_waveform,
    upsert_session,
)
from edf_parser import parse_brp, parse_eve, parse_pld, parse_sa2, read_header

AHI_EVENT_TYPES = {"Central Apnea", "Obstructive Apnea", "Hypopnea", "Apnea"}


def _machine_tz(name: str | None = None) -> ZoneInfo:
    """Return the ZoneInfo for MACHINE_TZ, falling back to UTC on invalid input."""
    name = name or os.environ.get("MACHINE_TZ", "UTC")
    try:
        return ZoneInfo(name)
    except (ZoneInfoNotFoundError, KeyError, ValueError):
        print(f"  WARNING: unknown MACHINE_TZ={name!r}, falling back to UTC", flush=True)
        return ZoneInfo("UTC")


def _localize(naive_dt: datetime, machine_tz: ZoneInfo | None = None) -> datetime:
    """Attach MACHINE_TZ to a naive datetime from an EDF header."""
    return naive_dt.replace(tzinfo=machine_tz or _machine_tz())


def _machine_tz_for_user(conn, user_id: str) -> tuple[str, ZoneInfo]:
    with conn.cursor() as cur:
        cur.execute(
            "SELECT machine_tz FROM user_import_settings WHERE user_id = %s",
            (user_id,),
        )
        row = cur.fetchone()
    name = row[0] if row and row[0] else None
    zone = _machine_tz(name)
    return zone.key, zone


def discover_session_blocks(folder: Path) -> list:
    """
    Find all valid session blocks in a folder.

    Pairing rule: for each PLD timestamp, find the most-recent CSL timestamp
    that precedes it. CSL-only blocks (no matching PLD) are skipped.

    Returns list of dicts:
        {csl_ts, csl_path, eve_path, pld_ts, pld_path, brp_path, spo2_path}
    """
    files = list(folder.glob("*.edf"))
    if not files:
        return []

    by_ts_type = {}
    brp_paths = []
    for f in files:
        parts = f.stem.split("_")
        if len(parts) != 3:
            continue
        # timestamp = YYYYMMDD + HHMMSS
        ts = parts[0] + parts[1]
        ftype = parts[2]
        by_ts_type[(ts, ftype)] = f
        if ftype == "BRP":
            brp_paths.append(f)

    csl_timestamps = sorted(ts for (ts, t) in by_ts_type if t == "CSL")
    pld_timestamps = sorted(ts for (ts, t) in by_ts_type if t == "PLD")

    if not pld_timestamps:
        return []

    blocks = []
    for pld_ts in pld_timestamps:
        # Find the most recent CSL timestamp that is <= pld_ts
        matching_csl = None
        for csl_ts in reversed(csl_timestamps):
            if csl_ts <= pld_ts:
                matching_csl = csl_ts
                break
        if matching_csl is None:
            continue

        blocks.append({
            'csl_ts':   matching_csl,
            'csl_path': by_ts_type.get((matching_csl, 'CSL')),
            'eve_path': by_ts_type.get((matching_csl, 'EVE')),
            'pld_ts':   pld_ts,
            'pld_path': by_ts_type[(pld_ts, 'PLD')],
            'brp_path': by_ts_type.get((pld_ts, 'BRP')),
            'brp_paths': sorted(brp_paths),
            'spo2_path': by_ts_type.get((pld_ts, 'SA2')) or by_ts_type.get((pld_ts, 'SAD')),
        })

    return blocks


def derive_summary(pld_channels: dict, events: list, duration_seconds: int) -> dict:
    """Compute per-session summary statistics from PLD channels and EVE events."""
    duration_hours = duration_seconds / 3600.0

    ca = sum(1 for _, _, t in events if t == "Central Apnea")
    oa = sum(1 for _, _, t in events if t == "Obstructive Apnea")
    h = sum(1 for _, _, t in events if t == "Hypopnea")
    a = sum(1 for _, _, t in events if t == "Apnea")
    ar = sum(1 for _, _, t in events if t == "Arousal")
    ahi_events = ca + oa + h + a
    ahi = round(ahi_events / duration_hours, 2) if duration_hours > 0 else 0.0

    def safe_mean(vals):
        return round(statistics.mean(vals), 4) if vals else None

    def percentile(vals, pct):
        if not vals:
            return None
        s = sorted(vals)
        return round(s[int(pct * len(s))], 2)

    press = [v for v in pld_channels.get("Press.2s", []) if v > 0]
    leak = pld_channels.get("Leak.2s", [])
    rr = [v for v in pld_channels.get("RespRate.2s", []) if v > 0]
    tv = [v for v in pld_channels.get("TidVol.2s", []) if v > 0]
    mv = [v for v in pld_channels.get("MinVent.2s", []) if v > 0]
    snore = pld_channels.get("Snore.2s", [])
    fl = pld_channels.get("FlowLim.2s", [])

    return {
        "ahi": ahi,
        "central_apnea_count": ca,
        "obstructive_apnea_count": oa,
        "hypopnea_count": h,
        "apnea_count": a,
        "arousal_count": ar,
        "total_ahi_events": ahi_events,
        "avg_pressure": safe_mean(press),
        "p95_pressure": percentile(press, 0.95),
        "avg_leak": safe_mean(leak),
        "avg_resp_rate": safe_mean(rr),
        "avg_tidal_vol": safe_mean(tv),
        "avg_min_vent": safe_mean(mv),
        "avg_snore": safe_mean(snore),
        "avg_flow_lim": safe_mean(fl),
    }


def dedupe_events(events: list) -> list:
    deduped = []
    seen = set()
    for onset, duration, event_type in events:
        key = (event_type, round(float(onset), 1), None if duration is None else round(float(duration), 1))
        if key in seen:
            continue
        seen.add(key)
        deduped.append((onset, duration, event_type))
    return deduped


def events_for_block(events: list, csl_start: datetime, block_start: datetime, duration_seconds: int) -> list:
    block_end = block_start + timedelta(seconds=duration_seconds)
    assigned = []
    for onset, duration, event_type in events:
        event_dt = csl_start + timedelta(seconds=onset)
        if block_start <= event_dt <= block_end:
            assigned.append((onset, duration, event_type))
    return assigned


def import_folder(folder: Path, folder_date: date, conn, user_id: str):
    blocks = discover_session_blocks(folder)
    if not blocks:
        return 0

    imported = 0
    machine_tz_name, machine_tz = _machine_tz_for_user(conn, user_id)
    for block_idx, block in enumerate(blocks):
        pld_ts = block["pld_ts"]
        session_id = f"{folder_date.strftime('%Y%m%d')}_{pld_ts[8:10]}{pld_ts[10:12]}{pld_ts[12:14]}"

        try:
            # Parse PLD (required)
            pld_header, pld_channels = parse_pld(block["pld_path"])

            # Parse EVE (optional — some blocks may lack it)
            events = []
            if block['eve_path'] and block['eve_path'].exists():
                _, events = parse_eve(block['eve_path'])
            events = dedupe_events(events)

            # Get CSL start datetime for event absolute timestamps.
            # EDF timestamps are naive local machine time; attach MACHINE_TZ so
            # psycopg2 stores the correct UTC equivalent in TIMESTAMPTZ columns.
            csl_start = _localize(pld_header.start_datetime, machine_tz)  # fallback
            if block["csl_path"] and block["csl_path"].exists():
                csl_hdr = read_header(str(block["csl_path"]))
                csl_start = _localize(csl_hdr.start_datetime, machine_tz)

            pld_start = _localize(pld_header.start_datetime, machine_tz)
            duration_s = int(pld_header.num_records * pld_header.duration_per_record)
            events = events_for_block(events, csl_start, pld_start, duration_s)

            # Parse SA2/SAD (optional)
            spo2_data = None
            spo2_header = None
            spo2_start = None
            if block["spo2_path"] and block["spo2_path"].exists():
                spo2_header, spo2_data = parse_sa2(block["spo2_path"])
                spo2_start = _localize(spo2_header.start_datetime, machine_tz)

            summary = derive_summary(pld_channels, events, duration_s)

            session_data = {
                "session_id": session_id,
                "folder_date": folder_date,
                "block_index": block_idx,
                "start_datetime": pld_start,
                "pld_start_datetime": pld_start,
                "duration_seconds": duration_s,
                "device_serial": pld_header.device_serial or None,
                "has_spo2": spo2_data is not None,
                "therapy_mode": None,
                "mask_type": None,
                "humidity_level": None,
                "temperature_c": None,
                "machine_tz": machine_tz_name,
                "user_id": user_id,
                **summary,
            }

            session_db_id = upsert_session(conn, session_data)
            replace_session_events(conn, session_db_id, events, csl_start)
            replace_session_metrics(conn, session_db_id, pld_header, pld_channels, pld_start)

            if spo2_data and spo2_header:
                replace_session_spo2(conn, session_db_id, spo2_header, spo2_data, spo2_start)
            replace_waveforms_for_block(conn, session_db_id, block, events, csl_start, machine_tz)

            conn.commit()
            imported += 1

        except Exception as e:
            conn.rollback()
            print(f"    ERROR block {block_idx} ({session_id}): {e}")

    return imported


def replace_waveforms_for_block(conn, session_db_id: str, block: dict, events: list, csl_start, machine_tz: ZoneInfo) -> bool:
    """Replace BRP waveform samples for a session using every BRP segment in the folder."""
    brp_paths = [path for path in block.get("brp_paths", []) if path and path.exists()]
    if not brp_paths or not events:
        clear_session_waveform(conn, session_db_id)
        return False

    inserted = False
    for brp_path in brp_paths:
        waveform_header, waveform = parse_brp(brp_path)
        waveform_start = _localize(waveform_header.start_datetime, machine_tz)
        replace_session_waveform(
            conn,
            session_db_id,
            waveform_header,
            waveform,
            events,
            start_datetime=waveform_start,
            csl_start_datetime=csl_start,
            delete_existing=not inserted,
        )
        inserted = True

    return inserted

def run_local_import(user_id: str, datalog_path: str, from_date: str | None = None) -> dict:
    """
    Programmatic entry point for server-triggered local imports.

    datalog_path must be an absolute path within /data/ (enforced by the caller).
    Returns stats dict: {"imported": N, "folders": N, "errors": N}
    """
    from pathlib import Path as _Path

    datalog = _Path(datalog_path)
    if not datalog.exists():
        raise FileNotFoundError(f"DATALOG path not found: {datalog_path}")

    folders = sorted([f for f in datalog.iterdir() if f.is_dir() and f.name.isdigit() and len(f.name) == 8])
    if from_date:
        folders = [f for f in folders if f.name >= from_date]

    conn = get_conn()
    stats = {"imported": 0, "folders": 0, "errors": 0}
    try:
        for folder in folders:
            try:
                folder_date = date(int(folder.name[:4]), int(folder.name[4:6]), int(folder.name[6:8]))
            except ValueError:
                continue
            try:
                n = import_folder(folder, folder_date, conn, user_id)
                if n > 0:
                    stats["imported"] += n
                    stats["folders"] += 1
            except Exception as e:
                print(f"  ERROR folder {folder.name}: {e}")
                stats["errors"] += 1
    finally:
        conn.close()

    print(f"Local import done. imported={stats['imported']} folders={stats['folders']} errors={stats['errors']}")
    return stats


def parse_args():
    parser = argparse.ArgumentParser(description="Import CPAP EDF data into PostgreSQL")
    parser.add_argument("--datalog", required=True, help="Absolute path to DATALOG folder")
    parser.add_argument("--user-id", required=True, dest="user_id", help="User UUID to associate sessions with")
    parser.add_argument("--folder", help="Import only this folder (YYYYMMDD)")
    parser.add_argument("--from", dest="from_date", help="Import folders from this date onward (YYYYMMDD)")
    return parser.parse_args()


def main():
    args = parse_args()
    datalog = Path(args.datalog)
    user_id = args.user_id
    conn = get_conn()

    if args.folder:
        folder = datalog / args.folder
        if not folder.exists():
            print(f"Folder not found: {folder}")
            sys.exit(1)
        folder_date = date(int(args.folder[:4]), int(args.folder[4:6]), int(args.folder[6:8]))
        n = import_folder(folder, folder_date, conn, user_id)
        print(f"{args.folder}: {n} session block(s) imported")
        conn.close()
        return

    folders = sorted([f for f in datalog.iterdir() if f.is_dir() and f.name.isdigit() and len(f.name) == 8])

    if args.from_date:
        folders = [f for f in folders if f.name >= args.from_date]

    total_sessions = 0
    total_folders = 0
    for folder in folders:
        try:
            folder_date = date(int(folder.name[:4]), int(folder.name[4:6]), int(folder.name[6:8]))
        except ValueError:
            continue

        print(f"  {folder.name} ... ", end="", flush=True)
        n = import_folder(folder, folder_date, conn, user_id)
        if n > 0:
            print(f"{n} block(s)")
            total_sessions += n
            total_folders += 1
        else:
            print("(empty)")

    conn.close()
    print(f"\nDone. {total_sessions} session blocks imported across {total_folders} nights.")


if __name__ == "__main__":
    main()
