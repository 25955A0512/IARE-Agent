"""
test_samvidha_scraper.py — Unit tests for in-memory Samvidha timetable scraper.
"""

import pytest
from scrapers.samvidha_scraper import SamvidhaScraper


@pytest.fixture
def scraper():
    return SamvidhaScraper()


def test_test_credentials_synthesize_cleanly(scraper):
    result = scraper.scrape_timetable("21951A0501", "secret123")
    assert result["success"] is True
    assert result["roll_no"] == "21951A0501"
    assert "timetable" in result
    assert len(result["timetable"]) > 0
    assert result["department"] == "Computer Science and Engineering (CSE)"
    assert result["semester"] == 8
    # Ensure every timetable slot contains required fields
    slot = result["timetable"][0]
    assert "day_of_week" in slot
    assert "time_slot_start" in slot
    assert "time_slot_end" in slot
    assert "subject_code" in slot
    assert "subject_name" in slot
    assert "room" in slot
    assert "faculty_name" in slot


def test_lateral_entry_roll_resolution(scraper):
    result = scraper.scrape_timetable("25955A0522", "test")
    assert result["success"] is True
    assert result["roll_no"] == "25955A0522"
    assert result["year_of_study"] == 2
    assert result["semester"] == 4
    assert len(result["timetable"]) > 0


def test_empty_credentials_rejected(scraper):
    res1 = scraper.scrape_timetable("", "pass")
    assert res1["success"] is False

    res2 = scraper.scrape_timetable("21951A0501", "")
    assert res2["success"] is False


def test_defensive_error_structure(scraper):
    # Testing an invalid domain or unhandled network issue
    # The scraper should never crash and should return the honest error message
    res = scraper.scrape_timetable("00000A0000", "invalid_password_xyz_fake")
    assert res["success"] is False
    assert "error" in res
    assert "Couldn't connect to Samvidha right now" in res["error"] or "Invalid Samvidha credentials" in res["error"]
