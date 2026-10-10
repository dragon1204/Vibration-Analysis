"""Baselines, alarm rules, bearings, users and notification preferences (screen 12)."""
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel

from ...common import gwconfig
from ..deps import User, audit, check_point, current_user, require
from ..security import hash_password

router = APIRouter(tags=["settings"])


@router.get("/baselines")
async def list_baselines(request: Request, point_id: Optional[str] = None, machine_id: Optional[str] = None,
                         user: User = Depends(current_user)):
    async with request.app.state.pool.acquire() as c:
        rows = await c.fetch("""SELECT b.* FROM baselines b JOIN measurement_points p ON p.id=b.point_id
                                JOIN machines m ON m.id=p.machine_id
                                WHERE m.site_id = ANY($1) AND ($2::text IS NULL OR b.point_id=$2) AND ($3::text IS NULL OR b.machine_id=$3)
                                ORDER BY b.point_id, b.feature, b.load_bin""", user.sites(), point_id, machine_id)
    return [dict(r) for r in rows]


class BaselinePatch(BaseModel):
    status: Optional[str] = None  # learning | active | frozen
    warn: Optional[float] = None
    alarm: Optional[float] = None
    warn_min: Optional[float] = None
    alarm_min: Optional[float] = None


@router.put("/baselines/{baseline_id}")
async def update_baseline(baseline_id: int, body: BaselinePatch, request: Request, user: User = Depends(require("analyst"))):
    pool = request.app.state.pool
    async with pool.acquire() as c:
        b = await c.fetchrow("SELECT point_id FROM baselines WHERE id=$1", baseline_id)
    if not b:
        raise HTTPException(404, "Không tìm thấy baseline")
    await check_point(pool, user, b["point_id"], "analyst")
    data = body.model_dump(exclude_none=True)
    if body.status and body.status not in ("learning", "active", "frozen"):
        raise HTTPException(400, "status không hợp lệ")
    if data:
        sets = ", ".join(f"{k}=${i + 2}" for i, k in enumerate(data))
        async with pool.acquire() as c:
            await c.execute(f"UPDATE baselines SET {sets}, version=version+1, updated_at=now() WHERE id=$1", baseline_id, *data.values())
            gw = await c.fetchval("SELECT gateway_id FROM measurement_points WHERE id=$1", b["point_id"])
        await audit(pool, user, "baseline.update", str(baseline_id), data)
        if gw:
            await gwconfig.push_managed(pool, request.app.state.settings, gw, user.email)
    return {"ok": True}


class RuleIn(BaseModel):
    scope: str = "global"
    scope_id: Optional[str] = None
    rule: str
    params: dict = {}
    severity: str = "watch"
    enabled: bool = True


@router.get("/alarm-rules")
async def list_rules(request: Request, user: User = Depends(current_user)):
    async with request.app.state.pool.acquire() as c:
        rows = await c.fetch("SELECT * FROM alarm_rules ORDER BY scope, rule")
    return [dict(r) for r in rows]


@router.post("/alarm-rules", status_code=201)
async def add_rule(body: RuleIn, request: Request, user: User = Depends(require("analyst"))):
    async with request.app.state.pool.acquire() as c:
        rid = await c.fetchval("""INSERT INTO alarm_rules (scope, scope_id, rule, params, severity, enabled) VALUES ($1,$2,$3,$4,$5,$6)
                                  RETURNING id""", body.scope, body.scope_id, body.rule, body.params, body.severity, body.enabled)
    await audit(request.app.state.pool, user, "rule.create", str(rid), body.model_dump())
    return {"id": rid}


@router.patch("/alarm-rules/{rule_id}")
async def patch_rule(rule_id: int, body: RuleIn, request: Request, user: User = Depends(require("analyst"))):
    async with request.app.state.pool.acquire() as c:
        await c.execute("UPDATE alarm_rules SET scope=$2, scope_id=$3, rule=$4, params=$5, severity=$6, enabled=$7 WHERE id=$1",
                        rule_id, body.scope, body.scope_id, body.rule, body.params, body.severity, body.enabled)
    await audit(request.app.state.pool, user, "rule.update", str(rule_id), body.model_dump())
    return {"ok": True}


class BearingIn(BaseModel):
    model: str
    maker: Optional[str] = None
    n_balls: Optional[int] = None
    bd_mm: Optional[float] = None
    pd_mm: Optional[float] = None
    contact_deg: float = 0
    bpfo_x: Optional[float] = None
    bpfi_x: Optional[float] = None
    bsf_x: Optional[float] = None
    ftf_x: Optional[float] = None


@router.get("/bearings")
async def list_bearings(request: Request, user: User = Depends(current_user)):
    async with request.app.state.pool.acquire() as c:
        return [dict(r) for r in await c.fetch("SELECT * FROM bearings ORDER BY model")]


