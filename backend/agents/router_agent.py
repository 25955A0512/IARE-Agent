"""
router_agent.py — LangGraph Router Agent for IARE Agent.

Classifies each incoming user message into one of three categories:
  - "navigation"     → dispatches to NavigationAgent
  - "people_finder"  → dispatches to PeopleFinderAgent
  - "out_of_scope"   → politely declines (RAG/tutor/events come in later phases)

Two modes:
  1. LLM mode  (USE_LLM_ROUTER=True):  Uses Groq LLM with a strict prompt.
  2. Keyword mode (USE_LLM_ROUTER=False): Deterministic keyword classifier — fully
     offline and free, no API key required.

The LangGraph StateGraph is intentionally minimal for this MVP phase.
"""

from __future__ import annotations

import logging
import re
from dataclasses import asdict, dataclass
from typing import Annotated, Any, Literal

from typing_extensions import TypedDict

from config import GROQ_API_KEY, GROQ_MODEL, USE_LLM_ROUTER
from agents.navigation_agent import NavigationResult, run_navigation_agent
from agents.people_finder_agent import PeopleFinderResult, run_people_finder_agent

logger = logging.getLogger(__name__)

# ── Shared state type for LangGraph ──────────────────────────────────────────

class AgentState(TypedDict):
    """State that flows through the LangGraph graph nodes."""
    user_message: str
    intent: str                   # "navigation" | "people_finder" | "out_of_scope"
    agent_response: dict[str, Any] | None


# ── Unified response type ─────────────────────────────────────────────────────

@dataclass
class RouterResponse:
    """Unified response returned by the router to the FastAPI endpoint."""
    agent: str           # "navigation" | "people_finder" | "out_of_scope"
    success: bool
    message: str         # Human-readable answer (markdown)
    # Navigation-specific extras
    route_stops: list[str] | None = None      # Ordered list of node names
    total_distance_meters: float | None = None
    # People-finder extras
    faculty_name: str | None = None
    location: str | None = None
    free_at: str | None = None


# ── Keyword-based classifier (fallback, no API key needed) ────────────────────

_NAVIGATION_PATTERNS = [
    r"\bwhere is\b", r"\bhow (do i|can i|to) (get|go|reach|find|walk)\b",
    r"\bdirections?\b", r"\bpath\b", r"\broute\b",
    r"\bfrom\b.+\bto\b", r"\bto the\b", r"\bfind (the|a)\b",
    r"\blocate\b", r"\blocated\b", r"\blocation of\b",
    r"\bcanteen\b", r"\blibrary\b", r"\badmin\b", r"\bauditorium\b",
    r"\bblock [abc]\b", r"\bsports\b", r"\bgate\b", r"\bstudent services\b",
    r"\bcse dept\b", r"\bece dept\b", r"\bnavigat\b",
]

_PEOPLE_PATTERNS = [
    r"\bprofessor\b", r"\bprof\b", r"\bdr\.?\b", r"\bdoctor\b",
    r"\bfaculty\b", r"\blecturer\b",
    r"\bsharma\b", r"\breddy\b", r"\bkumar\b", r"\biyer\b",
    r"\bvenkatesh\b", r"\bdevi\b", r"\btiwari\b", r"\bkrishnan\b",
    r"\bwhere is\b.{0,30}\b(prof|dr|professor|faculty)\b",
    r"\b(prof|dr|professor|faculty)\b.{0,30}\bwhere\b",
    r"\bfind\b.{0,20}\b(professor|prof|dr)\b",
    r"\blooking for\b",
    r"\bteacher\b", r"\binstructor\b",
]

_OUT_OF_SCOPE_PATTERNS = [
    r"\btoday.s (schedule|timetable|events?|news)\b",
    r"\bevent[s]?\b", r"\bfest\b", r"\bhackathon\b",
    r"\btelegram\b", r"\bwhatsapp\b",
    r"\bsyllabus\b", r"\bsubject\b", r"\btutor\b", r"\bmentor\b",
    r"\bweather\b", r"\bnews\b",
]


def _keyword_classify(message: str) -> Literal["navigation", "people_finder", "out_of_scope"]:
    """
    Classify message using regex keyword patterns.
    People-finder takes priority over navigation when both match (e.g. "where is Prof Sharma").
    """
    msg = message.lower()

    people_score = sum(1 for p in _PEOPLE_PATTERNS if re.search(p, msg))
    nav_score = sum(1 for p in _NAVIGATION_PATTERNS if re.search(p, msg))

    logger.debug("Keyword scores — people: %d, nav: %d", people_score, nav_score)

    if people_score >= 2:
        return "people_finder"
    if people_score == 1 and nav_score == 0:
        return "people_finder"
    if nav_score >= 1:
        return "navigation"
    if people_score == 1 and nav_score >= 1:
        # Ambiguous: check for faculty name keywords specifically
        if re.search(r"\b(prof|dr|professor|faculty|lecturer|sharma|reddy|kumar|iyer|venkatesh|devi|tiwari|krishnan)\b", msg):
            return "people_finder"
        return "navigation"

    return "out_of_scope"


# ── LLM-based classifier (Groq) ───────────────────────────────────────────────

_CLASSIFICATION_SYSTEM_PROMPT = """\
You are an intent classifier for a university campus assistant.
Classify the user message into EXACTLY ONE of these three categories:

1. navigation   — The user wants directions to a place on campus, or asks where a 
                  building/facility is located (e.g. canteen, library, admin block, auditorium).
2. people_finder — The user wants to find a specific faculty member, professor, or doctor 
                  (asks where they are, if they're available, what room they're in).
3. out_of_scope — Anything else: syllabus questions, events, weather, tutoring, 
                  Telegram, WhatsApp, or anything not covered above.

Respond with ONLY the category name (one word, lowercase). No explanation. No punctuation.
Examples:
  "Where is the library?" → navigation
  "How do I get to the canteen from Block A?" → navigation
  "Where is Professor Sharma right now?" → people_finder
  "Is Dr Iyer available?" → people_finder
  "What is the syllabus for algorithms?" → out_of_scope
  "When is the cultural fest?" → out_of_scope
"""


