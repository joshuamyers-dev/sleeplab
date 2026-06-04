import sys
from dataclasses import dataclass
from datetime import UTC, date, datetime, timedelta
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "importer"))

import db as importer_db
import import_sessions


@dataclass
class FakeSignal:
    label: str
    num_samples_per_record: int


@dataclass
class FakeHeader:
    start_datetime: datetime
    num_records: int = 1
    duration_per_record: float = 60.0
    device_serial: str = "SN123"

    @property
    def signals(self):
        return [FakeSignal("Flow.40ms", 60), FakeSignal("Press.40ms", 60)]


class FakeCursor:
    def __init__(self, rows=None):
        self.rows = list(rows or [])
        self.statements = []

    def execute(self, sql, params=None):
        self.statements.append((sql, params))

    def fetchone(self):
        return self.rows.pop(0) if self.rows else None

    def __enter__(self):
        return self

    def __exit__(self, *_args):
        return False


class FakeConn:
    def __init__(self, rows=None):
        self.cursor_obj = FakeCursor(rows)
        self.commits = 0
        self.rollbacks = 0

    def cursor(self):
        return self.cursor_obj

    def commit(self):
        self.commits += 1

    def rollback(self):
        self.rollbacks += 1


def test_dedupe_events_preserves_zero_duration_arousal():
    events = [
        (10.0, 0.0, "Arousal"),
        (10.0, 0.0, "Arousal"),
        (20.0, 10.0, "Central Apnea"),
        (20.0, 10.0, "Central Apnea"),
    ]

    assert import_sessions.dedupe_events(events) == [
        (10.0, 0.0, "Arousal"),
        (20.0, 10.0, "Central Apnea"),
    ]


def test_replace_session_events_dedupes_before_insert_and_keeps_zero_duration(monkeypatch):
    inserted = []

    def fake_execute_values(_cur, _sql, rows, **_kwargs):
        inserted.extend(rows)

    monkeypatch.setattr(importer_db.psycopg2.extras, "execute_values", fake_execute_values)

    importer_db.replace_session_events(
        FakeConn(),
        123,
        [(10.0, 0.0, "Arousal"), (10.0, 0.0, "Arousal")],
        datetime(2026, 6, 2, 4, 0, tzinfo=UTC),
    )

    assert len(inserted) == 1
    assert inserted[0][3] == 0.0


def test_replace_session_waveform_uses_absolute_event_time(monkeypatch):
    inserted = []

    def fake_execute_values(_cur, _sql, rows, **_kwargs):
        inserted.extend(rows)

    monkeypatch.setattr(importer_db.psycopg2.extras, "execute_values", fake_execute_values)

    csl_start = datetime(2026, 6, 2, 4, 20, tzinfo=UTC)
    waveform_start = csl_start + timedelta(seconds=20)
    importer_db.replace_session_waveform(
        FakeConn(),
        123,
        FakeHeader(waveform_start),
        {"Flow.40ms": [float(i) for i in range(60)], "Press.40ms": [10.0 for _ in range(60)]},
        [(25.0, 10.0, "Central Apnea")],
        before_seconds=2,
        after_seconds=2,
        start_datetime=waveform_start,
        csl_start_datetime=csl_start,
    )

    assert inserted
    assert inserted[0][1] == waveform_start + timedelta(seconds=3)
    assert inserted[-1][1] == waveform_start + timedelta(seconds=17)


