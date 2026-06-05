import os
from datetime import date as date_type
from unittest.mock import MagicMock, patch
from unittest.mock import patch as _patch

import httpx
import pytest

from api.wearable.base import Sample, StageSample, WearablePayload
from api.wearable.mirobody import _MIROBODY_STAGE_MAP, MirobodyAdapter
from api.wearable.open_wearables import _STAGE_MAP, OpenWearablesAdapter
from api.wearable.registry import get_adapter


def test_wearable_payload_is_empty_when_default():
    """Test wearable payload is empty when default."""
    assert WearablePayload().is_empty()


def test_wearable_payload_not_empty_with_hr():
    """Test wearable payload not empty with hr."""
    p = WearablePayload(hr=[Sample(timestamp="2025-01-01T02:00:00Z", value=62.0)])
    assert not p.is_empty()


def test_stage_map_covers_all_expected_labels():
    """Test stage map covers all expected labels."""
    expected = {"awake", "light", "nrem1", "nrem2", "deep", "nrem3", "nrem4", "rem"}
    assert expected == set(_STAGE_MAP.keys())


def test_stage_map_normalises_correctly():
    """Test stage map normalises correctly."""
    assert _STAGE_MAP["awake"] == 1
    assert _STAGE_MAP["light"] == 2
    assert _STAGE_MAP["nrem1"] == 2
    assert _STAGE_MAP["nrem2"] == 2
    assert _STAGE_MAP["deep"] == 3
    assert _STAGE_MAP["nrem3"] == 3
    assert _STAGE_MAP["nrem4"] == 3
    assert _STAGE_MAP["rem"] == 4


def _make_ok_response(json_data: dict):
    """Test  make ok response."""
    r = MagicMock()
    r.status_code = 200
    r.json.return_value = json_data
    return r


def _make_error_response(status_code: int):
    """Test  make error response."""
    r = MagicMock()
    r.status_code = status_code
    r.raise_for_status.side_effect = httpx.HTTPStatusError("error", request=MagicMock(), response=MagicMock())
    return r


def test_open_wearables_fetch_returns_normalised_payload():
    """Test open wearables fetch returns normalised payload."""
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
    """Test open wearables connect error returns empty."""
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
    """Test open wearables 401 raises."""
    adapter = OpenWearablesAdapter(base_url="http://wearables.test", api_key="bad-key")
    auth_err_resp = _make_error_response(401)
    ok_resp = _make_ok_response({"samples": []})

    with patch("api.wearable.open_wearables.httpx.Client") as mock_client_cls:
        mock_client = MagicMock()
        mock_client.__enter__ = MagicMock(return_value=mock_client)
        mock_client.__exit__ = MagicMock(return_value=False)
        mock_client.get.side_effect = [auth_err_resp, ok_resp, ok_resp]
        mock_client_cls.return_value = mock_client

        with pytest.raises(httpx.HTTPStatusError):
            adapter.fetch("user-123", date_type(2025, 1, 15))


def test_mirobody_stage_map_normalises_correctly():
    """Test mirobody stage map normalises correctly."""
    assert _MIROBODY_STAGE_MAP["wake"] == 1
    assert _MIROBODY_STAGE_MAP["awake"] == 1
    assert _MIROBODY_STAGE_MAP["light"] == 2
    assert _MIROBODY_STAGE_MAP["nrem"] == 2
    assert _MIROBODY_STAGE_MAP["deep"] == 3
    assert _MIROBODY_STAGE_MAP["slow_wave"] == 3
    assert _MIROBODY_STAGE_MAP["rem"] == 4


def test_mirobody_connect_error_returns_empty():
    """Test mirobody connect error returns empty."""
    adapter = MirobodyAdapter(base_url="http://mirobody.test", api_key="key")

    with patch("api.wearable.mirobody.httpx.Client") as mock_client_cls:
        mock_client = MagicMock()
        mock_client.__enter__ = MagicMock(return_value=mock_client)
        mock_client.__exit__ = MagicMock(return_value=False)
        mock_client.get.side_effect = httpx.ConnectError("refused")
        mock_client_cls.return_value = mock_client

        payload = adapter.fetch("user-456", date_type(2025, 1, 15))

    assert payload.is_empty()


