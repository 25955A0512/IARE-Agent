"""
live_test.py — End-to-end HTTP tests against the running IARE Agent backend.
Hits localhost:8000/chat with 15 diverse queries and prints a full report.
"""

import json
import sys
import time
import io

# Force UTF-8 for Windows terminals
if sys.stdout.encoding and sys.stdout.encoding.lower() not in ("utf-8", "utf8"):
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding="utf-8", errors="replace")

import httpx

BASE = "http://localhost:8000"
PASS = "[PASS]"
FAIL = "[FAIL]"
INFO = "[INFO]"

# ── Test cases ────────────────────────────────────────────────────────────────
# Each: (query, expected_agent, check_fn, description)
# check_fn receives the JSON response dict and returns (bool, detail_str)

def nav_has_route(r):
    stops = r.get("route_stops") or []
    dist  = r.get("total_distance_meters", 0)
    return len(stops) >= 2 and dist > 0, f"stops={stops}  dist={dist}m"

def nav_src_main_gate(r):
    stops = r.get("route_stops") or []
    ok = stops and stops[0] == "Main Gate"
    return ok, f"first_stop={stops[0] if stops else 'none'}"

def nav_dest_library(r):
    stops = r.get("route_stops") or []
    ok = stops and stops[-1] == "Library"
    return ok, f"last_stop={stops[-1] if stops else 'none'}"

def nav_dest_canteen(r):
    stops = r.get("route_stops") or []
    ok = stops and stops[-1] == "Canteen"
    return ok, f"last_stop={stops[-1] if stops else 'none'}"

def nav_dest_admin(r):
    stops = r.get("route_stops") or []
    ok = stops and stops[-1] == "Admin Block"
    return ok, f"last_stop={stops[-1] if stops else 'none'}"

def nav_dest_auditorium(r):
    stops = r.get("route_stops") or []
    ok = stops and stops[-1] == "Auditorium"
    return ok, f"last_stop={stops[-1] if stops else 'none'}"

def nav_dest_cse(r):
    stops = r.get("route_stops") or []
    ok = stops and "CSE" in (stops[-1] if stops else "")
    return ok, f"last_stop={stops[-1] if stops else 'none'}"

def pf_in_class(r):
    msg = r.get("message", "")
    ok = "in class" in msg.lower() or "currently" in msg.lower()
    loc = r.get("location", "—")
    return ok, f"location={loc}"

def pf_cabin(r):
    msg = r.get("message", "")
    ok = "cabin" in msg.lower() or "likely available" in msg.lower()
    loc = r.get("location", "—")
    return ok, f"location={loc}"

def pf_not_found(r):
    msg = r.get("message", "").lower()
    ok = r.get("success") == False and ("not found" in msg or "couldn't find" in msg or "could not find" in msg)
    return ok, f"success={r.get('success')}  msg_snippet={r.get('message','')[:60]}"

def oos_check(r):
    ok = r.get("agent") == "out_of_scope"
    return ok, f"agent={r.get('agent')}"

