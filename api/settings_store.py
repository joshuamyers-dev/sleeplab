import os
from collections.abc import Mapping
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from sqlalchemy import text
from sqlalchemy.orm import Session


VALID_LLM_PROVIDERS = {"openai", "ollama", "litellm", "custom"}


def normalize_timezone(value: str | None) -> str | None:
    if value is None:
        return None
    name = value.strip()
    if not name:
        return None
    try:
        ZoneInfo(name)
    except (ZoneInfoNotFoundError, KeyError, ValueError) as exc:
        raise ValueError(f"Unknown timezone: {name}") from exc
    return name


def normalize_llm_provider(value: str | None) -> str | None:
    if value is None:
        return None
    provider = value.strip().lower()
    if not provider:
        return None
    if provider not in VALID_LLM_PROVIDERS:
        raise ValueError(f"Unknown LLM provider: {provider}")
    return provider


def _row_value(row: Mapping[str, object] | None, key: str) -> str | None:
    if row is None:
        return None
    value = row.get(key)
    if value is None:
        return None
    text_value = str(value).strip()
    return text_value or None


def get_user_import_settings_row(db: Session, user_id: str) -> Mapping[str, object] | None:
    return db.execute(
        text("SELECT * FROM user_import_settings WHERE user_id = CAST(:uid AS uuid)"),
        {"uid": user_id},
    ).mappings().first()


def get_timezone_settings(db: Session, user_id: str) -> dict[str, str]:
    row = get_user_import_settings_row(db, user_id)
    machine_tz = _row_value(row, "machine_tz") or os.environ.get("MACHINE_TZ", "UTC") or "UTC"
    display_tz = _row_value(row, "display_tz") or os.environ.get("DISPLAY_TZ", machine_tz) or "UTC"
    try:
        machine_tz = normalize_timezone(machine_tz) or "UTC"
    except ValueError:
        machine_tz = "UTC"
    try:
        display_tz = normalize_timezone(display_tz) or machine_tz
    except ValueError:
        display_tz = machine_tz
    return {"machine_tz": machine_tz, "display_tz": display_tz}


def get_llm_settings(db: Session, user_id: str) -> dict[str, str | None]:
    row = get_user_import_settings_row(db, user_id)
    provider = _row_value(row, "llm_provider")
    if provider is None:
        provider = os.environ.get("LLM_PROVIDER", "").strip().lower() or None
    if provider is None:
        provider = "openai" if os.environ.get("OPENAI_API_KEY") else "ollama"

    try:
        provider = normalize_llm_provider(provider) or "ollama"
    except ValueError:
        provider = "ollama"

    base_url = _row_value(row, "llm_base_url")
    api_key = _row_value(row, "llm_api_key")
    model = _row_value(row, "llm_model")

    if provider == "openai":
        model = model or os.environ.get("OPENAI_MODEL", "gpt-4o")
        api_key = api_key or os.environ.get("OPENAI_API_KEY") or None
        base_url = base_url or "https://api.openai.com/v1"
    elif provider == "ollama":
        model = model or os.environ.get("OLLAMA_MODEL", "llama3.1:8b")
        base_url = base_url or os.environ.get("OLLAMA_BASE_URL", "http://localhost:11434/v1")
        api_key = api_key or "ollama"
    elif provider == "litellm":
        model = model or os.environ.get("LITELLM_MODEL", "gpt-4o-mini")
        base_url = base_url or os.environ.get("LITELLM_BASE_URL", "http://localhost:4000/v1")
        api_key = api_key or os.environ.get("LITELLM_API_KEY", "litellm")
    else:
        model = model or os.environ.get("LLM_MODEL") or None
        base_url = base_url or os.environ.get("LLM_BASE_URL") or None
        api_key = api_key or os.environ.get("LLM_API_KEY") or None

    return {
        "llm_provider": provider,
        "llm_base_url": base_url,
        "llm_api_key": api_key,
        "llm_model": model,
    }


def has_explicit_llm_settings(db: Session, user_id: str) -> bool:
    row = get_user_import_settings_row(db, user_id)
    if row is not None and _row_value(row, "llm_provider"):
        return True
    return any(
        os.environ.get(name)
        for name in (
            "LLM_PROVIDER",
            "OPENAI_API_KEY",
            "OLLAMA_BASE_URL",
            "LITELLM_BASE_URL",
            "LLM_BASE_URL",
        )
    )
