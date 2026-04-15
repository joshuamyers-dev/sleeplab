"""
Test harness: fetch one month of SleepHQ history for one or more teams and
print the rows as they would be mapped into the sessions table.

No database writes are performed.

Usage:
    cd importer
    SLEEPHQ_CLIENT_ID=... SLEEPHQ_CLIENT_SECRET=... SLEEPHQ_TEAM_IDS=43940,104558 \\
        python test_sleephq_fetch.py

    # Single team — SLEEPHQ_TEAM_ID also accepted
    SLEEPHQ_CLIENT_ID=... SLEEPHQ_CLIENT_SECRET=... SLEEPHQ_TEAM_ID=43940 \\
        python test_sleephq_fetch.py

Or set the variables in .env (db.py loads it automatically) and just run:
    python test_sleephq_fetch.py
"""

import os
import sys
from datetime import date, timedelta


def _load_users_from_env() -> list[dict]:
    """
    Build a per-team user list from environment variables.

    Reads SLEEPHQ_TEAM_IDS (comma-separated) or falls back to SLEEPHQ_TEAM_ID.
    Each team gets a generic placeholder user_id of the form "test-team-<id>".
    """
    raw = os.environ.get("SLEEPHQ_TEAM_IDS") or os.environ.get("SLEEPHQ_TEAM_ID", "")
    team_ids = [t.strip() for t in raw.split(",") if t.strip()]
    if not team_ids:
        return []
    return [
        {"label": f"team-{tid}", "team_id": int(tid), "user_id": f"test-team-{tid}"}
        for tid in team_ids
    ]


DAYS = 30  # how many days of history to pull

# Columns to display in the table (subset of the full sessions schema).
# Adjust this list if you want to see more or fewer fields.
DISPLAY_COLS = [
    "session_id",
    "folder_date",
    "start_datetime",
    "duration_seconds",
    "ahi",
    "central_apnea_count",
    "obstructive_apnea_count",
    "hypopnea_count",
    "total_ahi_events",
    "avg_pressure",
    "p95_pressure",
    "avg_leak",
    "avg_resp_rate",
    "device_serial",
]

# ── Imports ──────────────────────────────────────────────────────────────────

# db.py loads .env; import it first so env vars are available
import db  # noqa: F401 (side-effect: loads .env)

from sleephq_import import (
    create_sleephq_client,
    fetch_machine_dates,
    map_machine_date_to_session,
    resolve_machine_id,
)


# ── Formatting helpers ───────────────────────────────────────────────────────

def _fmt(val) -> str:
    if val is None:
        return "—"
    if isinstance(val, float):
        return f"{val:.2f}"
    return str(val)


def print_table(rows: list[dict], cols: list[str], title: str) -> None:
    """Print a fixed-width table to stdout."""
    print(f"\n{'=' * 100}")
    print(f"  {title}  ({len(rows)} row(s))")
    print(f"{'=' * 100}")

    if not rows:
        print("  (no records returned)")
        return

    # Compute column widths: max of header length and data length
    widths = {c: len(c) for c in cols}
    for row in rows:
        for c in cols:
            widths[c] = max(widths[c], len(_fmt(row.get(c))))

    sep = "  ".join("-" * widths[c] for c in cols)
    header = "  ".join(c.ljust(widths[c]) for c in cols)

    print(header)
    print(sep)
    for row in rows:
        line = "  ".join(_fmt(row.get(c)).ljust(widths[c]) for c in cols)
        print(line)


# ── Main ─────────────────────────────────────────────────────────────────────

def main() -> None:
    client_id     = os.environ.get("SLEEPHQ_CLIENT_ID")
    client_secret = os.environ.get("SLEEPHQ_CLIENT_SECRET")

    if not client_id or not client_secret:
        print(
            "ERROR: SLEEPHQ_CLIENT_ID and SLEEPHQ_CLIENT_SECRET must be set "
            "in the environment or in .env",
            file=sys.stderr,
        )
        sys.exit(1)

    users = _load_users_from_env()
    if not users:
        print(
            "ERROR: set SLEEPHQ_TEAM_IDS (comma-separated) or SLEEPHQ_TEAM_ID",
            file=sys.stderr,
        )
        sys.exit(1)

    to_date   = date.today()
    from_date = to_date - timedelta(days=DAYS)
    print(f"Date range: {from_date} → {to_date}  ({DAYS} days)")

    # Authenticate once — all teams share the same OAuth app credentials.
    print("\nAuthenticating with SleepHQ…")
    try:
        shared_client = create_sleephq_client(client_id, client_secret)
        print("  OK")
    except Exception as exc:
        print(f"  Auth failed: {exc}", file=sys.stderr)
        sys.exit(1)

    for user in users:
        label   = user["label"]
        team_id = user["team_id"]
        user_id = user["user_id"]

        print(f"\n{'─' * 60}")
        print(f"Team ID: {team_id}")

        # Temporarily set SLEEPHQ_TEAM_ID so resolve_machine_id() picks it up
        os.environ["SLEEPHQ_TEAM_ID"] = str(team_id)

        try:
            client     = shared_client
            machine_id = resolve_machine_id(client, team_id)
            print(f"  machine_id resolved → {machine_id}")

            raw_records = fetch_machine_dates(
                client,
                machine_id=machine_id,
                from_date=from_date,
                to_date=to_date,
            )
            print(f"  raw records fetched: {len(raw_records)}")

            # Map every record to the sessions-table dict
            mapped = [map_machine_date_to_session(r, user_id) for r in raw_records]

            print_table(mapped, DISPLAY_COLS, f"team-{team_id} — sessions table preview")

            # Dump the raw sub-summary dicts from the first record so we can
            # validate that the field names in map_machine_date_to_session()
            # match what the API actually returns.
            if raw_records:
                first = raw_records[0]
                attrs = getattr(first, "attributes", None)
                print(f"\n  [first record id={first.id}]")
                if attrs:
                    for sub in ("ahi_summary", "pressure_summary", "leak_rate_summary",
                                "resp_rate_summary", "flow_limit_summary",
                                "pulse_rate_summary", "spo2_summary", "movement_summary"):
                        obj = getattr(attrs, sub, None)
                        if obj is not None:
                            props = getattr(obj, "additional_properties", {})
                            print(f"  {sub}: {props}")

        except Exception as exc:
            print(f"  FAILED for team-{team_id}: {exc}", file=sys.stderr)
            import traceback
            traceback.print_exc()
        finally:
            os.environ.pop("SLEEPHQ_TEAM_ID", None)


if __name__ == "__main__":
    main()
