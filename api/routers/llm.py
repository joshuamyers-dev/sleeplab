"""
LLM health endpoint.

GET /llm/health  — returns provider name, base URL, model, and connectivity status.
"""

import os

from fastapi import APIRouter

from ..llm_client import get_llm_client, get_model, get_provider

router = APIRouter()

_BASE_URLS = {
    "openai":  "https://api.openai.com/v1",
    "ollama":  lambda: os.environ.get("OLLAMA_BASE_URL",  "http://localhost:11434/v1"),
    "litellm": lambda: os.environ.get("LITELLM_BASE_URL", "http://localhost:4000/v1"),
    "custom":  lambda: os.environ.get("LLM_BASE_URL",     ""),
}


@router.get("/health")
def llm_health():
    """Return provider info and a live connectivity check."""
    provider = get_provider()
    model = get_model()

    entry = _BASE_URLS.get(provider, "")
    base_url = entry() if callable(entry) else entry

    try:
        client = get_llm_client()
        client.models.list()
        return {"provider": provider, "base_url": base_url, "model": model, "ok": True}
    except Exception as exc:
        return {
            "provider": provider,
            "base_url": base_url,
            "model": model,
            "ok": False,
            "error": str(exc)[:300],
        }
