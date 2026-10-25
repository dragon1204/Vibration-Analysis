"""Add a sensor to a machine by choosing its mounting position (DE/NDE/BASE/LOAD).

One call creates the measurement point, optionally gives a factory-new sensor its Modbus address through
the gateway, and pushes the new edge configuration so the gateway starts reading it.
"""
import asyncio
import uuid
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field

from ...common import gwconfig, mqttpub
from ...common.sensor_slots import SLOTS, add_point_to_config, build_edge_point, point_id, point_name, slot_of
from ..deps import User, audit, check_machine, current_user, require

router = APIRouter(tags=["sensors"])

COMMISSION_WAIT_S = 40


class SensorIn(BaseModel):
    slot: int = Field(ge=1, le=4)
    addr: int = Field(ge=1, le=127)
    name: Optional[str] = None
    commission: bool = False  # the sensor still has its factory address: set `addr` through the gateway first


async def _points(c, machine_id: str) -> list[dict]:
    rows = await c.fetch("SELECT id, name, location, role, sensor_addr, gateway_id FROM measurement_points WHERE machine_id=$1 ORDER BY id",
                         machine_id)
    return [dict(r) for r in rows]


@router.get("/machines/{machine_id}/sensor-slots")
async def sensor_slots(machine_id: str, request: Request, user: User = Depends(current_user)):
    """The four positions with the point (if any) mounted there."""
    await check_machine(request.app.state.pool, user, machine_id)
    async with request.app.state.pool.acquire() as c:
        pts = await _points(c, machine_id)
    used = {slot_of(p["location"]): p for p in pts if slot_of(p["location"])}
    return {"slots": [{"slot": n, **spec, "point": used.get(n)} for n, spec in SLOTS.items()],
            "used_addrs": sorted({p["sensor_addr"] for p in pts if p["sensor_addr"]})}


async def _commission(request: Request, gateway: dict, bus_id: str | None, addr: int) -> dict:
    """Send commission_sensor and wait for the gateway's answer."""
    s = request.app.state.settings
    pool = request.app.state.pool
    cmd_id = f"cmd_{uuid.uuid4().hex[:12]}"
    payload = {"cmd_id": cmd_id, "type": "commission_sensor", "params": {"bus": bus_id or "", "to_addr": addr}}
    async with pool.acquire() as c:
        await c.execute("INSERT INTO gateway_commands (cmd_id, gateway_id, type, payload, created_by) VALUES ($1,$2,$3,$4,$5)",
                        cmd_id, gateway["id"], "commission_sensor", payload, "sensors")
    try:
        await mqttpub.publish(s, mqttpub.gateway_prefix(s, gateway["tenant_id"], gateway["site_id"], gateway["id"]) + "cmd", payload, qos=1)
    except Exception as e:
        raise HTTPException(502, f"Không gửi được lệnh tới gateway: {e}")
    for _ in range(COMMISSION_WAIT_S):
        await asyncio.sleep(1)
        async with pool.acquire() as c:
            row = await c.fetchrow("SELECT status, detail FROM gateway_commands WHERE cmd_id=$1", cmd_id)
        if row and row["status"] == "ok":
            return {"cmd_id": cmd_id, "detail": row["detail"]}
        if row and row["status"] == "error":
            raise HTTPException(422, f"Gateway không đặt được địa chỉ cho cảm biến: {row['detail']}")
    raise HTTPException(504, "Gateway không trả lời lệnh đặt địa chỉ (đang mất kết nối hoặc cảm biến chưa cắm)")


@router.post("/machines/{machine_id}/sensors", status_code=201)
async def add_sensor(machine_id: str, body: SensorIn, request: Request, user: User = Depends(require("admin"))):
    pool = request.app.state.pool
    await check_machine(pool, user, machine_id, "admin")
    async with pool.acquire() as c:
        pts = await _points(c, machine_id)
        if any(slot_of(p["location"]) == body.slot for p in pts):
            raise HTTPException(409, f"Vị trí {SLOTS[body.slot]['short']} đã có cảm biến")
        gw_id = next((p["gateway_id"] for p in pts if p["gateway_id"]), None)
        if not gw_id:
            gw_id = await c.fetchval("""SELECT gateway_id FROM gateway_deployments
                                       WHERE machine_id=$1 AND state='active' ORDER BY started_at DESC LIMIT 1""", machine_id)
        if not gw_id:
            raise HTTPException(400, "Máy chưa gắn gateway")
        if any(p["sensor_addr"] == body.addr and p["gateway_id"] == gw_id for p in pts):
            raise HTTPException(409, f"Địa chỉ Modbus {body.addr} đã dùng cho cảm biến khác")
        gateway = await c.fetchrow("SELECT g.id, s.id AS site_id, s.tenant_id FROM gateways g JOIN sites s ON s.id=g.site_id WHERE g.id=$1", gw_id)
        cur = await gwconfig.latest(c, gw_id)
    if not cur:
        raise HTTPException(409, "Gateway chưa có cấu hình gốc")
    cfg = cur["config"]
    machine = next((m for m in cfg.get("machines") or [] if m.get("id") == machine_id), None)
    if machine is None:
        raise HTTPException(409, "Cấu hình gateway không có máy này")
    template = next((p for p in machine.get("points") or [] if p.get("role", "bearing") == "bearing"), None) or (machine.get("points") or [None])[0]
    edge_point = build_edge_point(machine_id, body.slot, body.addr, template, body.name)

    commissioned = None
    if body.commission:
        commissioned = await _commission(request, dict(gateway), (edge_point["sensor"] or {}).get("bus"), body.addr)

    pid = point_id(machine_id, body.slot)
    async with pool.acquire() as c:
        await c.execute("""INSERT INTO measurement_points (id, machine_id, name, location, gateway_id, sensor_addr, axes_map, iso_axes, role)
                           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)""",
                        pid, machine_id, edge_point["name"], edge_point["location"], gw_id, body.addr, edge_point["axes_map"],
                        edge_point["iso_axes"], edge_point["role"])
        merged = await gwconfig.merge_managed(c, add_point_to_config(cfg, machine_id, edge_point))
    ver = await gwconfig.save_and_publish(pool, request.app.state.settings, gw_id, merged, user.email)
    await audit(pool, user, "sensor.add", pid, {"slot": body.slot, "addr": body.addr, "commission": body.commission, "config": ver})
    return {"point_id": pid, "name": edge_point["name"], "slot": body.slot, "config_version": ver,
            "commission": commissioned, "label": point_name(body.slot)}
