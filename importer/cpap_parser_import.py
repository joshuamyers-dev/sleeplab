"""
Multi-manufacturer CPAP importer backed by cpap-parser.

This module is the SleepLab-side integration point for cpap-parser
(https://gitlab.com/open-cpap/cpap-parser). It handles:

  1. Manufacturer detection via ``UniversalCPAPParser``.
  2. Delegating field mapping to the first-party SleepLab adapter that
     ships inside cpap-parser (``cpap_parser.adapters.sleeplab_output``).
  3. Calling the existing DB helpers in ``importer/db.py`` to upsert
     sessions, events, metrics, and SpO2 rows.

Entry points
------------
``detect_open_cpap_layout(directory)``
    Probe whether a directory is a recognised CPAP SD-card layout.
    Returns ``True`` / ``False`` without raising.  Used by
    ``import_sessions.run_local_import()`` to decide which parsing path
    to take before committing to a full parse.

``run_open_cpap_import(user_id, datalog_path, from_date=None)``
    Parse *datalog_path* with cpap-parser and upsert all sessions into
    the DB.  Mirrors the return shape of
    ``import_sessions.run_local_import()`` so callers are interchangeable.

Relationship to cpap-parser
----------------------------
Field derivation (rate-to-count conversion, SpO2 aggregation, etc.) lives
in ``cpap_parser.adapters.sleeplab_output``, not here.  SleepLab only needs to:

  • Call ``map_directory_to_sleeplab(directory, user_id)`` to get the
    normalised dict payload.
  • Add the three provenance columns (``manufacturer``, ``data_source``,
    ``parser_validated``) that are SleepLab-specific.
  • Pass the result to ``upsert_session``, ``replace_session_events``,
    ``replace_session_metrics_cpap``, and ``replace_session_spo2_cpap``.

See: joshuamyers-dev/sleeplab#38, cpap-parser#14
"""

from __future__ import annotations

from pathlib import Path
from typing import Optional

from cpap_parser import UniversalCPAPParser  # noqa: F401
from cpap_parser import map_directory_to_sleeplab  # noqa: F401
from cpap_parser.adapters.base import UnsupportedDirectoryError  # noqa: F401

from db import (  # noqa: F401
    get_conn,
    replace_session_events,
    replace_session_metrics_cpap,
    replace_session_spo2_cpap,
    session_exists,
    upsert_session,
)


def detect_open_cpap_layout(directory: Path) -> bool:
    """Return True if open-cpap-parser recognises the directory layout.

    Calls ``UniversalCPAPParser.parse()`` with a minimal probe.  Does not
    return parsed data — use ``run_open_cpap_import`` for the full import.

    Args:
        directory: Root path of the CPAP SD card or DATALOG folder.

    Returns:
        True if a supported manufacturer layout is detected.
        False if ``UnsupportedDirectoryError`` is raised.

    Raises:
        NotADirectoryError: If *directory* does not exist.
    """
    if not directory.exists() or not directory.is_dir():
        raise NotADirectoryError(f"Not a directory: {directory}")
    try:
        UniversalCPAPParser().parse(str(directory))
        return True
    except UnsupportedDirectoryError:
        return False