def test_registry_returns_open_wearables():
    """Test registry returns open wearables."""
    adapter = get_adapter("open-wearables", "http://host", "key")
    assert isinstance(adapter, OpenWearablesAdapter)


def test_registry_returns_mirobody():
    """Test registry returns mirobody."""
    adapter = get_adapter("mirobody", "http://host", "key")
    assert isinstance(adapter, MirobodyAdapter)


def test_registry_raises_on_unknown_provider():
    """Test registry raises on unknown provider."""
    with pytest.raises(ValueError, match="Unknown wearable provider"):
        get_adapter("nonexistent", "http://host", "key")


# ── endpoint tests ────────────────────────────────────────────────────────────
# These use the standard client + auth_headers fixtures from conftest.py.
# They require TEST_DATABASE_URL to be set (see conftest.py).


def test_wearable_data_no_provider_returns_empty(client, auth_headers):
    """Test wearable data no provider returns empty."""
    resp = client.get("/wearable/data", params={"date": "2025-01-15"}, headers=auth_headers)
    assert resp.status_code == 200
    body = resp.json()
    assert body["hr"] == []
    assert body["spo2"] == []
    assert body["stages"] == []


def test_wearable_data_unauthenticated(client):
    """Test wearable data unauthenticated."""
    resp = client.get("/wearable/data", params={"date": "2025-01-15"})
    assert resp.status_code == 401


def test_wearable_summary_no_provider_returns_empty(client, auth_headers):
    """Test wearable summary no provider returns empty."""
    resp = client.get(
        "/wearable/summary",
        params={"date_from": "2025-01-01", "date_to": "2025-01-03"},
        headers=auth_headers,
    )
    assert resp.status_code == 200
    assert resp.json() == []


def test_wearable_data_connect_error_returns_empty(client, auth_headers, db):
    """Test wearable data connect error returns empty."""
    from sqlalchemy import text

    # Insert wearable settings for the test user so provider is configured.
    # We need the user_id — read it from the auth token via /auth/me.
    me = client.get("/auth/me", headers=auth_headers).json()
    uid = me["user_id"]
    db.execute(
        text("""
            INSERT INTO user_import_settings
                (user_id, wearable_provider, wearable_base_url, wearable_api_key)
            VALUES (CAST(:uid AS uuid), 'open-wearables', 'http://no-such-host.test', 'key')
            ON CONFLICT (user_id) DO UPDATE
                SET wearable_provider  = EXCLUDED.wearable_provider,
                    wearable_base_url  = EXCLUDED.wearable_base_url,
                    wearable_api_key   = EXCLUDED.wearable_api_key
        """),
        {"uid": uid},
    )
    db.commit()

    with _patch("api.wearable.open_wearables.httpx.Client") as mock_cls:
        mock_c = MagicMock()
        mock_c.__enter__ = MagicMock(return_value=mock_c)
        mock_c.__exit__ = MagicMock(return_value=False)
        mock_c.get.side_effect = httpx.ConnectError("refused")
        mock_cls.return_value = mock_c

        resp = client.get("/wearable/data", params={"date": "2025-01-15"}, headers=auth_headers)

    assert resp.status_code == 200
    assert resp.json()["hr"] == []