def test_import_folder_replaces_events_on_repeat_import(monkeypatch, tmp_path):
    folder = tmp_path / "20260601"
    folder.mkdir()
    for suffix in ("CSL", "EVE", "PLD", "BRP"):
        (folder / f"20260601_235949_{suffix}.edf").touch()

    event_calls = []
    waveform_calls = []

    monkeypatch.setattr(import_sessions, "_machine_tz_for_user", lambda _conn, _uid: ("UTC", UTC))
    monkeypatch.setattr(import_sessions, "parse_pld", lambda _path: (FakeHeader(datetime(2026, 6, 1, 23, 59, 49), num_records=10), {}))
    monkeypatch.setattr(
        import_sessions,
        "parse_eve",
        lambda _path: (
            FakeHeader(datetime(2026, 6, 1, 23, 59, 49)),
            [(120.0, 0.0, "Arousal"), (120.0, 0.0, "Arousal"), (180.0, 10.0, "Central Apnea")],
        ),
    )
    monkeypatch.setattr(import_sessions, "read_header", lambda _path: FakeHeader(datetime(2026, 6, 1, 23, 59, 49)))
    monkeypatch.setattr(import_sessions, "parse_brp", lambda _path: (FakeHeader(datetime(2026, 6, 1, 23, 59, 49)), {}))
    monkeypatch.setattr(import_sessions, "upsert_session", lambda _conn, _data: 123)
    monkeypatch.setattr(import_sessions, "replace_session_metrics", lambda *_args: None)
    monkeypatch.setattr(import_sessions, "replace_session_spo2", lambda *_args: None)
    monkeypatch.setattr(import_sessions, "replace_session_events", lambda _conn, _sid, events, _start: event_calls.append(events))
    monkeypatch.setattr(import_sessions, "replace_waveforms_for_block", lambda *_args: waveform_calls.append(True))

    conn = FakeConn()
    assert import_sessions.import_folder(folder, date(2026, 6, 1), conn, "user-1") == 1
    assert import_sessions.import_folder(folder, date(2026, 6, 1), conn, "user-1") == 1

    assert [len(events) for events in event_calls] == [2, 2]
    assert event_calls[0] == event_calls[1]
    assert len(waveform_calls) == 2


def test_import_folder_assigns_repeated_eve_events_to_only_matching_split_block(monkeypatch, tmp_path):
    folder = tmp_path / "20260601"
    folder.mkdir()
    (folder / "20260601_000000_CSL.edf").touch()
    (folder / "20260601_000000_EVE.edf").touch()
    for stamp in ("000000", "010000", "020000"):
        (folder / f"20260601_{stamp}_PLD.edf").touch()

    starts = {
        "20260601_000000": datetime(2026, 6, 1, 0, 0, tzinfo=None),
        "20260601_010000": datetime(2026, 6, 1, 1, 0, tzinfo=None),
        "20260601_020000": datetime(2026, 6, 1, 2, 0, tzinfo=None),
    }
    inserted_by_session = {}

    def header_for_path(path):
        stem = Path(path).stem[:15]
        return FakeHeader(starts[stem], num_records=60)

    def fake_upsert(_conn, data):
        return data["session_id"]

    def fake_replace_events(_conn, session_id, events, _start):
        inserted_by_session[session_id] = list(events)

    monkeypatch.setattr(import_sessions, "_machine_tz_for_user", lambda _conn, _uid: ("UTC", UTC))
    monkeypatch.setattr(import_sessions, "parse_pld", lambda path: (header_for_path(path), {}))
    monkeypatch.setattr(import_sessions, "read_header", header_for_path)
    monkeypatch.setattr(
        import_sessions,
        "parse_eve",
        lambda _path: (
            FakeHeader(datetime(2026, 6, 1, 0, 0)),
            [
                (90 * 60.0, 10.0, "Central Apnea"),
                (150 * 60.0, 0.0, "Arousal"),
            ],
        ),
    )
    monkeypatch.setattr(import_sessions, "upsert_session", fake_upsert)
    monkeypatch.setattr(import_sessions, "replace_session_metrics", lambda *_args: None)
    monkeypatch.setattr(import_sessions, "replace_session_spo2", lambda *_args: None)
    monkeypatch.setattr(import_sessions, "replace_waveforms_for_block", lambda *_args: None)
    monkeypatch.setattr(import_sessions, "replace_session_events", fake_replace_events)

    assert import_sessions.import_folder(folder, date(2026, 6, 1), FakeConn(), "user-1") == 3

    assert inserted_by_session["20260601_000000"] == []
    assert inserted_by_session["20260601_010000"] == [(90 * 60.0, 10.0, "Central Apnea")]
    assert inserted_by_session["20260601_020000"] == [(150 * 60.0, 0.0, "Arousal")]
