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

from cpap_parser import map_directory_to_sleeplab  # noqa: F401
from cpap_parser.adapters.sleeplab_output import map_timeseries_to_metrics, map_timeseries_to_spo2  # noqa: F401
from cpap_parser.core import UnsupportedDirectoryError, create_parser  # noqa: F401


def _extract_metrics_from_timeseries(session) -> list[dict]:
    """Extract therapy metric rows directly from CPAPSession.timeseries.

    cpap-parser's map_timeseries_to_metrics aligns 1 Hz therapy channels
    against a 10 Hz timestamp array by array index, compressing 160 min of
    data into the first 16 min of timestamps.  When 'timestamps_low' is
    present, use it as the authoritative time axis so the full session is
    covered at 1 Hz.

    Falls back to map_timeseries_to_metrics for sessions without timestamps_low.
    """
    if session.timeseries is None:
        return map_timeseries_to_metrics(session)

    ts_dict = dict(session.timeseries)
    ts_low = ts_dict.get("timestamps_low")
    if not ts_low:
        return map_timeseries_to_metrics(session)

    mask_p = ts_dict.get("mask_pressure") or []
    leak = ts_dict.get("leak") or []
    rr = ts_dict.get("respiratory_rate") or []
    tv = ts_dict.get("tidal_volume") or []
    mv = ts_dict.get("minute_ventilation") or []

    rows = []
    for i, ts in enumerate(ts_low):
        rows.append(
            {
                "ts": float(ts),
                "mask_pressure": mask_p[i] if i < len(mask_p) else None,
                "pressure": None,
                "epr_pressure": None,
                "leak": leak[i] if i < len(leak) else None,
                "resp_rate": rr[i] if i < len(rr) else None,
                "tidal_vol": tv[i] if i < len(tv) else None,
                "min_vent": mv[i] if i < len(mv) else None,
                "snore": None,
                "flow_lim": None,
            }
        )
    return rows


def _extract_spo2_from_timeseries(session) -> list[dict]:
    """Same timestamp-alignment fix for SpO2/pulse channels."""
    if session.timeseries is None:
        return map_timeseries_to_spo2(session)

    ts_dict = dict(session.timeseries)
    ts_low = ts_dict.get("timestamps_low")
    if not ts_low:
        return map_timeseries_to_spo2(session)

    spo2 = ts_dict.get("spo2") or []
    pulse = ts_dict.get("pulse") or []

    return [
        {
            "ts": float(ts),
            "spo2": (spo2[i] if spo2[i] > 0 else None) if i < len(spo2) else None,
            "pulse": (pulse[i] if pulse[i] > 0 else None) if i < len(pulse) else None,
        }
        for i, ts in enumerate(ts_low)
    ]


from datetime import UTC  # noqa: E402

