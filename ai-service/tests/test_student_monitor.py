"""
tests/test_student_monitor.py — Tests for StudentMonitorAgent and LangGraph routing.

Run with:
    pytest tests/test_student_monitor.py -v
"""

import io
import os
import sys
import pytest

if sys.stdout.encoding and sys.stdout.encoding.lower() not in ("utf-8", "utf8"):
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")

os.environ.setdefault("CAMPUS_DATA_PATH", "data/campus_overview.json")
os.environ.setdefault("AI_SERVICE_SHARED_SECRET", "test-secret")

from agents.navigation_agent import NavigationAgent
from agents.student_monitor_agent import StudentMonitorAgent
from agents.router_agent import build_router


@pytest.fixture(scope="module")
def student_agent():
    return StudentMonitorAgent()


@pytest.fixture(scope="module")
def router(student_agent):
    nav_agent = NavigationAgent()
    return build_router(nav_agent, student_agent)


@pytest.fixture
def mock_student_context():
    return {
        "rollNo": "21951A0501",
        "fullName": "Student 21951A0501",
        "department": "Computer Science and Engineering (CSE)",
        "overallAttendance": 84.5,
        "attendanceStatus": "GOOD",
        "safeBunksAvailable": 6,
        "classesNeededFor75": 0,
        "mentorName": "Dr. K. Srinivas Rao",
        "mentorCabin": "Academic Block B - Room 204",
        "attendance": [
            {
                "subjectCode": "ACS003",
                "subjectName": "Operating Systems",
                "attendedClasses": 36,
                "totalClasses": 45,
                "percentage": 80.0,
            },
            {
                "subjectCode": "ACS004",
                "subjectName": "Computer Networks",
                "attendedClasses": 31,
                "totalClasses": 44,
                "percentage": 70.45,
            },
        ],
        "todaySchedule": [
            {
                "timeSlotStart": "09:00",
                "timeSlotEnd": "09:50",
                "subjectName": "Operating Systems",
                "room": "Block B - Room 301",
                "facultyName": "Dr. K. Srinivas Rao",
                "isCurrent": True,
                "isNext": False,
            },
            {
                "timeSlotStart": "09:50",
                "timeSlotEnd": "10:40",
                "subjectName": "Computer Networks",
                "room": "Block B - Room 301",
                "facultyName": "Prof. Suresh Kumar",
                "isCurrent": False,
                "isNext": True,
            },
        ],
        "marks": [
            {
                "subjectName": "Operating Systems",
                "cie1": 21.0,
                "cie2": 22.5,
                "internalTotal": 21.75,
            }
        ],
    }


def test_attendance_query_with_context(student_agent, mock_student_context):
    result = student_agent.handle("What is my attendance?", mock_student_context)
    assert result["success"] is True
    assert result["agent"] == "student_monitor"
    assert "84.5%" in result["message"]
    assert "Operating Systems" in result["message"]


def test_safe_bunk_query(student_agent, mock_student_context):
    result = student_agent.handle("How many classes can I bunk?", mock_student_context)
    assert result["success"] is True
    assert "6 class(es)" in result["message"]


def test_timetable_query(student_agent, mock_student_context):
    result = student_agent.handle("Where is my next class?", mock_student_context)
    assert result["success"] is True
    assert "Operating Systems" in result["message"]
    assert "Block B - Room 301" in result["message"]


def test_mentor_query(student_agent, mock_student_context):
    result = student_agent.handle("Who is my mentor?", mock_student_context)
    assert result["success"] is True
    assert "Dr. K. Srinivas Rao" in result["message"]
    assert "Room 204" in result["message"]


def test_unlinked_account_guidance(student_agent):
    result = student_agent.handle("What is my attendance?", None)
    assert result["success"] is True
    assert "Samvidha" in result["message"]


def test_router_routes_student_query(router, mock_student_context):
    state = router.invoke({
        "query": "Show my timetable for today",
        "student_context": mock_student_context,
    })
    assert state["agent"] == "student_monitor"
    assert state["result"]["success"] is True
    assert "Today's Schedule" in state["result"]["message"]
