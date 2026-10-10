"""Gateways: status/health, commands (downlink), versioned configuration (screen 11)."""
import uuid
from typing import Any, Optional

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel

from ...common import gwconfig, mqttpub
from ..deps import User, audit, current_user, require
from ..security import ROLE_RANK, hash_password, new_token

router = APIRouter(tags=["gateways"])

CMD_TYPES = {"capture_now", "group_capture", "reload_config", "set_sensor_param", "reboot", "ota_update", "ping",
             "upload_logs", "learn_alpha"}


async def _gateway(request: Request, user: User, gw_id: str, min_role: str = "viewer") -> dict:
    async with request.app.state.pool.acquire() as c:
        g = await c.fetchrow("SELECT g.*, s.tenant_id FROM gateways g JOIN sites s ON s.id=g.site_id WHERE g.id=$1", gw_id)
    if not g:
        raise HTTPException(404, "Không tìm thấy gateway")
    if user.role_for_site(g["site_id"]) < ROLE_RANK[min_role]:
        raise HTTPException(403, "Không đủ quyền")
    return dict(g)


@router.get("/gateways")
async def list_gateways(request: Request, user: User = Depends(current_user)):
    async with request.app.state.pool.acquire() as c:
        rows = await c.fetch("""SELECT g.id, g.site_id, g.hw_model, g.fw_version, g.last_seen, g.online, g.config_version, g.health,
                                  (SELECT count(*) FROM measurement_points p WHERE p.gateway_id=g.id) AS points
                                FROM gateways g WHERE g.site_id = ANY($1) ORDER BY g.id""", user.sites())
    return [dict(r) for r in rows]


@router.get("/gateways/{gw_id}")
async def get_gateway(gw_id: str, request: Request, user: User = Depends(current_user)):
    g = await _gateway(request, user, gw_id)
    g.pop("mqtt_password_hash", None)
    async with request.app.state.pool.acquire() as c:
        pts = await c.fetch("""SELECT p.id, p.name, p.machine_id, p.sensor_addr, p.role,
                                 (SELECT max(ts) FROM vib_metrics v WHERE v.point_id=p.id AND v.ts > now()-interval '1 day') AS last_reading
                               FROM measurement_points p WHERE p.gateway_id=$1 ORDER BY p.id""", gw_id)
        cmds = await c.fetch("SELECT * FROM gateway_commands WHERE gateway_id=$1 ORDER BY created_at DESC LIMIT 30", gw_id)
    return {**g, "points": [dict(p) for p in pts], "commands": [dict(x) for x in cmds]}


class GatewayIn(BaseModel):
    id: str
    site_id: str
    hw_model: str = "T153-HelperBoard"


@router.post("/gateways", status_code=201)
async def create_gateway(body: GatewayIn, request: Request, user: User = Depends(require("admin"))):
    if user.role_for_site(body.site_id) < ROLE_RANK["admin"]:
        raise HTTPException(403, "Không đủ quyền với site")
    token = new_token()
    async with request.app.state.pool.acquire() as c:
        await c.execute("""INSERT INTO gateways (id, site_id, hw_model, mqtt_username, mqtt_password_hash) VALUES ($1,$2,$3,$1,$4)""",
                        body.id, body.site_id, body.hw_model, hash_password(token))
    await audit(request.app.state.pool, user, "gateway.create", body.id)
    return {"id": body.id, "mqtt_username": body.id, "mqtt_token": token,
            "note": "Lưu token vào /etc/edge-agent/mqtt.token – chỉ hiển thị một lần"}


@router.post("/gateways/{gw_id}/token")
async def rotate_token(gw_id: str, request: Request, user: User = Depends(require("admin"))):
    await _gateway(request, user, gw_id, "admin")
    token = new_token()
    async with request.app.state.pool.acquire() as c:
        await c.execute("UPDATE gateways SET mqtt_password_hash=$2, mqtt_username=COALESCE(mqtt_username,$1) WHERE id=$1",
                        gw_id, hash_password(token))
    await audit(request.app.state.pool, user, "gateway.token_rotate", gw_id)
    return {"mqtt_username": gw_id, "mqtt_token": token}


