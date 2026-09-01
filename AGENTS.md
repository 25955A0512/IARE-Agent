# AGENTS.md — IARE Agent Project Rules

## Project
IARE Agent — a multi-agent AI campus assistant for IARE college. Built in phases.
Full context: this is a student resume/hackathon project, built solo/two-person team,
using only free-tier tools and APIs.

## Architecture
- Router agent (LangGraph) dispatches user queries to specialist agents:
  Navigation Agent, People-Finder Agent, Daily-Brief Agent, Event-Aggregator Agent,
  Tutor/Mentor Agent (RAG-based), Monitoring Agent (Telegram-based, consent-only).
- Backend: FastAPI (Python), with SSE streaming for chat responses.
- Database: PostgreSQL (Supabase free tier).
- Vector store: ChromaDB for RAG (syllabus, notices, lab manuals).
- LLM inference: Groq primary, Gemini API fallback. Never hardcode API keys —
  always load from environment variables via a .env file (never committed).
- Frontend: Streamlit for MVP; can migrate to React later.

## Coding standards
- Python: PEP 8, type hints on all functions, docstrings required.
- One feature/agent per file — no monolithic files.
- All agents live under /agents/, each as its own module with a clear interface.
- All secrets in .env, referenced via os.environ, .env listed in .gitignore.
- Write a README.md section for every new feature explaining how to run/test it.
- Prefer free/open-source libraries over paid APIs at every decision point.
- After building each feature, write a minimal test and actually run it before
  reporting the task as done.

## Data & privacy rules (non-negotiable)
- Telegram monitoring only activates for group IDs explicitly whitelisted in
  config/consented_groups.json — never auto-join or scrape groups.
- No private/DM messages are ever read or stored.
- Student data (profile, schedule) is only stored after explicit opt-in.
- No live GPS or physical tracking of any person — People-Finder Agent uses
  ONLY timetable inference, never location tracking.