"""
CPAP ETL importer: reads all ResMed EDF session files from DATALOG and
inserts/updates records in the local PostgreSQL database.

Run:
    python import_sessions.py
    python import_sessions.py --folder 20241215   # single folder
    python import_sessions.py --from 20250101     # from date onward
"""

import sys
import argparse
import statistics
from pathlib import Path
from datetime import date, datetime, timedelta

from edf_parser import parse_pld, parse_eve, parse_sa2, read_header
from db import (
    get_conn,
    replace_session_events,
    replace_session_metrics,
    replace_session_spo2,
    session_exists,
    upsert_session,
)


AHI_EVENT_TYPES = {'Central Apnea', 'Obstructive Apnea', 'Hypopnea', 'Apnea'}


def discover_session_blocks(folder: Path) -> list:
    """
    Find all valid session blocks in a folder.

    Pairing rule: for each PLD timestamp, find the most-recent CSL timestamp
    that precedes it. CSL-only blocks (no matching PLD) are skipped.

    Returns list of dicts: {csl_ts, csl_path, eve_path, pld_ts, pld_path, sa2_path}
    """
    files = list(folder.glob("*.edf"))
    if not files:
        return []

    by_ts_type = {}
    for f in files:
        parts = f.stem.split('_')
        if len(parts) != 3:
            continue
        # timestamp = YYYYMMDD + HHMMSS
        ts = parts[0] + parts[1]
        ftype = parts[2]
        by_ts_type[(ts, ftype)] = f

    csl_timestamps = sorted(ts for (ts, t) in by_ts_type if t == 'CSL')
    pld_timestamps = sorted(ts for (ts, t) in by_ts_type if t == 'PLD')

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
            'sa2_path': by_ts_type.get((pld_ts, 'SA2')),
        })

    return blocks


def derive_summary(pld_channels: dict, events: list, duration_seconds: int) -> dict:
    """Compute per-session summary statistics from PLD channels and EVE events."""
    duration_hours = duration_seconds / 3600.0

    ca  = sum(1 for _, _, t in events if t == 'Central Apnea')
    oa  = sum(1 for _, _, t in events if t == 'Obstructive Apnea')
    h   = sum(1 for _, _, t in events if t == 'Hypopnea')
    a   = sum(1 for _, _, t in events if t == 'Apnea')
    ar  = sum(1 for _, _, t in events if t == 'Arousal')
    ahi_events = ca + oa + h + a
    ahi = round(ahi_events / duration_hours, 2) if duration_hours > 0 else 0.0

    def safe_mean(vals):
        return round(statistics.mean(vals), 4) if vals else None

    def percentile(vals, pct):
        if not vals:
            return None
        s = sorted(vals)
        return round(s[int(pct * len(s))], 2)

    press = [v for v in pld_channels.get('Press.2s', []) if v > 0]
    leak  = pld_channels.get('Leak.2s', [])
    rr    = [v for v in pld_channels.get('RespRate.2s', []) if v > 0]
    tv    = [v for v in pld_channels.get('TidVol.2s', []) if v > 0]
    mv    = [v for v in pld_channels.get('MinVent.2s', []) if v > 0]
    snore = pld_channels.get('Snore.2s', [])
    fl    = pld_channels.get('FlowLim.2s', [])

    return {
        'ahi':                     ahi,
        'central_apnea_count':     ca,
        'obstructive_apnea_count': oa,
        'hypopnea_count':          h,
        'apnea_count':             a,
        'arousal_count':           ar,
        'total_ahi_events':        ahi_events,
        'avg_pressure':            safe_mean(press),
        'p95_pressure':            percentile(press, 0.95),
        'avg_leak':                safe_mean(leak),
        'avg_resp_rate':           safe_mean(rr),
        'avg_tidal_vol':           safe_mean(tv),
        'avg_min_vent':            safe_mean(mv),
        'avg_snore':               safe_mean(snore),
        'avg_flow_lim':            safe_mean(fl),
    }


