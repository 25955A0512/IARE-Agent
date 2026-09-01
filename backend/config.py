"""
config.py — Centralised environment variable loading for IARE Agent backend.

All secrets and settings are read from environment variables (via a .env file
in development). Missing required keys raise descriptive errors at startup.
"""

import os
from dotenv import load_dotenv

# Load .env file if it exists (silently ignored in production where env vars
# are injected by the platform, e.g. Render).
load_dotenv()


def _get(key: str, default: str | None = None, required: bool = False) -> str | None:
    """Retrieve an environment variable, optionally raising if absent."""
    value = os.environ.get(key, default)
    if required and not value:
        raise EnvironmentError(
            f"Required environment variable '{key}' is not set. "
            f"Copy .env.example to .env and fill in the value."
        )
    return value


# ── LLM ──────────────────────────────────────────────────────────────────────
GROQ_API_KEY: str | None = _get("GROQ_API_KEY")
GEMINI_API_KEY: str | None = _get("GEMINI_API_KEY")

# Groq model to use for routing (fast, free-tier friendly)
GROQ_MODEL: str = _get("GROQ_MODEL", default="llama-3.1-8b-instant")

# ── Database ─────────────────────────────────────────────────────────────────
# If SUPABASE_DB_URL is not set, the app falls back to a local SQLite file.
SUPABASE_DB_URL: str | None = _get("SUPABASE_DB_URL")
SQLITE_FALLBACK_PATH: str = "iare_agent_local.db"

# ── App ───────────────────────────────────────────────────────────────────────
FRONTEND_URL: str = _get("FRONTEND_URL", default="http://localhost:8501")
BACKEND_URL: str = _get("BACKEND_URL", default="http://localhost:8000")

# ── Routing mode ─────────────────────────────────────────────────────────────
# If True and GROQ_API_KEY is set, the router uses an LLM for classification.
# If False (or no key), falls back to a deterministic keyword classifier.
USE_LLM_ROUTER: bool = bool(GROQ_API_KEY)
