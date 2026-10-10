"""WebSocket realtime (spec 6.6): /ws?token=<access JWT>.

Client → {"sub": ["point:ga55-01-de", "machine:ga55-01", "events", "gateways"]}
Server → messages published by ingest/analytics on Redis rt:* channels (filtered by access).
"""
import asyncio
import json
import logging

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from .deps import load_user, site_of_machine, site_of_point
from .security import decode_token

router = APIRouter()
log = logging.getLogger("ws")


@router.websocket("/ws")
async def ws_endpoint(ws: WebSocket):
    app = ws.app
    token = ws.query_params.get("token", "")
    uid = decode_token(app.state.settings.jwt_secret, token, "access")
    user = await load_user(app.state.pool, uid) if uid else None
    if not user:
        await ws.close(code=4401)
        return
    await ws.accept()
    allowed_sites = set(user.sites())
    pubsub = app.state.redis.pubsub()
    subscribed: set[str] = set()

    async def reader():
        async for m in pubsub.listen():
            if m.get("type") != "message":
                continue
            data = m["data"]
            if m["channel"] in ("rt:events", "rt:gateways"):
                try:
                    d = json.loads(data)
                except json.JSONDecodeError:
                    continue
                mid = d.get("machine_id")
                if mid and (await site_of_machine(app.state.pool, mid)) not in allowed_sites:
                    continue
            await ws.send_text(json.dumps({"channel": m["channel"].removeprefix("rt:"), "data": json.loads(data)}))

    task = None
    try:
        while True:
            msg = await ws.receive_json()
            subs = msg.get("sub") or []
            unsubs = msg.get("unsub") or []
            for s in subs:
                kind, _, ident = s.partition(":")
                if kind == "point":
                    ok = (await site_of_point(app.state.pool, ident)) in allowed_sites
                elif kind == "machine":
                    ok = (await site_of_machine(app.state.pool, ident)) in allowed_sites
                else:
                    ok = kind in ("events", "gateways")
                if ok and f"rt:{s}" not in subscribed:
                    await pubsub.subscribe(f"rt:{s}")
                    subscribed.add(f"rt:{s}")
            for s in unsubs:
                if f"rt:{s}" in subscribed:
                    await pubsub.unsubscribe(f"rt:{s}")
                    subscribed.discard(f"rt:{s}")
            if subscribed and task is None:
                task = asyncio.create_task(reader())
            await ws.send_json({"subscribed": sorted(x.removeprefix("rt:") for x in subscribed)})
    except WebSocketDisconnect:
        pass
    except Exception:
        log.exception("websocket error")
    finally:
        if task:
            task.cancel()
        await pubsub.aclose()
