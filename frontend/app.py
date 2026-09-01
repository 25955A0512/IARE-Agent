"""
app.py — Streamlit chat UI for IARE Agent.

Features:
  - Chat input with message history (preserved via st.session_state)
  - Agent badge in sidebar (Navigation / People-Finder / Out of Scope)
  - For navigation responses: renders route as a numbered stop list
  - Graceful error handling when the backend is unreachable
"""

from __future__ import annotations

import os
import time
from typing import Any

import httpx
import streamlit as st

# ── Configuration ─────────────────────────────────────────────────────────────

BACKEND_URL = os.environ.get("BACKEND_URL", "http://localhost:8000")
CHAT_ENDPOINT = f"{BACKEND_URL}/chat"
HEALTH_ENDPOINT = f"{BACKEND_URL}/health"

# ── Page config ───────────────────────────────────────────────────────────────

st.set_page_config(
    page_title="IARE Campus Agent",
    page_icon="🎓",
    layout="wide",
    initial_sidebar_state="expanded",
)

# ── Custom CSS ────────────────────────────────────────────────────────────────

st.markdown("""
<style>
/* ── Google Fonts ── */
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap');

/* ── Global ── */
html, body, [class*="css"] {
    font-family: 'Inter', sans-serif;
}

/* ── Header gradient banner ── */
.iare-header {
    background: linear-gradient(135deg, #1a1a2e 0%, #16213e 40%, #0f3460 100%);
    border-radius: 16px;
    padding: 28px 32px;
    margin-bottom: 24px;
    box-shadow: 0 8px 32px rgba(0,0,0,0.3);
    position: relative;
    overflow: hidden;
}
.iare-header::before {
    content: '';
    position: absolute;
    top: -50%;
    right: -10%;
    width: 300px;
    height: 300px;
    background: radial-gradient(circle, rgba(83, 144, 217, 0.15) 0%, transparent 70%);
    border-radius: 50%;
}
.iare-header h1 {
    color: #ffffff;
    font-size: 2rem;
    font-weight: 700;
    margin: 0 0 6px 0;
    letter-spacing: -0.5px;
}
.iare-header p {
    color: rgba(255,255,255,0.7);
    font-size: 0.95rem;
    margin: 0;
}
.iare-header .accent {
    color: #5390d9;
    font-weight: 600;
}

/* ── Agent badges ── */
.badge {
    display: inline-block;
    padding: 4px 12px;
    border-radius: 20px;
    font-size: 0.78rem;
    font-weight: 600;
    letter-spacing: 0.5px;
    text-transform: uppercase;
}
.badge-nav {
    background: linear-gradient(135deg, #0f3460, #1a6b9a);
    color: #7ec8e3;
    border: 1px solid rgba(126, 200, 227, 0.3);
}
.badge-pf {
    background: linear-gradient(135deg, #2d1b69, #553d91);
    color: #c4b5fd;
    border: 1px solid rgba(196, 181, 253, 0.3);
}
.badge-oos {
    background: linear-gradient(135deg, #1f1f1f, #2d2d2d);
    color: #9ca3af;
    border: 1px solid rgba(156, 163, 175, 0.2);
}

/* ── Route card ── */
.route-card {
    background: linear-gradient(135deg, rgba(15,52,96,0.4), rgba(26,106,154,0.2));
    border: 1px solid rgba(83, 144, 217, 0.25);
    border-radius: 12px;
    padding: 16px 20px;
    margin: 12px 0;
}
.route-card h4 {
    color: #7ec8e3;
    margin: 0 0 12px 0;
    font-size: 0.9rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 1px;
}
.route-stop {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 8px 0;
    border-bottom: 1px solid rgba(255,255,255,0.06);
    color: #e2e8f0;
    font-size: 0.9rem;
}
.route-stop:last-child {
    border-bottom: none;
}
.stop-num {
    background: #0f3460;
    color: #7ec8e3;
    border-radius: 50%;
    width: 26px;
    height: 26px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 0.75rem;
    font-weight: 700;
    flex-shrink: 0;
}
.stop-final {
    background: linear-gradient(135deg, #16543e, #1d7a5a);
    color: #6ee7b7;
}
.distance-tag {
    margin-left: auto;
    background: rgba(255,255,255,0.06);
    border-radius: 8px;
    padding: 2px 8px;
    font-size: 0.75rem;
    color: #94a3b8;
}

/* ── Sidebar styling ── */
.sidebar-card {
    background: rgba(255,255,255,0.04);
    border: 1px solid rgba(255,255,255,0.08);
    border-radius: 12px;
    padding: 14px 16px;
    margin-bottom: 12px;
}
.sidebar-card h4 {
    color: #94a3b8;
    font-size: 0.75rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 1px;
    margin: 0 0 8px 0;
}
.sidebar-stat {
    color: #e2e8f0;
    font-size: 0.9rem;
}

/* ── Status dot ── */
.status-dot {
    display: inline-block;
    width: 8px;
    height: 8px;
    border-radius: 50%;
    margin-right: 6px;
}
.status-online { background: #22c55e; box-shadow: 0 0 6px #22c55e; }
.status-offline { background: #ef4444; }

/* ── Typing indicator ── */
.typing-indicator {
    display: flex;
    gap: 5px;
    padding: 8px 0;
    align-items: center;
}
.typing-dot {
    width: 8px;
    height: 8px;
    background: #5390d9;
    border-radius: 50%;
    animation: typing-bounce 1.2s infinite;
}
.typing-dot:nth-child(2) { animation-delay: 0.2s; }
.typing-dot:nth-child(3) { animation-delay: 0.4s; }
@keyframes typing-bounce {
    0%, 60%, 100% { transform: translateY(0); }
    30% { transform: translateY(-8px); }
}

/* ── Streamlit overrides ── */
.stChatMessage { background: transparent !important; }
section[data-testid="stSidebar"] {
    background: linear-gradient(180deg, #0d1117 0%, #161b22 100%) !important;
}
</style>
""", unsafe_allow_html=True)


