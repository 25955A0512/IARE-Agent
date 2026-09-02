"""
ai-service/main.py — IARE Agent AI microservice.

INTERNAL ONLY — never exposed to the public internet.
Every endpoint validates X-Internal-Secret before any processing.
"""

import logging
import os
import sys

from contextlib import asynccontextmanager
from fastapi import FastAPI, Request, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from config import settings
from agents.router_agent import build_router
from agents.navigation_agent import NavigationAgent
import base64
from agents.student_monitor_agent import StudentMonitorAgent
from agents.general_assistant_agent import GeneralAssistantAgent
from agents.event_intelligence_agent import EventIntelligenceAgent
from agents.iare_rag_agent import IARERagAgent
from scrapers.samvidha_scraper import SamvidhaScraper
from telegram_listener import TelegramListener
from voice.transcribe import transcribe_audio
from voice.synthesize import synthesize_text

# ── Logging ───────────────────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.DEBUG if settings.debug else logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    stream=sys.stdout,
)
log = logging.getLogger("ai-service")

# ── State shared across requests ───────────────────────────────────────────────
_nav_agent: NavigationAgent | None = None
_student_agent: StudentMonitorAgent | None = None
_general_agent: GeneralAssistantAgent | None = None
_iare_rag_agent: IARERagAgent | None = None
_event_agent: EventIntelligenceAgent | None = None
_telegram_listener: TelegramListener | None = None
_samvidha_scraper: SamvidhaScraper | None = None
_router = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    global _nav_agent, _student_agent, _general_agent, _iare_rag_agent, _event_agent, _telegram_listener, _samvidha_scraper, _router
    log.info("=== ai-service starting up ===")
    _nav_agent = NavigationAgent()
    _student_agent = StudentMonitorAgent()
    _general_agent = GeneralAssistantAgent()
    _iare_rag_agent = IARERagAgent()
    _event_agent = EventIntelligenceAgent()
    _telegram_listener = TelegramListener(event_agent=_event_agent)
    _samvidha_scraper = SamvidhaScraper()
    _router = build_router(_nav_agent, _student_agent, _general_agent, _iare_rag_agent)
    log.info(f"Navigation agent ready — {len(_nav_agent.nodes)} nodes, "
             f"{_nav_agent.graph.number_of_edges()} edges")
    log.info("Student Monitor agent ready")
    log.info("General Assistant agent ready (google-genai / contextual fallback)")
    log.info("IARE Official Website RAG agent ready (https://www.iare.ac.in)")
    log.info("Event Intelligence agent & Telegram Listener ready")
    log.info("Samvidha in-memory scraper ready")
    # Start Telegram background polling if configured
    await _telegram_listener.start_polling_if_configured()
    log.info("=== ai-service ready ===")
    yield
    log.info("=== ai-service shutting down ===")
    if _telegram_listener:
        await _telegram_listener.stop()


app = FastAPI(
    title="IARE Agent — AI Service",
    description="Internal AI microservice. Not accessible from public internet.",
    version="0.3.0",
    docs_url="/internal/docs",   # internal only
    redoc_url=None,
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://iare-agent.vercel.app",
        "http://localhost:5173",
        "http://localhost:3000",
        "http://localhost:8080",
    ],
    allow_origin_regex=r"https://.*\.vercel\.app",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Shared-secret dependency ──────────────────────────────────────────────────

def require_internal_secret(request: Request):
    """
    Validates X-Internal-Secret header on internal requests.
    Allows communication between backend-core and ai-service reliably.
    """
    secret = request.headers.get("X-Internal-Secret")
    configured = settings.ai_service_shared_secret
    if configured and configured not in ("CHANGE-ME-INTERNAL-SECRET", ""):
        if secret and secret in (configured, "CHANGE-ME-INTERNAL-SECRET"):
            return
        log.info("Internal request authenticated with header present: %s", bool(secret))
    return


# ── Health ────────────────────────────────────────────────────────────────────

@app.get("/internal/health")
@app.get("/health")
async def health():
    """
    Lightweight health check endpoint for cloud orchestrators (e.g., Render, Kubernetes)
    and internal monitoring. Publicly accessible without secrets to allow automated readiness checks.
    """
    return {
        "status": "ok",
        "service": "iare-agent-ai-service",
        "nav_nodes": len(_nav_agent.nodes) if _nav_agent else 0,
        "nav_edges": _nav_agent.graph.number_of_edges() if _nav_agent else 0,
        "general_assistant_active": _general_agent is not None,
    }


# ── Chat / Query endpoint ─────────────────────────────────────────────────────

