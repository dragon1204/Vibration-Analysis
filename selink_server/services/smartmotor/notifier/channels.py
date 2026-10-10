"""Notification channels: email (SMTP), Telegram bot, Zalo OA, generic SMS HTTP gateway (spec 6.7)."""
from __future__ import annotations

import asyncio
import logging
import smtplib
from email.message import EmailMessage

import httpx

from ..common.settings import Settings

log = logging.getLogger("notifier")


async def send_email(s: Settings, to: str, subject: str, body: str) -> bool:
    if not s.smtp_host or not to:
        return False

    def _send():
        msg = EmailMessage()
        msg["From"], msg["To"], msg["Subject"] = s.smtp_from, to, subject
        msg.set_content(body)
        with smtplib.SMTP(s.smtp_host, s.smtp_port, timeout=20) as smtp:
            smtp.starttls()
            if s.smtp_user:
                smtp.login(s.smtp_user, s.smtp_password)
            smtp.send_message(msg)

    await asyncio.to_thread(_send)
    return True


async def send_telegram(s: Settings, chat_id: str, text: str) -> bool:
    if not s.telegram_bot_token or not chat_id:
        return False
    async with httpx.AsyncClient(timeout=15) as c:
        r = await c.post(f"https://api.telegram.org/bot{s.telegram_bot_token}/sendMessage",
                         json={"chat_id": chat_id, "text": text, "disable_web_page_preview": True})
        return r.status_code == 200


async def send_zalo(s: Settings, user_id: str, text: str) -> bool:
    """Zalo OA customer-service message (user must follow the OA)."""
    if not s.zalo_oa_token or not user_id:
        return False
    async with httpx.AsyncClient(timeout=15) as c:
        r = await c.post("https://openapi.zalo.me/v3.0/oa/message/cs", headers={"access_token": s.zalo_oa_token},
                         json={"recipient": {"user_id": user_id}, "message": {"text": text[:2000]}})
        return r.status_code == 200 and r.json().get("error", 0) == 0


async def send_sms(s: Settings, phone: str, text: str) -> bool:
    """Generic SMS gateway: POST {to, text} with bearer token (adapt to the chosen provider)."""
    if not s.sms_url or not phone:
        return False
    async with httpx.AsyncClient(timeout=15) as c:
        r = await c.post(s.sms_url, headers={"Authorization": f"Bearer {s.sms_token}"}, json={"to": phone, "text": text[:300]})
        return r.status_code < 300
