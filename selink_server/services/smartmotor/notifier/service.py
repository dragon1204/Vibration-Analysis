"""Notifier (spec 6.7): sends raised events to users with access to the site whose
min_severity is reached; throttles to 1 message / 5 min / machine; reminders come from analytics."""
from __future__ import annotations

import asyncio
import json
import logging

from ..common import bus
from ..common.db import create_pool
from ..common.iso import SEVERITY_ORDER
from ..common.settings import Settings
from . import channels

log = logging.getLogger("notifier")

SEV_VI = {"watch": "THEO DÕI", "warning": "CẢNH BÁO", "danger": "NGUY HIỂM", "info": "THÔNG TIN"}


def format_message(ev: dict, base_url: str, reminder: bool = False) -> tuple[str, str]:
    sev = SEV_VI.get(ev.get("severity"), ev.get("severity", "").upper())
    where = " · ".join(x for x in (ev.get("machine_name") or ev.get("machine_id"), ev.get("point_name") or ev.get("point_id")) if x)
    subject = f"[Smart Motor] {'Nhắc lại – ' if reminder else ''}{sev}: {where or ev.get('gateway_id') or ''}"
    lines = [f"{sev} – {ev.get('message') or ev.get('rule')}"]
    if where:
        lines.append(f"Thiết bị: {where}")
    if ev.get("value") is not None:
        thr = f" / ngưỡng {ev['threshold']:.2f}" if ev.get("threshold") is not None else ""
        lines.append(f"Giá trị: {ev['value']:.2f}{thr} ({ev.get('metric') or ''})")
    diag = ev.get("diagnosis") or {}
    if diag.get("label"):
        lines.append(f"Chẩn đoán sơ bộ: {diag['label']} ({diag.get('confidence', 0) * 100:.0f}%) – {diag.get('recommendation', '')}")
    lines.append(f"Thời điểm: {ev.get('ts')}")
    lines.append(f"Chi tiết: {base_url.rstrip('/')}/events?event={ev.get('event_id')}")
    return subject, "\n".join(lines)


class Notifier:
    def __init__(self, s: Settings):
        self.s = s
        self.pool = None
        self.redis = None

    async def run(self) -> None:
        self.pool = await create_pool(self.s.db_url, max_size=3)
        self.redis = bus.connect(self.s.redis_url)
        ps = self.redis.pubsub()
        await ps.subscribe("notify")
        log.info("notifier listening")
        async for m in ps.listen():
            if m.get("type") != "message":
                continue
            try:
                d = json.loads(m["data"])
                if d.get("event_id"):
                    await self.handle_event(d["event_id"], bool(d.get("reminder")))
            except Exception:
                log.exception("notify failed")

    async def handle_event(self, event_id: str, reminder: bool) -> None:
        async with self.pool.acquire() as c:
            ev = await c.fetchrow("""SELECT e.*, m.name AS machine_name, p.name AS point_name,
                                       COALESCE(m.site_id, g.site_id) AS site_id, s.tenant_id
                                     FROM events e LEFT JOIN machines m ON m.id=e.machine_id
                                     LEFT JOIN measurement_points p ON p.id=e.point_id
                                     LEFT JOIN gateways g ON g.id=e.gateway_id
                                     LEFT JOIN sites s ON s.id=COALESCE(m.site_id, g.site_id)
                                     WHERE e.event_id=$1""", event_id)
            if not ev or ev["state"] != "raised" and not reminder:
                return
            if reminder and ev["state"] != "raised":
                return
            users = await c.fetch("""SELECT DISTINCT u.id, u.email, u.phone, u.zalo_id, u.telegram_chat_id, np.channel, np.min_severity
                                     FROM users u JOIN user_roles r ON r.user_id=u.id
                                     JOIN notification_prefs np ON np.user_id=u.id AND np.enabled
                                     WHERE u.active AND ((r.tenant_id IS NULL AND r.site_id IS NULL) OR r.site_id=$1
                                       OR (r.site_id IS NULL AND r.tenant_id=$2))""", ev["site_id"], ev["tenant_id"])
        ev = dict(ev)
        # Throttle: at most 1 notification / 5 min / machine (reminders bypass).
        key = f"notify:throttle:{ev.get('machine_id') or ev.get('gateway_id')}"
        if not reminder and SEVERITY_ORDER.get(ev["severity"], 0) < 3:
            if not await self.redis.set(key, event_id, ex=300, nx=True):
                log.info("throttled %s", event_id)
                return
        subject, body = format_message(ev, self.s.public_base_url, reminder)
        sent = 0
        for u in users:
            if SEVERITY_ORDER.get(ev["severity"], 0) < SEVERITY_ORDER.get(u["min_severity"], 2):
                continue
            ch = u["channel"]
            try:
                if ch == "email":
                    ok = await channels.send_email(self.s, u["email"], subject, body)
                elif ch == "telegram":
                    ok = await channels.send_telegram(self.s, u["telegram_chat_id"], body)
                elif ch == "zalo":
                    ok = await channels.send_zalo(self.s, u["zalo_id"], body)
                elif ch == "sms":
                    ok = await channels.send_sms(self.s, u["phone"], f"{subject}\n{ev.get('message')}")
                else:
                    ok = False
                sent += int(bool(ok))
            except Exception as e:
                log.warning("send %s to %s failed: %s", ch, u["email"], e)
        log.info("event %s notified via %d channel(s)", event_id, sent)


def main() -> None:
    from ..common.logs import setup
    from ..common.settings import get_settings
    s = get_settings()
    setup(s.log_level)
    asyncio.run(Notifier(s).run())
