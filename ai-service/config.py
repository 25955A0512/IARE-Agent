"""
config.py — ai-service configuration.
All secrets loaded from environment variables. Never hardcoded.
"""

import os
from pathlib import Path
from dotenv import load_dotenv

# Load .env if present (dev convenience)
_env_path = Path(__file__).parent / ".env"
if _env_path.exists():
    load_dotenv(_env_path)


class Settings:
    """Centralized settings loaded from environment variables."""

    # ── Internal security ────────────────────────────────────────────────────
    ai_service_shared_secret: str = os.environ.get(
        "AI_SERVICE_SHARED_SECRET", "CHANGE-ME-INTERNAL-SECRET"
    )

    # ── LLM Inference (Groq Primary, Gemini Fallback per AGENTS.md) ───────────
    groq_api_key: str | None = (
        os.environ.get("GROQ_API_KEY")
        or os.environ.get("GROQ_APT_KEY")
        or os.environ.get("GROQ_KEY")
    )
    groq_model: str = os.environ.get("GROQ_MODEL", "openai/gpt-oss-120b")

    # Uses google-genai SDK (NOT deprecated google-generativeai per AGENTS.md)
    gemini_api_key: str | None = (
        os.environ.get("GEMINI_API_KEY")
        or os.environ.get("GOOGLE_API_KEY")
        or os.environ.get("GEMINI_KEY")
    )
    gemini_model: str = os.environ.get("GEMINI_MODEL", "gemini-2.5-flash")

    # ── Data ─────────────────────────────────────────────────────────────────
    campus_data_path: str = os.environ.get(
        "CAMPUS_DATA_PATH",
        str(Path(__file__).parent / "data" / "campus_overview.json")
    )

    # ── Voice ─────────────────────────────────────────────────────────────────
    whisper_model_size: str = os.environ.get("WHISPER_MODEL", "base")
    tts_voice: str = os.environ.get("TTS_VOICE", "en-IN-NeerjaNeural")

    # ── Telegram Intelligence & Whitelist ─────────────────────────────────────
    telegram_bot_token: str | None = os.environ.get("TELEGRAM_BOT_TOKEN")
    telegram_api_id: int | None = int(os.environ.get("TELEGRAM_API_ID")) if os.environ.get("TELEGRAM_API_ID") else None
    telegram_api_hash: str | None = os.environ.get("TELEGRAM_API_HASH")
    consented_groups_path: str = os.environ.get(
        "CONSENTED_GROUPS_PATH",
        str(Path(__file__).parent.parent / "config" / "consented_groups.json")
    )
    backend_core_url: str = os.environ.get("BACKEND_CORE_URL", "http://localhost:8080")

    # ── Service ───────────────────────────────────────────────────────────────
    debug: bool = os.environ.get("DEBUG", "false").lower() == "true"
    port: int = int(os.environ.get("PORT", "8001"))


settings = Settings()
