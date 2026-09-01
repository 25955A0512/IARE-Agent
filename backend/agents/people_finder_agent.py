"""
people_finder_agent.py — Faculty Locator Agent for IARE Agent.

Given a natural-language query about a faculty member's current location,
this agent:
  1. Fuzzy-matches the faculty name from the query.
  2. Checks the current day/time against that faculty member's timetable.
  3. Returns:
       - Room + class end time  → if currently in a scheduled class
       - Cabin location         → if free (labeled as "likely available", never certain)
       - Not-found response     → if the faculty member isn't in the database

Privacy guarantee: uses ONLY timetable inference — no GPS or live location tracking.
"""

from __future__ import annotations

import json
import logging
from dataclasses import dataclass, field
from datetime import datetime, time
from pathlib import Path
from typing import Optional

from rapidfuzz import fuzz, process as fuzz_process

logger = logging.getLogger(__name__)

# ── Data types ────────────────────────────────────────────────────────────────

@dataclass
class ScheduleSlot:
    day_of_week: int       # 0=Mon … 5=Sat
    start: time
    end: time
    room: str
    subject: str


@dataclass
class FacultyRecord:
    id: int
    name: str
    aliases: list[str]
    department: str
    cabin_location: str
    schedule: list[ScheduleSlot] = field(default_factory=list)


@dataclass
class PeopleFinderResult:
    """Result returned by the people-finder agent."""
    success: bool
    faculty_name: str
    status: str          # "in_class" | "free" | "not_found" | "error"
    location: str
    message: str         # Full human-readable response
    free_at: str = ""    # If in_class: HH:MM when the slot ends


# ── Faculty data store (loaded once at startup) ───────────────────────────────

class FacultyStore:
    """In-memory store of faculty records. Thread-safe for reads."""

    def __init__(self) -> None:
        self._faculty: list[FacultyRecord] = []
        # Flat list of (FacultyRecord, display_string) for fuzzy matching
        self._name_index: list[tuple[FacultyRecord, str]] = []
        self._loaded = False

    def load_from_json(self, json_path: Path) -> None:
        """Load faculty data from the faculty_timetable.json seed file."""
        with open(json_path, encoding="utf-8") as f:
            data = json.load(f)

        for fac_data in data["faculty"]:
            aliases = [a.strip() for a in (fac_data.get("aliases") or "").split(",") if a.strip()]
            schedule = [
                ScheduleSlot(
                    day_of_week=slot["day_of_week"],
                    start=_parse_time(slot["time_slot_start"]),
                    end=_parse_time(slot["time_slot_end"]),
                    room=slot["room"],
                    subject=slot.get("subject", "class"),
                )
                for slot in fac_data.get("schedule", [])
            ]
            record = FacultyRecord(
                id=fac_data["id"],
                name=fac_data["name"],
                aliases=aliases,
                department=fac_data.get("department", ""),
                cabin_location=fac_data.get("cabin_location", "their department office"),
                schedule=schedule,
            )
            self._faculty.append(record)
            # Index canonical name + all aliases
            self._name_index.append((record, record.name.lower()))
            for alias in aliases:
                self._name_index.append((record, alias.lower()))

        self._loaded = True
        logger.info("Faculty store loaded: %d members", len(self._faculty))

    def load_from_db_rows(self, faculty_rows: list, schedule_rows: list) -> None:
        """Load from SQLAlchemy ORM objects (alternative to JSON)."""
        schedule_by_fac: dict[int, list[ScheduleSlot]] = {}
        for slot in schedule_rows:
            slot_obj = ScheduleSlot(
                day_of_week=slot.day_of_week,
                start=_parse_time(slot.time_slot_start),
                end=_parse_time(slot.time_slot_end),
                room=slot.room,
                subject=slot.subject or "class",
            )
            schedule_by_fac.setdefault(slot.faculty_id, []).append(slot_obj)

        for fac in faculty_rows:
            aliases = [a.strip() for a in (fac.aliases or "").split(",") if a.strip()]
            record = FacultyRecord(
                id=fac.id,
                name=fac.name,
                aliases=aliases,
                department=fac.department or "",
                cabin_location=fac.cabin_location or "their department office",
                schedule=schedule_by_fac.get(fac.id, []),
            )
            self._faculty.append(record)
            self._name_index.append((record, record.name.lower()))
            for alias in aliases:
                self._name_index.append((record, alias.lower()))

        self._loaded = True
        logger.info("Faculty store loaded from DB: %d members", len(self._faculty))

    def fuzzy_find(self, query: str, threshold: int = 55) -> Optional[FacultyRecord]:
        """
        Return the FacultyRecord whose name/alias best matches *query*,
        or None if confidence is below *threshold*.
        """
        if not self._name_index:
            return None
        query_lower = query.lower().strip()
        alias_strings = [alias for (_, alias) in self._name_index]

        result = fuzz_process.extractOne(
            query_lower,
            alias_strings,
            scorer=fuzz.WRatio,
            score_cutoff=threshold,
        )
        if result is None:
            return None

        matched_alias = result[0]
        for record, alias in self._name_index:
            if alias == matched_alias:
                return record
        return None

    @property
    def is_loaded(self) -> bool:
        return self._loaded


