# IARE Agent

An official AI campus companion for IARE college — voice-driven navigation, people-finder, and more.

## Architecture

```
Browser / Mobile
      │ HTTPS
      ▼
backend-core (Spring Boot :8080)   ← only internet-facing service (Flyway + Supabase Postgres / H2)
      │ X-Internal-Secret (shared secret)
      ▼
ai-service (FastAPI :8001)         ← internal only, never public
      └── LangGraph router → Navigation Agent (NetworkX + Gemini)
web (React + Vite :5173)           ← frontend, proxies /api → backend-core
```

---

## Mission 2 Features

1. **Supabase Database & Flyway Migrations**:
   - Production PostgreSQL connection via Supabase credentials (`SUPABASE_DB_URL`, `SUPABASE_DB_USER`, `SUPABASE_DB_PASSWORD`).
   - Versioned schema migrations managed via Flyway (`V1__init_schema.sql`).
   - Automatic offline fallback to in-memory H2 database during local development when variables are unset.

2. **Smart Online/Offline Voice Switching**:
   - **Offline Definition**: The client can communicate with `backend-core` and text APIs, but real-time Gemini Live WebSocket streaming is degraded, unavailable, or manually turned off.
   - **Automatic Fallback**: Pre-flight reachability checks probe `/api/health` and probe Gemini Live token validity. If unavailable, voice queries automatically fall back to the local STT/TTS pipeline (`faster-whisper` + `edge-tts`) with a clear status indicator pill.
   - **Manual Mode Toggle**: Users can explicitly choose **⚡ Auto (Smart Detect)**, **✨ Online (Gemini Live)**, or **🎙️ Offline (Local Whisper)** from the UI, persisted in `localStorage`.
   - **Non-Interrupting Guarantee**: If connectivity recovers during an active fallback session, the current query completes cleanly, and auto mode reapplies on the next interaction.
   - **Audit Telemetry**: Every voice session logs its active mode and reason to `backend-core`'s audit log for reliability telemetry.

3. **Light/Dark Theme System**:
   - Implemented via CSS Custom Properties / design tokens without duplicate markup.
   - Auto-detects OS theme preference (`prefers-color-scheme`) on initial load.
   - Persistent manual theme toggle (☀️ Light / 🌙 Dark) available on all screens.

4. **Samvidha Campus Portal Student Monitoring**:
   - **Background Synchronization**: When a student enters their official Roll Number (e.g. `21951A0501`) and password, `SamvidhaService` connects in the background to `https://samvidha.iare.ac.in`, extracts live attendance %, timetable slots, CIE internal marks, and faculty mentor information into PostgreSQL / H2 database.
   - **Student Academic Hub UI**: Dedicated modal and quick-chips displaying overall attendance gauge, exam eligibility status (>=75%), safe bunk buffer calculator, subject-wise breakdown, and today's schedule with live current/next class markers.
   - **Specialist Student Monitor AI Agent**: LangGraph router dispatches student queries to `StudentMonitorAgent` for natural-language attendance analysis, safe bunk calculations, today's schedule lookup, and mentor information.

## Mission 3 Features

1. **Full Onboarding Survey & Dual Samvidha Setup**:
   - **Academic Details**: Captures current semester (1–8), branch dropdown, section, enrolled courses chips, and self-reported difficult subjects.
   - **Goals & Interests**: Career aspirations (Tier-1 placement, GATE, hackathons), technical interests, and college clubs.
   - **Logistics & Engagement**: Preferred notification timings, monitored Telegram group consent/preferences, check-in frequency (Daily Brief, Weekly, Critical), and optional non-blocking mood check-ins.
   - **Dual Workflow**: Dual buttons for **"🔗 Connect Samvidha"** (live credential handshake) and **"⏭️ Skip for Now"** (self-reported setup without blocking).
   - **Re-editable Profile**: Accessible anytime via the **"📝 Survey & Profile"** button in the sidebar or top navbar.

2. **Samvidha Password Security Audit**:
   - Samvidha password is strictly handled in-memory during the in-flight HTTPS POST request to `https://samvidha.iare.ac.in/checkUser.php` and immediately discarded.
   - Zero storage: The password is NEVER saved in database tables (`student_onboarding`, `student_profiles`, `users`), logs, cookies, or `localStorage`.

3. **Persistent Conversation Memory & Drawer**:
   - Multi-turn conversation messages stored in Supabase PostgreSQL (`chat_sessions` and `chat_messages`).
   - Context compiler passes recent message turns (~20) and summaries to AI agents for conversational continuity.
   - Smart memory compaction summarizes conversations exceeding ~20 messages into a compact memory note (`summary_memory`).
   - Interactive sidebar drawer grouped by date (*Today*, *Yesterday*, *Previous 7 Days*, *Older*) with session switcher and deletion.

