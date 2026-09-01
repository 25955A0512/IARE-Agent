"""
voice/synthesize.py — Local TTS fallback using edge-tts.

Uses Microsoft's Neural TTS via edge-tts.
Default voice: en-IN-NeerjaNeural (Indian English, clear and natural).
"""

import io
import logging
from typing import AsyncGenerator

from config import settings

log = logging.getLogger(__name__)


async def synthesize_text(text: str) -> AsyncGenerator[bytes, None]:
    """
    Convert text to speech using edge-tts.
    Yields audio chunks as an async generator (for StreamingResponse).
    """
    try:
        import edge_tts
        communicate = edge_tts.Communicate(text, voice=settings.tts_voice)

        buffer = io.BytesIO()
        async for chunk in communicate.stream():
            if chunk["type"] == "audio":
                yield chunk["data"]

        log.info("TTS synthesis complete for text: %r", text[:60])

    except ImportError:
        log.warning("edge-tts not installed — returning silent audio")
        yield b""
    except Exception as e:
        log.error("TTS synthesis failed: %s", e)
        yield b""
