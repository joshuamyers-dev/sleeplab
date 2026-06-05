"""
One-shot inspector: authenticates with SleepHQ and dumps the full
attributes of the most recent machine_date record, including
machine_settings and all summary sub-objects.

Usage (env vars can also live in .env):
    cd importer
    SLEEPHQ_CLIENT_ID=... SLEEPHQ_CLIENT_SECRET=... python inspect_sleephq_fields.py

Accepts SLEEPHQ_UID / SLEEPHQ_SECRET as aliases for the _CLIENT_ variants
so the existing .env works without renaming.
"""

import json
import os
import sys
from datetime import date, timedelta

import db  # noqa: F401 — loads .env as side-effect

# Accept either naming convention
_id = os.environ.get("SLEEPHQ_CLIENT_ID") or os.environ.get("SLEEPHQ_UID")
_secret = os.environ.get("SLEEPHQ_CLIENT_SECRET") or os.environ.get("SLEEPHQ_SECRET")

if not _id or not _secret:
    print("ERROR: set SLEEPHQ_CLIENT_ID/SLEEPHQ_UID and SLEEPHQ_CLIENT_SECRET/SLEEPHQ_SECRET", file=sys.stderr)
    sys.exit(1)

os.environ["SLEEPHQ_CLIENT_ID"] = _id
os.environ["SLEEPHQ_CLIENT_SECRET"] = _secret

from sleephq.api.machines import get_v1_teams_team_id_machines  # noqa: E402
from sleephq_import import create_sleephq_client, fetch_machine_dates, resolve_machine_id, resolve_team_id  # noqa: E402


def _dump(label, obj):
    if obj is None:
        print(f"  {label}: None")
        return
    props = getattr(obj, "additional_properties", None)
    if props is not None:
        print(f"  {label}: {json.dumps(props, default=str, indent=4)}")
    else:
        print(f"  {label}: {obj!r}")


print("Authenticating…")
client = create_sleephq_client(_id, _secret)
print("  OK")

team_id = resolve_team_id(client)
machine_id = resolve_machine_id(client, team_id)
print(f"  team_id={team_id}  machine_id={machine_id}")

# Fetch the machine record itself
print("\n── Machine record ──────────────────────────────────────────")
machines_resp = get_v1_teams_team_id_machines.sync(team_id=team_id, client=client)
for m in getattr(machines_resp, "data", None) or []:
    attrs = getattr(m, "attributes", None)
    if getattr(attrs, "id", None) == machine_id or str(getattr(m, "id", "")) == str(machine_id):
        print(f"  model:         {getattr(attrs, 'model', '—')}")
        print(f"  brand:         {getattr(attrs, 'brand', '—')}")
        print(f"  serial_number: {getattr(attrs, 'serial_number', '—')}")
        ms = getattr(attrs, "machine_settings", None)
        _dump("machine_settings", ms)
        break

# Fetch the most recent machine_date record
print("\n── Most recent machine_date ─────────────────────────────────")
to_date = date.today()
from_date = to_date - timedelta(days=7)
records = fetch_machine_dates(client, machine_id=machine_id, from_date=from_date, to_date=to_date)

if not records:
    print("  No records in last 7 days — trying 30 days")
    from_date = to_date - timedelta(days=30)
    records = fetch_machine_dates(client, machine_id=machine_id, from_date=from_date, to_date=to_date)

if not records:
    print("  No records found.")
    sys.exit(0)

first = records[-1]  # most recent
attrs = getattr(first, "attributes", None)
print(f"  record id: {first.id}  date: {getattr(attrs, 'date', '—')}")

ALL_SUBS = [
    "ahi_summary",
    "pressure_summary",
    "leak_rate_summary",
    "resp_rate_summary",
    "flow_limit_summary",
    "epap_summary",
    "pulse_rate_summary",
    "spo2_summary",
    "movement_summary",
    "machine_settings",
]

for sub in ALL_SUBS:
    obj = getattr(attrs, sub, None)
    _dump(sub, obj)

# Also dump any attributes we haven't covered
print("\n── Full attributes dict ─────────────────────────────────────")
if attrs:
    for key in dir(attrs):
        if key.startswith("_"):
            continue
        if key not in ALL_SUBS + ["additional_properties", "to_dict", "to_json", "from_dict", "from_json"]:
            val = getattr(attrs, key, None)
            if not callable(val):
                print(f"  {key}: {val!r}")
