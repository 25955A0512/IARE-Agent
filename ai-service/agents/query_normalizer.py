"""
query_normalizer.py — Intelligent fuzzy spelling corrector & intent normalizer.

Ensures typos like 'pricnipal', 'attandance', 'timtable', 'libary', 'profesor', 'placment'
are automatically corrected to the student's intended academic words before routing and RAG search.
"""

import difflib
import re
from typing import Dict, List, Set

# Curated high-priority academic & campus vocabulary
CAMPUS_VOCABULARY: List[str] = [
    "principal", "dean", "professor", "faculty", "lecturer", "director", "mentor", "counselor",
    "attendance", "bunk", "leave", "skip", "timetable", "schedule", "internals", "marks", "score", "grades",
    "regulations", "autonomous", "accreditation", "admissions", "counseling", "scholarship",
    "placement", "placements", "packages", "recruiters", "salary", "companies", "training",
    "library", "hostel", "transport", "canteen", "auditorium", "sports", "gymnasium", "labs",
    "computer", "science", "engineering", "aeronautical", "electronics", "mechanical", "civil", "information",
    "technology", "management", "artificial", "intelligence", "machine", "learning", "deep",
    "algorithm", "algorithms", "dijkstra", "deadlock", "banker", "binary", "tree", "traversal",
    "sorting", "searching", "network", "protocols", "database", "normalization", "queries",
    "dundigal", "hyderabad", "telangana", "samvidha", "iare"
]

# Explicit common phonetic & transposition typo lookup table
EXPLICIT_TYPO_MAP: Dict[str, str] = {
    "pricnipal": "principal",
    "princpal": "principal",
    "prncipal": "principal",
    "prinsipal": "principal",
    "princiapl": "principal",
    "princple": "principal",
    "attandance": "attendance",
    "attendence": "attendance",
    "atendance": "attendance",
    "attendanc": "attendance",
    "attandence": "attendance",
    "timtable": "timetable",
    "timetble": "timetable",
    "scheduel": "schedule",
    "schejule": "schedule",
    "profesor": "professor",
    "proffesor": "professor",
    "proffessor": "professor",
    "faclty": "faculty",
    "falculty": "faculty",
    "placment": "placement",
    "placemnt": "placement",
    "placemnts": "placements",
    "pakage": "package",
    "pakag": "package",
    "pacage": "package",
    "libary": "library",
    "librari": "library",
    "libarary": "library",
    "admision": "admission",
    "addmission": "admission",
    "admisn": "admission",
    "regulatn": "regulation",
    "regulatins": "regulations",
    "dijikstra": "dijkstra",
    "dijkstras": "dijkstra",
    "algoritm": "algorithm",
    "algorthm": "algorithm",
    "alogrithm": "algorithm",
    "deadlok": "deadlock",
    "dedlock": "deadlock",
}


def normalize_query(query: str) -> str:
    """
    Cleans, fixes typos, and normalizes spelling in student queries while preserving names.
    Example: 'who is the pricnipal of IARE' -> 'who is the principal of IARE'
    """
    if not query:
        return ""

    # Multi-word phrase normalizations
    q_norm = query
    q_norm = re.sub(r"\btime\s+table\b", "timetable", q_norm, flags=re.IGNORECASE)
    q_norm = re.sub(r"\btime\s+tables\b", "timetable", q_norm, flags=re.IGNORECASE)
    q_norm = re.sub(r"\broll\s+no\b", "roll number", q_norm, flags=re.IGNORECASE)
    q_norm = re.sub(r"\bblood\s+grp\b", "blood group", q_norm, flags=re.IGNORECASE)

    words = re.findall(r"\w+|[^\w\s]", q_norm)
    corrected_words = []

    for word in words:
        if not word.isalnum():
            corrected_words.append(word)
            continue

        w_lower = word.lower()

        # 1. Direct explicit typo dictionary check
        if w_lower in EXPLICIT_TYPO_MAP:
            corrected = EXPLICIT_TYPO_MAP[w_lower]
            # Match capitalization
            if word.isupper():
                corrected_words.append(corrected.upper())
            elif word.istitle():
                corrected_words.append(corrected.title())
            else:
                corrected_words.append(corrected)
            continue

        # 2. Fuzzy match against vocabulary if word length is >= 4 and not exact match
        if len(w_lower) >= 4 and w_lower not in CAMPUS_VOCABULARY:
            matches = difflib.get_close_matches(w_lower, CAMPUS_VOCABULARY, n=1, cutoff=0.78)
            if matches:
                matched_term = matches[0]
                if word.isupper():
                    corrected_words.append(matched_term.upper())
                elif word.istitle():
                    corrected_words.append(matched_term.title())
                else:
                    corrected_words.append(matched_term)
                continue

        corrected_words.append(word)

    # Reconstruct text cleanly
    reconstructed = ""
    for i, w in enumerate(corrected_words):
        if i > 0 and w.isalnum() and corrected_words[i - 1].isalnum():
            reconstructed += " " + w
        elif i > 0 and w.isalnum() and corrected_words[i - 1] not in ["'", '"', '`']:
            reconstructed += " " + w
        else:
            reconstructed += w

    return reconstructed