def test_endpoint_timeout_returns_empty(client, auth_headers, db):
    """Test endpoint timeout returns empty."""
    from sqlalchemy import text

    me = client.get("/auth/me", headers=auth_headers).json()
    uid = me["user_id"]
    db.execute(
        text("""
            INSERT INTO user_import_settings
                (user_id, wearable_provider, wearable_base_url, wearable_api_key)
            VALUES (CAST(:uid AS uuid), 'open-wearables', 'http://no-such-host.test', 'key')
            ON CONFLICT (user_id) DO UPDATE
                SET wearable_provider  = EXCLUDED.wearable_provider,
                    wearable_base_url  = EXCLUDED.wearable_base_url,
                    wearable_api_key   = EXCLUDED.wearable_api_key
        """),
        {"uid": uid},
    )
    db.commit()

    with _patch("api.wearable.open_wearables.httpx.Client") as mock_cls:
        mock_c = MagicMock()
        mock_c.__enter__ = MagicMock(return_value=mock_c)
        mock_c.__exit__ = MagicMock(return_value=False)
        mock_c.get.side_effect = httpx.TimeoutException("timed out")
        mock_cls.return_value = mock_c

        resp = client.get("/wearable/data", params={"date": "2025-01-15"}, headers=auth_headers)

    assert resp.status_code == 200
    assert resp.json()["hr"] == []
    assert resp.json()["spo2"] == []
    assert resp.json()["stages"] == []


def test_endpoint_5xx_returns_empty(client, auth_headers, db):
    """Test endpoint 5xx returns empty."""
    from sqlalchemy import text

    me = client.get("/auth/me", headers=auth_headers).json()
    uid = me["user_id"]
    db.execute(
        text("""
            INSERT INTO user_import_settings
                (user_id, wearable_provider, wearable_base_url, wearable_api_key)
            VALUES (CAST(:uid AS uuid), 'open-wearables', 'http://host.test', 'key')
            ON CONFLICT (user_id) DO UPDATE
                SET wearable_provider  = EXCLUDED.wearable_provider,
                    wearable_base_url  = EXCLUDED.wearable_base_url,
                    wearable_api_key   = EXCLUDED.wearable_api_key
        """),
        {"uid": uid},
    )
    db.commit()

    with _patch("api.wearable.open_wearables.httpx.Client") as mock_cls:
        mock_c = MagicMock()
        mock_c.__enter__ = MagicMock(return_value=mock_c)
        mock_c.__exit__ = MagicMock(return_value=False)
        server_err_resp = MagicMock()
        server_err_resp.status_code = 500
        server_err_resp.raise_for_status.side_effect = httpx.HTTPStatusError(
            "500", request=MagicMock(), response=httpx.Response(500)
        )
        ok = MagicMock()
        ok.status_code = 200
        ok.json.return_value = {"samples": []}
        mock_c.get.side_effect = [server_err_resp, ok, ok]
        mock_cls.return_value = mock_c

        resp = client.get("/wearable/data", params={"date": "2025-01-15"}, headers=auth_headers)

    assert resp.status_code == 200
    assert resp.json()["hr"] == []
    assert resp.json()["spo2"] == []
    assert resp.json()["stages"] == []


def test_wearable_data_401_from_api_returns_502(client, auth_headers, db):
    """Test wearable data 401 from api returns 502."""
    from sqlalchemy import text

    me = client.get("/auth/me", headers=auth_headers).json()
    uid = me["user_id"]
    db.execute(
        text("""
            INSERT INTO user_import_settings
                (user_id, wearable_provider, wearable_base_url, wearable_api_key)
            VALUES (CAST(:uid AS uuid), 'open-wearables', 'http://host.test', 'bad-key')
            ON CONFLICT (user_id) DO UPDATE
                SET wearable_provider  = EXCLUDED.wearable_provider,
                    wearable_base_url  = EXCLUDED.wearable_base_url,
                    wearable_api_key   = EXCLUDED.wearable_api_key
        """),
        {"uid": uid},
    )
    db.commit()

    with _patch("api.wearable.open_wearables.httpx.Client") as mock_cls:
        mock_c = MagicMock()
        mock_c.__enter__ = MagicMock(return_value=mock_c)
        mock_c.__exit__ = MagicMock(return_value=False)
        auth_err = MagicMock()
        auth_err.status_code = 401
        err_response = MagicMock()
        err_response.status_code = 401
        auth_err.raise_for_status.side_effect = httpx.HTTPStatusError("401", request=MagicMock(), response=err_response)
        ok = MagicMock()
        ok.status_code = 200
        ok.json.return_value = {"samples": []}
        mock_c.get.side_effect = [auth_err, ok, ok]
        mock_cls.return_value = mock_c

        resp = client.get("/wearable/data", params={"date": "2025-01-15"}, headers=auth_headers)

    assert resp.status_code == 502


