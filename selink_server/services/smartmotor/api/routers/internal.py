"""EMQX HTTP authentication & authorization (spec 6.8). Not exposed through Caddy.

ACL: a gateway may only publish under sm/v1/<tenant>/<site>/<gw>/# (except cmd, config) and
subscribe to .../<gw>/cmd and .../<gw>/config. The internal service user may do everything.
"""
import hmac
import logging
import time

from fastapi import APIRouter, Request
from pydantic import BaseModel

from ..security import verify_password

router = APIRouter(prefix="/internal/mqtt", tags=["internal"], include_in_schema=False)
log = logging.getLogger("mqtt-auth")

_cache: dict[str, tuple[float, bool]] = {}


class AuthIn(BaseModel):
    username: str = ""
    password: str = ""
    clientid: str = ""


class AclIn(BaseModel):
    username: str = ""
    topic: str = ""
    action: str = ""  # publish | subscribe


@router.post("/auth")
async def mqtt_auth(body: AuthIn, request: Request):
    s = request.app.state.settings
    if body.username == s.mqtt_ingest_user:
        ok = hmac.compare_digest(body.password, s.mqtt_ingest_pass)
        return {"result": "allow" if ok else "deny", "is_superuser": ok}
    if body.clientid and body.clientid != f"edge-{body.username}":
        return {"result": "deny"}
    key = f"{body.username}:{body.password}"
    hit = _cache.get(key)
    if hit and time.monotonic() - hit[0] < 300:
        ok = hit[1]
    else:
        async with request.app.state.pool.acquire() as c:
            h = await c.fetchval("SELECT mqtt_password_hash FROM gateways WHERE mqtt_username=$1", body.username)
        ok = verify_password(body.password, h)
        _cache[key] = (time.monotonic(), ok)
    if not ok:
        log.warning("mqtt auth denied for %s", body.username)
    return {"result": "allow" if ok else "deny", "is_superuser": False}


@router.post("/acl")
async def mqtt_acl(body: AclIn, request: Request):
    s = request.app.state.settings
    if body.username == s.mqtt_ingest_user:
        return {"result": "allow"}
    async with request.app.state.pool.acquire() as c:
        g = await c.fetchrow("""SELECT g.id, s.id AS site, s.tenant_id FROM gateways g JOIN sites s ON s.id=g.site_id
                                WHERE g.mqtt_username=$1""", body.username)
    if not g:
        return {"result": "deny"}
    prefix = f"{s.mqtt_topic_root}/{g['tenant_id']}/{g['site']}/{g['id']}/"
    if body.action == "subscribe":
        ok = body.topic in (prefix + "cmd", prefix + "config")
    else:
        ok = body.topic.startswith(prefix) and body.topic not in (prefix + "cmd", prefix + "config") and "#" not in body.topic \
            and "+" not in body.topic
    return {"result": "allow" if ok else "deny"}