def _llm_classify(message: str) -> Literal["navigation", "people_finder", "out_of_scope"]:
    """Classify using Groq LLM. Falls back to keyword classifier on any error."""
    try:
        from langchain_groq import ChatGroq
        from langchain_core.messages import HumanMessage, SystemMessage

        llm = ChatGroq(model=GROQ_MODEL, api_key=GROQ_API_KEY, temperature=0)
        response = llm.invoke(
            [
                SystemMessage(content=_CLASSIFICATION_SYSTEM_PROMPT),
                HumanMessage(content=message),
            ]
        )
        raw = response.content.strip().lower()
        logger.debug("LLM classification raw response: %r", raw)

        if "people" in raw or "finder" in raw:
            return "people_finder"
        if "navigation" in raw or "nav" in raw:
            return "navigation"
        if "scope" in raw or "other" in raw:
            return "out_of_scope"

        # If the LLM returned something unexpected, fall back
        logger.warning("LLM returned unexpected classification %r — falling back", raw)
        return _keyword_classify(message)

    except Exception as exc:
        logger.warning("LLM classification failed (%s) — using keyword fallback", exc)
        return _keyword_classify(message)


# ── LangGraph nodes ───────────────────────────────────────────────────────────

def node_classify(state: AgentState) -> AgentState:
    """LangGraph node: classify the user message and set state['intent']."""
    message = state["user_message"]
    if USE_LLM_ROUTER:
        intent = _llm_classify(message)
        logger.info("LLM router classified message as: %s", intent)
    else:
        intent = _keyword_classify(message)
        logger.info("Keyword router classified message as: %s", intent)
    return {**state, "intent": intent}


def node_navigation(state: AgentState) -> AgentState:
    """LangGraph node: run the navigation agent."""
    result: NavigationResult = run_navigation_agent(state["user_message"])
    stops = [step.to_node for step in result.steps] if result.steps else []
    if result.success and result.source:
        stops = [result.source] + stops

    response = RouterResponse(
        agent="navigation",
        success=result.success,
        message=result.directions_text if result.success else result.error_message,
        route_stops=stops,
        total_distance_meters=result.total_distance_meters if result.success else None,
    )
    return {**state, "agent_response": _to_dict(response)}


def node_people_finder(state: AgentState) -> AgentState:
    """LangGraph node: run the people-finder agent."""
    result: PeopleFinderResult = run_people_finder_agent(state["user_message"])
    response = RouterResponse(
        agent="people_finder",
        success=result.success,
        message=result.message,
        faculty_name=result.faculty_name,
        location=result.location,
        free_at=result.free_at or None,
    )
    return {**state, "agent_response": _to_dict(response)}


def node_out_of_scope(state: AgentState) -> AgentState:
    """LangGraph node: politely decline out-of-scope queries."""
    response = RouterResponse(
        agent="out_of_scope",
        success=False,
        message=(
            "I'm sorry, I can't help with that yet. 🙂\n\n"
            "In this version I can assist with:\n"
            "- 📍 **Navigation** — finding buildings, getting directions on campus\n"
            "- 👤 **Faculty location** — checking where a professor currently is\n\n"
            "Features like the daily brief, event listings, and tutoring are coming soon!"
        ),
    )
    return {**state, "agent_response": _to_dict(response)}


def _to_dict(response: RouterResponse) -> dict[str, Any]:
    """Convert RouterResponse dataclass to a plain dict (JSON-serialisable)."""
    return asdict(response)


def _route(state: AgentState) -> str:
    """LangGraph conditional edge: route based on the classified intent."""
    return state.get("intent", "out_of_scope")


# ── Build LangGraph ───────────────────────────────────────────────────────────

def build_graph():
    """Construct and compile the LangGraph StateGraph."""
    from langgraph.graph import StateGraph, END

    graph = StateGraph(AgentState)
    graph.add_node("classify", node_classify)
    graph.add_node("navigation", node_navigation)
    graph.add_node("people_finder", node_people_finder)
    graph.add_node("out_of_scope", node_out_of_scope)

    graph.set_entry_point("classify")
    graph.add_conditional_edges(
        "classify",
        _route,
        {
            "navigation": "navigation",
            "people_finder": "people_finder",
            "out_of_scope": "out_of_scope",
        },
    )
    graph.add_edge("navigation", END)
    graph.add_edge("people_finder", END)
    graph.add_edge("out_of_scope", END)

    return graph.compile()


# Singleton compiled graph
_compiled_graph = None


def get_compiled_graph():
    """Return the singleton compiled LangGraph (lazy init)."""
    global _compiled_graph
    if _compiled_graph is None:
        _compiled_graph = build_graph()
    return _compiled_graph


# ── Main entry point ──────────────────────────────────────────────────────────

def run_router(message: str) -> dict[str, Any]:
    """
    Process a user message through the full router → specialist agent pipeline.

    Args:
        message: Raw user query string.

    Returns:
        dict representation of RouterResponse.
    """
    graph = get_compiled_graph()
    initial_state: AgentState = {
        "user_message": message,
        "intent": "",
        "agent_response": None,
    }
    final_state = graph.invoke(initial_state)
    return final_state.get("agent_response", _to_dict(RouterResponse(
        agent="out_of_scope",
        success=False,
        message="An unexpected error occurred. Please try again.",
    )))
