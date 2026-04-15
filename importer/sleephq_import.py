"""
SleepHQ → Postgres bridge.

Fetches per-night CPAP summaries from the SleepHQ API and upserts them
into the sleeplab `sessions` table using the existing db helpers.

Session IDs from this source are prefixed with ``sleephq-{record_id}``
to avoid collisions with EDF-imported sessions from the same night.

Environment variables (required unless passed via CLI / run_sleephq_import):
    SLEEPHQ_CLIENT_ID       OAuth2 client ID
    SLEEPHQ_CLIENT_SECRET   OAuth2 client secret
    SLEEPHQ_TEAM_ID         (optional) override auto-resolved team
    SLEEPHQ_MACHINE_ID      (optional) override auto-resolved machine

CLI usage:
    # Last 30 days
    python sleephq_import.py --user-id <uuid> --days 30

    # Explicit date range
    python sleephq_import.py --user-id <uuid> --from 2025-01-01 --to 2025-06-01

    # Dry run (no DB writes)
    python sleephq_import.py --user-id <uuid> --days 7 --dry-run

    # Re-import, overwriting existing rows
    python sleephq_import.py --user-id <uuid> --days 7 --force

Programmatic usage:
    from sleephq_import import run_sleephq_import

    stats = run_sleephq_import(user_id="abc-123", days=7)
    # → {"inserted": 5, "updated": 0, "skipped": 2, "errors": 0}
"""

import argparse
import os
import sys
from datetime import date, datetime, timedelta
from typing import Optional

from sleephq import AuthenticatedClient
from sleephq.api.machines import get_v1_machines_machine_id_machine_dates
from sleephq.api.teams import get_v1_teams
from sleephq.api.machines import get_v1_teams_team_id_machines

from db import get_conn, session_exists, upsert_session


# ---------------------------------------------------------------------------
# Client / authentication
# ---------------------------------------------------------------------------

def create_sleephq_client(
    client_id: Optional[str] = None,
    client_secret: Optional[str] = None,
) -> AuthenticatedClient:
    """Authenticate with SleepHQ and return an authenticated client."""
    cid = client_id or os.environ["SLEEPHQ_CLIENT_ID"]
    csecret = client_secret or os.environ["SLEEPHQ_CLIENT_SECRET"]
    return AuthenticatedClient(client_id=cid, client_secret=csecret)


# ---------------------------------------------------------------------------
# ID resolution helpers
# ---------------------------------------------------------------------------

def resolve_team_id(client: AuthenticatedClient) -> int:
    """Return the team ID from env or auto-resolve via the API."""
    env_val = os.environ.get("SLEEPHQ_TEAM_ID")
    if env_val:
        return int(env_val)

    resp = get_v1_teams.sync_detailed(client=client)
    if resp.status_code != 200 or not resp.parsed:
        raise RuntimeError(f"Failed to list teams: HTTP {resp.status_code}")

    teams = resp.parsed
    if not teams:
        raise RuntimeError("No teams found on this SleepHQ account")

    # Use first team; most users have exactly one
    team = teams[0]
    return _attr(team, "id", "team_id")


def resolve_machine_id(client: AuthenticatedClient, team_id: int) -> int:
    """Return the machine ID from env or auto-resolve via the API."""
    env_val = os.environ.get("SLEEPHQ_MACHINE_ID")
    if env_val:
        return int(env_val)

    resp = get_v1_teams_team_id_machines.sync_detailed(
        team_id=team_id, client=client
    )
    if resp.status_code != 200 or not resp.parsed:
        raise RuntimeError(f"Failed to list machines: HTTP {resp.status_code}")

    machines = resp.parsed
    if not machines:
        raise RuntimeError("No machines found for this team")

    machine = machines[0]
    return _attr(machine, "id", "machine_id")


# ---------------------------------------------------------------------------
# Data fetching
# ---------------------------------------------------------------------------

