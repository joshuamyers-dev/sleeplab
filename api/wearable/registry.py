"""Provider registry.

To add a new wearable provider:
1. Create ``api/wearable/<provider>.py`` subclassing ``WearableAdapter``.
2. Import and register it here.
3. Add the provider name to the selector in ``frontend/src/pages/Settings.tsx``.
"""

from .base import WearableAdapter
from .mirobody import MirobodyAdapter
from .open_wearables import OpenWearablesAdapter

ADAPTERS: dict[str, type[WearableAdapter]] = {
    "open-wearables": OpenWearablesAdapter,
    "mirobody": MirobodyAdapter,
}


def get_adapter(provider: str, base_url: str, api_key: str) -> WearableAdapter:
    """Instantiate the adapter for the given provider name.

    Args:
        provider: Key matching an entry in ``ADAPTERS``.
        base_url: Root URL of the self-hosted wearable server.
        api_key: Bearer token / API key for the wearable server.

    Returns:
        A ``WearableAdapter`` instance ready to call ``fetch()``.

    Raises:
        ValueError: If ``provider`` is not registered.
    """
    cls = ADAPTERS.get(provider)
    if cls is None:
        raise ValueError(f"Unknown wearable provider: {provider!r}. Registered: {list(ADAPTERS)}")
    return cls(base_url=base_url, api_key=api_key)
