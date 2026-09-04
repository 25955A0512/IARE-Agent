"""
test_general_assistant.py — Unit tests for GeneralAssistantAgent and LangGraph router.
"""

import pytest
from agents.general_assistant_agent import GeneralAssistantAgent
from agents.navigation_agent import NavigationAgent
from agents.student_monitor_agent import StudentMonitorAgent
from agents.router_agent import build_router


@pytest.fixture
def general_agent():
    return GeneralAssistantAgent()


@pytest.fixture
def router():
    nav = NavigationAgent()
    student = StudentMonitorAgent()
    general = GeneralAssistantAgent()
    return build_router(nav, student, general)


def test_topic_classification(general_agent):
    subj, top = general_agent._extract_topic_and_subject("Explain how binary search tree rotations work in AVL trees", None)
    assert "Data Structures" in subj
    assert "Binary Search Tree" in top

    subj2, top2 = general_agent._extract_topic_and_subject("What is the difference between TCP and UDP in networking?", None)
    assert "Computer Networks" in subj2
    assert "TCP" in top2

    subj3, top3 = general_agent._extract_topic_and_subject("How does deadlock prevention work in Operating Systems?", None)
    assert "Operating Systems" in subj3
    assert "Deadlock" in top3


def test_general_qna_handling(general_agent):
    res = general_agent.handle("What is the difference between TCP and UDP?")
    assert res["success"] is True
    assert res["agent"] == "general_assistant"
    assert "TCP" in res["message"]
    assert "UDP" in res["message"]
    assert res["subject"] == "Computer Networks"


def test_weakness_trigger_when_topic_in_weak_list(general_agent):
    weak_topics = ["Binary Search Trees", "Trees"]
    res = general_agent.handle(
        "Can you explain AVL tree insertion and rotation rules?",
        weak_topics=weak_topics
    )
    assert res["success"] is True
    assert res["is_weakness_trigger"] is True
    # Verify natural conversational practice suggestion is included
    assert "practice set" in res["message"].lower() or "cheat sheet" in res["message"].lower()


def test_weakness_trigger_from_onboarding_difficult_subjects(general_agent):
    onboarding = {
        "difficult_subjects": "Operating Systems, Deadlocks, Compiler Design"
    }
    res = general_agent.handle(
        "Explain the four necessary conditions for deadlocks.",
        onboarding_context=onboarding
    )
    assert res["success"] is True
    assert res["is_weakness_trigger"] is True
    assert "practice set" in res["message"].lower() or "cheat sheet" in res["message"].lower()


def test_router_dispatch(router):
    # 1. Greeting
    state1 = router.invoke({"query": "Hello, good morning!"})
    assert state1["agent"] == "greeting"
    assert "welcome" in state1["result"]["message"].lower()

    # 2. Navigation
    state2 = router.invoke({"query": "Directions to Central Library"})
    assert state2["agent"] == "navigation"
    assert state2["result"]["success"] is True

    # 3. Student Monitor
    state3 = router.invoke({
        "query": "What is my current attendance percentage?",
        "student_context": {"rollNo": "21951A0501", "overallAttendance": 82.5, "fullName": "Govind"}
    })
    assert state3["agent"] == "student_monitor"
    assert "82.5%" in state3["result"]["message"]

    # 4. General Assistant (General knowledge & Homework help)
    state4 = router.invoke({"query": "Explain how dynamic programming solves the 0/1 knapsack problem"})
    assert state4["agent"] == "general_assistant"
    assert state4["result"]["success"] is True
    assert "dynamic programming" in state4["result"]["message"].lower() or "knapsack" in state4["result"]["message"].lower()



