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
import random
import sys
import time
from datetime import date, datetime, timedelta
from typing import Optional

import httpx

from sleephq import AuthenticatedClient
from sleephq.auth import create_client as _sleephq_create_client
from sleephq.api.machine_dates import get_v1_machines_machine_id_machine_dates
from sleephq.api.teams import get_v1_teams
from sleephq.api.machines import get_v1_teams_team_id_machines

from db import get_conn, session_exists, upsert_session


# ---------------------------------------------------------------------------
# Rate-limit / retry helpers
# ---------------------------------------------------------------------------

#: HTTP status codes that warrant a retry with backoff.
_RETRY_STATUSES = {429, 500, 502, 503, 504}

#: Maximum number of attempts before giving up (1 original + N-1 retries).
_MAX_ATTEMPTS = 8

#: Base delay in seconds for exponential backoff.
_BASE_DELAY = 2.0

#: Hard cap on a single wait interval.
_MAX_DELAY = 300.0  # 5 minutes

#: Polite pause between successive paginated API requests.
_PAGE_DELAY = 1.5  # seconds


def _backoff_delay(attempt: int, retry_after_header: Optional[str] = None) -> float:
    """
    Return how many seconds to wait before the next attempt.

    Prefers the ``Retry-After`` header value when present.  Otherwise uses
    full-jitter exponential backoff:  random(0, min(base * 2^attempt, cap)).
    """
    if retry_after_header:
        try:
            return max(1.0, float(retry_after_header))
        except (TypeError, ValueError):
            pass
    cap = min(_BASE_DELAY * (2 ** attempt), _MAX_DELAY)
    return random.uniform(0, cap)


def _api_call_with_retry(fn, *args, label: str = "API call", **kwargs):
    """
    Call ``fn(*args, **kwargs)`` and retry on transient / rate-limit errors.

    ``fn`` must return an httpx-style response object with a ``status_code``
    attribute and a ``headers`` mapping (i.e. the ``Response`` type returned
    by sleephq-client ``sync_detailed`` functions).

    Raises ``RuntimeError`` if all attempts are exhausted.
    """
    last_resp = None
    for attempt in range(_MAX_ATTEMPTS):
        last_resp = fn(*args, **kwargs)
        if last_resp.status_code not in _RETRY_STATUSES:
            return last_resp

        retry_after = None
        if hasattr(last_resp, "headers") and last_resp.headers:
            retry_after = last_resp.headers.get("Retry-After")

        wait = _backoff_delay(attempt, retry_after)
        print(
            f"  [{label}] HTTP {last_resp.status_code} — "
            f"waiting {wait:.1f}s before retry {attempt + 1}/{_MAX_ATTEMPTS - 1}…",
            file=sys.stderr,
        )
        time.sleep(wait)

    # Return the last response; caller decides whether to raise or continue.
    return last_resp


# ---------------------------------------------------------------------------
# Client / authentication
# ---------------------------------------------------------------------------

def create_sleephq_client(
    client_id: Optional[str] = None,
    client_secret: Optional[str] = None,
) -> AuthenticatedClient:
    """
    Authenticate with SleepHQ via OAuth2 and return an authenticated client.

    Retries up to ``_MAX_ATTEMPTS`` times on HTTP 429 (rate limit) with
    exponential back-off, honouring the ``Retry-After`` header when present.
    """
    cid = client_id or os.environ["SLEEPHQ_CLIENT_ID"]
    csecret = client_secret or os.environ["SLEEPHQ_CLIENT_SECRET"]

    last_exc: Optional[Exception] = None
    for attempt in range(_MAX_ATTEMPTS):
        try:
            return _sleephq_create_client(client_id=cid, client_secret=csecret)
        except httpx.HTTPStatusError as exc:
            if exc.response.status_code not in _RETRY_STATUSES:
                raise
            retry_after = exc.response.headers.get("Retry-After")
            wait = _backoff_delay(attempt, retry_after)
            print(
                f"  [auth] HTTP {exc.response.status_code} — "
                f"waiting {wait:.1f}s before retry {attempt + 1}/{_MAX_ATTEMPTS - 1}…",
                file=sys.stderr,
            )
            time.sleep(wait)
            last_exc = exc

    raise RuntimeError(
        f"SleepHQ authentication failed after {_MAX_ATTEMPTS} attempts"
    ) from last_exc


# ---------------------------------------------------------------------------
# ID resolution helpers
# ---------------------------------------------------------------------------

