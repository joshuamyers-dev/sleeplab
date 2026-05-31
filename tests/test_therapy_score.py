from api.therapy_score import compute_therapy_score, grade_for_score


def _session(**overrides):
    data = {
        "ahi": 2.0,
        "avg_leak": 0.1,
        "duration_seconds": 8 * 3600,
        "has_spo2": True,
        "avg_spo2": 96.0,
        "min_spo2": 93.0,
        "manufacturer": "ResMed",
        "parser_validated": True,
    }
    data.update(overrides)
    return data


def test_resmed_session_with_normal_validated_data_scores_high():
    score = compute_therapy_score(_session())

    assert score.total >= 90
    assert score.grade == "A"
    assert score.low_confidence is False
    assert score.components.ahi is not None
    assert score.components.leak is not None
    assert score.components.duration is not None
    assert score.components.spo2 is not None


def test_resmed_large_leak_reduces_leak_component():
    score = compute_therapy_score(_session(avg_leak=0.8, ahi=8.0))

    assert score.components.leak is not None
    assert score.components.leak.score < score.components.leak.max_score
    assert "Large leak" in score.callout


def test_unvalidated_parser_sets_low_confidence_but_still_scores():
    score = compute_therapy_score(_session(parser_validated=False))

    assert score.total > 0
    assert score.low_confidence is True
    assert "Scoring confidence is lower" in score.callout


def test_without_spo2_redistributes_spo2_weight():
    score = compute_therapy_score(_session(has_spo2=False, avg_spo2=None, min_spo2=None))

    assert score.components.spo2 is None
    max_total = sum(
        component.max_score
        for component in [score.components.ahi, score.components.leak, score.components.duration]
        if component is not None
    )
    assert max_total == 100


def test_unavailable_leak_redistributes_leak_weight():
    score = compute_therapy_score(_session(avg_leak=None))

    assert score.components.leak is None
    assert score.components.ahi is not None
    assert score.components.duration is not None
    assert score.components.spo2 is not None
    assert score.components.ahi.max_score + score.components.duration.max_score + score.components.spo2.max_score == 100


def test_grade_mapping():
    assert grade_for_score(90) == "A"
    assert grade_for_score(80) == "B"
    assert grade_for_score(70) == "C"
    assert grade_for_score(60) == "D"
    assert grade_for_score(59) == "F"


def test_large_leak_with_low_ahi_mentions_understated_ahi():
    score = compute_therapy_score(_session(avg_leak=0.8, ahi=2.0))

    assert "low AHI may be understated" in score.callout


def test_invalid_or_null_inputs_do_not_crash():
    score = compute_therapy_score({
        "ahi": "not-a-number",
        "avg_leak": None,
        "duration_seconds": None,
        "has_spo2": True,
        "avg_spo2": None,
        "min_spo2": None,
        "manufacturer": "Unknown",
        "parser_validated": False,
    })

    assert score.total == 0
    assert score.grade == "F"
    assert score.components.ahi is None
    assert score.components.leak is None
    assert score.components.duration is None
    assert score.components.spo2 is None