4. **General Assistant Agent**:
   - Specializes in broad academic Q&A, homework assistance, and conceptual clarifications (e.g. *TCP vs UDP*, *Operating Systems Deadlocks*, *BST/AVL trees*, *Dynamic Programming*).
   - Powered by `google-genai` SDK with deterministic educational synthesis fallback.
   - Integrated into LangGraph router alongside Navigation and Student Monitor agents.

5. **Lightweight Weakness Detection**:
   - Tags the subject & topic of each question asked in `student_topics_asked`.
   - Triggers when a topic recurs $\ge 3$ times in 7 days or matches self-reported difficult subjects.
   - Surfaces **ONLY** as gentle, optional practice suggestion chips below the agent's answer (*"🎯 Practice 3 Questions on [Topic]"*, *"📝 Quick Cheat Sheet"*). Private to student only.

## Mission 4 Features — Telegram Event Intelligence

1. **Strict Consent-Based Group Whitelist (`config/consented_groups.json`)**:
   - Listens exclusively to verified college groups (CSE Official, T&P Cell, Student Affairs, ECE).
   - Any message from a non-whitelisted group or any private 1-on-1 DM is instantly dropped to protect student privacy.

2. **Multimodal Vision OCR for Posters**:
   - Analyzes event images and text using Google Gemini 2.0 Flash (`google-genai`).
   - Extracts structured event records (date, time, venue, target semester, target branch, mandatory status, action URL).
   - Casual group chatter is filtered out without creating event noise.

3. **Cohort-Targeted Alerts & Lead-Time Reminders**:
   - Ingested events are automatically mapped to students matching the target audience.
   - Urgent mandatory notices surface on a top dismissible banner with a countdown.
   - Advance 24-hour reminders are generated for critical events with lead times $\ge 48$ hours.

4. **Events & Notices UI with Live Simulator**:
   - Interactive events feed modal with filter tabs and one-click action buttons.
   - Built-in Telegram Bot Ingest Simulator for manual and automated validation.

---

## Quick Start

