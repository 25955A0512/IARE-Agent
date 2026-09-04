"""
event_intelligence_agent.py — Event Intelligence Agent for Telegram Poster/Message Extraction.

Uses Gemini 2.0 Flash (google-genai SDK) with multimodal vision OCR and structured output.
Extracts:
- Title, description, date, time, location, organizer
- Target audience (semester int, branch, section, raw audience string)
- Conservative is_mandatory flag (only True for compulsory drives/deadlines/required actions)
- Registration deadlines and action URLs
- Filters out casual chat noise (is_event: false)
"""

import json
import logging
import re
from typing import Any, Dict, Optional

from config import settings

log = logging.getLogger(__name__)

# Roman numeral mapping for semester resolution
ROMAN_TO_SEM = {
    "I": 1, "1ST": 1, "1": 1,
    "II": 2, "2ND": 2, "2": 2,
    "III": 3, "3RD": 3, "3": 3,
    "IV": 4, "4TH": 4, "4": 4,
    "V": 5, "5TH": 5, "5": 5,
    "VI": 6, "6TH": 6, "6": 6,
    "VII": 7, "7TH": 7, "7": 7,
    "VIII": 8, "8TH": 8, "8": 8,
}

CASUAL_CHAT_PATTERNS = [
    r"^(?:hi|hello|hey|good\s+morning|good\s+night|gm|gn)\b",
    r"^(?:where\s+are\s+you|what\s+are\s+you\s+doing|kaha\s+ho)\b",
    r"^(?:thanks|thank\s+you|ty|thx|ok|okay|cool|nice)\b",
    r"^(?:can\s+someone\s+send|send\s+notes|notes\s+bhejo)\b",
]

MANDATORY_KEYWORDS = [
    "mandatory", "compulsory", "must attend", "must register", "register now",
    "last date", "deadline", "strict deadline", "placement drive", "recruitment drive",
    "hall ticket", "cie exam", "mid exam", "semester end exam", "lab external",
    "submission deadline", "immediate action", "required for all",
]


