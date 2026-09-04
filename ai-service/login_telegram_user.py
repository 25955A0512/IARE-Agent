"""
login_telegram_user.py — One-time Telegram user authentication helper.
Run this script once to log in your Telegram account and save the local session.
"""

import os
from pathlib import Path
from telethon.sync import TelegramClient
from config import settings

def main():
    api_id = settings.telegram_api_id
    api_hash = settings.telegram_api_hash
    session_path = str(Path(__file__).parent / "iare_user_session")

    if not api_id or not api_hash:
        print("❌ Error: TELEGRAM_API_ID and TELEGRAM_API_HASH must be set in ai-service/.env")
        return

    print("==================================================")
    print("🔐 IARE Agent — Telegram User Client Setup")
    print(f"API ID: {api_id}")
    print(f"Consented Group: -1002243755834 (IARE College Group)")
    print("==================================================")
    print("Connecting to Telegram...")

    with TelegramClient(session_path, api_id, api_hash) as client:
        print("✅ Telegram session successfully authenticated!")
        me = client.get_me()
        print(f"Logged in as: {me.first_name} (@{me.username}) [ID: {me.id}]")
        print("\n🎉 The IARE Agent user listener is now ready to automatically monitor your college group in the background.")

if __name__ == "__main__":
    main()