def fetch_machine_dates(
    client: AuthenticatedClient,
    machine_id: int,
    from_date: Optional[date] = None,
    to_date: Optional[date] = None,
    days: int = 30,
) -> list:
    """
    Fetch paginated machine_dates records from the SleepHQ API.

    If neither from_date nor to_date is given, fetches the last `days` days.
    Returns a flat list of machine_date objects.
    """
    if from_date is None:
        to_date = to_date or date.today()
        from_date = to_date - timedelta(days=days)

    to_date = to_date or date.today()

    all_records = []
    page = 1

    while True:
        resp = get_v1_machines_machine_id_machine_dates.sync_detailed(
            machine_id=machine_id,
            client=client,
            start_date=from_date.isoformat(),
            end_date=to_date.isoformat(),
            page=page,
        )

        if resp.status_code != 200:
            raise RuntimeError(
                f"machine_dates fetch failed: HTTP {resp.status_code}"
            )

        parsed = resp.parsed
        if parsed is None:
            break

        # Normalise: response may be a list directly or wrapped in .data
        records = _attr_safe(parsed, "data") or (parsed if isinstance(parsed, list) else [])
        if not records:
            break

        all_records.extend(records)

        # Pagination: stop when we receive fewer records than a full page
        # or when meta.next_page is None
        meta = _attr_safe(parsed, "meta")
        if meta:
            next_page = _attr_safe(meta, "next_page")
            if not next_page:
                break
        elif len(records) < 25:
            # No meta; fall back to heuristic
            break

        page += 1

    return all_records


# ---------------------------------------------------------------------------
# Field mapping
# ---------------------------------------------------------------------------

def _attr(obj, *names, default=None):
    """Return the first attribute in `names` that exists and is not None."""
    for name in names:
        val = getattr(obj, name, None)
        if val is not None:
            return val
        # Some generated clients nest data under .attributes
        attrs = getattr(obj, "attributes", None)
        if attrs is not None:
            val = getattr(attrs, name, None)
            if val is not None:
                return val
    return default


def _attr_safe(obj, name, default=None):
    """Return obj.name if it exists, else default."""
    return getattr(obj, name, default)


