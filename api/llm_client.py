"""
Provider-agnostic LLM client factory.

All supported backends (OpenAI, Ollama, LiteLLM, custom) expose the
OpenAI-compatible /v1/chat/completions protocol, so the official openai
Python SDK can drive all of them — only base_url and api_key differ.

Provider detection
------------------
LLM_PROVIDER set explicitly?
  "openai"  → OPENAI_API_KEY + api.openai.com
  "ollama"  → OLLAMA_BASE_URL (default http://localhost:11434/v1), key "ollama"
  "litellm" → LITELLM_BASE_URL (default http://localhost:4000/v1), LITELLM_API_KEY
  "custom"  → LLM_BASE_URL + LLM_API_KEY (both required)

LLM_PROVIDER not set?
  OPENAI_API_KEY present → "openai"   (backwards compatible with existing deploys)
  otherwise              → "ollama"   (self-hosted default)

Environment variables
---------------------
LLM_PROVIDER      one of: openai, ollama, litellm, custom  (optional)
OPENAI_API_KEY    required for openai provider
OPENAI_MODEL      default: gpt-4o
OLLAMA_BASE_URL   default: http://localhost:11434/v1
OLLAMA_MODEL      default: llama3.1:8b
LITELLM_BASE_URL  default: http://localhost:4000/v1
LITELLM_MODEL     default: gpt-4o-mini
LLM_BASE_URL      required for custom provider
LLM_API_KEY       required for custom provider
LLM_MODEL         required for custom provider
"""

from collections.abc import Mapping
import os

from openai import OpenAI


def get_provider(settings: Mapping[str, str | None] | None = None) -> str:
    """Return the active provider name, auto-detecting when LLM_PROVIDER is unset."""
    return str((settings or get_llm_settings_from_env())["llm_provider"])


def get_llm_client(settings: Mapping[str, str | None] | None = None) -> OpenAI:
    """Return an OpenAI-SDK client pointed at the configured backend."""
    config = dict(settings or get_llm_settings_from_env())
    provider = get_provider(config)

    if provider == "openai":
        return OpenAI(api_key=config.get("llm_api_key") or "")

    if provider == "ollama":
        return OpenAI(base_url=config.get("llm_base_url"), api_key=config.get("llm_api_key") or "ollama")

    if provider == "litellm":
        return OpenAI(base_url=config.get("llm_base_url"), api_key=config.get("llm_api_key") or "litellm")

    if provider == "custom":
        base_url = config.get("llm_base_url") or ""
        api_key = config.get("llm_api_key") or "custom"
        if not base_url:
            raise ValueError("LLM_BASE_URL must be set when LLM_PROVIDER=custom")
        return OpenAI(base_url=base_url, api_key=api_key)

    raise ValueError(f"Unknown LLM_PROVIDER: {provider!r}")


def get_model(settings: Mapping[str, str | None] | None = None) -> str:
    """Return the model name to use for the configured provider."""
    return str((settings or get_llm_settings_from_env()).get("llm_model") or "")


def is_configured(settings: Mapping[str, str | None] | None = None) -> bool:
    """Return True if the backend has the minimum required configuration."""
    config = dict(settings or get_llm_settings_from_env())
    provider = get_provider(config)
    if provider == "openai":
        return bool(config.get("llm_api_key"))
    if provider == "custom":
        return bool(config.get("llm_base_url")) and bool(config.get("llm_model"))
    return True  # ollama / litellm just need a reachable URL


def get_llm_settings_from_env() -> dict[str, str | None]:
    provider = os.environ.get("LLM_PROVIDER", "").strip().lower()
    if not provider:
        provider = "openai" if os.environ.get("OPENAI_API_KEY") else "ollama"

    if provider == "openai":
        return {
            "llm_provider": provider,
            "llm_base_url": "https://api.openai.com/v1",
            "llm_api_key": os.environ.get("OPENAI_API_KEY") or None,
            "llm_model": os.environ.get("OPENAI_MODEL", "gpt-4o"),
        }
    if provider == "ollama":
        return {
            "llm_provider": provider,
            "llm_base_url": os.environ.get("OLLAMA_BASE_URL", "http://localhost:11434/v1"),
            "llm_api_key": "ollama",
            "llm_model": os.environ.get("OLLAMA_MODEL", "llama3.1:8b"),
        }
    if provider == "litellm":
        return {
            "llm_provider": provider,
            "llm_base_url": os.environ.get("LITELLM_BASE_URL", "http://localhost:4000/v1"),
            "llm_api_key": os.environ.get("LITELLM_API_KEY", "litellm"),
            "llm_model": os.environ.get("LITELLM_MODEL", "gpt-4o-mini"),
        }
    return {
        "llm_provider": provider,
        "llm_base_url": os.environ.get("LLM_BASE_URL") or None,
        "llm_api_key": os.environ.get("LLM_API_KEY") or None,
        "llm_model": os.environ.get("LLM_MODEL") or None,
    }