@router.post("/bearings", status_code=201)
async def add_bearing(body: BearingIn, request: Request, user: User = Depends(require("analyst"))):
    d = body.model_dump()
    async with request.app.state.pool.acquire() as c:
        bid = await c.fetchval(f"INSERT INTO bearings ({', '.join(d)}) VALUES ({', '.join(f'${i+1}' for i in range(len(d)))}) RETURNING id",
                               *d.values())
    await audit(request.app.state.pool, user, "bearing.create", str(bid), d)
    return {"id": bid}


@router.patch("/bearings/{bearing_id}")
async def update_bearing(bearing_id: int, body: BearingIn, request: Request, user: User = Depends(require("analyst"))):
    d = body.model_dump()
    sets = ", ".join(f"{k}=${i + 2}" for i, k in enumerate(d))
    async with request.app.state.pool.acquire() as c:
        await c.execute(f"UPDATE bearings SET {sets} WHERE id=$1", bearing_id, *d.values())
    await audit(request.app.state.pool, user, "bearing.update", str(bearing_id), d)
    return {"ok": True}


class UserIn(BaseModel):
    email: str
    name: Optional[str] = None
    password: Optional[str] = None
    phone: Optional[str] = None
    zalo_id: Optional[str] = None
    telegram_chat_id: Optional[str] = None
    active: bool = True
    roles: list[dict] = []  # [{"tenant_id":..,"site_id":..,"role":..}]


@router.get("/users")
async def list_users(request: Request, user: User = Depends(require("admin"))):
    async with request.app.state.pool.acquire() as c:
        users = await c.fetch("SELECT id, email, name, phone, zalo_id, telegram_chat_id, active FROM users ORDER BY id")
        roles = await c.fetch("SELECT * FROM user_roles")
    by: dict = {}
    for r in roles:
        by.setdefault(r["user_id"], []).append({"tenant_id": r["tenant_id"], "site_id": r["site_id"], "role": r["role"]})
    return [{**dict(u), "roles": by.get(u["id"], [])} for u in users]


@router.post("/users", status_code=201)
async def create_user(body: UserIn, request: Request, user: User = Depends(require("admin"))):
    if not body.password or len(body.password) < 8:
        raise HTTPException(400, "Mật khẩu tối thiểu 8 ký tự")
    async with request.app.state.pool.acquire() as c:
        async with c.transaction():
            uid = await c.fetchval("""INSERT INTO users (email, name, password_hash, phone, zalo_id, telegram_chat_id, active)
                                      VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id""", body.email, body.name, hash_password(body.password),
                                   body.phone, body.zalo_id, body.telegram_chat_id, body.active)
            for r in body.roles:
                await c.execute("INSERT INTO user_roles (user_id, tenant_id, site_id, role) VALUES ($1,$2,$3,$4)",
                                uid, r.get("tenant_id"), r.get("site_id"), r["role"])
            await c.execute("INSERT INTO notification_prefs (user_id, channel, min_severity) VALUES ($1,'email','warning')", uid)
    await audit(request.app.state.pool, user, "user.create", body.email)
    return {"id": uid}


@router.patch("/users/{user_id}")
async def update_user(user_id: int, body: UserIn, request: Request, user: User = Depends(require("admin"))):
    async with request.app.state.pool.acquire() as c:
        async with c.transaction():
            await c.execute("""UPDATE users SET email=$2, name=$3, phone=$4, zalo_id=$5, telegram_chat_id=$6, active=$7 WHERE id=$1""",
                            user_id, body.email, body.name, body.phone, body.zalo_id, body.telegram_chat_id, body.active)
            if body.password:
                await c.execute("UPDATE users SET password_hash=$2 WHERE id=$1", user_id, hash_password(body.password))
            await c.execute("DELETE FROM user_roles WHERE user_id=$1", user_id)
            for r in body.roles:
                await c.execute("INSERT INTO user_roles (user_id, tenant_id, site_id, role) VALUES ($1,$2,$3,$4)",
                                user_id, r.get("tenant_id"), r.get("site_id"), r["role"])
    await audit(request.app.state.pool, user, "user.update", str(user_id))
    return {"ok": True}


class PrefIn(BaseModel):
    channel: str  # email | zalo | telegram | sms
    min_severity: str = "warning"
    enabled: bool = True


@router.get("/notification-prefs")
async def get_prefs(request: Request, user: User = Depends(current_user)):
    async with request.app.state.pool.acquire() as c:
        return [dict(r) for r in await c.fetch("SELECT channel, min_severity, enabled FROM notification_prefs WHERE user_id=$1", user.id)]


@router.put("/notification-prefs")
async def put_prefs(body: list[PrefIn], request: Request, user: User = Depends(current_user)):
    async with request.app.state.pool.acquire() as c:
        async with c.transaction():
            await c.execute("DELETE FROM notification_prefs WHERE user_id=$1", user.id)
            for p in body:
                await c.execute("INSERT INTO notification_prefs (user_id, channel, min_severity, enabled) VALUES ($1,$2,$3,$4)",
                                user.id, p.channel, p.min_severity, p.enabled)
    return {"ok": True}
