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
             "upload_logs", "learn_alpha", "commission_sensor"}


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
                                  d.machine_id AS assigned_machine_id, m.name AS assigned_machine_name, d.started_at AS deployment_started_at,
                                  (SELECT count(*) FROM measurement_points p WHERE p.gateway_id=g.id) AS points
                                FROM gateways g
                                LEFT JOIN gateway_deployments d ON d.gateway_id=g.id AND d.state='active'
                                LEFT JOIN machines m ON m.id=d.machine_id
                                WHERE g.site_id = ANY($1) ORDER BY g.id""", user.sites())
    return [dict(r) for r in rows]


@router.get("/gateways/{gw_id}")
async def get_gateway(gw_id: str, request: Request, user: User = Depends(current_user)):
    g = await _gateway(request, user, gw_id)
    g.pop("mqtt_password_hash", None)
    async with request.app.state.pool.acquire() as c:
        deployment = await c.fetchrow("""SELECT d.*, m.name AS machine_name FROM gateway_deployments d
                                         JOIN machines m ON m.id=d.machine_id
                                         WHERE d.gateway_id=$1 AND d.state='active'""", gw_id)
        pts = await c.fetch("""SELECT p.id, p.name, p.machine_id, p.sensor_addr, p.role,
                                 (SELECT max(ts) FROM vib_metrics v WHERE v.point_id=p.id AND v.ts > now()-interval '1 day') AS last_reading
                               FROM measurement_points p WHERE p.gateway_id=$1
                                 AND (NOT EXISTS (SELECT 1 FROM gateway_deployments d WHERE d.gateway_id=$1 AND d.state='active')
                                      OR p.machine_id=(SELECT machine_id FROM gateway_deployments d WHERE d.gateway_id=$1 AND d.state='active'))
                               ORDER BY p.id""", gw_id)
        cmds = await c.fetch("SELECT * FROM gateway_commands WHERE gateway_id=$1 ORDER BY created_at DESC LIMIT 30", gw_id)
        history = await c.fetch("""SELECT d.id, d.machine_id, m.name AS machine_name, d.state, d.started_at, d.ended_at, d.note
                                   FROM gateway_deployments d JOIN machines m ON m.id=d.machine_id
                                   WHERE d.gateway_id=$1 ORDER BY d.started_at DESC LIMIT 12""", gw_id)
    return {**g, "deployment": dict(deployment) if deployment else None, "points": [dict(p) for p in pts],
            "commands": [dict(x) for x in cmds], "deployment_history": [dict(x) for x in history]}


class GatewayIn(BaseModel):
    id: str
    site_id: str
    hw_model: str = "T153-HelperBoard"


class DeploymentIn(BaseModel):
    machine_id: str
    note: str = ""


async def _machine_for_deployment(request: Request, user: User, gateway: dict, machine_id: str) -> dict:
    async with request.app.state.pool.acquire() as c:
        machine = await c.fetchrow("SELECT * FROM machines WHERE id=$1", machine_id)
    if not machine or user.role_for_site(machine["site_id"]) < ROLE_RANK["analyst"]:
        raise HTTPException(404, "Không tìm thấy máy hoặc không đủ quyền")
    if machine["site_id"] != gateway["site_id"]:
        raise HTTPException(422, "Gateway và máy phải cùng khu vực để phân công")
    return dict(machine)


@router.get("/machines/{machine_id}/deployment")
async def machine_deployment(machine_id: str, request: Request, user: User = Depends(current_user)):
    """Current gateway and a short deployment history for an asset."""
    async with request.app.state.pool.acquire() as c:
        machine = await c.fetchrow("SELECT site_id FROM machines WHERE id=$1", machine_id)
        if not machine or user.role_for_site(machine["site_id"]) < ROLE_RANK["viewer"]:
            raise HTTPException(404, "Không tìm thấy máy")
        rows = await c.fetch("""SELECT d.*, g.online, g.last_seen, g.hw_model FROM gateway_deployments d
                                JOIN gateways g ON g.id=d.gateway_id WHERE d.machine_id=$1
                                ORDER BY d.started_at DESC LIMIT 12""", machine_id)
    active = next((dict(row) for row in rows if row["state"] == "active"), None)
    return {"active": active, "history": [dict(row) for row in rows]}


@router.post("/gateways/{gw_id}/deployments")
async def assign_gateway(gw_id: str, body: DeploymentIn, request: Request, user: User = Depends(require("analyst"))):
    """Move a portable gateway to one asset and publish a topology containing only that asset."""
    gateway = await _gateway(request, user, gw_id, "analyst")
    machine = await _machine_for_deployment(request, user, gateway, body.machine_id)
    pool = request.app.state.pool
    async with pool.acquire() as c:
        current = await gwconfig.latest(c, gw_id)
        if not current:
            raise HTTPException(409, "Gateway chưa có cấu hình gốc; hãy nạp cấu hình gateway trước")
        active = await c.fetchrow("SELECT * FROM gateway_deployments WHERE gateway_id=$1 AND state='active'", gw_id)
        if active and active["machine_id"] == body.machine_id:
            return {"id": active["id"], "machine_id": body.machine_id, "config_version": current["version"], "unchanged": True}
        selected = next((m for m in current["config"].get("machines") or [] if m.get("id") == body.machine_id), None)
        next_cfg = await gwconfig.merge_managed(c, gwconfig.activate_deployment(current["config"], machine))
        deployment_id = f"dep_{uuid.uuid4().hex[:16]}"
        snapshot = {"previous_config_version": current["version"], "previous_machine_ids": [m.get("id") for m in current["config"].get("machines") or []],
                    "reused_machine_block": bool(selected)}
        async with c.transaction():
            await c.execute("""UPDATE gateway_deployments SET state='ended', ended_at=now(), ended_by=$2
                               WHERE gateway_id=$1 AND state='active'""", gw_id, user.email)
            await c.execute("""INSERT INTO gateway_deployments
                               (id, gateway_id, machine_id, started_by, note, snapshot) VALUES ($1,$2,$3,$4,$5,$6)""",
                            deployment_id, gw_id, body.machine_id, user.email, body.note.strip(), snapshot)
    version = await gwconfig.save_and_publish(pool, request.app.state.settings, gw_id, next_cfg, user.email)
    async with pool.acquire() as c:
        await c.execute("UPDATE gateway_deployments SET config_version=$2 WHERE id=$1", deployment_id, version)
    await audit(pool, user, "gateway.deploy", gw_id, {"machine_id": body.machine_id, "deployment_id": deployment_id, "config_version": version})
    return {"id": deployment_id, "machine_id": body.machine_id, "config_version": version, "unchanged": False}


@router.post("/gateways/{gw_id}/unassign")
async def unassign_gateway(gw_id: str, request: Request, user: User = Depends(require("analyst"))):
    """End the active assignment and stop acquisition before hardware is moved."""
    await _gateway(request, user, gw_id, "analyst")
    pool = request.app.state.pool
    async with pool.acquire() as c:
        current = await gwconfig.latest(c, gw_id)
        active = await c.fetchrow("SELECT id FROM gateway_deployments WHERE gateway_id=$1 AND state='active'", gw_id)
        if not active:
            return {"ok": True, "unchanged": True}
        if not current:
            raise HTTPException(409, "Gateway chưa có cấu hình gốc")
        next_cfg = dict(current["config"])
        next_cfg["machines"] = []
        next_cfg.pop("version", None)
        await c.execute("""UPDATE gateway_deployments SET state='ended', ended_at=now(), ended_by=$2
                           WHERE id=$1""", active["id"], user.email)
    version = await gwconfig.save_and_publish(pool, request.app.state.settings, gw_id, next_cfg, user.email)
    await audit(pool, user, "gateway.unassign", gw_id, {"config_version": version})
    return {"ok": True, "config_version": version}


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