def run_open_cpap_import(
    user_id: str,
    datalog_path: str,
    from_date: Optional[str] = None,
) -> dict:
    """Parse a CPAP SD-card directory and upsert all sessions into the DB.

    Mirrors the signature and return shape of
    ``import_sessions.run_local_import()`` so that callers in
    ``api/routers/import_settings.py`` are interchangeable.

    Steps:
      1. Call ``create_parser().parse(datalog_path)`` to get a
         ``CPAPDirectory`` containing all dates.
      2. Optionally filter ``daily_summaries`` by ``from_date``.
      3. Call ``map_directory_to_sleeplab(directory, user_id)`` to
         normalise the output.
      4. For each session dict in the result:
           a. Check ``session_exists()`` — skip if already imported
              (unless ``--force`` / ``skip_existing=False``).
           b. Extend the dict with SleepLab-specific columns not yet
              produced by the shared adapter:
                - ``manufacturer``     ← ``directory.machine.series``
                - ``data_source``      ← ``"open_cpap_parser"``
                - ``parser_validated`` ← ``True`` for validated manufacturers
                                         (e.g. Lowenstein, confirmed vs.
                                         OSCAR v1.7.x); ``False`` for
                                         unvalidated ones (e.g. ResMed)
                                         until pressure/event regression
                                         is confirmed. See sleeplab#38.
           c. Call ``upsert_session(conn, session_data)``.
           d. Call ``replace_session_events(conn, session_db_id, events, ...)``
              using the session's ``start_datetime`` as the epoch.
           e. Call ``replace_session_metrics(conn, session_db_id, ...)``
              if metric rows exist.
           f. Call ``replace_session_spo2(conn, session_db_id, ...)``
              if SpO2 rows exist.
           g. ``conn.commit()`` after each session.

    Args:
        user_id: SleepLab user UUID to associate all sessions with.
        datalog_path: Absolute path to the CPAP SD card root.
        from_date: Optional ``YYYYMMDD`` string; skip dates before this.

    Returns:
        Stats dict matching ``run_local_import()`` shape:
        ``{"imported": int, "folders": int, "errors": int}``

    Raises:
        FileNotFoundError: If *datalog_path* does not exist.
        UnsupportedDirectoryError: If the directory layout is unrecognised.
            Callers (``import_sessions.run_local_import()``) should catch
            this and fall through to the native ResMed EDF path.
    """
    import os
    from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

    def _localize(naive_dt):
        name = os.environ.get("MACHINE_TZ", "UTC")
        try:
            tz = ZoneInfo(name)
        except (ZoneInfoNotFoundError, KeyError, ValueError):
            tz = ZoneInfo("UTC")
        return naive_dt.replace(tzinfo=tz)

    path = Path(datalog_path)
    if not path.exists():
        raise FileNotFoundError(f"DATALOG path not found: {datalog_path}")

    directory = UniversalCPAPParser().parse(str(path))
    result = map_directory_to_sleeplab(directory, user_id)

    manufacturer = getattr(getattr(directory, "machine", None), "series", None)

    # Group events by session start: cpap-parser gives (event_type, onset, duration, session_start)
    # Localize the key here so it matches the localized start_datetime used for the DB lookup.
    events_by_start: dict = {}
    for item in result.get("events", []):
        event_type, onset, duration, session_start = item
        key = _localize(session_start) if session_start.tzinfo is None else session_start
        events_by_start.setdefault(key, []).append((onset, duration, event_type))

    conn = get_conn()
    stats = {"imported": 0, "folders": 0, "errors": 0}
    try:
        for session_dict in result.get("sessions", []):
            meta = session_dict.pop("meta", {})

            if from_date and str(session_dict.get("folder_date", "")) < from_date:
                continue

            sid = session_dict.get("session_id")
            if session_exists(conn, user_id, sid):
                continue

            # Rename SpO2 keys to match schema columns
            session_dict["avg_spo2"] = session_dict.pop("spo2_avg", None)
            session_dict["min_spo2"] = session_dict.pop("spo2_min", None)

            # Localize naive datetimes from parser
            if session_dict.get("start_datetime") and session_dict["start_datetime"].tzinfo is None:
                session_dict["start_datetime"] = _localize(session_dict["start_datetime"])
            if session_dict.get("pld_start_datetime") and session_dict["pld_start_datetime"].tzinfo is None:
                session_dict["pld_start_datetime"] = _localize(session_dict["pld_start_datetime"])

            # Provenance fields
            session_dict["manufacturer"] = manufacturer
            session_dict["data_source"] = "open_cpap_parser"
            session_dict["parser_validated"] = (
                MANUFACTURER_VALIDATED.get(manufacturer, False)
                if meta.get("validation_status") != "validated"
                else True
            )

            try:
                db_id = upsert_session(conn, session_dict)

                csl_start = session_dict["start_datetime"]
                session_events = events_by_start.get(csl_start, [])
                replace_session_events(conn, db_id, session_events, csl_start)

                metrics = result.get("metrics", [])
                if metrics:
                    replace_session_metrics_cpap(conn, db_id, metrics)

                spo2_rows = result.get("spo2", [])
                if spo2_rows:
                    replace_session_spo2_cpap(conn, db_id, spo2_rows)

                conn.commit()
                stats["imported"] += 1
                stats["folders"] += 1
            except Exception as e:
                conn.rollback()
                print(f"  ERROR {sid}: {e}", flush=True)
                stats["errors"] += 1
    finally:
        conn.close()
    return stats


# ---------------------------------------------------------------------------
# Manufacturer validation registry
# ---------------------------------------------------------------------------
# Maps ``MachineInfo.series`` values (as returned by open-cpap-parser) to
# the ``parser_validated`` boolean for the sessions table.
#
# ``True``  — community data has confirmed metric accuracy for this device.
# ``False`` — adapter is implemented but awaiting pressure/event regression
#             validation against OSCAR exports.
#
# Update this dict as manufacturers are validated.  See sleeplab#38.
#
MANUFACTURER_VALIDATED: dict[str, bool] = {
    "Lowenstein": True,    # validated against OSCAR v1.7.x
    "ResMed": False,       # implemented, awaiting validation
}
