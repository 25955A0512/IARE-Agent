"""
router_agent.py — LangGraph router that dispatches queries to specialist agents.

Dispatches queries to:
- Greeting handler (warm campus greeting with student name)
- Navigation Agent (Campus routing, pathfinding, SVG coordinates)
- Student Monitor Agent (Samvidha academic data: attendance, timetable, CIE marks, mentor, lab status)
- IARE RAG Agent (Official IARE website www.iare.ac.in: professors, leadership, regulations, placements, admissions, facilities)
- General Assistant Agent (Broad Q&A, homework help, conceptual explanations, code/maths guidance, weakness detection)
"""

import logging
import re
from typing import Any, Dict, List, Optional, TypedDict

from langgraph.graph import StateGraph, END
from agents.query_normalizer import normalize_query

log = logging.getLogger(__name__)


class RouterState(TypedDict):
    """Shared state passed between LangGraph nodes."""
    query: str
    student_context: Optional[Dict[str, Any]]
    onboarding_context: Optional[Dict[str, Any]]
    weak_topics: Optional[List[str]]
    recent_messages: Optional[List[Dict[str, str]]]
    summary_memory: Optional[str]
    active_events: Optional[List[Dict[str, Any]]]
    agent: str
    result: dict


def build_router(nav_agent, student_agent=None, general_agent=None, iare_rag_agent=None) -> StateGraph:
    """
    Build and compile the LangGraph router.

    Graph: classify → [greeting | navigation | student_monitor | iare_rag | general_assistant] → END
    """

    def classify(state: RouterState) -> RouterState:
        """Classify the query and assign it to the appropriate specialist agent."""
        norm_query = normalize_query(state["query"])
        query = norm_query.lower().strip()
        state["query"] = norm_query

        GREETING_KEYWORDS = {
            "hello", "hi", "hey", "greetings", "good morning", "good afternoon",
            "good evening", "who are you", "what can you do", "help me", "introduce yourself"
        }

        # Standby / Dismissive Phrases
        STANDBY_KEYWORDS = {
            "nothing just be cool", "just be cool", "be cool", "nothing", "chill",
            "just chill", "be quiet", "stay quiet", "mute", "standby", "all good",
            "nevermind", "nothing for now", "nothing much", "just listening"
        }

        STUDENT_MONITOR_KEYWORDS = {
            "attendance", "bunk", "leave", "skip", "timetable", "time table", "schedule",
            "next class", "current class", "today's class", "today class", "my class", "classes today",
            "which class", "period", "periods", "when is my class", "where is my class",
            "cie marks", "internal marks", "internals", "marks", "score", "grade", "grades",
            "mentor", "counselor", "advisor", "samvidha", "75%",
            "who am i", "my profile", "my details", "dob", "date of birth",
            "my name", "my info", "blood group", "my department", "my section", "my roll",
            "my lab submission", "my assignment", "lab", "labs", "due date", "deadline",
            "faculty for", "teacher for", "who teaches", "who is the faculty", "who is teaching",
            "faculty of", "teacher of", "professor for", "instructor for"
        }

        NAV_KEYWORDS = {
            "where is", "how to get", "directions to", "route to", "navigate to",
            "way to", "location of", "path to", "reach", "from gate to",
            "admin block", "placement cell", "sports complex", "open air theatre",
            "mechanical lab", "aeronautical lab", "civil lab", "academic block"
        }

        # Official Website & Faculty Inquiries
        IARE_WEBSITE_KEYWORDS = {
            "iare", "institute of aeronautical engineering", "principal", "dean",
            "hod", "head of department", "director",
            "narasimha prasad", "raghavendra", "mohana roopa", "srinivasa rao",
            "padmaja", "ramu", "ashok babu", "sudhir sastry", "rizwana", "gandham ohm",
            "accreditation", "naac", "nba", "nirf", "autonomous", "regulation", "regulations", "r23", "r22",
            "admission", "admissions", "eamcet", "eapcet", "eamcet code", "category b", "management quota",
            "placement", "placements", "package", "packages", "highest package", "average package", "salary", "lpa", "recruiters", "companies", "cdpc",
            "central library", "digital library", "library timings", "hostel fee", "hostel facility", "hostel",
            "college history", "established", "maruthi educational", "dundigal",
            "website", "iare.ac.in", "official website"
        }

        # Check if query asks for college external location vs internal campus navigation
        is_college_location = any(kw in query for kw in [
            "where is iare", "where is college", "where is the college", "college located",
            "campus located", "where is the campus", "address of iare", "address of college", "where is dundigal"
        ])

        if is_college_location:
            agent = "iare_rag"
        elif any(re.search(rf"^{re.escape(s)}[\.!\?]*$", query) for s in STANDBY_KEYWORDS) or query in STANDBY_KEYWORDS:
            agent = "general_assistant"
        elif any(re.search(rf"\b{re.escape(g)}\b", query) for g in GREETING_KEYWORDS):
            agent = "greeting"
        elif any(kw in query for kw in STUDENT_MONITOR_KEYWORDS):
            agent = "student_monitor"
        elif any(kw in query for kw in NAV_KEYWORDS):
            agent = "navigation"
        elif any(kw in query for kw in IARE_WEBSITE_KEYWORDS):
            agent = "iare_rag"
        else:
            # Everything else routed to General Assistant Agent
            agent = "general_assistant"

        log.info("Router classified %r -> %s", state["query"][:60], agent)
        return {**state, "agent": agent}

    def run_greeting(state: RouterState) -> RouterState:
        """Return a warm campus greeting personalized with student name."""
        ctx = state.get("student_context") or {}
        name = ctx.get("fullName")
        roll = ctx.get("rollNo")

        if name:
            greeting_line = f"Hey **{name}**! 👋 Great to see you. How are your classes going today?"
        elif roll:
            greeting_line = f"Hey `{roll}`! 👋 Good to see you on campus."
        else:
            greeting_line = "Hey there! 👋 Welcome to your IARE Campus Companion."

        result = {
            "success": True,
            "agent": "greeting",
            "message": (
                f"{greeting_line}\n\n"
                "I'm here to help make campus life a breeze — whether you want to check your attendance stats, "
                "figure out if you can safely take a day off, get step-by-step directions around IARE, look up faculty details, or work through a tricky homework concept.\n\n"
                "**What's on your mind? Here are a few things we can do:**\n"
                "• *'What is my current attendance?'* 📊\n"
                "• *'Who is the Principal / HOD of CSE?'* 🏛️\n"
                "• *'What is the highest package in IARE placements?'* 💼\n"
                "• *'Explain Binary Search Trees with a diagram'* 🌲\n"
                "• *'How do I walk from Main Gate to Central Library?'* 📍"
            ),
        }
        return {**state, "result": result}

    def run_navigation(state: RouterState) -> RouterState:
        """Run the Navigation Agent."""
        result = nav_agent.handle(state["query"])
        return {**state, "result": result}

    def run_student_monitor(state: RouterState) -> RouterState:
        """Run the Student Monitor Agent with Samvidha context."""
        if student_agent:
            result = student_agent.handle(state["query"], state.get("student_context"))
        else:
            result = {
                "success": True,
                "agent": "student_monitor",
                "message": "Student monitoring agent is initializing.",
            }
        return {**state, "result": result}

    def run_iare_rag(state: RouterState) -> RouterState:
        """Run the Official IARE Website RAG Agent."""
        if iare_rag_agent:
            result = iare_rag_agent.handle(
                query=state["query"],
                student_context=state.get("student_context"),
                onboarding_context=state.get("onboarding_context")
            )
        else:
            result = {
                "success": True,
                "agent": "iare_rag",
                "message": "Official IARE website knowledge agent is initializing.",
            }
        return {**state, "result": result}

    def run_general_assistant(state: RouterState) -> RouterState:
        """Run the General Assistant Agent for Q&A, homework help, concept clarifications, and event intelligence."""
        if general_agent:
            result = general_agent.handle(
                query=state["query"],
                student_context=state.get("student_context"),
                onboarding_context=state.get("onboarding_context"),
                weak_topics=state.get("weak_topics"),
                recent_messages=state.get("recent_messages"),
                summary_memory=state.get("summary_memory"),
                active_events=state.get("active_events")
            )
        else:
            result = {
                "success": True,
                "agent": "general_assistant",
                "message": "Here is information regarding your query.",
                "subject": "General Studies",
                "topic": "Academic Inquiry",
            }
        return {**state, "result": result}

    def route(state: RouterState) -> str:
        """Conditional edge — decide which node to run next."""
        return state["agent"]

    # ── Build the LangGraph ────────────────────────────────────────────────
    graph = StateGraph(RouterState)
    graph.add_node("classify", classify)
    graph.add_node("greeting", run_greeting)
    graph.add_node("navigation", run_navigation)
    graph.add_node("student_monitor", run_student_monitor)
    graph.add_node("iare_rag", run_iare_rag)
    graph.add_node("general_assistant", run_general_assistant)

    graph.set_entry_point("classify")
    graph.add_conditional_edges(
        "classify",
        route,
        {
            "greeting": "greeting",
            "navigation": "navigation",
            "student_monitor": "student_monitor",
            "iare_rag": "iare_rag",
            "general_assistant": "general_assistant",
        }
    )
    graph.add_edge("greeting", END)
    graph.add_edge("navigation", END)
    graph.add_edge("student_monitor", END)
    graph.add_edge("iare_rag", END)
    graph.add_edge("general_assistant", END)

    compiled = graph.compile()
    log.info("LangGraph router compiled with Navigation, StudentMonitor, IARERag, and GeneralAssistant agents")
    return compiled