class CommandIn(BaseModel):
    type: str
    point_id: Optional[str] = None
    profile: Optional[str] = None
    url: Optional[str] = None
    sha256: Optional[str] = None
    params: dict[str, Any] = {}


@router.post("/gateways/{gw_id}/commands")
async def send_command(gw_id: str, body: CommandIn, request: Request, user: User = Depends(require("analyst"))):
    g = await _gateway(request, user, gw_id, "analyst")
    if body.type not in CMD_TYPES:
        raise HTTPException(400, f"type phải thuộc {sorted(CMD_TYPES)}")
    if body.type in ("reboot", "ota_update") and user.role_for_site(g["site_id"]) < ROLE_RANK["admin"]:
        raise HTTPException(403, "Lệnh này cần quyền admin")
    cmd_id = f"cmd_{uuid.uuid4().hex[:12]}"
    payload = {"cmd_id": cmd_id, **body.model_dump(exclude_none=True)}
    if not payload.get("params"):
        payload.pop("params", None)
    s = request.app.state.settings
    async with request.app.state.pool.acquire() as c:
        await c.execute("INSERT INTO gateway_commands (cmd_id, gateway_id, type, payload, created_by) VALUES ($1,$2,$3,$4,$5)",
                        cmd_id, gw_id, body.type, payload, user.email)
    try:
        await mqttpub.publish(s, mqttpub.gateway_prefix(s, g["tenant_id"], g["site_id"], gw_id) + "cmd", payload, qos=1)
    except Exception as e:
        async with request.app.state.pool.acquire() as c:
            await c.execute("UPDATE gateway_commands SET status='error', detail=$2 WHERE cmd_id=$1", cmd_id, str(e))
        raise HTTPException(502, f"Không gửi được lệnh qua MQTT: {e}")
    await audit(request.app.state.pool, user, "gateway.command", gw_id, payload)
    return {"cmd_id": cmd_id, "status": "sent"}


@router.get("/gateways/{gw_id}/config")
async def get_config(gw_id: str, request: Request, user: User = Depends(require("engineer"))):
    await _gateway(request, user, gw_id, "engineer")
    async with request.app.state.pool.acquire() as c:
        cur = await gwconfig.latest(c, gw_id)
        versions = await c.fetch("SELECT version, created_by, created_at, applied_at FROM gateway_configs WHERE gateway_id=$1 ORDER BY version DESC LIMIT 20", gw_id)
    return {"current": cur, "versions": [dict(v) for v in versions]}


@router.put("/gateways/{gw_id}/config")
async def put_config(gw_id: str, cfg: dict, request: Request, user: User = Depends(require("admin"))):
    """Upload a full edge configuration (JSON equivalent of edge.yaml); server-managed parts are merged in."""
    g = await _gateway(request, user, gw_id, "admin")
    gwc = cfg.get("gateway") or {}
    if gwc.get("id") not in (None, gw_id) or gwc.get("site") not in (None, g["site_id"]):
        raise HTTPException(400, "gateway.id/site trong cấu hình không khớp")
    cfg.setdefault("gateway", {}).update({"id": gw_id, "site": g["site_id"], "tenant": g["tenant_id"]})
    pool = request.app.state.pool
    async with pool.acquire() as c:
        merged = await gwconfig.merge_managed(c, cfg)
    ver = await gwconfig.save_and_publish(pool, request.app.state.settings, gw_id, merged, user.email)
    await audit(pool, user, "gateway.config", gw_id, {"version": ver})
    return {"version": ver}


@router.post("/gateways/{gw_id}/config/push")
async def push_config(gw_id: str, request: Request, user: User = Depends(require("analyst"))):
    await _gateway(request, user, gw_id, "analyst")
    ver = await gwconfig.push_managed(request.app.state.pool, request.app.state.settings, gw_id, user.email)
    if ver is None:
        raise HTTPException(409, "Chưa có cấu hình gốc cho gateway này")
    return {"version": ver}