# ── Session state ─────────────────────────────────────────────────────────────

if "messages" not in st.session_state:
    st.session_state.messages = []
if "last_agent" not in st.session_state:
    st.session_state.last_agent = None
if "backend_online" not in st.session_state:
    st.session_state.backend_online = None


# ── Helper functions ──────────────────────────────────────────────────────────

def check_backend_health() -> bool:
    """Ping the backend health endpoint."""
    try:
        resp = httpx.get(HEALTH_ENDPOINT, timeout=3.0)
        return resp.status_code == 200
    except Exception:
        return False


def call_backend(message: str) -> dict[str, Any] | None:
    """Send a message to the backend and return the parsed JSON response."""
    try:
        resp = httpx.post(
            CHAT_ENDPOINT,
            json={"message": message},
            timeout=30.0,
        )
        resp.raise_for_status()
        return resp.json()
    except httpx.TimeoutException:
        return {"error": "Request timed out. The backend may be starting up — try again."}
    except httpx.HTTPStatusError as e:
        return {"error": f"Backend error {e.response.status_code}: {e.response.text}"}
    except Exception as e:
        return {"error": f"Could not reach backend at {BACKEND_URL}. Is it running? ({e})"}


def agent_badge_html(agent: str) -> str:
    """Return an HTML badge for the given agent type."""
    if agent == "navigation":
        return '<span class="badge badge-nav">📍 Navigation</span>'
    elif agent == "people_finder":
        return '<span class="badge badge-pf">👤 People Finder</span>'
    else:
        return '<span class="badge badge-oos">🤖 Out of Scope</span>'


def render_route_card(stops: list[str], total_distance: float | None) -> str:
    """Build an HTML route card for a navigation response."""
    if not stops:
        return ""
    dist_str = f" — Total: ~{int(total_distance)}m" if total_distance else ""
    html = f'<div class="route-card"><h4>🗺️ Route{dist_str}</h4>'
    for i, stop in enumerate(stops):
        is_last = i == len(stops) - 1
        num_class = "stop-num stop-final" if is_last else "stop-num"
        icon = "🏁" if is_last else str(i + 1)
        html += (
            f'<div class="route-stop">'
            f'<div class="{num_class}">{icon}</div>'
            f'<span>{stop}</span>'
            f'</div>'
        )
    html += "</div>"
    return html


# ── Sidebar ───────────────────────────────────────────────────────────────────

with st.sidebar:
    st.markdown("""
    <div style="text-align:center; padding: 16px 0 24px 0;">
        <div style="font-size:2.5rem;">🎓</div>
        <div style="color:#e2e8f0; font-weight:700; font-size:1.1rem; margin-top:8px;">IARE Agent</div>
        <div style="color:#64748b; font-size:0.8rem;">Campus AI Assistant</div>
    </div>
    """, unsafe_allow_html=True)

    # Backend status
    if st.button("🔄 Check Backend", use_container_width=True):
        st.session_state.backend_online = check_backend_health()

    if st.session_state.backend_online is None:
        st.session_state.backend_online = check_backend_health()

    online = st.session_state.backend_online
    status_html = (
        '<span class="status-dot status-online"></span><span style="color:#22c55e; font-size:0.85rem;">Online</span>'
        if online else
        '<span class="status-dot status-offline"></span><span style="color:#ef4444; font-size:0.85rem;">Offline</span>'
    )
    st.markdown(
        f'<div class="sidebar-card"><h4>Backend Status</h4>{status_html}</div>',
        unsafe_allow_html=True,
    )

    # Last agent used
    if st.session_state.last_agent:
        st.markdown(
            f'<div class="sidebar-card"><h4>Last Agent</h4>'
            f'{agent_badge_html(st.session_state.last_agent)}</div>',
            unsafe_allow_html=True,
        )

    # Capabilities
    st.markdown("""
    <div class="sidebar-card">
        <h4>What I can do</h4>
        <div style="color:#e2e8f0; font-size:0.85rem; line-height:1.7;">
            📍 <b>Navigate</b> anywhere on campus<br>
            👤 <b>Find</b> faculty members<br>
            🗺️ Step-by-step directions<br>
            ⏰ Real-time timetable lookup
        </div>
    </div>
    """, unsafe_allow_html=True)

    # Example queries
    st.markdown("**💡 Try asking:**")
    example_queries = [
        "Where is the Library?",
        "How do I get to the Canteen from Block A?",
        "Where is Professor Sharma right now?",
        "Is Dr Iyer available?",
        "Directions from Main Gate to Auditorium",
        "Find Dr Tiwari",
    ]
    for q in example_queries:
        st.markdown(f"<div style='color:#64748b; font-size:0.82rem; padding:2px 0;'>• {q}</div>", unsafe_allow_html=True)

    st.markdown("---")
    if st.button("🗑️ Clear Chat", use_container_width=True):
        st.session_state.messages = []
        st.session_state.last_agent = None
        st.rerun()


