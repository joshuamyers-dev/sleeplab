from datetime import UTC, datetime

import pytest

from api.oximeter import (
    OximeterParseError,
    build_legacy_viatom_fixture,
    build_o2ring_s_fixture,
    parse_viatom_binary,
)


def test_parse_legacy_viatom_records():
    """Test parse legacy viatom records."""
    started_at = datetime(2025, 1, 15, 22, 0, 0)
    payload = build_legacy_viatom_fixture(
        signature=0x0005,
        started_at=started_at,
        duration_seconds=8,
        records=[
            (97, 61, 0, 0, 0),
            (96, 62, 0, 0, 0),
        ],
    )

    recording = parse_viatom_binary(payload, "20250115220000", "UTC")

    assert recording.started_at == datetime(2025, 1, 15, 22, 0, 0, tzinfo=UTC)
    assert recording.sample_interval_seconds == 4
    assert [sample.spo2 for sample in recording.samples] == [97, 96]
    assert [sample.pulse for sample in recording.samples] == [61, 62]


def test_parse_legacy_deduplicates_double_reported_samples():
    """Test parse legacy deduplicates double reported samples."""
    started_at = datetime(2025, 1, 15, 22, 0, 0)
    payload = build_legacy_viatom_fixture(
        signature=0x0003,
        started_at=started_at,
        duration_seconds=8,
        records=[
            (97, 61, 0, 0, 0),
            (97, 61, 0, 0, 0),
            (96, 62, 0, 0, 0),
            (96, 62, 0, 0, 0),
        ],
    )

    recording = parse_viatom_binary(payload, "20250115220000", "UTC")

    assert recording.sample_interval_seconds == 4
    assert len(recording.samples) == 2
    assert [sample.spo2 for sample in recording.samples] == [97, 96]


def test_parse_invalid_samples_as_none():
    """Test parse invalid samples as none."""
    started_at = datetime(2025, 1, 15, 22, 0, 0)
    payload = build_legacy_viatom_fixture(
        signature=0x0005,
        started_at=started_at,
        duration_seconds=8,
        records=[
            (97, 61, 0, 0, 0),
            (0xFF, 0xFF, 0xFF, 0, 0),
        ],
    )

    recording = parse_viatom_binary(payload, "20250115220000", "UTC")

    assert [sample.spo2 for sample in recording.samples] == [97, None]
    assert [sample.pulse for sample in recording.samples] == [61, None]


def test_filename_timestamp_overrides_header_timestamp():
    """Test filename timestamp overrides header timestamp."""
    payload = build_legacy_viatom_fixture(
        signature=0x0005,
        started_at=datetime(2025, 1, 15, 21, 45, 0),
        duration_seconds=4,
        records=[(97, 61, 0, 0, 0)],
    )

    recording = parse_viatom_binary(payload, "O2Ring_20250115220000", "UTC")

    assert recording.started_at == datetime(2025, 1, 15, 22, 0, 0, tzinfo=UTC)


def test_parse_o2ring_s_records():
    """Test parse o2ring s records."""
    payload = build_o2ring_s_fixture(
        records=[
            (97, 61, 0),
            (96, 63, 1),
            (0xFF, 0xFF, 0),
        ],
    )

    recording = parse_viatom_binary(payload, "20250115220000", "UTC")

    assert recording.sample_interval_seconds == 1
    assert recording.ended_at == datetime(2025, 1, 15, 22, 0, 3, tzinfo=UTC)
    assert [sample.spo2 for sample in recording.samples] == [97, 96, None]
    assert [sample.pulse for sample in recording.samples] == [61, 63, None]


def test_o2ring_s_requires_filename_timestamp():
    """Test o2ring s requires filename timestamp."""
    payload = build_o2ring_s_fixture(records=[(97, 61, 0)])

    with pytest.raises(OximeterParseError, match="timestamp"):
        parse_viatom_binary(payload, "session.bin", "UTC")