# Singleton instance
faculty_store = FacultyStore()


# ── Helpers ───────────────────────────────────────────────────────────────────

def _parse_time(t_str: str) -> time:
    """Parse 'HH:MM' string into a datetime.time object."""
    h, m = t_str.split(":")
    return time(int(h), int(m))


_FACULTY_KEYWORDS = [
    "professor", "prof", "dr", "doctor", "faculty", "lecturer",
    "where is", "find", "locate", "looking for",
    "sir", "madam", "mam",
]


def _extract_faculty_name_hint(query: str) -> str:
    """
    Strip common question phrasing to isolate the faculty name fragment.
    Returns a cleaned string to fuzzy-match against the faculty store.
    """
    q = query.lower().strip()
    # Remove leading question words
    for phrase in [
        "where is", "where's", "can you find", "find", "locate",
        "i am looking for", "looking for", "i need to meet",
        "how do i find", "who is", "where can i find",
    ]:
        if q.startswith(phrase):
            q = q[len(phrase):].strip()

    # Remove titles and trailing filler
    for token in ["professor", "prof.", "prof", "dr.", "dr", "right now", "currently",
                   "today", "now", "at the moment", "?", "please", "sir", "madam", "mam"]:
        q = q.replace(token, " ").strip()

    return q.strip()


def _current_slot(record: FacultyRecord, now: datetime) -> Optional[ScheduleSlot]:
    """
    Return the active schedule slot for *record* at datetime *now*, or None.
    day_of_week: 0=Monday … 5=Saturday (Sunday always free).
    """
    weekday = now.weekday()   # Python: 0=Mon … 6=Sun
    if weekday > 5:           # Sunday
        return None

    current_time = now.time()
    for slot in record.schedule:
        if slot.day_of_week == weekday and slot.start <= current_time < slot.end:
            return slot
    return None


# ── Main agent function ───────────────────────────────────────────────────────

def run_people_finder_agent(
    query: str,
    now: Optional[datetime] = None,
) -> PeopleFinderResult:
    """
    Process a faculty location query and return a PeopleFinderResult.

    Args:
        query: Natural language question (e.g. "Where is Prof Sharma now?")
        now:   Override current datetime (used in tests). Defaults to real time.

    Returns:
        PeopleFinderResult with location and human-readable message.
    """
    if not faculty_store.is_loaded:
        return PeopleFinderResult(
            success=False,
            faculty_name="",
            status="error",
            location="",
            message="Faculty data is not loaded yet. Please try again in a moment.",
        )

    if now is None:
        now = datetime.now()

    # Extract name hint and fuzzy match
    name_hint = _extract_faculty_name_hint(query)
    record = faculty_store.fuzzy_find(name_hint)

    if record is None:
        return PeopleFinderResult(
            success=False,
            faculty_name=name_hint,
            status="not_found",
            location="",
            message=(
                f"I couldn't find a faculty member matching **'{name_hint}'** in our records. "
                "Please check the spelling or visit the **department office** for assistance. "
                "Note: only IARE faculty listed in our system can be looked up."
            ),
        )

    # Check current schedule
    active_slot = _current_slot(record, now)
    day_names = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]
    day_str = day_names[now.weekday()] if now.weekday() <= 5 else "Sunday"
    time_str = now.strftime("%I:%M %p")

    if active_slot:
        end_str = active_slot.end.strftime("%I:%M %p")
        message = (
            f"**{record.name}** ({record.department} dept.) is currently **in class**.\n\n"
            f"📍 **Location:** {active_slot.room}\n"
            f"📚 **Subject:** {active_slot.subject}\n"
            f"🕐 **Free at:** {end_str} (as of {day_str}, {time_str})\n\n"
            f"_This is based on the timetable schedule — actual presence may vary._"
        )
        return PeopleFinderResult(
            success=True,
            faculty_name=record.name,
            status="in_class",
            location=active_slot.room,
            message=message,
            free_at=end_str,
        )
    else:
        # Not in a scheduled class — direct to cabin
        # On Sunday, add a note
        if now.weekday() > 5:
            extra = "\n\n_Note: Today is Sunday — the faculty member is likely not on campus._"
        else:
            extra = ""

        message = (
            f"**{record.name}** ({record.department} dept.) does not have a scheduled class "
            f"right now ({day_str}, {time_str}).\n\n"
            f"📍 **Likely available at their cabin:** {record.cabin_location}\n\n"
            f"_This is timetable-based inference only — actual availability is not guaranteed. "
            f"If not in cabin, check with the {record.department} department office._"
            f"{extra}"
        )
        return PeopleFinderResult(
            success=True,
            faculty_name=record.name,
            status="free",
            location=record.cabin_location,
            message=message,
        )