# ── Main content ──────────────────────────────────────────────────────────────

# Header
st.markdown("""
<div class="iare-header">
    <h1>🎓 IARE Campus Agent</h1>
    <p>Your AI-powered campus assistant — navigate anywhere, find anyone.
    Powered by <span class="accent">LangGraph</span> multi-agent routing.</p>
</div>
""", unsafe_allow_html=True)

# Welcome message
if not st.session_state.messages:
    st.markdown("""
    <div style="
        background: linear-gradient(135deg, rgba(83,144,217,0.08), rgba(83,144,217,0.03));
        border: 1px solid rgba(83,144,217,0.2);
        border-radius: 12px;
        padding: 20px 24px;
        margin-bottom: 20px;
    ">
        <div style="color:#7ec8e3; font-weight:600; margin-bottom:8px;">👋 Welcome!</div>
        <div style="color:#94a3b8; font-size:0.9rem; line-height:1.6;">
            I'm your IARE campus AI assistant. I can help you:<br>
            &nbsp;&nbsp;📍 Find any building or facility on campus<br>
            &nbsp;&nbsp;🗺️ Get step-by-step walking directions<br>
            &nbsp;&nbsp;👤 Locate faculty members based on their timetable<br><br>
            Type your question below to get started!
        </div>
    </div>
    """, unsafe_allow_html=True)

# Chat history
for msg in st.session_state.messages:
    with st.chat_message(msg["role"], avatar="🧑‍🎓" if msg["role"] == "user" else "🤖"):
        if msg["role"] == "assistant":
            agent = msg.get("agent", "")
            if agent:
                st.markdown(agent_badge_html(agent), unsafe_allow_html=True)
            st.markdown(msg["content"])
            # Re-render route card if present
            if msg.get("route_stops"):
                st.markdown(
                    render_route_card(msg["route_stops"], msg.get("total_distance_meters")),
                    unsafe_allow_html=True,
                )
        else:
            st.markdown(msg["content"])

# Chat input
if prompt := st.chat_input("Ask me anything about the IARE campus..."):
    # Display user message
    with st.chat_message("user", avatar="🧑‍🎓"):
        st.markdown(prompt)
    st.session_state.messages.append({"role": "user", "content": prompt})

    # Call backend with typing indicator
    with st.chat_message("assistant", avatar="🤖"):
        thinking_placeholder = st.empty()
        thinking_placeholder.markdown("""
        <div class="typing-indicator">
            <div class="typing-dot"></div>
            <div class="typing-dot"></div>
            <div class="typing-dot"></div>
            <span style="color:#64748b; font-size:0.85rem; margin-left:4px;">Thinking...</span>
        </div>
        """, unsafe_allow_html=True)

        response = call_backend(prompt)
        time.sleep(0.3)  # small pause so the animation is visible
        thinking_placeholder.empty()

        if response is None or "error" in response:
            error_msg = (response or {}).get("error", "Unknown error occurred.")
            error_text = f"⚠️ **Connection Error**\n\n{error_msg}\n\n_Make sure the backend is running: `uvicorn main:app --reload` in `/backend`_"
            st.markdown(error_text)
            st.session_state.messages.append({
                "role": "assistant",
                "content": error_text,
                "agent": "",
            })
        else:
            agent = response.get("agent", "")
            message_content = response.get("message", "No response.")
            route_stops = response.get("route_stops") or []
            total_dist = response.get("total_distance_meters")

            st.session_state.last_agent = agent

            # Badge
            if agent:
                st.markdown(agent_badge_html(agent), unsafe_allow_html=True)

            # Main message
            st.markdown(message_content)

            # Route card (navigation only)
            if agent == "navigation" and route_stops:
                route_html = render_route_card(route_stops, total_dist)
                st.markdown(route_html, unsafe_allow_html=True)

            # Store in history
            st.session_state.messages.append({
                "role": "assistant",
                "content": message_content,
                "agent": agent,
                "route_stops": route_stops if route_stops else None,
                "total_distance_meters": total_dist,
            })

    st.rerun()
