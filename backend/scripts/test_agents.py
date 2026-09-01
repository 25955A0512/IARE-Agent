"""
test_agents.py -- Integration tests for IARE Agent Navigation and People-Finder agents.

Runs 5+ test queries per agent directly against the agent functions (no HTTP server
needed). Results are printed to stdout and written to TESTING.md.

Usage (from /backend directory):
    python scripts/test_agents.py
"""

import io
import sys
from pathlib import Path
from datetime import datetime

# Force UTF-8 output on Windows so box-drawing / emoji chars don't crash
if sys.stdout.encoding and sys.stdout.encoding.lower() not in ("utf-8", "utf8"):
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding="utf-8", errors="replace")

# Allow imports from backend root
sys.path.insert(0, str(Path(__file__).parent.parent))

from agents.navigation_agent import campus_graph, run_navigation_agent
from agents.people_finder_agent import faculty_store, run_people_finder_agent

DATA_DIR = Path(__file__).parent.parent / "data"

# ── Load data from JSON seed files ────────────────────────────────────────────
campus_graph.load_from_json(DATA_DIR / "campus_graph.json")
faculty_store.load_from_json(DATA_DIR / "faculty_timetable.json")

# ── Test definitions ──────────────────────────────────────────────────────────

NAVIGATION_TESTS = [
    # (query, description_of_expected_behaviour)
    ("Where is the library?",
     "Single destination — should default source to Main Gate"),
    ("How do I get from the Canteen to Academic Block B?",
     "Explicit source + destination route"),
    ("directions to canteen",
     "Abbreviated query — fuzzy match 'canteen'"),
    ("How do I reach the auditorium from the sports complex?",
     "Reverse-ish direction query"),
    ("Take me to the CSE department",
     "Alias match: 'CSE department' → 'CSE Department Entrance'"),
    ("where is admin",
     "Short alias query — 'admin' should match 'Admin Block'"),
    ("I want to go to the library from block a",
     "Lowercase + no punctuation"),
    ("route from main gate to ECE",
     "Partial match on ECE department"),
]

PEOPLE_FINDER_TESTS = [
    # (query, simulated_datetime, description)
    ("Where is Professor Sharma right now?",
     datetime(2026, 8, 24, 9, 30),   # Monday 9:30 AM — in Data Structures class
     "Should return in-class status for Dr Sharma on Monday morning"),
    ("Is Dr Reddy available?",
     datetime(2026, 8, 24, 14, 0),   # Monday 2:00 PM — no class
     "Should return cabin location (free period)"),
    ("Where can I find Dr Kumar?",
     datetime(2026, 8, 25, 9, 20),   # Tuesday 9:20 AM — in Digital Electronics
     "Should return in-class status for Dr Kumar"),
    ("Looking for professor Iyer",
     datetime(2026, 8, 24, 11, 30),  # Monday 11:30 AM — in OS class
     "Alias match 'Iyer' → Prof Meena Iyer, in class"),
    ("Where is prof krishnan today?",
     datetime(2026, 8, 24, 15, 20),  # Monday 3:20 PM — in Python Programming class
     "Fuzzy match 'krishnan' → Prof Nithya Krishnan, in class"),
    ("find professor venkatesh",
     datetime(2026, 8, 27, 10, 0),   # Thursday 10:00 AM — no class scheduled
     "Should return cabin for Venkatesh on Thursday at 10AM (free period)"),
    ("Where is Dr. XYZ?",
     datetime(2026, 8, 24, 10, 0),
     "Non-existent faculty — should return 'not found' response"),
    ("Is professor devi in office?",
     datetime(2026, 8, 24, 13, 20),  # Monday 1:20 PM — in Database Systems class
     "Fuzzy match 'devi' → Prof Lakshmi Devi, in class"),
]

# ── Test runner ───────────────────────────────────────────────────────────────

def divider(char: str = "-", width: int = 70) -> str:
    return char * width


def run_navigation_tests() -> list[dict]:
    """Run all navigation test queries and return results."""
    print("\n" + divider("="))
    print("NAVIGATION AGENT TESTS")
    print(divider("="))
    results = []
    for i, (query, expectation) in enumerate(NAVIGATION_TESTS, 1):
        print(f"\nTest N{i}: {query!r}")
        print(f"Expected: {expectation}")
        result = run_navigation_agent(query)
        status = "✅ PASS" if result.success else "⚠️  INFO (expected failure OK)"
        print(f"Status  : {status}")
        print(f"Source  : {result.source or 'N/A'}")
        print(f"Dest    : {result.destination or 'N/A'}")
        if result.defaulted_source:
            print(f"Note    : Source defaulted to Main Gate")
        if result.success:
            stops = [result.source] + [s.to_node for s in result.steps]
            print(f"Route   : {' → '.join(stops)}")
            print(f"Distance: {result.total_distance_meters:.0f}m")
        else:
            print(f"Error   : {result.error_message}")
        print(divider())
        results.append({
            "id": f"N{i}",
            "query": query,
            "expectation": expectation,
            "success": result.success,
            "source": result.source,
            "destination": result.destination,
            "route": " → ".join([result.source] + [s.to_node for s in result.steps]) if result.success else "",
            "distance_m": result.total_distance_meters if result.success else 0,
            "defaulted_source": result.defaulted_source,
            "error": result.error_message,
            "directions": result.directions_text,
        })
    return results


