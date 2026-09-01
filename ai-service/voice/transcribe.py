"""
voice/transcribe.py — Local STT fallback using faster-whisper.

Used when Gemini Live is unavailable or the client requests lightweight mode.
"""

import io
import logging
import tempfile
from pathlib import Path

log = logging.getLogger(__name__)

# Lazy-load the model to avoid slowing startup when voice isn't used
_model = None


def _get_model():
    global _model
    if _model is None:
        from faster_whisper import WhisperModel
        from config import settings
        log.info("Loading faster-whisper model (%s)...", settings.whisper_model_size)
        _model = WhisperModel(
            settings.whisper_model_size,
            device="cpu",
            compute_type="int8"
        )
        log.info("faster-whisper model loaded")
    return _model


async def transcribe_audio(audio_bytes: bytes) -> str:
    """
    Transcribe raw audio bytes to text using faster-whisper.
    Accepts WebM, MP3, WAV, OGG — any format ffmpeg can read.
    """
    try:
        model = _get_model()

        with tempfile.NamedTemporaryFile(suffix=".webm", delete=False) as tmp:
            tmp.write(audio_bytes)
            tmp_path = tmp.name

        segments, info = model.transcribe(
            tmp_path,
            beam_size=5,
            language="en",
            vad_filter=True,
        )
        transcript = " ".join(seg.text for seg in segments).strip()
        Path(tmp_path).unlink(missing_ok=True)

        log.info("Transcribed audio: %r", transcript[:80])
        return transcript

    except ImportError:
        log.warning("faster-whisper not installed — returning empty transcript")
        return ""
    except Exception as e:
        log.error("Transcription failed: %s", e)
        return ""
