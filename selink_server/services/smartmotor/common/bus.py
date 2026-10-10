"""Redis pub/sub channels between services.

Channels: rt:point:<id>, rt:machine:<id>, rt:events, rt:gateways (realtime → WebSocket),
notify (events → notifier), analytics:capture (new capture → analytics).
"""
from __future__ import annotations

import json
from typing import Any

import redis.asyncio as aioredis


def connect(url: str) -> aioredis.Redis:
    return aioredis.from_url(url, decode_responses=True)


async def publish(r: aioredis.Redis, channel: str, msg: Any) -> None:
    await r.publish(channel, json.dumps(msg, default=str, ensure_ascii=False))


async def dedupe(r: aioredis.Redis, msg_id: str | None, ttl_s: int = 48 * 3600) -> bool:
    """Return True if msg_id is new (spec 6.3 step 4)."""
    if not msg_id:
        return True
    return bool(await r.set(f"msg:{msg_id}", 1, ex=ttl_s, nx=True))