TESTS = [
    # ── Navigation ───────────────────────────────────────────────────────────
    ("Where is the Library?",
     "navigation", [nav_has_route, nav_dest_library, nav_src_main_gate],
     "Single destination - defaults to Main Gate"),

    ("How do I get from the Canteen to Block B?",
     "navigation", [nav_has_route,
                    lambda r: (r.get("route_stops",[""])[-1] == "Academic Block B",
                               f"last_stop={r.get('route_stops',['?'])[-1]}")],
     "Explicit source+dest - Canteen (src) -> Block B (dst)"),

    ("directions to admin block",
     "navigation", [nav_has_route, nav_dest_admin],
     "Abbreviated query - 'admin block'"),

    ("Take me to the auditorium",
     "navigation", [nav_has_route, nav_dest_auditorium],
     "Casual phrasing"),

    ("How do I reach the CSE department?",
     "navigation", [nav_has_route, nav_dest_cse],
     "Department alias"),

    ("where is canteen",
     "navigation", [nav_has_route, nav_dest_canteen],
     "Minimal query - no punctuation"),

    # ── People-Finder ─────────────────────────────────────────────────────────
    ("Where is Professor Sharma right now?",
     "people_finder", [lambda r: (r.get("faculty_name","").endswith("Sharma"), f"faculty={r.get('faculty_name')}")],
     "Clean name match - Sharma"),

    ("Is Dr Reddy available?",
     "people_finder", [lambda r: ("Reddy" in r.get("faculty_name",""), f"faculty={r.get('faculty_name')}")],
     "Availability question - Reddy"),

    ("find dr kumar",
     "people_finder", [lambda r: ("Kumar" in r.get("faculty_name",""), f"faculty={r.get('faculty_name')}")],
     "Lowercase - Kumar"),

    ("where is prof krishnan",
     "people_finder", [lambda r: ("Krishnan" in r.get("faculty_name",""), f"faculty={r.get('faculty_name')}")],
     "Fuzzy - Krishnan"),

    ("looking for professor tiwari",
     "people_finder", [lambda r: ("Tiwari" in r.get("faculty_name",""), f"faculty={r.get('faculty_name')}")],
     "Alias phrasing - Tiwari"),

    ("Where is Dr. XYZ right now?",
     "people_finder", [pf_not_found],
     "Non-existent faculty - should return honest not-found"),

    # ── Out of scope ──────────────────────────────────────────────────────────
    ("What is the syllabus for Data Structures?",
     "out_of_scope", [oos_check],
     "Tutoring query - should be out of scope"),

    ("When is the cultural fest?",
     "out_of_scope", [oos_check],
     "Events query - out of scope"),

    ("What's the weather today?",
     "out_of_scope", [oos_check],
     "Completely off-topic"),
]

# ── Runner ────────────────────────────────────────────────────────────────────

def sep(char="-", n=72):
    return char * n

def run_tests():
    print(sep("="))
    print("  IARE Agent -- Live End-to-End API Test Suite")
    print(f"  Target: {BASE}/chat")
    print(sep("="))

    # Health check first
    try:
        h = httpx.get(f"{BASE}/health", timeout=5)
        hd = h.json()
        print(f"\n{INFO} Health: status={hd['status']}  "
              f"graph={hd['campus_graph_loaded']}  "
              f"faculty={hd['faculty_store_loaded']}  "
              f"nodes={hd['campus_nodes']}")
    except Exception as e:
        print(f"\n{FAIL} Backend unreachable: {e}")
        sys.exit(1)

    results = []
    nav_p = nav_f = pf_p = pf_f = oos_p = oos_f = 0

    for i, (query, expected_agent, checks, desc) in enumerate(TESTS, 1):
        print(f"\nTest {i:02d}: {query!r}")
        print(f"         {desc}")

        t0 = time.time()
        try:
            resp = httpx.post(f"{BASE}/chat", json={"message": query}, timeout=20)
            resp.raise_for_status()
            data = resp.json()
            elapsed = time.time() - t0
        except Exception as e:
            print(f"         {FAIL} HTTP error: {e}")
            results.append(False)
            continue

        got_agent  = data.get("agent", "?")
        agent_ok   = got_agent == expected_agent
        agent_icon = PASS if agent_ok else FAIL

        print(f"         {agent_icon} Agent routed to: {got_agent}  (expected: {expected_agent})  [{elapsed:.2f}s]")

        check_pass = True
        for check in checks:
            ok, detail = check(data)
            icon = PASS if ok else FAIL
            print(f"              {icon} {detail}")
            if not ok:
                check_pass = False

        overall = agent_ok and check_pass
        results.append(overall)

        if expected_agent == "navigation":
            if overall: nav_p += 1
            else: nav_f += 1
        elif expected_agent == "people_finder":
            if overall: pf_p += 1
            else: pf_f += 1
        else:
            if overall: oos_p += 1
            else: oos_f += 1

        # Print truncated message for context
        msg = data.get("message", "")
        print(f"         Response snippet: {msg[:100].replace(chr(10),' ')}...")

    # Summary
    total  = len(results)
    passed = sum(results)
    print(f"\n{sep('=')}")
    print(f"  RESULTS: {passed}/{total} tests passed")
    print(f"  Navigation Agent : {nav_p}/{nav_p+nav_f}")
    print(f"  People-Finder    : {pf_p}/{pf_p+pf_f}")
    print(f"  Out of Scope     : {oos_p}/{oos_p+oos_f}")
    print(sep("="))

    if passed == total:
        print("  ALL TESTS PASSED!")
    else:
        failed = [TESTS[i][0] for i, ok in enumerate(results) if not ok]
        print(f"  Failed queries: {failed}")

if __name__ == "__main__":
    run_tests()
