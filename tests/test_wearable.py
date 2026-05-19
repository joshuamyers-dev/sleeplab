from api.wearable.base import WearablePayload, Sample, StageSample

def test_wearable_payload_is_empty_when_default():
    assert WearablePayload().is_empty()

def test_wearable_payload_not_empty_with_hr():
    p = WearablePayload(hr=[Sample(timestamp="2025-01-01T02:00:00Z", value=62.0)])
    assert not p.is_empty()


from unittest.mock import MagicMock, patch
from datetime import date as date_type
from api.wearable.open_wearables import OpenWearablesAdapter, _STAGE_MAP


def test_stage_map_covers_all_expected_labels():
    expected = {"awake", "light", "nrem1", "nrem2", "deep", "nrem3", "nrem4", "rem"}
    assert expected == set(_STAGE_MAP.keys())


def test_stage_map_normalises_correctly():
    assert _STAGE_MAP["awake"] == 1
    assert _STAGE_MAP["light"] == 2
    assert _STAGE_MAP["nrem1"] == 2
    assert _STAGE_MAP["nrem2"] == 2
    assert _STAGE_MAP["deep"] == 3
    assert _STAGE_MAP["nrem3"] == 3
    assert _STAGE_MAP["nrem4"] == 3
    assert _STAGE_MAP["rem"] == 4


def _make_ok_response(json_data: dict):
    r = MagicMock()
    r.status_code = 200
    r.json.return_value = json_data
    return r


def _make_error_response(status_code: int):
    import httpx
    r = MagicMock()
    r.status_code = status_code
    r.raise_for_status.side_effect = httpx.HTTPStatusError(
        "error", request=MagicMock(), response=MagicMock()
    )
    return r


def test_open_wearables_fetch_returns_normalised_payload():
    adapter = OpenWearablesAdapter(base_url="http://wearables.test", api_key="key")
    hr_resp = _make_ok_response({"samples": [{"ts": "2025-01-15T02:00:00Z", "bpm": 58.0}]})
    spo2_resp = _make_ok_response({"samples": [{"ts": "2025-01-15T02:00:00Z", "spo2_pct": 97.0}]})
    stages_resp = _make_ok_response({"epochs": [{"ts": "2025-01-15T02:00:00Z", "stage": "rem"}]})

    with patch("api.wearable.open_wearables.httpx.Client") as mock_client_cls:
        mock_client = MagicMock()
        mock_client.__enter__ = MagicMock(return_value=mock_client)
        mock_client.__exit__ = MagicMock(return_value=False)
        mock_client.get.side_effect = [hr_resp, spo2_resp, stages_resp]
        mock_client_cls.return_value = mock_client

        payload = adapter.fetch("user-123", date_type(2025, 1, 15))

    assert len(payload.hr) == 1
    assert payload.hr[0].value == 58.0
    assert len(payload.spo2) == 1
    assert payload.spo2[0].value == 97.0
    assert len(payload.stages) == 1
    assert payload.stages[0].stage == 4  # rem


def test_open_wearables_connect_error_returns_empty():
    import httpx
    adapter = OpenWearablesAdapter(base_url="http://wearables.test", api_key="key")

    with patch("api.wearable.open_wearables.httpx.Client") as mock_client_cls:
        mock_client = MagicMock()
        mock_client.__enter__ = MagicMock(return_value=mock_client)
        mock_client.__exit__ = MagicMock(return_value=False)
        mock_client.get.side_effect = httpx.ConnectError("refused")
        mock_client_cls.return_value = mock_client

        payload = adapter.fetch("user-123", date_type(2025, 1, 15))

    assert payload.is_empty()


def test_open_wearables_401_raises():
    import httpx
    adapter = OpenWearablesAdapter(base_url="http://wearables.test", api_key="bad-key")
    auth_err_resp = _make_error_response(401)
    ok_resp = _make_ok_response({"samples": []})

    with patch("api.wearable.open_wearables.httpx.Client") as mock_client_cls:
        mock_client = MagicMock()
        mock_client.__enter__ = MagicMock(return_value=mock_client)
        mock_client.__exit__ = MagicMock(return_value=False)
        mock_client.get.side_effect = [auth_err_resp, ok_resp, ok_resp]
        mock_client_cls.return_value = mock_client

        import pytest
        with pytest.raises(httpx.HTTPStatusError):
            adapter.fetch("user-123", date_type(2025, 1, 15))


from api.wearable.mirobody import MirobodyAdapter, _MIROBODY_STAGE_MAP


def test_mirobody_stage_map_normalises_correctly():
    assert _MIROBODY_STAGE_MAP["wake"] == 1
    assert _MIROBODY_STAGE_MAP["light"] == 2
    assert _MIROBODY_STAGE_MAP["deep"] == 3
    assert _MIROBODY_STAGE_MAP["rem"] == 4


def test_mirobody_connect_error_returns_empty():
    import httpx
    adapter = MirobodyAdapter(base_url="http://mirobody.test", api_key="key")

    with patch("api.wearable.mirobody.httpx.Client") as mock_client_cls:
        mock_client = MagicMock()
        mock_client.__enter__ = MagicMock(return_value=mock_client)
        mock_client.__exit__ = MagicMock(return_value=False)
        mock_client.get.side_effect = httpx.ConnectError("refused")
        mock_client_cls.return_value = mock_client

        payload = adapter.fetch("user-456", date_type(2025, 1, 15))

    assert payload.is_empty()
