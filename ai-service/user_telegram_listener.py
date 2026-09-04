"""
user_telegram_listener.py — Telegram User Client Listener (Telethon).

Strict Privacy & Consent Rules (AGENTS.md):
1. Whitelist Only: ONLY listens to group IDs listed in config/consented_groups.json.
2. Hard Ignore: Messages from personal chats, DMs, family groups, or non-whitelisted groups
   are NEVER accessed, read, or logged.
"""

import asyncio
import json
import logging
from pathlib import Path
from typing import Any, Dict, List, Optional, Set

import httpx

try:
    from telethon import TelegramClient, events
    HAS_TELETHON = True
except ImportError:
    TelegramClient = None  # type: ignore
    events = None  # type: ignore
    HAS_TELETHON = False

from config import settings
from agents.event_intelligence_agent import EventIntelligenceAgent

log = logging.getLogger(__name__)


class UserTelegramListener:
    """Listens to consented Telegram groups via user-client (Telethon) for automated hands-free ingestion."""

    def __init__(self, event_agent: Optional[EventIntelligenceAgent] = None):
        self.event_agent = event_agent or EventIntelligenceAgent()
        self.api_id = settings.telegram_api_id
        self.api_hash = settings.telegram_api_hash
        self.session_path = str(Path(__file__).parent / "iare_user_session")
        self.client: Optional[TelegramClient] = None
        self._consented_group_ids: Set[int] = set()
        self._reload_whitelist()
        self._is_running = False

    def _reload_whitelist(self) -> None:
        """Loads consented group IDs from config/consented_groups.json."""
        path = Path(settings.consented_groups_path)
        if not path.exists():
            alt_path = Path(__file__).parent.parent / "config" / "consented_groups.json"
            if alt_path.exists():
                path = alt_path

        if path.exists():
            try:
                with open(path, "r", encoding="utf-8") as f:
                    data = json.load(f)
                groups = data.get("consented_groups", [])
                self._consented_group_ids = {int(g["group_id"]) for g in groups if "group_id" in g}
                log.info("UserTelegramListener: Loaded consented groups whitelist: %s", self._consented_group_ids)
            except Exception as e:
                log.error("UserTelegramListener: Failed to load consented groups: %s", e)

    def is_group_consented(self, group_id: int) -> bool:
        """Strict check that group is in consented list."""
        self._reload_whitelist()
        try:
            gid = int(group_id)
            if gid in self._consented_group_ids:
                return True
            str_gid = str(abs(gid))
            for cid in self._consented_group_ids:
                str_cid = str(abs(cid))
                if str_gid == str_cid:
                    return True
                if str_gid.startswith("100") and str_gid[3:] == str_cid:
                    return True
                if str_cid.startswith("100") and str_cid[3:] == str_gid:
                    return True
            return False
        except Exception:
            return False

    async def start_if_configured(self) -> None:
        """Starts the Telethon client background listener if API ID and Hash are set."""
        if not HAS_TELETHON or TelegramClient is None:
            log.info("UserTelegramListener: Telethon is not installed — skipping user listener")
            return

        if not self.api_id or not self.api_hash:
            log.info("UserTelegramListener: TELEGRAM_API_ID / TELEGRAM_API_HASH not set — skipping user client")
            return

        try:
            self.client = TelegramClient(self.session_path, self.api_id, self.api_hash)
            await self.client.connect()
            if not await self.client.is_user_authorized():
                log.info("UserTelegramListener: Client not yet authorized. Run login helper once to authenticate.")
                return

            self._reload_whitelist()
            log.info("UserTelegramListener: Connected as user account. Registering listener for consented groups...")

            @self.client.on(events.NewMessage)
            async def handler(event):
                chat = await event.get_chat()
                chat_id = getattr(chat, "id", None)
                if not chat_id or not self.is_group_consented(chat_id):
                    # STRICT PRIVACY: Ignore all other personal/non-consented chats completely
                    return

                msg_text = event.raw_text or ""
                log.info("UserTelegramListener: Detected new message in consented group %s (len=%d)", chat_id, len(msg_text))

                photo_bytes = None
                if event.message.photo:
                    try:
                        photo_bytes = await event.download_media(bytes)
                    except Exception as e:
                        log.warning("UserTelegramListener: Could not download photo: %s", e)

                # Process with Event Intelligence Agent
                extracted = self.event_agent.process_message(
                    text=msg_text,
                    image_bytes=photo_bytes,
                    group_id=chat_id,
                    message_id=event.message.id,
                )

                if extracted and extracted.get("is_event"):
                    log.info("UserTelegramListener: Extracted official event: '%s' (Sem=%s, Branch=%s)",
                             extracted.get("title"), extracted.get("target_semester"), extracted.get("target_branch"))
                    await self._forward_to_backend(extracted)

            self._is_running = True
            log.info("UserTelegramListener: Live background listener ACTIVE for college group %s", self._consented_group_ids)
        except Exception as e:
            log.warning("UserTelegramListener: Init error: %s", e)

    async def _forward_to_backend(self, event_data: Dict[str, Any]) -> None:
        """Forwards extracted event to backend-core."""
        url = f"{settings.backend_core_url.rstrip('/')}/api/events/internal/ingest"
        headers = {
            "X-Internal-Secret": settings.ai_service_shared_secret,
            "Content-Type": "application/json",
        }
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                res = await client.post(url, json=event_data, headers=headers)
                if res.status_code in (200, 201):
                    log.info("UserTelegramListener: Ingested event to backend: %s", event_data.get("title"))
                else:
                    log.error("UserTelegramListener: Backend returned %d: %s", res.status_code, res.text)
        except Exception as e:
            log.warning("UserTelegramListener: Could not forward to backend: %s", e)

    async def stop(self) -> None:
        """Stops the Telethon client."""
        if self.client and self.client.is_connected():
            await self.client.disconnect()
            log.info("UserTelegramListener: Disconnected")