def map_machine_date_to_session(record, user_id: str) -> dict:
    """
    Map a SleepHQ machine_date record to the dict expected by
    db.upsert_session().  Field names are tried in priority order to
    handle minor schema variations across sleephq-client versions.
    """
    record_id = _attr(record, "id", "record_id")
    session_id = f"sleephq-{record_id}"

    # Date — ISO string ("2025-03-15") or a date object
    raw_date = _attr(record, "date", "session_date", "calendar_date")
    if isinstance(raw_date, str):
        folder_date = date.fromisoformat(raw_date)
    elif isinstance(raw_date, date):
        folder_date = raw_date
    else:
        folder_date = None

    # Start datetime
    raw_start = _attr(record, "start_time", "session_start", "starts_at")
    if isinstance(raw_start, str):
        start_datetime = datetime.fromisoformat(raw_start.replace("Z", "+00:00"))
    elif isinstance(raw_start, datetime):
        start_datetime = raw_start
    else:
        start_datetime = (
            datetime(folder_date.year, folder_date.month, folder_date.day)
            if folder_date
            else None
        )

    # Duration — may be in seconds or minutes depending on API version
    duration_raw = _attr(record, "duration", "session_duration", "total_duration")
    duration_seconds = None
    if duration_raw is not None:
        duration_seconds = int(duration_raw)
        # Heuristic: durations > 86400 are probably in ms; < 600 probably in minutes
        if duration_seconds > 86400:
            duration_seconds //= 1000
        elif duration_seconds < 600:
            duration_seconds *= 60

    # AHI
    ahi = _attr(record, "ahi", "apnea_hypopnea_index")
    try:
        ahi = round(float(ahi), 2) if ahi is not None else None
    except (TypeError, ValueError):
        ahi = None

    # Event counts
    def _int(val):
        try:
            return int(val) if val is not None else None
        except (TypeError, ValueError):
            return None

    ca  = _int(_attr(record, "central_apnea_count", "central_apneas",  "ca_count"))
    oa  = _int(_attr(record, "obstructive_apnea_count", "obstructive_apneas", "oa_count"))
    h   = _int(_attr(record, "hypopnea_count", "hypopneas"))
    a   = _int(_attr(record, "apnea_count",    "apneas"))
    ar  = _int(_attr(record, "arousal_count",  "arousals"))

    total_ahi_events = _int(_attr(record, "total_ahi_events"))
    if total_ahi_events is None:
        counts = [ca, oa, h, a]
        if any(c is not None for c in counts):
            total_ahi_events = sum(c for c in counts if c is not None)

    # Pressures / ventilation
    def _float(val, ndigits=4):
        try:
            return round(float(val), ndigits) if val is not None else None
        except (TypeError, ValueError):
            return None

    avg_pressure = _float(_attr(record, "avg_pressure",  "average_pressure",   "median_pressure"))
    p95_pressure = _float(_attr(record, "p95_pressure",  "pressure_95",        "p95"))
    avg_leak     = _float(_attr(record, "avg_leak",      "average_leak",       "leak"))
    avg_resp_rate = _float(_attr(record, "avg_resp_rate", "average_resp_rate", "resp_rate"))
    avg_tidal_vol = _float(_attr(record, "avg_tidal_vol", "tidal_volume",      "tidal_vol"))
    avg_min_vent  = _float(_attr(record, "avg_min_vent",  "minute_ventilation", "min_vent"))
    avg_snore     = _float(_attr(record, "avg_snore",     "snore_index",        "snore"))
    avg_flow_lim  = _float(_attr(record, "avg_flow_lim",  "flow_limitation",   "flow_lim"))

    # Device serial
    device_serial = _attr(record, "device_serial", "serial_number", "device_id")
    if device_serial is not None:
        device_serial = str(device_serial)

    return {
        "session_id":              session_id,
        "folder_date":             folder_date,
        "block_index":             0,
        "start_datetime":          start_datetime,
        "pld_start_datetime":      start_datetime,
        "duration_seconds":        duration_seconds,
        "device_serial":           device_serial,
        "ahi":                     ahi,
        "central_apnea_count":     ca,
        "obstructive_apnea_count": oa,
        "hypopnea_count":          h,
        "apnea_count":             a,
        "arousal_count":           ar,
        "total_ahi_events":        total_ahi_events,
        "avg_pressure":            avg_pressure,
        "p95_pressure":            p95_pressure,
        "avg_leak":                avg_leak,
        "avg_resp_rate":           avg_resp_rate,
        "avg_tidal_vol":           avg_tidal_vol,
        "avg_min_vent":            avg_min_vent,
        "avg_snore":               avg_snore,
        "avg_flow_lim":            avg_flow_lim,
        "has_spo2":                False,
        "user_id":                 user_id,
    }


# ---------------------------------------------------------------------------
# Persistence
# ---------------------------------------------------------------------------

def persist_sessions(
    conn,
    records: list,
    user_id: str,
    skip_existing: bool = True,
    dry_run: bool = False,
) -> dict:
    """
    Upsert mapped session records into Postgres.

    Returns a stats dict: {"inserted": N, "updated": N, "skipped": N, "errors": N}
    """
    stats = {"inserted": 0, "updated": 0, "skipped": 0, "errors": 0}

    for record in records:
        try:
            session_data = map_machine_date_to_session(record, user_id)
            sid = session_data["session_id"]

            exists = session_exists(conn, user_id, sid)

            if exists and skip_existing:
                print(f"  SKIP {sid}: already imported")
                stats["skipped"] += 1
                continue

            if dry_run:
                action = "UPDATE (dry)" if exists else "INSERT (dry)"
                print(f"  {action} {sid}")
                if exists:
                    stats["updated"] += 1
                else:
                    stats["inserted"] += 1
                continue

            upsert_session(conn, session_data)
            conn.commit()

            action = "UPDATE" if exists else "INSERT"
            print(f"  {action} {sid}")
            if exists:
                stats["updated"] += 1
            else:
                stats["inserted"] += 1

        except Exception as e:
            conn.rollback()
            record_id = _attr_safe(record, "id") or "?"
            print(f"  ERROR sleephq-{record_id}: {e}")
            stats["errors"] += 1

    return stats


# ---------------------------------------------------------------------------
# Main pipeline
# ---------------------------------------------------------------------------