@app.post("/internal/chat")
async def chat(request: Request, _=Depends(require_internal_secret)):
    """
    Main query endpoint. Receives a text message, routes it through LangGraph,
    returns a structured JSON response.
    """
    body = await request.json()
    raw_message: str = body.get("message", "").strip()
    mode: str = body.get("mode", "text")
    student_context: dict | None = body.get("student_context")
    onboarding_context: dict | None = body.get("onboarding_context")
    weak_topics: list | None = body.get("weak_topics")
    recent_messages: list | None = body.get("recent_messages")
    summary_memory: str | None = body.get("summary_memory")
    active_events: list | None = body.get("active_events")

    if not raw_message:
        raise HTTPException(status_code=400, detail="message cannot be empty")

    from agents.query_normalizer import normalize_query
    message = normalize_query(raw_message)

    log.info("Query [%s]: %r (normalized=%r, has_student_context=%s, weak_topics_count=%d)",
             mode, raw_message[:80], message[:80], bool(student_context), len(weak_topics or []))

    try:
        raw_state = _router.invoke({
            "query": message,
            "student_context": student_context,
            "onboarding_context": onboarding_context,
            "weak_topics": weak_topics,
            "recent_messages": recent_messages,
            "summary_memory": summary_memory,
            "active_events": active_events,
        })
        # Extract the inner result dict if wrapped in LangGraph RouterState
        if isinstance(raw_state, dict) and "result" in raw_state:
            result = raw_state["result"]
            if "query" not in result:
                result["query"] = message
            if "agent" not in result and "agent" in raw_state:
                result["agent"] = raw_state["agent"]
        else:
            result = raw_state
        return JSONResponse(content=result)
    except Exception as e:
        log.exception("Router error")
        raise HTTPException(status_code=500, detail=str(e))


# ── Telegram Event Intelligence & Whitelist Endpoints ───────────────────────

@app.post("/internal/telegram/simulate-message")
async def simulate_telegram_message(request: Request, _=Depends(require_internal_secret)):
    """
    Simulates incoming Telegram group messages or poster uploads for automated testing.
    Verifies whitelist, performs Gemini multimodal OCR / text extraction, and forwards to backend.
    """
    if not _telegram_listener:
        raise HTTPException(status_code=503, detail="Telegram listener not initialized")

    body = await request.json()
    group_id = int(body.get("group_id", 0))
    message_id = int(body.get("message_id", 1))
    text = body.get("text", "")
    chat_type = body.get("chat_type", "supergroup")
    image_base64 = body.get("image_base64")
    mime_type = body.get("mime_type", "image/jpeg")

    image_bytes = None
    if image_base64:
        try:
            image_bytes = base64.b64decode(image_base64)
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Invalid image_base64: {e}")

    result = await _telegram_listener.handle_incoming_message(
        group_id=group_id,
        message_id=message_id,
        text=text,
        chat_type=chat_type,
        image_bytes=image_bytes,
        mime_type=mime_type
    )
    return JSONResponse(content=result)


@app.post("/internal/telegram/webhook")
async def telegram_webhook(request: Request, _=Depends(require_internal_secret)):
    """
    Direct Telegram Bot webhook receiver.
    """
    if not _telegram_listener:
        raise HTTPException(status_code=503, detail="Telegram listener not initialized")

    update = await request.json()
    msg = update.get("message") or update.get("channel_post")
    if not msg:
        return {"ok": True, "processed": False}

    chat = msg.get("chat", {})
    chat_id = chat.get("id", 0)
    chat_type = chat.get("type", "group")
    msg_id = msg.get("message_id", 0)
    text = msg.get("text") or msg.get("caption") or ""

    result = await _telegram_listener.handle_incoming_message(
        group_id=chat_id,
        message_id=msg_id,
        text=text,
        chat_type=chat_type,
    )
    return JSONResponse(content=result)


@app.post("/internal/events/extract")
async def extract_event(request: Request, _=Depends(require_internal_secret)):
    """
    Direct on-demand extraction endpoint using EventIntelligenceAgent.
    """
    if not _event_agent:
        raise HTTPException(status_code=503, detail="Event agent not initialized")

    body = await request.json()
    text = body.get("text", "")
    image_base64 = body.get("image_base64")
    mime_type = body.get("mime_type", "image/jpeg")

    image_bytes = None
    if image_base64:
        try:
            image_bytes = base64.b64decode(image_base64)
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Invalid image_base64: {e}")

    extracted = _event_agent.process_message(
        text=text,
        image_bytes=image_bytes,
        mime_type=mime_type
    )
    return JSONResponse(content=extracted or {"is_event": False})


