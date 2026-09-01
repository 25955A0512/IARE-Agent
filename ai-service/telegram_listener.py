"""
telegram_listener.py — Telegram bot message listener & consent whitelist enforcement.

Strict Privacy & Consent Rules (AGENTS.md):
1. Whitelist Only: Only process messages from group IDs listed in config/consented_groups.json.
2. Hard Drop: Messages from non-whitelisted groups are immediately discarded.
3. No Private DMs: 1-on-1 private messages are never processed for event intelligence.
"""

import asyncio
import json
import logging
from pathlib import Path
from typing import Any, Dict, List, Optional, Set

import httpx

from config import settings
from agents.event_intelligence_agent import EventIntelligenceAgent

log = logging.getLogger(__name__)


class TelegramListener:
    """Manages Telegram group updates with strict consent whitelist verification."""

    def __init__(self, event_agent: Optional[EventIntelligenceAgent] = None):
        self.event_agent = event_agent or EventIntelligenceAgent()
        self._consented_group_ids: Set[int] = set()
        self._consented_groups_metadata: List[Dict[str, Any]] = []
        self._reload_whitelist()
        self._is_running = False
        self._polling_task: Optional[asyncio.Task] = None

    def _reload_whitelist(self) -> None:
        """Loads consented group IDs from config/consented_groups.json."""
        path = Path(settings.consented_groups_path)
        if not path.exists():
            # Fallback check relative to repo root
            alt_path = Path(__file__).parent.parent / "config" / "consented_groups.json"
            if alt_path.exists():
                path = alt_path

        if path.exists():
            try:
                with open(path, "r", encoding="utf-8") as f:
                    data = json.load(f)
                groups = data.get("consented_groups", [])
                self._consented_groups_metadata = groups
                self._consented_group_ids = {int(g["group_id"]) for g in groups if "group_id" in g}
                log.info("TelegramListener: Loaded %d consented groups from whitelist: %s",
                         len(self._consented_group_ids), self._consented_group_ids)
            except Exception as e:
                log.error("TelegramListener: Failed to load consented groups: %s", e)
        else:
            log.warning("TelegramListener: Consented groups file not found at %s", path)

    def is_group_consented(self, group_id: int) -> bool:
        """Returns True ONLY if group_id is explicitly in the consent whitelist."""
        self._reload_whitelist()
        try:
            gid = int(group_id)
            if gid in self._consented_group_ids:
                return True
            # Flexible match across supergroup -100 prefix, negative sign, and raw positive ID
            str_gid = str(abs(gid))
            for consented_id in self._consented_group_ids:
                str_cid = str(abs(consented_id))
                if str_gid == str_cid:
                    return True
                # e.g., 1001861027806 vs 1861027806
                if str_gid.startswith("100") and str_gid[3:] == str_cid:
                    return True
                if str_cid.startswith("100") and str_cid[3:] == str_gid:
                    return True
            return False
        except Exception:
            return False

    def get_consented_groups(self) -> List[Dict[str, Any]]:
        """Returns the list of consented group metadata."""
        self._reload_whitelist()
        return self._consented_groups_metadata

    async def handle_incoming_message(
        self,
        group_id: int,
        message_id: int = 0,
        text: str = "",
        chat_type: str = "supergroup",
        image_bytes: Optional[bytes] = None,
        mime_type: str = "image/jpeg"
    ) -> Dict[str, Any]:
        """
        Main message entrypoint for Telegram webhook/polling/simulation.
        Enforces whitelist, discards DMs, extracts event schema, and forward to backend-core.
        """
        # Rule 1: No Private / DM processing
        if chat_type == "private":
            log.info("Telegram message ignored: Private / 1-on-1 DM")
            return {
                "processed": False,
                "is_event": False,
                "reason": "private_dm_ignored",
            }

        # Rule 2: Hard Whitelist check
        if not self.is_group_consented(group_id):
            log.warning("Telegram message REJECTED: Group ID %d is NOT in consented_groups.json whitelist", group_id)
            return {
                "processed": False,
                "is_event": False,
                "reason": "non_consented_group",
                "group_id": group_id,
            }

        log.info("Telegram message accepted from consented group %d (msg_id=%d, has_image=%s)",
                 group_id, message_id, bool(image_bytes))

        # Process with Event Intelligence Agent
        extracted = self.event_agent.process_message(
            text=text,
            image_bytes=image_bytes,
            mime_type=mime_type,
            group_id=group_id,
            message_id=message_id,
        )

        if not extracted or not extracted.get("is_event"):
            log.info("Message evaluated as non-event / casual chatter in group %d", group_id)
            return {
                "processed": True,
                "is_event": False,
                "reason": "casual_noise_or_non_event",
            }

        # Forward extracted event to backend-core for persistence & audience matching
        ingest_status = await self._forward_to_backend(extracted)
        return {
            "processed": True,
            "is_event": True,
            "event": extracted,
            "ingested_to_backend": ingest_status.get("success", False),
            "backend_response": ingest_status,
        }

    async def _forward_to_backend(self, event_data: Dict[str, Any]) -> Dict[str, Any]:
        """Posts extracted event to backend-core internal ingestion endpoint."""
        url = f"{settings.backend_core_url.rstrip('/')}/api/events/internal/ingest"
        headers = {
            "X-Internal-Secret": settings.ai_service_shared_secret,
            "Content-Type": "application/json",
        }
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                res = await client.post(url, json=event_data, headers=headers)
                if res.status_code in (200, 201):
                    log.info("Successfully ingested event to backend-core: %s", event_data.get("title"))
                    return res.json()
                else:
                    log.error("Backend-core event ingestion returned %d: %s", res.status_code, res.text)
                    return {"success": False, "error": f"Backend returned {res.status_code}: {res.text}"}
        except Exception as e:
            log.warn("Could not forward event to backend-core at %s: %s", url, e)
            return {"success": False, "error": str(e)}

    async def start_polling_if_configured(self) -> None:
        """Starts background Telegram polling if TELEGRAM_BOT_TOKEN is set."""
        token = settings.telegram_bot_token
        if not token or token in {"YOUR_TELEGRAM_BOT_TOKEN_HERE", ""}:
            log.info("TelegramListener: No TELEGRAM_BOT_TOKEN configured — running in webhook / simulation mode")
            return

        self._is_running = True
        self._polling_task = asyncio.create_task(self._poll_loop(token))
        log.info("TelegramListener: Started background polling worker for Telegram bot")

    async def stop(self) -> None:
        """Stops background polling."""
        self._is_running = False
        if self._polling_task:
            self._polling_task.cancel()
            try:
                await self._polling_task
            except asyncio.CancelledError:
                pass
        log.info("TelegramListener: Stopped")

    async def _poll_loop(self, token: str) -> None:
        """Background long-polling loop against Telegram Bot API."""
        offset = 0
        base_url = f"https://api.telegram.org/bot{token}"

        async with httpx.AsyncClient(timeout=35.0) as client:
            while self._is_running:
                try:
                    resp = await client.get(
                        f"{base_url}/getUpdates",
                        params={"offset": offset, "timeout": 25}
                    )
                    if resp.status_code == 200:
                        data = resp.json()
                        for update in data.get("result", []):
                            offset = update["update_id"] + 1
                            msg = update.get("message") or update.get("channel_post")
                            if not msg:
                                continue

                            chat = msg.get("chat", {})
                            chat_id = chat.get("id")
                            chat_type = chat.get("type", "group")
                            msg_id = msg.get("message_id", 0)
                            text = msg.get("text") or msg.get("caption") or ""

                            # Check for photo
                            photo_bytes = None
                            if "photo" in msg and msg["photo"]:
                                best_photo = msg["photo"][-1]
                                file_id = best_photo.get("file_id")
                                if file_id:
                                    f_resp = await client.get(f"{base_url}/getFile", params={"file_id": file_id})
                                    if f_resp.status_code == 200:
                                        file_path = f_resp.json().get("result", {}).get("file_path")
                                        if file_path:
                                            d_resp = await client.get(f"https://api.telegram.org/file/bot{token}/{file_path}")
                                            if d_resp.status_code == 200:
                                                photo_bytes = d_resp.content

                            # Handle incoming message
                            await self.handle_incoming_message(
                                group_id=chat_id,
                                message_id=msg_id,
                                text=text,
                                chat_type=chat_type,
                                image_bytes=photo_bytes,
                            )
                except asyncio.CancelledError:
                    break
                except Exception as e:
                    log.warning("Telegram polling error: %s", e)
                    await asyncio.sleep(5)
