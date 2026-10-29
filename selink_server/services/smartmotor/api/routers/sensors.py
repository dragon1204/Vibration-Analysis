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
from ...common import installation
from ...common.model_export import position_of
from ...common.sensor_slots import SLOTS, add_point_to_config, build_point_for
from ..deps import User, audit, check_machine, current_user, require

router = APIRouter(tags=["sensors"])

COMMISSION_WAIT_S = 40


class SensorIn(BaseModel):
    code: Optional[str] = Field(None, max_length=32)  # position of the installation model, e.g. DE, BASE
    slot: Optional[int] = Field(None, ge=1, le=4)     # legacy numeric slot (1 LOAD, 2 BASE, 3 DE, 4 NDE)
    addr: int = Field(ge=1, le=127)
    name: Optional[str] = None
    commission: bool = False  # the sensor still has its factory address: set `addr` through the gateway first


async def _points(c, machine_id: str) -> list[dict]:
    rows = await c.fetch("""SELECT id, name, location, role, sensor_addr, gateway_id, iso_axes FROM measurement_points
                            WHERE machine_id=$1 ORDER BY id""", machine_id)
    return [dict(r) for r in rows]


@router.get("/machines/{machine_id}/sensor-slots")
async def sensor_slots(machine_id: str, request: Request, user: User = Depends(current_user)):
    """The positions of the machine's installation model, with the sensor (if any) mounted at each."""
    await check_machine(request.app.state.pool, user, machine_id)
    async with request.app.state.pool.acquire() as c:
        pts = await _points(c, machine_id)
        _, model = await installation.machine_model(c, machine_id)
    used = {position_of(p): p for p in pts if position_of(p)}
    out = [{"code": str(s["code"]).upper(), "short": str(s["code"]).upper(), "label": s.get("label") or "",
            "model_role": s.get("role") or "bearing", "role": installation.edge_role(s.get("role")),
            "point": used.get(str(s["code"]).upper())} for s in installation.slots(model)]
    return {"model": {"id": model["id"], "name": model["name"], "algorithms": model.get("algorithms") or []} if model else None, "slots": out,
            "issues": installation.check_points(model, pts),
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
    code = (body.code or (SLOTS[body.slot]["location"] if body.slot else "")).upper()
    if not code:
        raise HTTPException(422, "Cần chọn vị trí lắp")
    async with pool.acquire() as c:
        _, model = await installation.machine_model(c, machine_id)
        spec = installation.slot(model, code)
        if model is not None and spec is None:
            raise HTTPException(422, f"Mô hình {model['name']} không có vị trí {code}")
        pts = await _points(c, machine_id)
        if any(position_of(p) == code for p in pts):
            raise HTTPException(409, f"Vị trí {code} đã có cảm biến")
        gw_id = next((p["gateway_id"] for p in pts if p["gateway_id"]), None)
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
    role = installation.edge_role((spec or {}).get("role")) if spec else SLOTS.get(body.slot or 0, {}).get("role", "bearing")
    edge_point = build_point_for(machine_id, code, role, body.addr, template, body.name, (spec or {}).get("label", ""))

    commissioned = None
    if body.commission:
        commissioned = await _commission(request, dict(gateway), (edge_point["sensor"] or {}).get("bus"), body.addr)

    pid = edge_point["id"]
    async with pool.acquire() as c:
        await c.execute("""INSERT INTO measurement_points (id, machine_id, name, location, gateway_id, sensor_addr, axes_map, iso_axes, role)
                           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)""",
                        pid, machine_id, edge_point["name"], code, gw_id, body.addr, edge_point["axes_map"],
                        edge_point["iso_axes"], role)
        merged = await gwconfig.merge_managed(c, add_point_to_config(cfg, machine_id, edge_point))
    ver = await gwconfig.save_and_publish(pool, request.app.state.settings, gw_id, merged, user.email)
    await audit(pool, user, "sensor.add", pid, {"code": code, "addr": body.addr, "commission": body.commission, "config": ver})
    return {"point_id": pid, "name": edge_point["name"], "code": code, "role": role, "config_version": ver,
            "commission": commissioned}