def run_sleephq_import(
    user_id: str,
    days: int = 30,
    from_date: Optional[date] = None,
    to_date: Optional[date] = None,
    skip_existing: bool = True,
    dry_run: bool = False,
    client_id: Optional[str] = None,
    client_secret: Optional[str] = None,
    team_id: Optional[int] = None,
    machine_id: Optional[int] = None,
) -> dict:
    """
    Full SleepHQ → Postgres pipeline.

    Returns stats dict: {"inserted": N, "updated": N, "skipped": N, "errors": N}

    Credentials are read from the environment unless explicitly passed.
    Callers that manage per-user creds (e.g. the server-path importer)
    should inject them via client_id / client_secret rather than
    mutating os.environ directly.
    """
    # Temporarily override env vars if explicit creds provided
    _orig = {}
    if client_id:
        _orig["SLEEPHQ_CLIENT_ID"] = os.environ.get("SLEEPHQ_CLIENT_ID")
        os.environ["SLEEPHQ_CLIENT_ID"] = client_id
    if client_secret:
        _orig["SLEEPHQ_CLIENT_SECRET"] = os.environ.get("SLEEPHQ_CLIENT_SECRET")
        os.environ["SLEEPHQ_CLIENT_SECRET"] = client_secret
    if team_id:
        _orig["SLEEPHQ_TEAM_ID"] = os.environ.get("SLEEPHQ_TEAM_ID")
        os.environ["SLEEPHQ_TEAM_ID"] = str(team_id)
    if machine_id:
        _orig["SLEEPHQ_MACHINE_ID"] = os.environ.get("SLEEPHQ_MACHINE_ID")
        os.environ["SLEEPHQ_MACHINE_ID"] = str(machine_id)

    try:
        client = create_sleephq_client()
        resolved_team_id = resolve_team_id(client)
        resolved_machine_id = resolve_machine_id(client, resolved_team_id)

        print(
            f"SleepHQ import: team={resolved_team_id} "
            f"machine={resolved_machine_id} user={user_id}"
        )

        records = fetch_machine_dates(
            client,
            machine_id=resolved_machine_id,
            from_date=from_date,
            to_date=to_date,
            days=days,
        )
        print(f"  Fetched {len(records)} record(s) from SleepHQ")

        if not records:
            return {"inserted": 0, "updated": 0, "skipped": 0, "errors": 0}

        conn = get_conn()
        try:
            stats = persist_sessions(
                conn,
                records,
                user_id,
                skip_existing=skip_existing,
                dry_run=dry_run,
            )
        finally:
            conn.close()

    finally:
        # Restore original environment
        for key, original_val in _orig.items():
            if original_val is None:
                os.environ.pop(key, None)
            else:
                os.environ[key] = original_val

    print(
        f"Done. inserted={stats['inserted']} updated={stats['updated']} "
        f"skipped={stats['skipped']} errors={stats['errors']}"
    )
    return stats


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------

def _parse_args():
    parser = argparse.ArgumentParser(
        description="Import SleepHQ session history into the sleeplab database"
    )
    parser.add_argument(
        "--user-id", required=True, dest="user_id",
        help="User UUID to associate sessions with"
    )

    date_group = parser.add_mutually_exclusive_group()
    date_group.add_argument(
        "--days", type=int, default=30,
        help="Number of past days to fetch (default: 30)"
    )
    date_group.add_argument(
        "--from", dest="from_date", metavar="YYYY-MM-DD",
        help="Start of date range (inclusive)"
    )

    parser.add_argument(
        "--to", dest="to_date", metavar="YYYY-MM-DD",
        help="End of date range (inclusive, default: today)"
    )
    parser.add_argument(
        "--dry-run", action="store_true",
        help="Fetch and map records but do not write to the database"
    )
    parser.add_argument(
        "--force", action="store_true",
        help="Overwrite existing sessions instead of skipping them"
    )
    return parser.parse_args()


def main():
    args = _parse_args()

    from_date = date.fromisoformat(args.from_date) if args.from_date else None
    to_date   = date.fromisoformat(args.to_date)   if args.to_date   else None

    run_sleephq_import(
        user_id=args.user_id,
        days=args.days,
        from_date=from_date,
        to_date=to_date,
        skip_existing=not args.force,
        dry_run=args.dry_run,
    )


if __name__ == "__main__":
    main()
