"""Request dependencies: DB pool, current user, RBAC and tenant/site filtering."""
from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone

import asyncpg
from fastapi import Depends, HTTPException, Query, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from ..common.settings import Settings, get_settings
from .security import ROLE_RANK, decode_token

bearer = HTTPBearer(auto_error=False)


def get_pool(request: Request) -> asyncpg.Pool:
    return request.app.state.pool


@dataclass
class User:
    id: int
    email: str
    name: str | None
    roles: list[dict] = field(default_factory=list)  # {tenant_id, site_id, role}
    site_tenant: dict[str, str] = field(default_factory=dict)

    def role_for_site(self, site_id: str) -> int:
        tenant = self.site_tenant.get(site_id)
        best = 0
        for r in self.roles:
            if (r["tenant_id"] is None and r["site_id"] is None) or r["site_id"] == site_id or \
                    (r["site_id"] is None and r["tenant_id"] == tenant):
                best = max(best, ROLE_RANK.get(r["role"], 0))
        return best

    def sites(self, min_role: str = "viewer") -> list[str]:
        need = ROLE_RANK[min_role]
        return [s for s in self.site_tenant if self.role_for_site(s) >= need]

    @property
    def max_role(self) -> str:
        best = max((ROLE_RANK.get(r["role"], 0) for r in self.roles), default=0)
        return next((k for k, v in ROLE_RANK.items() if v == best), "viewer")

    @property
    def is_global_admin(self) -> bool:
        return any(r["role"] == "admin" and r["tenant_id"] is None and r["site_id"] is None for r in self.roles)


async def load_user(pool: asyncpg.Pool, user_id: int) -> User | None:
    async with pool.acquire() as c:
        u = await c.fetchrow("SELECT id, email, name FROM users WHERE id=$1 AND active", user_id)
        if not u:
            return None
        roles = await c.fetch("SELECT tenant_id, site_id, role FROM user_roles WHERE user_id=$1", user_id)
        sites = await c.fetch("SELECT id, tenant_id FROM sites")
    return User(id=u["id"], email=u["email"], name=u["name"], roles=[dict(r) for r in roles],
                site_tenant={r["id"]: r["tenant_id"] for r in sites})


async def current_user(request: Request, cred: HTTPAuthorizationCredentials | None = Depends(bearer),
                       s: Settings = Depends(get_settings)) -> User:
    if cred is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Chưa đăng nhập")
    uid = decode_token(s.jwt_secret, cred.credentials, "access")
    if uid is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Phiên đăng nhập hết hạn")
    user = await load_user(request.app.state.pool, uid)
    if not user:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Tài khoản không hợp lệ")
    return user


def require(min_role: str):
    async def dep(user: User = Depends(current_user)) -> User:
        if ROLE_RANK.get(user.max_role, 0) < ROLE_RANK[min_role]:
            raise HTTPException(status.HTTP_403_FORBIDDEN, "Không đủ quyền")
        return user
    return dep


async def site_of_machine(pool: asyncpg.Pool, machine_id: str) -> str | None:
    async with pool.acquire() as c:
        return await c.fetchval("SELECT site_id FROM machines WHERE id=$1", machine_id)


async def site_of_point(pool: asyncpg.Pool, point_id: str) -> str | None:
    async with pool.acquire() as c:
        return await c.fetchval("SELECT m.site_id FROM measurement_points p JOIN machines m ON m.id=p.machine_id WHERE p.id=$1",
                                point_id)


async def check_machine(pool, user: User, machine_id: str, min_role: str = "viewer") -> str:
    site = await site_of_machine(pool, machine_id)
    if site is None:
        raise HTTPException(404, "Không tìm thấy máy")
    if user.role_for_site(site) < ROLE_RANK[min_role]:
        raise HTTPException(403, "Không đủ quyền với máy này")
    return site


async def check_point(pool, user: User, point_id: str, min_role: str = "viewer") -> str:
    site = await site_of_point(pool, point_id)
    if site is None:
        raise HTTPException(404, "Không tìm thấy điểm đo")
    if user.role_for_site(site) < ROLE_RANK[min_role]:
        raise HTTPException(403, "Không đủ quyền với điểm đo này")
    return site


def time_range(frm: datetime | None = Query(None, alias="from"), to: datetime | None = Query(None)) -> tuple[datetime, datetime]:
    to = to or datetime.now(timezone.utc)
    frm = frm or to - timedelta(hours=24)
    if frm.tzinfo is None:
        frm = frm.replace(tzinfo=timezone.utc)
    if to.tzinfo is None:
        to = to.replace(tzinfo=timezone.utc)
    if frm >= to:
        raise HTTPException(400, "from phải nhỏ hơn to")
    return frm, to


async def audit(pool, user: User | None, action: str, target: str, detail: dict | None = None) -> None:
    async with pool.acquire() as c:
        await c.execute("INSERT INTO audit_log(user_id, action, target, detail) VALUES ($1,$2,$3,$4)",
                        user.id if user else None, action, target, detail or {})