### Prerequisites
| Tool | Version | Install |
|------|---------|---------|
| Java | 21 | [Oracle JDK 21](https://www.oracle.com/java/) |
| Maven | 3.9+ | `winget install Apache.Maven` or [archive.apache.org](https://archive.apache.org/dist/maven/maven-3/) |
| Python | 3.12+ | [python.org](https://python.org) |
| Node.js | 20+ LTS | [nodejs.org](https://nodejs.org) |

---

### 1. Clone & Configure

```bash
git clone <repo-url> IARE_Agent
cd IARE_Agent
```

#### backend-core
```powershell
cd backend-core
Copy-Item .env.example .env
# Edit .env — set JWT_SECRET and AI_SERVICE_SHARED_SECRET
# (Optional) Add Supabase credentials if connecting to Postgres
```

#### ai-service
```powershell
cd ai-service
Copy-Item .env.example .env
# Edit .env — set GEMINI_API_KEY and AI_SERVICE_SHARED_SECRET (must match backend-core)
```

---

### 2. Run ai-service (Internal FastAPI)

```powershell
cd ai-service
python -m venv .venv-ai
.venv-ai\Scripts\activate        # Windows
pip install -r requirements.txt
uvicorn main:app --port 8001 --reload
```

---

### 3. Run backend-core (Spring Boot)

```powershell
cd backend-core
mvn spring-boot:run
```

> **Local dev**: When `SUPABASE_DB_URL` is unset, `backend-core` uses H2 in-memory mode automatically and Flyway runs `V1__init_schema.sql` on startup.

---

### 4. Run web frontend (React + Vite)

```powershell
cd web
npm install
npm run dev
```

🌐 Open **http://localhost:5173** — register an account, then start exploring campus navigation with voice and light/dark theme!

---

## 🗄️ Supabase Setup Guide

To connect `backend-core` to your Supabase PostgreSQL project:

1. **Sign in to Supabase**: Navigate to [database.new](https://database.new) and create a new project.
2. **Retrieve Connection String**:
   - Go to **Project Settings** (gear icon) → **Database**.
   - Under **Connection string**, select **JDBC** (or **URI**).
   - Format: `jdbc:postgresql://db.<PROJECT_REF>.supabase.co:5432/postgres?sslmode=require`
   - Alternatively for session pooler: `jdbc:postgresql://aws-0-<REGION>.pooler.supabase.com:6543/postgres?sslmode=require`
3. **Set Environment Variables** in `backend-core/.env`:
   ```env
   SUPABASE_DB_URL=jdbc:postgresql://db.xxxx.supabase.co:5432/postgres?sslmode=require
   SUPABASE_DB_USER=postgres
   SUPABASE_DB_PASSWORD=your-supabase-database-password
   ```
4. **Boot Backend**:
   - When you start `backend-core` via `mvn spring-boot:run`, Flyway automatically applies `V1__init_schema.sql` to your Supabase instance, creating `users` and `audit_log` tables with constraints and indexes.

---

## Environment Variables

### backend-core/.env

| Variable | Required | Description |
|----------|----------|-------------|
| `JWT_SECRET` | Yes (prod) | HMAC-SHA256 secret (minimum 32 characters) |
| `AI_SERVICE_URL` | No | Default: `http://localhost:8001` |
| `AI_SERVICE_SHARED_SECRET` | Yes | Must match `ai-service` |
| `SUPABASE_DB_URL` | No | Supabase JDBC URL (`?sslmode=require`). Leave unset for H2 local fallback. |
| `SUPABASE_DB_USER` | No | Supabase DB username (default: `postgres`) |
| `SUPABASE_DB_PASSWORD` | No | Supabase DB password |
| `CORS_ORIGINS` | No | Comma-separated allowed origins (default: `http://localhost:5173`) |

### ai-service/.env

| Variable | Required | Description |
|----------|----------|-------------|
| `AI_SERVICE_SHARED_SECRET` | Yes | Must match `backend-core` |
| `GEMINI_API_KEY` | No | Free key from [aistudio.google.com](https://aistudio.google.com/apikey) |
| `GEMINI_MODEL` | No | Default: `gemini-2.0-flash-exp` |
| `WHISPER_MODEL` | No | Default: `base` (tiny/base/small/medium/large-v3) |
| `TTS_VOICE` | No | Default: `en-IN-NeerjaNeural` |

---

## Testing & Running

### 1. Run All Test Suites
```powershell
# ai-service (31/31 unit tests)
cd ai-service
.venv-ai\Scripts\pytest tests/ -v

# backend-core (15/15 unit & integration tests)
cd ..\backend-core
mvn test

# web build verification
cd ..\web
npm run build
```

### 2. Run Live Event Pipeline Verification
```powershell
cd ..\ai-service
.venv-ai\Scripts\python "..\scratch\test_live_event_pipeline.py"
```

---

## API Endpoints

### backend-core (public & internal)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/health` | — | Lightweight health check for connectivity detection |
| POST | `/api/auth/register` | — | Register student account |
| POST | `/api/auth/login` | — | Login → access + refresh tokens |
| POST | `/api/auth/refresh` | — | Refresh access token |
| POST | `/api/agent/query` | JWT | Forward query to AI agent router with active events context |
| GET | `/api/events` | JWT | Fetch cohort-relevant events feed |
| GET | `/api/events/notifications` | JWT | Fetch unread event notifications |
| POST | `/api/events/notifications/{id}/read` | JWT | Mark notification as read |
| POST | `/api/events/internal/ingest` | X-Internal-Secret | Protected event ingestion from ai-service |

### ai-service (internal only)

| Method | Path | Secret | Description |
|--------|------|--------|-------------|
| POST | `/internal/chat` | X-Internal-Secret | LangGraph router with active events injection |
| POST | `/internal/telegram/webhook` | X-Internal-Secret | Telegram bot webhook update handler |
| POST | `/internal/telegram/simulate-message` | X-Internal-Secret | Simulated Telegram message ingestion tester |
| GET | `/internal/telegram/consented-groups` | X-Internal-Secret | Returns consented group whitelist |
| POST | `/internal/events/extract` | X-Internal-Secret | Multimodal Vision OCR extraction |

---

## Project Structure

```
IARE_Agent/
├── config/
│   └── consented_groups.json  Strict Telegram group consent whitelist
├── backend-core/              Spring Boot — auth, events, cohort matcher, Flyway
│   ├── src/main/java/in/iare/agent/
│   │   ├── controller/        AuthController, EventController, AgentProxyController, ...
│   │   ├── service/           EventService, SamvidhaService, OnboardingService, AIProxyService, ...
│   │   ├── model/             Event, StudentEventNotification, StudentProfile, User, ...
│   │   └── repository/        EventRepository, StudentEventNotificationRepository, ...
│   └── src/main/resources/
│       └── db/migration/      V1 through V6__telegram_events_and_notifications.sql
├── ai-service/                FastAPI — LangGraph, Gemini 2.0 OCR, Telegram Listener
│   ├── agents/                event_intelligence_agent.py, general_assistant_agent.py, router_agent.py, ...
│   ├── telegram_listener.py   Whitelist enforcement, poster OCR, backend ingest
│   └── tests/                 test_event_intelligence.py, test_general_assistant.py, ...
├── web/                       React + Vite — Events feed, Top Banner, Ingest Simulator
│   └── src/
│       ├── components/        EventsNoticesModal.tsx, OnboardingModal.tsx, ChatHistoryDrawer.tsx, MapOverlay.tsx
│       ├── pages/             ChatPage.tsx, LoginPage.tsx, RegisterPage.tsx
│       └── services/          api.ts, voice.ts
└── shared/tokens.json         Single-source design tokens (navy/gold)
```
