"""open-wearables adapter.

Fetches HR, SpO₂, and sleep stages from a self-hosted open-wearables instance
(https://github.com/openwearables). This module is the canonical worked example
for building new adapters — follow its pattern exactly.
"""

from datetime import date, timedelta

import httpx

from .base import Sample, StageSample, WearableAdapter, WearablePayload

_STAGE_MAP: dict[str, int] = {
    "awake": 1,
    "light": 2,
    "nrem1": 2,
    "nrem2": 2,
    "deep": 3,
    "nrem3": 3,
    "nrem4": 3,
    "rem": 4,
}

_TIMEOUT = 5.0


class OpenWearablesAdapter(WearableAdapter):
    """Adapter for a self-hosted open-wearables instance.

    Args:
        base_url: Root URL, e.g. ``"https://wearables.home.example.com"``.
        api_key: Bearer token issued by the open-wearables instance.
    """

    def __init__(self, base_url: str, api_key: str) -> None:
        self._base_url = base_url.rstrip("/")
        self._headers = {"Authorization": f"Bearer {api_key}"}

    def fetch(self, user_id: str, target_date: date) -> WearablePayload:
        """Fetch HR, SpO₂, and sleep stages for one night.

        Args:
            user_id: SleepLab user UUID forwarded as ``subject`` query param.
            target_date: Local calendar date of the sleep session.

        Returns:
            Normalised ``WearablePayload``. Unknown stage labels default to
            ``1`` (awake). Empty lists for any series with no data.

        Raises:
            httpx.HTTPStatusError: Propagated on 401/403.
        """
        params = {
            "subject": user_id,
            "from": target_date.isoformat(),
            "to": (target_date + timedelta(days=1)).isoformat(),
        }

        with httpx.Client(
            base_url=self._base_url,
            headers=self._headers,
            timeout=_TIMEOUT,
        ) as client:
            try:
                hr_resp = client.get("/v1/heart-rate", params=params)
                spo2_resp = client.get("/v1/spo2", params=params)
                stages_resp = client.get("/v1/sleep-stages", params=params)
            except httpx.ConnectError:
                return WearablePayload()

            for resp in (hr_resp, spo2_resp, stages_resp):
                if resp.status_code in (401, 403):
                    resp.raise_for_status()

        hr = [
            Sample(timestamp=s["ts"], value=s["bpm"])
            for s in (hr_resp.json().get("samples", []) if hr_resp.status_code == 200 else [])
        ]
        spo2 = [
            Sample(timestamp=s["ts"], value=s["spo2_pct"])
            for s in (spo2_resp.json().get("samples", []) if spo2_resp.status_code == 200 else [])
        ]
        stages = [
            StageSample(
                timestamp=s["ts"],
                stage=_STAGE_MAP.get(s["stage"].lower(), 1),
            )
            for s in (stages_resp.json().get("epochs", []) if stages_resp.status_code == 200 else [])
        ]

        return WearablePayload(hr=hr, spo2=spo2, stages=stages)
