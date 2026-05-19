"""Abstract base for wearable data source adapters.

All adapters in this package return data on demand at request time.
No data is stored in the SleepLab database.

Docstring style: Google.
"""

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from datetime import date


@dataclass
class Sample:
    """A single timestamped scalar measurement.

    Attributes:
        timestamp: ISO-8601 UTC string, e.g. ``"2025-01-15T02:34:00Z"``.
        value: Numeric value — bpm for HR, percent for SpO₂.
    """

    timestamp: str
    value: float


@dataclass
class StageSample:
    """A single timestamped sleep stage epoch.

    Attributes:
        timestamp: ISO-8601 UTC string marking the start of the epoch.
        stage: Normalised stage code: ``1`` awake, ``2`` light, ``3`` deep, ``4`` REM.
    """

    timestamp: str
    stage: int


@dataclass
class WearablePayload:
    """Normalised wearable data for a single night.

    Attributes:
        hr: Heart rate samples (bpm).
        spo2: Blood oxygen saturation samples (%).
        stages: Sleep stage epochs in chronological order.
    """

    hr: list[Sample] = field(default_factory=list)
    spo2: list[Sample] = field(default_factory=list)
    stages: list[StageSample] = field(default_factory=list)

    def is_empty(self) -> bool:
        """Return True when all three series are empty."""
        return not self.hr and not self.spo2 and not self.stages


class WearableAdapter(ABC):
    """Abstract base for wearable data source adapters.

    Subclass this, implement ``fetch``, then register in
    ``api/wearable/registry.py`` under a unique provider name string.

    Example::

        class MyAdapter(WearableAdapter):
            def __init__(self, base_url: str, api_key: str) -> None:
                self._base_url = base_url
                self._api_key = api_key

            def fetch(self, user_id: str, target_date: date) -> WearablePayload:
                ...

        # registry.py
        ADAPTERS["my-provider"] = MyAdapter
    """

    @abstractmethod
    def fetch(self, user_id: str, target_date: date) -> WearablePayload:
        """Fetch wearable data for one night.

        Args:
            user_id: SleepLab user UUID, used to scope to the correct account.
            target_date: Local calendar date of the sleep session. Adapters
                should query a window that captures midnight-spanning sessions.

        Returns:
            Normalised ``WearablePayload``. Return empty ``WearablePayload()``
            when no data exists — never raise for missing data.

        Raises:
            httpx.HTTPStatusError: On 401/403 from the upstream API so callers
                can surface credential errors to the user.
        """
