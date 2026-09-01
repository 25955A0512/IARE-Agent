"""
tests/test_navigation.py — Verifies 5+ navigation pairs from the campus data.

Run from ai-service/ directory:
    python -m pytest tests/test_navigation.py -v
"""
import io
import sys
import os

if sys.stdout.encoding and sys.stdout.encoding.lower() not in ("utf-8", "utf8"):
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")

# Point config to the data file
os.environ.setdefault("CAMPUS_DATA_PATH", "data/campus_overview.json")
os.environ.setdefault("AI_SERVICE_SHARED_SECRET", "test-secret")

import pytest
from agents.navigation_agent import NavigationAgent

@pytest.fixture(scope="module")
def agent():
    return NavigationAgent()


# ── Navigation pair tests ─────────────────────────────────────────────────────

PAIRS = [
    ("Where is the Library?",                          "Library"),
    ("How do I get to the Admin Block?",               "Admin Block"),
    ("How do I get from the Canteen to Block B?",      "Academic Block B"),
    ("Take me to the CSE department",                  "CSE Department Entrance"),
    ("Directions from Main Gate to Auditorium",        "Auditorium"),
    ("Where is the canteen?",                          "Canteen"),
    ("How do I reach the Sports Complex?",             "Sports Complex"),
]

@pytest.mark.parametrize("query,expected_dest", PAIRS)
def test_navigation_returns_route(agent: NavigationAgent, query: str, expected_dest: str):
    result = agent.handle(query)
    assert result["success"], f"Navigation failed for {query!r}: {result.get('error')}"
    stops = result["route_stops"]
    assert len(stops) >= 2, f"Route too short: {stops}"
    assert stops[-1] == expected_dest, f"Expected dest={expected_dest!r}, got {stops[-1]!r}\nFull route: {stops}"
    assert result["total_distance_meters"] > 0


def test_not_found_returns_graceful(agent: NavigationAgent):
    result = agent.handle("Where is the Zqwxyz Frobnicator room?")
    assert result["success"] is False, f"Expected failure but got: {result}"


def test_default_source_is_main_gate(agent: NavigationAgent):
    result = agent.handle("Where is the Library?")
    assert result["success"]
    assert result["source_node"] == "Main Gate"
    assert result["route_stops"][0] == "Main Gate"


def test_explicit_source_used(agent: NavigationAgent):
    result = agent.handle("From Canteen to Academic Block B")
    assert result["success"]
    assert result["route_stops"][0] == "Canteen"
    assert result["route_stops"][-1] == "Academic Block B"
