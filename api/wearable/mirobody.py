"""mirobody adapter.

Fetches HR, SpO₂, and sleep stages from a self-hosted Mirobody instance
(https://mirobody.com). Follows the same pattern as ``open_wearables.py``.
"""

from datetime import date, timedelta

import httpx

from .base import Sample, StageSample, WearableAdapter, WearablePayload

_MIROBODY_STAGE_MAP: dict[str, int] = {
    "wake": 1,
    "awake": 1,
    "light": 2,
    "nrem": 2,
    "deep": 3,
    "slow_wave": 3,
    "rem": 4,
}

_TIMEOUT = 5.0


class MirobodyAdapter(WearableAdapter):
    """Adapter for a self-hosted Mirobody instance.

    Args:
        base_url: Root URL, e.g. ``"https://mirobody.home.example.com"``.
        api_key: API key from your Mirobody instance settings.
    """

    def __init__(self, base_url: str, api_key: str) -> None:
        self._base_url = base_url.rstrip("/")
        self._headers = {"X-Api-Key": api_key}

    def fetch(self, user_id: str, target_date: date) -> WearablePayload:
        """Fetch HR, SpO₂, and sleep stages for one night.

        Args:
            user_id: SleepLab user UUID forwarded as ``user_id`` query param.
            target_date: Local calendar date of the sleep session.

        Returns:
            Normalised ``WearablePayload``. Unknown stage labels default to
            ``1`` (awake). Empty lists for any series with no data.

        Raises:
            httpx.HTTPStatusError: Propagated on 401/403.
        """
        params = {
            "user_id": user_id,
            "date_from": target_date.isoformat(),
            "date_to": (target_date + timedelta(days=1)).isoformat(),
        }

        with httpx.Client(
            base_url=self._base_url,
            headers=self._headers,
            timeout=_TIMEOUT,
        ) as client:
            try:
                hr_resp = client.get("/api/v1/biometrics/heart-rate", params=params)
                spo2_resp = client.get("/api/v1/biometrics/spo2", params=params)
                stages_resp = client.get("/api/v1/sleep/stages", params=params)
            except httpx.ConnectError:
                return WearablePayload()

            for resp in (hr_resp, spo2_resp, stages_resp):
                if resp.status_code in (401, 403):
                    resp.raise_for_status()

        hr = [
            Sample(timestamp=s["timestamp"], value=s["value"])
            for s in (hr_resp.json().get("data", []) if hr_resp.status_code == 200 else [])
        ]
        spo2 = [
            Sample(timestamp=s["timestamp"], value=s["value"])
            for s in (spo2_resp.json().get("data", []) if spo2_resp.status_code == 200 else [])
        ]
        stages = [
            StageSample(
                timestamp=s["timestamp"],
                stage=_MIROBODY_STAGE_MAP.get(s["stage"].lower(), 1),
            )
            for s in (stages_resp.json().get("data", []) if stages_resp.status_code == 200 else [])
        ]

        return WearablePayload(hr=hr, spo2=spo2, stages=stages)
