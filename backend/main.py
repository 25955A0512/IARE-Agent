"""
main.py — FastAPI application entrypoint for IARE Agent backend.

Endpoints:
  GET  /health         — Liveness check
  POST /chat           — Main chat endpoint (routes via LangGraph router)
  GET  /campus/nodes   — List all campus locations (used by frontend for reference)

On startup the campus graph and faculty data are loaded into memory from either
the database (if SUPABASE_DB_URL is set) or the JSON seed files (offline fallback).
"""

from __future__ import annotations

import logging
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from config import FRONTEND_URL
from database import AsyncSessionLocal, create_all_tables
from agents.navigation_agent import campus_graph
from agents.people_finder_agent import faculty_store
from agents.router_agent import run_router

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)

DATA_DIR = Path(__file__).parent / "data"


# ── Startup / shutdown ────────────────────────────────────────────────────────

async def _load_data_from_db() -> bool:
    """
    Try to load campus and faculty data from the database.
    Returns True on success, False if DB load fails (triggers JSON fallback).
    """
    try:
        from sqlalchemy import select
        from models import CampusNode, CampusEdge, Faculty, FacultySchedule

        async with AsyncSessionLocal() as session:
            nodes_result = await session.execute(select(CampusNode))
            nodes = nodes_result.scalars().all()

            edges_result = await session.execute(select(CampusEdge))
            edges = edges_result.scalars().all()

            faculty_result = await session.execute(select(Faculty))
            faculty_rows = faculty_result.scalars().all()

            schedule_result = await session.execute(select(FacultySchedule))
            schedule_rows = schedule_result.scalars().all()

        if not nodes:
            logger.warning("DB returned 0 campus nodes — falling back to JSON seed files.")
            return False

        campus_graph.load_from_db_rows(nodes, edges)
        faculty_store.load_from_db_rows(faculty_rows, schedule_rows)
        logger.info("Data loaded from database successfully.")
        return True

    except Exception as exc:
        logger.warning("Could not load from DB (%s) — using JSON seed files.", exc)
        return False


def _load_data_from_json() -> None:
    """Load campus and faculty data from JSON seed files (offline fallback)."""
    campus_json = DATA_DIR / "campus_graph.json"
    faculty_json = DATA_DIR / "faculty_timetable.json"
    campus_graph.load_from_json(campus_json)
    faculty_store.load_from_json(faculty_json)
    logger.info("Data loaded from JSON seed files.")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """FastAPI lifespan: load data on startup, clean up on shutdown."""
    logger.info("=== IARE Agent backend starting up ===")

    # Create DB tables (idempotent)
    try:
        await create_all_tables()
    except Exception as exc:
        logger.warning("Could not create tables (%s) — proceeding with JSON data.", exc)

    # Load campus and faculty data
    db_success = await _load_data_from_db()
    if not db_success:
        _load_data_from_json()

    # Pre-compile the LangGraph (avoids cold-start latency on first request)
    from agents.router_agent import get_compiled_graph
    get_compiled_graph()
    logger.info("LangGraph compiled and ready.")

    logger.info("=== Backend ready — all agents online ===")
    yield
    logger.info("=== Backend shutting down ===")


# ── FastAPI app ───────────────────────────────────────────────────────────────

app = FastAPI(
    title="IARE Agent",
    description="Multi-agent AI campus assistant for IARE college. Phase 1 MVP.",
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],   # Open for all origins — tighten in production
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Request / Response models ─────────────────────────────────────────────────

class ChatRequest(BaseModel):
    """Incoming chat message from the frontend."""
    message: str


class ChatResponse(BaseModel):
    """Unified response returned to the frontend."""
    agent: str
    success: bool
    message: str
    route_stops: list[str] | None = None
    total_distance_meters: float | None = None
    faculty_name: str | None = None
    location: str | None = None
    free_at: str | None = None


# ── Endpoints ─────────────────────────────────────────────────────────────────

@app.get("/health", tags=["system"])
async def health_check() -> dict:
    """Liveness endpoint — returns OK when the server is running."""
    return {
        "status": "ok",
        "campus_graph_loaded": campus_graph.is_loaded,
        "faculty_store_loaded": faculty_store.is_loaded,
        "campus_nodes": len(campus_graph.all_node_names()) if campus_graph.is_loaded else 0,
    }


@app.post("/chat", response_model=ChatResponse, tags=["chat"])
async def chat(request: ChatRequest) -> ChatResponse:
    """
    Main chat endpoint. Accepts a user message and returns a routed,
    agent-generated response.
    """
    if not request.message or not request.message.strip():
        raise HTTPException(status_code=400, detail="Message cannot be empty.")

    logger.info("Received message: %r", request.message[:120])

    try:
        result = run_router(request.message.strip())
    except Exception as exc:
        logger.exception("Router error for message %r", request.message)
        raise HTTPException(status_code=500, detail=f"Internal error: {exc}") from exc

    return ChatResponse(**result)


@app.get("/campus/nodes", tags=["campus"])
async def list_campus_nodes() -> dict:
    """Return all known campus location names (useful for the frontend autocomplete)."""
    if not campus_graph.is_loaded:
        raise HTTPException(status_code=503, detail="Campus map not yet loaded.")
    return {"nodes": campus_graph.all_node_names()}