def resolve_team_id(client: AuthenticatedClient) -> int:
    """Return the team ID from env or auto-resolve via the API."""
    env_val = os.environ.get("SLEEPHQ_TEAM_ID")
    if env_val:
        return int(env_val)

    resp = _api_call_with_retry(
        get_v1_teams.sync_detailed, client=client, label="GET /teams"
    )
    if resp.status_code != 200 or not resp.parsed:
        raise RuntimeError(f"Failed to list teams: HTTP {resp.status_code}")

    items = getattr(resp.parsed, "data", None) or []
    if not items:
        raise RuntimeError("No teams found on this SleepHQ account")

    return int(items[0].id)


def resolve_machine_id(client: AuthenticatedClient, team_id: int) -> int:
    """Return the machine ID from env or auto-resolve via the API."""
    env_val = os.environ.get("SLEEPHQ_MACHINE_ID")
    if env_val:
        return int(env_val)

    resp = _api_call_with_retry(
        get_v1_teams_team_id_machines.sync_detailed,
        team_id=team_id,
        client=client,
        label=f"GET /teams/{team_id}/machines",
    )
    if resp.status_code != 200 or not resp.parsed:
        raise RuntimeError(f"Failed to list machines: HTTP {resp.status_code}")

    items = getattr(resp.parsed, "data", None) or []
    if not items:
        raise RuntimeError("No machines found for this team")

    return int(items[0].id)


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
    Fetch machine_dates records from the SleepHQ API, filtered to a date range.

    The API returns records sorted DESC (newest first) with no server-side date
    filter.  We paginate through all pages, applying client-side date filtering,
    and stop as soon as we reach a record older than ``from_date``.

    Each page request is retried automatically on 429 / transient 5xx with
    exponential back-off (see ``_api_call_with_retry``).  A short polite pause
    (``_PAGE_DELAY``) is inserted between successive pages so we don't saturate
    the API when importing long histories.

    If neither from_date nor to_date is given, fetches the last ``days`` days.
    Returns a flat list of machine_date items (JSON:API data items).
    """
    from sleephq.types import Unset

    if from_date is None:
        to_date = to_date or date.today()
        from_date = to_date - timedelta(days=days)

    to_date = to_date or date.today()

    span_days = (to_date - from_date).days
    print(
        f"  Fetching machine_dates for machine {machine_id}: "
        f"{from_date} → {to_date} ({span_days} days)"
    )

    all_records: list = []
    page = 1

    while True:
        if page > 1:
            time.sleep(_PAGE_DELAY)

        resp = _api_call_with_retry(
            get_v1_machines_machine_id_machine_dates.sync_detailed,
            machine_id=machine_id,
            client=client,
            page=page,
            label=f"GET machine_dates page {page}",
        )

        if resp.status_code != 200:
            raise RuntimeError(
                f"machine_dates fetch failed on page {page}: HTTP {resp.status_code}"
            )

        parsed = resp.parsed
        if parsed is None:
            break

        records = getattr(parsed, "data", None)
        if not records or isinstance(records, Unset):
            break

        page_kept = 0
        reached_start = False

        for rec in records:
            rec_attrs = getattr(rec, "attributes", None)
            rec_date  = getattr(rec_attrs, "date", None) if rec_attrs else None
            if isinstance(rec_date, Unset):
                rec_date = None

            if isinstance(rec_date, str):
                try:
                    rec_date = date.fromisoformat(rec_date)
                except ValueError:
                    rec_date = None

            # No date on record — include it and keep going
            if rec_date is None:
                all_records.append(rec)
                page_kept += 1
                continue

            # Sorted DESC: skip anything newer than our window
            if rec_date > to_date:
                continue

            # Past the start of our window — no need to fetch further pages
            if rec_date < from_date:
                reached_start = True
                break

            all_records.append(rec)
            page_kept += 1

        print(
            f"    page {page}: {len(records)} records returned, "
            f"{page_kept} in window, {len(all_records)} total so far"
        )

        if reached_start or len(records) < 100:
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


def _sub(summary_obj, *keys, default=None):
    """
    Read a value from a JSON:API summary sub-object (ahi_summary,
    pressure_summary, etc.).  These are schema-less bags stored in
    .additional_properties, so dict-style access is required.
    """
    if summary_obj is None:
        return default
    from sleephq.types import Unset
    if isinstance(summary_obj, Unset):
        return default
    props = getattr(summary_obj, "additional_properties", {}) or {}
    for key in keys:
        val = props.get(key)
        if val is not None:
            return val
    return default


def map_machine_date_to_session(record, user_id: str) -> dict:
    """
    Map a SleepHQ machine_date record (JSON:API format) to the dict
    expected by db.upsert_session().

    The record has:
      record.id                  — string record ID
      record.attributes.date     — date object
      record.attributes.usage    — int (seconds of usage)
      record.attributes.*_summary — dict-bag via .additional_properties
    """
    from sleephq.types import Unset

    record_id = record.id if not isinstance(getattr(record, "id", None), Unset) else None
    session_id = f"sleephq-{record_id}"

    attrs = record.attributes if not isinstance(getattr(record, "attributes", None), Unset) else None

    # ── Date ────────────────────────────────────────────────────────────────
    raw_date = getattr(attrs, "date", None) if attrs else None
    if isinstance(raw_date, Unset):
        raw_date = None
    if isinstance(raw_date, str):
        folder_date = date.fromisoformat(raw_date)
    elif isinstance(raw_date, date):
        folder_date = raw_date
    else:
        folder_date = None

    # ── Start datetime ───────────────────────────────────────────────────────
    # SleepHQ doesn't expose a start_time on machine_dates; use midnight of
    # the session date as a reasonable default.
    start_datetime = (
        datetime(folder_date.year, folder_date.month, folder_date.day)
        if folder_date
        else None
    )

    # ── Duration ─────────────────────────────────────────────────────────────
    # attributes.usage is confirmed to be in seconds (e.g. 27960 = ~7.8 h).
    usage_raw = getattr(attrs, "usage", None) if attrs else None
    duration_seconds = None
    if usage_raw is not None and not isinstance(usage_raw, Unset):
        try:
            duration_seconds = int(usage_raw)
        except (TypeError, ValueError):
            pass

    def _float(val, ndigits=4):
        try:
            return round(float(val), ndigits) if val is not None else None
        except (TypeError, ValueError):
            return None

    def _int(val):
        try:
            return int(round(float(val))) if val is not None else None
        except (TypeError, ValueError):
            return None

    # ── AHI summary ──────────────────────────────────────────────────────────
    # Keys confirmed from live API: total, hypopnea, all_apnea, clear_airway,
    # obstructive_apnea, unidentified_apnea.
    # Values are per-hour indices (not raw counts).  We derive counts by
    # multiplying the index by session duration in hours.
    ahi_s = getattr(attrs, "ahi_summary", None) if attrs else None

    ahi = _float(_sub(ahi_s, "total"), 2)

    duration_hours = (duration_seconds / 3600.0) if duration_seconds else None

    def _index_to_count(index_val):
        """Convert a per-hour event index to an integer count."""
        if index_val is None or duration_hours is None:
            return None
        return _int(float(index_val) * duration_hours)

    ca = _index_to_count(_sub(ahi_s, "clear_airway"))
    oa = _index_to_count(_sub(ahi_s, "obstructive_apnea"))
    h  = _index_to_count(_sub(ahi_s, "hypopnea"))
    # all_apnea covers obstructive + unidentified; store as the generic apnea count
    a  = _index_to_count(_sub(ahi_s, "all_apnea"))
    ar = None  # not present in machine_dates

    total_ahi_events = _index_to_count(_sub(ahi_s, "total"))
    # If we got a total index but no individual counts, total is still useful
    if total_ahi_events is None and ahi is not None and duration_hours is not None:
        total_ahi_events = _int(ahi * duration_hours)

    # ── Pressure summary ─────────────────────────────────────────────────────
    # Confirmed keys: av (mean), med (median), upper (95th percentile), max, min
    pres_s = getattr(attrs, "pressure_summary", None) if attrs else None
    avg_pressure = _float(_sub(pres_s, "av"))
    p95_pressure = _float(_sub(pres_s, "upper"))

    # ── Leak rate summary ────────────────────────────────────────────────────
    # Confirmed keys: av, med, upper, max, min, score
    leak_s = getattr(attrs, "leak_rate_summary", None) if attrs else None
    avg_leak = _float(_sub(leak_s, "av"))

    # ── Respiratory rate summary ─────────────────────────────────────────────
    # Confirmed keys: av, med, upper, max, min
    rr_s = getattr(attrs, "resp_rate_summary", None) if attrs else None
    avg_resp_rate = _float(_sub(rr_s, "av"))

    # ── Flow limitation summary ──────────────────────────────────────────────
    # Confirmed keys: av, med, upper, max, min
    fl_s = getattr(attrs, "flow_limit_summary", None) if attrs else None
    avg_flow_lim = _float(_sub(fl_s, "av"))

    # ── SpO2 / pulse summary ─────────────────────────────────────────────────
    # Returns empty dict for most machines; has_spo2 = True only if non-empty
    spo2_s = getattr(attrs, "spo2_summary", None) if attrs else None
    has_spo2 = bool(
        spo2_s is not None
        and not isinstance(spo2_s, Unset)
        and getattr(spo2_s, "additional_properties", {})
    )

    # Fields not present in machine_dates (no per-session waveform summaries)
    avg_tidal_vol = None
    avg_min_vent  = None
    avg_snore     = None

    # ── Device serial ────────────────────────────────────────────────────────
    # Not present on machine_dates; would need to join against the machine record
    device_serial = None

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
        "has_spo2":                has_spo2,
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