def import_folder(folder: Path, folder_date: date, conn, user_id: str):
    blocks = discover_session_blocks(folder)
    if not blocks:
        return 0

    imported = 0
    for block_idx, block in enumerate(blocks):
        # Build human-readable session_id
        # Format: "YYYYMMDD_HHMMSS" using folder date + CSL HHMMSS
        csl_ts = block['csl_ts']
        session_id = f"{folder_date.strftime('%Y%m%d')}_{csl_ts[8:10]}{csl_ts[10:12]}{csl_ts[12:14]}"

        try:
            if session_exists(conn, user_id, session_id):
                print(f"    SKIP block {block_idx} ({session_id}): already imported")
                continue

            # Parse PLD (required)
            pld_header, pld_channels = parse_pld(block['pld_path'])

            # Parse EVE (optional — some blocks may lack it)
            events = []
            if block['eve_path'] and block['eve_path'].exists():
                _, events = parse_eve(block['eve_path'])

            # Get CSL start datetime for event absolute timestamps
            csl_start = pld_header.start_datetime  # fallback
            if block['csl_path'] and block['csl_path'].exists():
                csl_hdr = read_header(str(block['csl_path']))
                csl_start = csl_hdr.start_datetime

            pld_start = pld_header.start_datetime
            duration_s = int(pld_header.num_records * pld_header.duration_per_record)

            # Parse SA2 (optional)
            spo2_data = None
            if block['sa2_path'] and block['sa2_path'].exists():
                _, spo2_data = parse_sa2(block['sa2_path'])

            summary = derive_summary(pld_channels, events, duration_s)

            session_data = {
                'session_id':         session_id,
                'folder_date':        folder_date,
                'block_index':        block_idx,
                'start_datetime':     csl_start,
                'pld_start_datetime': pld_start,
                'duration_seconds':   duration_s,
                'device_serial':      pld_header.device_serial or None,
                'has_spo2':           spo2_data is not None,
                'user_id':            user_id,
                **summary,
            }

            session_db_id = upsert_session(conn, session_data)
            replace_session_events(conn, session_db_id, events, csl_start)
            replace_session_metrics(conn, session_db_id, pld_header, pld_channels)

            if spo2_data:
                replace_session_spo2(conn, session_db_id, pld_header, spo2_data)

            conn.commit()
            imported += 1

        except Exception as e:
            conn.rollback()
            print(f"    ERROR block {block_idx} ({session_id}): {e}")

    return imported


def parse_args():
    parser = argparse.ArgumentParser(description='Import CPAP EDF data into PostgreSQL')
    parser.add_argument('--datalog', required=True, help='Absolute path to DATALOG folder')
    parser.add_argument('--user-id', required=True, dest='user_id', help='User UUID to associate sessions with')
    parser.add_argument('--folder', help='Import only this folder (YYYYMMDD)')
    parser.add_argument('--from', dest='from_date', help='Import folders from this date onward (YYYYMMDD)')
    return parser.parse_args()


def main():
    args = parse_args()
    DATALOG = Path(args.datalog)
    user_id = args.user_id
    conn = get_conn()

    if args.folder:
        folder = DATALOG / args.folder
        if not folder.exists():
            print(f"Folder not found: {folder}")
            sys.exit(1)
        folder_date = date(int(args.folder[:4]), int(args.folder[4:6]), int(args.folder[6:8]))
        n = import_folder(folder, folder_date, conn, user_id)
        print(f"{args.folder}: {n} session block(s) imported")
        conn.close()
        return

    folders = sorted([f for f in DATALOG.iterdir() if f.is_dir() and f.name.isdigit() and len(f.name) == 8])

    if args.from_date:
        folders = [f for f in folders if f.name >= args.from_date]

    total_sessions = 0
    total_folders = 0
    for folder in folders:
        try:
            folder_date = date(int(folder.name[:4]), int(folder.name[4:6]), int(folder.name[6:8]))
        except ValueError:
            continue

        print(f"  {folder.name} ... ", end='', flush=True)
        n = import_folder(folder, folder_date, conn, user_id)
        if n > 0:
            print(f"{n} block(s)")
            total_sessions += n
            total_folders += 1
        else:
            print("(empty)")

    conn.close()
    print(f"\nDone. {total_sessions} session blocks imported across {total_folders} nights.")


if __name__ == '__main__':
    main()