from db import (  # noqa: E402, F401
    find_or_create_machine_equipment,
    get_conn,
    replace_session_events,
    replace_session_metrics_cpap,
    replace_session_spo2_cpap,
    session_exists,
    update_session_machine_equipment,
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
        create_parser().parse(str(directory))
        return True
    except UnsupportedDirectoryError:
        return False


def run_open_cpap_import(
    user_id: str,
    datalog_path: str,
    from_date: str | None = None,
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

    directory = create_parser().parse(str(path), include_timeseries=True)
    result = map_directory_to_sleeplab(directory, user_id)

    manufacturer = getattr(getattr(directory, "machine", None), "series", None)

    from datetime import date as _date

    # Build a sorted list of (naive_start, folder_date) from the daily summaries.
    # CPAPSession.start_time is UTC+00:00 but the *numbers* represent device-local
    # time (cpap-parser doesn't apply a TZ offset to the raw device timestamps).
    # The same "local-as-UTC" convention is used by map_directory_to_sleeplab for
    # the naive start_datetime it returns.  Stripping tzinfo before comparison
    # lets us match them correctly across midnight-UTC crossings.
    _summary_starts: list[tuple] = sorted(
        (
            (
                sd["start_datetime"]
                if sd.get("start_datetime") and sd["start_datetime"].tzinfo is None
                else (sd["start_datetime"].replace(tzinfo=None) if sd.get("start_datetime") else None),
                _date.fromisoformat(str(sd["folder_date"])),
            )
            for sd in result.get("sessions", [])
            if sd.get("start_datetime") is not None and sd.get("folder_date") is not None
        ),
        key=lambda x: x[0],
    )

    def _folder_for_block(block_start_aware) -> _date | None:
        """Return the folder_date whose summary start is the latest one ≤ block start."""
        naive = block_start_aware.replace(tzinfo=None)
        fd = None
        for start, d in _summary_starts:
            if start <= naive:
                fd = d
            else:
                break
        return fd

    # Group metrics and spo2 by folder_date using cpap-parser's own grouping logic.
    # This correctly handles tail-end blocks that cross midnight UTC (e.g. a session
    # starting at 01:53 UTC that belongs to the previous night's folder_date).
    metrics_by_date: dict[_date, list] = {}
    spo2_by_date: dict[_date, list] = {}
    for s in directory.sessions:
        fd = _folder_for_block(s.start_time)
        if fd is not None:
            metrics_by_date.setdefault(fd, []).extend(_extract_metrics_from_timeseries(s))
            spo2_by_date.setdefault(fd, []).extend(_extract_spo2_from_timeseries(s))

    # Group events by folder_date so all sub-blocks of a night map to the right session.
    # cpap-parser gives (event_type, onset_s, duration_s, block_session_start) tuples where
    # block_session_start is the CPAPSession block start (not the daily-summary start).
    # We store the naive block start alongside the event so onset can be re-expressed
    # relative to the summary's csl_start during the insert loop.
    events_by_date: dict[_date, list] = {}
    event_counts_by_date: dict[_date, dict] = {}
    for item in result.get("events", []):
        event_type, onset, duration, session_start = item
        ss_aware = session_start if session_start.tzinfo is not None else session_start.replace(tzinfo=UTC)
        fd = _folder_for_block(ss_aware)
        if fd is not None:
            naive_block_start = session_start.replace(tzinfo=None)
            events_by_date.setdefault(fd, []).append((naive_block_start, onset, duration, event_type))
            cnt = event_counts_by_date.setdefault(fd, {})
            cnt[event_type] = cnt.get(event_type, 0) + 1

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

            # Null out out-of-range SpO2 values (includes INT16 sentinel ±32767 and
            # device-zeroed oximetry when no pulse-ox is connected).
            for field in ("avg_spo2", "min_spo2"):
                v = session_dict.get(field)
                if v is not None and not (0 < v <= 100):
                    session_dict[field] = None

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
                folder_date = _date.fromisoformat(str(session_dict.get("folder_date")))

                # Derive event counts / AHI from parsed events when the device summary
                # omits them (e.g. Lowenstein firmware doesn't write AHI to the file).
                if session_dict.get("total_ahi_events", 0) == 0:
                    counts = event_counts_by_date.get(folder_date, {})
                    if counts:
                        oa = counts.get("ObstructiveApnea", 0)
                        ca = counts.get("CentralApnea", 0)
                        hy = counts.get("Hypopnea", 0)
                        total = oa + ca + hy
                        session_dict["obstructive_apnea_count"] = oa
                        session_dict["central_apnea_count"] = ca
                        session_dict["hypopnea_count"] = hy
                        session_dict["apnea_count"] = oa + ca
                        session_dict["total_ahi_events"] = total
                        dur_h = (session_dict.get("duration_seconds") or 0) / 3600
                        if dur_h > 0:
                            session_dict["ahi"] = round(total / dur_h, 2)

                # Derive per-session averages from timeseries when the adapter omits them.
                metrics_for_session = metrics_by_date.get(folder_date, [])
                if metrics_for_session:
                    for _key, _col in (
                        ("avg_leak", "leak"),
                        ("avg_resp_rate", "resp_rate"),
                        ("avg_tidal_vol", "tidal_vol"),
                        ("avg_min_vent", "min_vent"),
                    ):
                        if session_dict.get(_key) is None:
                            _vals = [r[_col] for r in metrics_for_session if r.get(_col) is not None]
                            if _vals:
                                session_dict[_key] = round(sum(_vals) / len(_vals), 2)

                db_id = upsert_session(conn, session_dict)

                machine_id = find_or_create_machine_equipment(
                    conn,
                    user_id,
                    manufacturer=manufacturer,
                    device_serial=session_dict.get("device_serial"),
                    model=None,
                    parser_validated=session_dict["parser_validated"],
                )
                if machine_id is not None:
                    update_session_machine_equipment(conn, db_id, machine_id)

                csl_start = session_dict["start_datetime"]
                raw_events = events_by_date.get(folder_date, [])
                session_events = [
                    ((_localize(nb) - csl_start).total_seconds() + onset, dur, ev_type)
                    for nb, onset, dur, ev_type in raw_events
                ]
                replace_session_events(conn, db_id, session_events, csl_start)

                replace_session_metrics_cpap(conn, db_id, metrics_by_date.get(folder_date, []))
                replace_session_spo2_cpap(conn, db_id, spo2_by_date.get(folder_date, []))

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
    "Lowenstein": True,  # validated against OSCAR v1.7.x
    "ResMed": False,  # implemented, awaiting validation
}
