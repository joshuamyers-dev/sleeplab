from api.wearable.base import WearablePayload, Sample, StageSample

def test_wearable_payload_is_empty_when_default():
    assert WearablePayload().is_empty()

def test_wearable_payload_not_empty_with_hr():
    p = WearablePayload(hr=[Sample(timestamp="2025-01-01T02:00:00Z", value=62.0)])
    assert not p.is_empty()