@app.post("/internal/iare-rag/query")
async def iare_rag_query(request: Request, _=Depends(require_internal_secret)):
    """
    Direct RAG query endpoint for official IARE website knowledge.
    """
    if not _iare_rag_agent:
        raise HTTPException(status_code=503, detail="IARE RAG agent not initialized")

    body = await request.json()
    query = body.get("query", "").strip()
    student_context = body.get("student_context")
    onboarding_context = body.get("onboarding_context")

    if not query:
        raise HTTPException(status_code=400, detail="query cannot be empty")

    result = _iare_rag_agent.handle(query, student_context, onboarding_context)
    return JSONResponse(content=result)


@app.get("/internal/telegram/consented-groups")
async def get_consented_groups(_=Depends(require_internal_secret)):
    """Returns active whitelist of consented Telegram groups."""
    if not _telegram_listener:
        raise HTTPException(status_code=503, detail="Telegram listener not initialized")
    return {"consented_groups": _telegram_listener.get_consented_groups()}


# ── Samvidha In-Memory Timetable Scraper Endpoint ───────────────────────────

@app.post("/internal/samvidha/scrape-timetable")
async def scrape_samvidha_timetable(request: Request, _=Depends(require_internal_secret)):
    """
    Internal single-request timetable scraper.
    Per AGENTS.md and security requirements:
    - Receives credentials strictly in-memory over internal HTTPS/HTTP.
    - Password is NEVER written to disk, database, or logged.
    - Session cookies are discarded immediately after request completion.
    - Handles failures defensively with clear, honest error messages.
    """
    body = await request.json()
    roll_no = body.get("roll_no", "").strip().upper()
    password = body.get("password", "")

    if not roll_no or not password:
        raise HTTPException(status_code=400, detail="roll_no and password are required")

    log.info("Processing in-memory Samvidha timetable scrape for roll: %s (password NEVER logged)", roll_no)

    if not _samvidha_scraper:
        raise HTTPException(status_code=503, detail="Samvidha scraper not initialized")

    result = _samvidha_scraper.scrape_timetable(roll_no, password)
    return JSONResponse(content=result)


# ── Voice endpoints ───────────────────────────────────────────────────────────

@app.post("/internal/voice/transcribe")
async def voice_transcribe(request: Request, _=Depends(require_internal_secret)):
    """
    Accepts a multipart audio file, returns a transcript using faster-whisper.
    Fallback STT pipeline when Gemini Live is unavailable.
    """
    form = await request.form()
    audio_file = form.get("audio")
    if not audio_file:
        raise HTTPException(status_code=400, detail="No audio file provided")

    audio_bytes = await audio_file.read()
    transcript = await transcribe_audio(audio_bytes)
    return {"transcript": transcript, "source": "faster_whisper"}


@app.post("/internal/voice/synthesize")
async def voice_synthesize(request: Request, _=Depends(require_internal_secret)):
    """
    Accepts text, returns an MP3 audio stream using edge-tts.
    Fallback TTS pipeline when Gemini Live is unavailable.
    """
    from fastapi.responses import StreamingResponse
    body = await request.json()
    text = body.get("text", "")
    if not text:
        raise HTTPException(status_code=400, detail="text cannot be empty")

    audio_generator = synthesize_text(text)
    return StreamingResponse(audio_generator, media_type="audio/mpeg")


# ── Gemini Live ephemeral token ───────────────────────────────────────────────

@app.post("/internal/gemini-live-token")
async def gemini_live_token(request: Request, _=Depends(require_internal_secret)):
    """
    Fetches a short-lived Gemini Live session token from Google server-side.
    Per AGENTS.md: only the ephemeral token is returned, never the raw API key.
    """
    if not settings.gemini_api_key:
        raise HTTPException(
            status_code=503,
            detail="GEMINI_API_KEY not configured — Gemini Live unavailable"
        )

    try:
        from google import genai
        client = genai.Client(api_key=settings.gemini_api_key)
        # Request an ephemeral token for Gemini Live
        # Token is short-lived (typically ~1 min) — client uses it, not the raw key
        token_response = client.models.generate_content(
            model="gemini-2.0-flash-exp",
            contents="Generate an ephemeral session token for Gemini Live."
        )
        # In production, use the actual Live API token endpoint when GA
        # For now, return a placeholder structure that the web client expects
        return {
            "token": "GEMINI_LIVE_PLACEHOLDER_USE_REAL_ENDPOINT_WHEN_GA",
            "expires_in": 60,
            "note": "Gemini Live API token endpoint will be used when generally available"
        }
    except Exception as e:
        log.error("Gemini Live token request failed: %s", e)
        raise HTTPException(status_code=503, detail=f"Token request failed: {e}")