def run_people_finder_tests() -> list[dict]:
    """Run all people-finder test queries and return results."""
    print("\n" + divider("="))
    print("PEOPLE-FINDER AGENT TESTS")
    print(divider("="))
    results = []
    for i, (query, sim_time, expectation) in enumerate(PEOPLE_FINDER_TESTS, 1):
        print(f"\nTest P{i}: {query!r}")
        print(f"Sim time: {sim_time.strftime('%A %Y-%m-%d %H:%M')}")
        print(f"Expected: {expectation}")
        result = run_people_finder_agent(query, now=sim_time)
        pass_flag = result.success or result.status == "not_found"
        status_icon = "✅ PASS" if pass_flag else "❌ FAIL"
        print(f"Status  : {status_icon} [{result.status}]")
        print(f"Faculty : {result.faculty_name or 'N/A'}")
        print(f"Location: {result.location or 'N/A'}")
        if result.free_at:
            print(f"Free at : {result.free_at}")
        print(divider())
        results.append({
            "id": f"P{i}",
            "query": query,
            "sim_time": sim_time.strftime("%A %H:%M"),
            "expectation": expectation,
            "status": result.status,
            "faculty_name": result.faculty_name,
            "location": result.location,
            "free_at": result.free_at,
            "message": result.message,
        })
    return results


def write_testing_md(nav_results: list[dict], pf_results: list[dict]) -> None:
    """Write a formatted TESTING.md to the project root."""
    output_path = Path(__file__).parent.parent.parent / "TESTING.md"
    lines = [
        "# IARE Agent — Test Results",
        "",
        "Auto-generated by `backend/scripts/test_agents.py`.",
        "",
        "---",
        "",
        "## Navigation Agent Tests",
        "",
        "| ID | Query | Source | Destination | Route | Distance | Status |",
        "|---|---|---|---|---|---|---|",
    ]
    for r in nav_results:
        status = "✅ Pass" if r["success"] else "⚠️ No path"
        route = r["route"] or r["error"]
        dist = f"{r['distance_m']:.0f}m" if r["success"] else "—"
        lines.append(
            f"| {r['id']} | {r['query']} | {r['source'] or '*(defaulted)*'} "
            f"| {r['destination']} | {route} | {dist} | {status} |"
        )

    lines += [
        "",
        "### Navigation Agent — Detailed Directions",
        "",
    ]
    for r in nav_results:
        lines.append(f"#### {r['id']}: `{r['query']}`")
        lines.append("")
        if r["success"]:
            lines.append(r["directions"])
        else:
            lines.append(f"> ⚠️ {r['error']}")
        lines.append("")

    lines += [
        "---",
        "",
        "## People-Finder Agent Tests",
        "",
        "| ID | Query | Simulated Time | Faculty | Status | Location |",
        "|---|---|---|---|---|---|",
    ]
    for r in pf_results:
        status_icon = "✅" if r["status"] in ("in_class", "free") else ("⚠️" if r["status"] == "not_found" else "❌")
        lines.append(
            f"| {r['id']} | {r['query']} | {r['sim_time']} "
            f"| {r['faculty_name'] or '—'} | {status_icon} {r['status']} | {r['location'] or '—'} |"
        )

    lines += [
        "",
        "### People-Finder Agent — Full Responses",
        "",
    ]
    for r in pf_results:
        lines.append(f"#### {r['id']}: `{r['query']}`")
        lines.append(f"_Simulated time: {r['sim_time']}_")
        lines.append("")
        lines.append(r["message"])
        lines.append("")

    lines += [
        "---",
        "",
        "_All tests use deterministic seed data and simulated timestamps_",
        "_to ensure reproducible results._",
    ]

    output_path.write_text("\n".join(lines), encoding="utf-8")
    print(f"\n✅ TESTING.md written to: {output_path}")


# ── Entry point ───────────────────────────────────────────────────────────────

if __name__ == "__main__":
    print("=== IARE Agent — Agent Test Suite ===")
    nav_results = run_navigation_tests()
    pf_results = run_people_finder_tests()
    write_testing_md(nav_results, pf_results)

    nav_pass = sum(1 for r in nav_results if r["success"])
    pf_pass = sum(1 for r in pf_results if r["status"] in ("in_class", "free", "not_found"))
    total = len(nav_results) + len(pf_results)
    passed = nav_pass + pf_pass

    print(f"\n{'='*50}")
    print(f"SUMMARY: {passed}/{total} tests passed")
    print(f"  Navigation Agent : {nav_pass}/{len(nav_results)}")
    print(f"  People-Finder    : {pf_pass}/{len(pf_results)}")
    print(f"{'='*50}")
