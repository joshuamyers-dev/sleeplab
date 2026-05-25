"""
LLM health endpoint.

GET /llm/health  — returns provider name, base URL, model, and connectivity status.
"""

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from ..auth import get_current_user
from ..database import get_db
from ..llm_client import get_llm_client, get_model, get_provider
from ..settings_store import get_llm_settings, has_explicit_llm_settings

router = APIRouter()


@router.get("/health")
def llm_health(
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Return provider info and a live connectivity check."""
    llm_settings = get_llm_settings(db, current_user["id"])
    provider = get_provider(llm_settings)
    model = get_model(llm_settings)
    base_url = llm_settings.get("llm_base_url") or ""

    if not has_explicit_llm_settings(db, current_user["id"]):
        return {
            "provider": provider,
            "base_url": base_url,
            "model": model,
            "ok": False,
            "error": "LLM backend not configured",
        }

    try:
        client = get_llm_client(llm_settings)
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