class EventIntelligenceAgent:
    """Agent for extracting structured event intelligence from Telegram messages and poster images."""

    def __init__(self):
        self.client = None
        if settings.gemini_api_key:
            try:
                from google import genai
                self.client = genai.Client(api_key=settings.gemini_api_key)
                log.info("EventIntelligenceAgent: google-genai client initialized (%s)", settings.gemini_model)
            except Exception as e:
                log.warning("EventIntelligenceAgent: Failed to initialize google-genai: %s", e)
        else:
            log.info("EventIntelligenceAgent: No GEMINI_API_KEY provided; using deterministic extraction fallback")

    def process_message(
        self,
        text: str = "",
        image_bytes: Optional[bytes] = None,
        mime_type: str = "image/jpeg",
        group_id: int = 0,
        message_id: int = 0
    ) -> Optional[Dict[str, Any]]:
        """
        Processes a Telegram message or poster image.
        Returns a structured event dict if an event is detected, or None if casual chatter / non-event.
        """
        raw_text = (text or "").strip()

        # Quick pre-filter: obvious non-event one-liners without image
        if not image_bytes and self._is_obvious_casual_noise(raw_text):
            log.info("Telegram message classified as casual noise (ignored): %r", raw_text[:50])
            return None

        # 1. Try Groq (Primary for text) if no image
        if not image_bytes:
            try:
                extracted = self._extract_with_groq(raw_text)
                if extracted and extracted.get("is_event"):
                    extracted["source_telegram_group_id"] = group_id
                    extracted["source_telegram_message_id"] = message_id
                    extracted["has_image"] = False
                    if not extracted.get("raw_text"):
                        extracted["raw_text"] = raw_text
                    if extracted.get("target_branch"):
                        m_b = re.search(r"\b(CSE|ECE|IT|ME|CE|AE|EEE|CSIT|AIML|DS|CIVIL|MECH|AERO)\b", str(extracted["target_branch"]).upper())
                        if m_b:
                            extracted["target_branch"] = m_b.group(1)
                    return extracted
                elif extracted and not extracted.get("is_event"):
                    log.info("Groq classified message as non-event: %r", raw_text[:60])
                    return None
            except Exception as e:
                log.warning("Groq event extraction failed: %s — trying Gemini / regex fallback", e)

        # 2. Try Gemini for multimodal vision poster OCR or fallback
        if self.client:
            try:
                extracted = self._extract_with_gemini(raw_text, image_bytes, mime_type)
                if extracted and extracted.get("is_event"):
                    extracted["source_telegram_group_id"] = group_id
                    extracted["source_telegram_message_id"] = message_id
                    extracted["has_image"] = bool(image_bytes)
                    if not extracted.get("raw_text"):
                        extracted["raw_text"] = raw_text or "[Poster Image]"
                    if extracted.get("target_branch"):
                        m_b = re.search(r"\b(CSE|ECE|IT|ME|CE|AE|EEE|CSIT|AIML|DS|CIVIL|MECH|AERO)\b", str(extracted["target_branch"]).upper())
                        if m_b:
                            extracted["target_branch"] = m_b.group(1)
                    return extracted
                elif extracted and not extracted.get("is_event"):
                    log.info("Gemini classified message as non-event: %r", raw_text[:60])
                    return None
            except Exception as e:
                log.warning("Gemini event extraction failed: %s — falling back to regex parser", e)

        # 3. Fallback deterministic extraction
        return self._extract_fallback(raw_text, bool(image_bytes), group_id, message_id)

    def _extract_with_groq(self, text: str) -> Optional[Dict[str, Any]]:
        """Invokes Groq with structured JSON output schema and model fallbacks."""
        groq_key = settings.groq_api_key or os.environ.get("GROQ_API_KEY")
        if not groq_key or groq_key.startswith("gsk_YOUR") or len(groq_key.strip()) < 8:
            return None
        from groq import Groq
        client = Groq(api_key=groq_key.strip())
        system_instruction = """
You are an expert Campus Event & Circular Intelligence Extractor for the Institute of Aeronautical Engineering (IARE).
Analyze the input text and extract structured event/notice information.

Return ONLY a valid JSON object matching this schema:
{
  "is_event": boolean,
  "title": string,
  "description": string,
  "event_date": string or null,
  "event_time": string or null,
  "location": string or null,
  "organizer": string or null,
  "target_semester": integer or null,
  "target_branch": string or null,
  "target_section": string or null,
  "target_audience_raw": string or null,
  "is_mandatory": boolean,
  "registration_deadline": string or null,
  "action_url": string or null
}
RULES:
1. "is_event": Return false if this is casual chat or non-event. Return true for official circulars, placement drives, exams, workshops, hackathons.
2. "is_mandatory": ONLY TRUE for compulsory registration, mandatory drives, or required exams.
3. "target_semester": Integer semester (1 to 8) e.g. "V Sem" -> 5, "3rd year" -> 5 or 6, "1st year" -> 1 or 2.
4. "action_url": Any registration URL, Google Form, or website link in the text.
"""
        models_to_try = [
            settings.groq_model,
            "openai/gpt-oss-120b",
            "qwen/qwen3.8-27b",
            "openai/gpt-oss-20b",
        ]
        for mdl in dict.fromkeys([m for m in models_to_try if m]):
            try:
                completion = client.chat.completions.create(
                    model=mdl,
                    messages=[
                        {"role": "system", "content": system_instruction},
                        {"role": "user", "content": text}
                    ],
                    temperature=0.1,
                    max_tokens=800,
                    response_format={"type": "json_object"}
                )
                resp_text = completion.choices[0].message.content.strip()
                if resp_text.startswith("```"):
                    resp_text = re.sub(r"^```(?:json)?\n|\n```$", "", resp_text, flags=re.MULTILINE).strip()
                data = json.loads(resp_text)
                return data
            except Exception as e:
                log.warning("Groq event extraction model %s error: %s", mdl, e)
        return None

    def _extract_with_gemini(
        self,
        text: str,
        image_bytes: Optional[bytes],
        mime_type: str
    ) -> Optional[Dict[str, Any]]:
        """Invokes Gemini Multimodal Vision / OCR with structured JSON output schema."""
        from google.genai import types

        system_instruction = """
You are an expert Campus Event & Circular Intelligence Extractor for the Institute of Aeronautical Engineering (IARE).
Analyze the input text and/or poster image and extract structured event/notice information.

RULES:
1. "is_event": Return false if this is casual chat, chit-chat, a question asking for homework, a thank-you note, or personal conversation.
   Return true if this is an official campus circular, event, guest lecture, workshop, placement/recruitment drive, competition, exam alert, or lab submission deadline.
2. "is_mandatory": ONLY set to TRUE when the text explicitly indicates a REQUIRED ACTION (e.g. mandatory placement drive registration, compulsory attendance, CIE exam schedule, strict submission deadline). Default to false for informational workshops, club events, hackathons, and guest lectures.
3. "target_semester": Integer semester (1 to 8) if specifically mentioned (e.g., "V Sem" -> 5, "7th Semester" -> 7, "III Sem" -> 3, "IV Sem" -> 4). Set null if open to all semesters or not mentioned.
4. "target_branch": Department abbreviation (e.g. "CSE", "ECE", "IT", "ME", "CE", "AE", "EEE") or null if all branches.
5. "target_section": Section string ("A", "B", etc.) or null if all sections.
6. "target_audience_raw": The verbatim phrase used for audience (e.g., "V Sem CSE & IT Students", "All 3rd Year B.Tech", "All Students").
7. "action_url": Any registration link, Google Form URL, or website URL in the text/poster.

Respond ONLY with a valid JSON object matching this schema:
{
  "is_event": boolean,
  "title": string,
  "description": string,
  "event_date": string or null,
  "event_time": string or null,
  "location": string or null,
  "organizer": string or null,
  "target_semester": integer or null,
  "target_branch": string or null,
  "target_section": string or null,
  "target_audience_raw": string or null,
  "is_mandatory": boolean,
  "registration_deadline": string or null,
  "action_url": string or null
}
"""

        contents = []
        if image_bytes:
            contents.append(
                types.Part.from_bytes(
                    data=image_bytes,
                    mime_type=mime_type or "image/jpeg"
                )
            )

        prompt_text = text if text else "Extract event details, dates, URLs, deadlines, and target branch/semester from this poster image."
        contents.append(prompt_text)

        models_to_try = [
            settings.gemini_model,
            "gemini-2.5-flash",
            "gemini-flash-latest",
            "gemini-2.5-pro",
        ]
        for mdl in dict.fromkeys([m for m in models_to_try if m]):
            try:
                response = self.client.models.generate_content(
                    model=mdl,
                    contents=contents,
                    config=types.GenerateContentConfig(
                        system_instruction=system_instruction,
                        temperature=0.1,
                        response_mime_type="application/json",
                    )
                )
                resp_text = (response.text or "").strip()
                if resp_text.startswith("```"):
                    resp_text = re.sub(r"^```(?:json)?\n|\n```$", "", resp_text, flags=re.MULTILINE).strip()

                data = json.loads(resp_text)
                if data.get("target_branch"):
                    m_b = re.search(r"\b(CSE|ECE|IT|ME|CE|AE|EEE|CSIT|AIML|DS|CIVIL|MECH|AERO)\b", str(data["target_branch"]).upper())
                    if m_b:
                        data["target_branch"] = m_b.group(1)
                return data
            except Exception as e:
                log.warning("Gemini event extraction model %s error: %s", mdl, e)
        return None

    def _is_obvious_casual_noise(self, text: str) -> bool:
        """Quick check for obvious casual group noise."""
        if not text:
            return True
        if len(text.split()) < 3 and not any(kw in text.lower() for kw in ["drive", "exam", "event", "workshop", "cie"]):
            return True
        for pattern in CASUAL_CHAT_PATTERNS:
            if re.search(pattern, text, re.IGNORECASE):
                return True
        return False

    def _extract_fallback(
        self,
        text: str,
        has_image: bool,
        group_id: int,
        message_id: int
    ) -> Optional[Dict[str, Any]]:
        """Deterministic regex-based fallback extractor when LLM is unavailable."""
        clean = text.strip()
        lower = clean.lower()

        # If text is too short or casual and no image, ignore
        if not has_image and self._is_obvious_casual_noise(clean):
            return None

        # Check for event indicator keywords
        EVENT_TRIGGERS = [
            "drive", "placement", "workshop", "hackathon", "seminar", "webinar",
            "session", "competition", "deadline", "submission", "exam", "cie",
            "circular", "recruitment", "fest", "symposium", "conference", "guest lecture",
            "internship", "registration", "notice", "announcement"
        ]

        if not has_image and not any(kw in lower for kw in EVENT_TRIGGERS):
            return None

        # Target Semester detection
        target_sem = None
        target_aud_raw = "All Students"
        m_sem = re.search(r"\b(VIII|VII|VI|V|IV|III|II|I|8th|7th|6th|5th|4th|3rd|2nd|1st|[1-8])\s*(?:-|–)?\s*(?:sem|semester|year)\b", clean, re.IGNORECASE)
        if m_sem:
            sem_token = m_sem.group(1).upper()
            target_sem = ROMAN_TO_SEM.get(sem_token)
            target_aud_raw = m_sem.group(0)

        # Target Branch detection
        target_branch = None
        m_dept = re.search(r"\b(CSE|ECE|IT|ME|CE|AE|EEE|CSIT|AIML|DS|CIVIL|MECH|AERO)\b", clean, re.IGNORECASE)
        if m_dept:
            target_branch = m_dept.group(1).upper()
            if target_aud_raw != "All Students":
                target_aud_raw = f"{target_aud_raw} {target_branch}"
            else:
                target_aud_raw = f"{target_branch} Students"

        # Mandatory determination (Conservative)
        is_mandatory = any(kw in lower for kw in MANDATORY_KEYWORDS)

        # Action URL detection
        m_url = re.search(r"https?://[^\s<>\"']+", clean)
        action_url = m_url.group(0) if m_url else None

        # Date detection
        m_date = re.search(r"\b(?:\d{1,2}[-/.]\d{1,2}[-/.]\d{2,4}|tomorrow|today|(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{1,2}(?:,\s*\d{4})?)\b", clean, re.IGNORECASE)
        event_date = m_date.group(0) if m_date else "Upcoming"

        # Title extraction (First line or up to 70 chars)
        lines = [line.strip() for line in clean.splitlines() if line.strip()]
        title = lines[0] if lines else "Campus Announcement"
        if len(title) > 90:
            title = title[:87] + "..."

        return {
            "is_event": True,
            "title": title,
            "description": clean,
            "raw_text": clean or "[Poster Announcement]",
            "has_image": has_image,
            "event_date": event_date,
            "event_time": "As scheduled",
            "location": "IARE Campus",
            "organizer": "IARE Department",
            "target_semester": target_sem,
            "target_branch": target_branch,
            "target_section": None,
            "target_audience_raw": target_aud_raw,
            "is_mandatory": is_mandatory,
            "registration_deadline": None,
            "action_url": action_url,
            "source_telegram_group_id": group_id,
            "source_telegram_message_id": message_id,
        }