# ── _stages_to_hours unit tests ───────────────────────────────────────────────


def test_stages_to_hours_accumulates_correctly():
    """Test stages to hours accumulates correctly."""
    from api.routers.wearable import _stages_to_hours

    stages = [
        StageSample(timestamp="2025-01-01T22:00:00Z", stage=1),  # awake 1h
        StageSample(timestamp="2025-01-01T23:00:00Z", stage=2),  # light 2h
        StageSample(timestamp="2025-01-02T01:00:00Z", stage=3),  # deep 1h
        StageSample(timestamp="2025-01-02T02:00:00Z", stage=4),  # rem → 30min default
    ]
    hours = _stages_to_hours(stages)
    assert hours[1] == pytest.approx(1.0)
    assert hours[2] == pytest.approx(2.0)
    assert hours[3] == pytest.approx(1.0)
    assert hours[4] == pytest.approx(0.5)  # 30 min default


def test_wearable_disabled_returns_empty(client, auth_headers):
    """Test wearable disabled returns empty."""
    with patch.dict(os.environ, {"WEARABLE_ENABLED": "false"}):
        resp = client.get("/wearable/data?date=2025-01-15", headers=auth_headers)
    assert resp.status_code == 200
    data = resp.json()
    assert data["hr"] == []
    assert data["spo2"] == []
    assert data["stages"] == []


def test_env_default_provider_used_when_no_db_row():
    """Test env default provider used when no db row."""
    from api.routers.wearable import _get_adapter_for_user

    mock_db = MagicMock()
    mock_db.execute.return_value.mappings.return_value.first.return_value = None  # no DB row

    with patch.dict(
        os.environ,
        {
            "WEARABLE_DEFAULT_PROVIDER": "open-wearables",
            "WEARABLE_DEFAULT_BASE_URL": "http://localhost:4000",
            "WEARABLE_DEFAULT_API_KEY": "test-key",
        },
    ):
        adapter = _get_adapter_for_user("some-user-id", mock_db)

    assert adapter is not None


def test_stages_to_hours_skips_malformed_timestamps():
    """Test stages to hours skips malformed timestamps."""
    from api.routers.wearable import _stages_to_hours

    stages = [
        StageSample(timestamp="not-a-timestamp", stage=1),
        StageSample(timestamp="2025-01-01T23:00:00Z", stage=2),  # light → 30min default
    ]
    hours = _stages_to_hours(stages)
    # Malformed first sample is skipped; second sample gets 30-min default
    assert hours[1] == pytest.approx(0.0)
    assert hours[2] == pytest.approx(0.5)


def test_wearable_settings_round_trip(client, auth_headers):
    """Test wearable settings round trip."""
    resp = client.put(
        "/import/settings",
        json={
            "wearable_provider": "open-wearables",
            "wearable_base_url": "https://wearables.home.example.com",
            "wearable_api_key": "my-secret-key",
        },
        headers=auth_headers,
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["wearable_provider"] == "open-wearables"
    assert body["wearable_base_url"] == "https://wearables.home.example.com"
    assert body["wearable_api_key"] is None  # always masked


def test_wearable_api_key_not_exposed_in_get(client, auth_headers):
    """Test wearable api key not exposed in get."""
    client.put(
        "/import/settings",
        json={"wearable_api_key": "super-secret"},
        headers=auth_headers,
    )
    resp = client.get("/import/settings", headers=auth_headers)
    assert resp.status_code == 200
    assert resp.json()["wearable_api_key"] is None
