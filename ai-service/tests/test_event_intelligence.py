"""
test_event_intelligence.py — Unit and integration tests for Telegram Event Intelligence.
"""

import pytest
from agents.event_intelligence_agent import EventIntelligenceAgent
from agents.general_assistant_agent import GeneralAssistantAgent
from telegram_listener import TelegramListener


@pytest.fixture
def event_agent():
    return EventIntelligenceAgent()


@pytest.fixture
def telegram_listener(event_agent):
    return TelegramListener(event_agent=event_agent)


@pytest.fixture
def general_agent():
    return GeneralAssistantAgent()


def test_mandatory_drive_extraction_with_semester(event_agent):
    text = (
        "📢 ATTENTION V SEM CSE & IT STUDENTS:\n"
        "TCS National Qualifier Test (NQT) Placement Drive is scheduled for tomorrow at 10:00 AM in the Auditorium.\n"
        "Registration is MANDATORY before 6:00 PM today. Apply here: https://iare.ac.in/placements/tcs-2026\n"
        "Strict deadline — un-registered students cannot attend."
    )
    result = event_agent.process_message(text=text, group_id=-1002345678901, message_id=101)
    assert result is not None
    assert result["is_event"] is True
    assert "TCS" in result["title"] or "Placement" in result["title"] or "ATTENTION" in result["title"]
    assert result["target_semester"] == 5
    assert result["target_branch"] in {"CSE", "IT"}
    assert result["is_mandatory"] is True
    assert result["action_url"] == "https://iare.ac.in/placements/tcs-2026"
    assert result["source_telegram_group_id"] == -1002345678901


def test_general_informational_event_relevant_to_all(event_agent):
    text = (
        "🎉 IARE Annual Technical Fest — TechAero 2026!\n"
        "Join us for a 2-day national hackathon and robotics exhibition on 15th Sep at Block B.\n"
        "Open to all engineering students across all years. Exciting cash prizes!\n"
        "Details: https://techaero.iare.ac.in"
    )
    result = event_agent.process_message(text=text, group_id=-1001234567890, message_id=102)
    assert result is not None
    assert result["is_event"] is True
    # Conservative mandatory check: informational fest should be False
    assert result["is_mandatory"] is False
    # No semester specified -> targeted to all
    assert result["target_semester"] is None or result["target_audience_raw"] == "All Students"


def test_casual_chat_noise_rejection(event_agent):
    casual_messages = [
        "hi bro",
        "where are you right now?",
        "thanks for the help",
        "can someone send notes for os unit 3?",
        "ok cool see you at canteen",
    ]
    for msg in casual_messages:
        res = event_agent.process_message(text=msg, group_id=-1002345678901, message_id=103)
        assert res is None or res.get("is_event") is False, f"Message should be ignored as casual noise: {msg}"


@pytest.mark.anyio
async def test_whitelist_enforcement_consented_vs_non_consented(telegram_listener):
    # 1. Consented group from config/consented_groups.json
    consented_id = -1002345678901
    res1 = await telegram_listener.handle_incoming_message(
        group_id=consented_id,
        message_id=201,
        text="V Sem CSE Workshop on Generative AI tomorrow at 10 AM in Lab 3.",
        chat_type="supergroup"
    )
    assert res1["processed"] is True
    assert res1["is_event"] is True

    # 2. Non-consented group ID — MUST be rejected immediately per AGENTS.md
    non_consented_id = -999999999999
    res2 = await telegram_listener.handle_incoming_message(
        group_id=non_consented_id,
        message_id=202,
        text="V Sem CSE Workshop on Generative AI tomorrow at 10 AM in Lab 3.",
        chat_type="supergroup"
    )
    assert res2["processed"] is False
    assert res2["reason"] == "non_consented_group"


@pytest.mark.anyio
async def test_private_dm_rejection(telegram_listener):
    # Private 1-on-1 DMs MUST be ignored immediately
    res = await telegram_listener.handle_incoming_message(
        group_id=12345678,
        message_id=203,
        text="Mandatory placement drive tomorrow",
        chat_type="private"
    )
    assert res["processed"] is False
    assert res["reason"] == "private_dm_ignored"


def test_general_assistant_answers_event_questions(general_agent):
    active_events = [
        {
            "id": 1,
            "title": "TCS National Qualifier Test 2026",
            "event_date": "Tomorrow 10:00 AM",
            "location": "Auditorium",
            "target_audience_raw": "V Sem CSE & IT",
            "is_mandatory": True,
            "action_url": "https://iare.ac.in/tcs"
        },
        {
            "id": 2,
            "title": "AI & Deep Learning Hands-on Bootcamp",
            "event_date": "Saturday 2:00 PM",
            "location": "CSE Lab 4",
            "target_audience_raw": "All Students",
            "is_mandatory": False,
            "action_url": None
        }
    ]

    res = general_agent.handle(
        query="What events and placement drives are happening this week?",
        active_events=active_events
    )
    assert res["success"] is True
    assert "TCS National Qualifier Test" in res["message"]
    assert "MANDATORY" in res["message"]
    assert "AI & Deep Learning" in res["message"]
