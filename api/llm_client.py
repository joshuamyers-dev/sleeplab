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

import os
from openai import OpenAI


def get_provider() -> str:
    """Return the active provider name, auto-detecting when LLM_PROVIDER is unset."""
    explicit = os.environ.get("LLM_PROVIDER", "").strip().lower()
    if explicit:
        return explicit
    if os.environ.get("OPENAI_API_KEY"):
        return "openai"
    return "ollama"


def get_llm_client() -> OpenAI:
    """Return an OpenAI-SDK client pointed at the configured backend."""
    provider = get_provider()

    if provider == "openai":
        return OpenAI(api_key=os.environ.get("OPENAI_API_KEY", ""))

    if provider == "ollama":
        base_url = os.environ.get("OLLAMA_BASE_URL", "http://localhost:11434/v1")
        return OpenAI(base_url=base_url, api_key="ollama")

    if provider == "litellm":
        base_url = os.environ.get("LITELLM_BASE_URL", "http://localhost:4000/v1")
        api_key = os.environ.get("LITELLM_API_KEY", "litellm")
        return OpenAI(base_url=base_url, api_key=api_key)

    if provider == "custom":
        base_url = os.environ.get("LLM_BASE_URL", "")
        api_key = os.environ.get("LLM_API_KEY", "custom")
        if not base_url:
            raise ValueError("LLM_BASE_URL must be set when LLM_PROVIDER=custom")
        return OpenAI(base_url=base_url, api_key=api_key)

    raise ValueError(f"Unknown LLM_PROVIDER: {provider!r}")


def get_model() -> str:
    """Return the model name to use for the configured provider."""
    provider = get_provider()

    defaults = {
        "openai":   ("OPENAI_MODEL",   "gpt-4o"),
        "ollama":   ("OLLAMA_MODEL",   "llama3.1:8b"),
        "litellm":  ("LITELLM_MODEL",  "gpt-4o-mini"),
        "custom":   ("LLM_MODEL",      ""),
    }
    env_var, fallback = defaults.get(provider, ("LLM_MODEL", ""))
    return os.environ.get(env_var, fallback)


def is_configured() -> bool:
    """Return True if the backend has the minimum required configuration."""
    provider = get_provider()
    if provider == "openai":
        return bool(os.environ.get("OPENAI_API_KEY"))
    if provider == "custom":
        return bool(os.environ.get("LLM_BASE_URL")) and bool(os.environ.get("LLM_MODEL"))
    return True  # ollama / litellm just need a reachable URL
