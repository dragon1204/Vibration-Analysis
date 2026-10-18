"""Zero-touch gateway enrolment (add a gateway on the web by its MAC only).

1. An unconfigured gateway calls ``POST /provision/hello`` every ~15 s with its eth0 MAC and a
   random secret it generated on first boot. Outbound HTTP only, so it works behind any NAT.
2. An admin enters the MAC on the web: ``POST /provision/claim``. Only a gateway that announced
   itself in the last ``FRESH_MIN`` minutes can be claimed. The server creates the gateway row,
   MQTT credentials and a base configuration, and stores them as a one-time bundle.
3. The next hello from the device holding the same secret receives the bundle; the device writes
   it, starts edge-agent and calls ``POST /provision/ack``, which deletes the bundle.

Only the MAC is entered by the user. The secret binds the bundle to the physical device that
announced itself, so another host that later learns the MAC cannot collect the credentials.
"""
from __future__ import annotations

import hashlib
import hmac
import re
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field

from ...common import gwconfig
from ..deps import User, audit, require
from ..security import ROLE_RANK, hash_password, new_token

router = APIRouter(tags=["provision"])

FRESH_MIN = 15          # a claim needs a hello within this many minutes
POLL_S = 15


def norm_mac(mac: str) -> str:
    m = re.sub(r"[^0-9a-fA-F]", "", mac or "").lower()
    if len(m) != 12:
        raise HTTPException(422, "MAC phải có 12 chữ số hex, ví dụ 02:00:10:85:97:67")
    return ":".join(m[i:i + 2] for i in range(0, 12, 2))


def _hash(secret: str) -> str:
    return hashlib.sha256(secret.encode()).hexdigest()


class HelloIn(BaseModel):
    mac: str
    secret: str = Field(min_length=32, max_length=128)
    serial: Optional[str] = Field(None, max_length=64)
    hostname: Optional[str] = Field(None, max_length=64)
    hw_model: Optional[str] = Field(None, max_length=64)
    fw_version: Optional[str] = Field(None, max_length=64)
    local_ips: list[str] = Field(default_factory=list, max_length=8)


class AckIn(BaseModel):
    mac: str
    secret: str = Field(min_length=32, max_length=128)


class ClaimIn(BaseModel):
    mac: str
    site_id: Optional[str] = None
    gateway_id: Optional[str] = Field(None, pattern=r"^[a-z0-9][a-z0-9-]{1,40}$")


async def _rate_limit(request: Request, key: str, limit: int, window_s: int) -> None:
    r = request.app.state.redis
    n = await r.incr(key)
    if n == 1:
        await r.expire(key, window_s)
    if n > limit:
        raise HTTPException(429, "Quá nhiều yêu cầu")


@router.post("/provision/hello")
async def hello(body: HelloIn, request: Request):
    """Called by unconfigured gateways (no user auth). Returns pending, or the one-time bundle once claimed."""
    mac = norm_mac(body.mac)
    ip = request.client.host if request.client else None
    await _rate_limit(request, f"prov:{ip}", 120, 60)
    sh = _hash(body.secret)
    async with request.app.state.pool.acquire() as c:
        row = await c.fetchrow("SELECT * FROM gateway_enrollments WHERE mac=$1", mac)
        if row and not hmac.compare_digest(row["secret_hash"], sh):
            stale = row["last_seen"] < datetime.now(timezone.utc) - timedelta(minutes=FRESH_MIN)
            if row["status"] == "pending" and stale:
                await c.execute("DELETE FROM gateway_enrollments WHERE mac=$1", mac)   # board re-imaged
                row = None
            else:
                raise HTTPException(409, "MAC này đang được một thiết bị khác sử dụng")
        if not row:
            await c.execute("""INSERT INTO gateway_enrollments (mac, secret_hash, serial, hostname, hw_model, fw_version, ip, local_ips)
                               VALUES ($1,$2,$3,$4,$5,$6,$7,$8)""", mac, sh, body.serial, body.hostname, body.hw_model,
                            body.fw_version, ip, body.local_ips)
            return {"status": "pending", "poll_s": POLL_S}
        await c.execute("""UPDATE gateway_enrollments SET last_seen=now(), ip=$2, local_ips=$3, fw_version=COALESCE($4, fw_version),
                             hostname=COALESCE($5, hostname) WHERE mac=$1""", mac, ip, body.local_ips, body.fw_version, body.hostname)
        if row["status"] in ("claimed", "delivered") and row["bundle"]:
            await c.execute("UPDATE gateway_enrollments SET status='delivered', delivered_at=now() WHERE mac=$1", mac)
            return {"status": "claimed", "bundle": row["bundle"]}
    return {"status": row["status"] if row["status"] != "delivered" else "done", "poll_s": POLL_S}


@router.post("/provision/ack")
async def ack(body: AckIn, request: Request):
    """The device confirms it stored the bundle: the credentials are deleted from the server."""
    mac = norm_mac(body.mac)
    async with request.app.state.pool.acquire() as c:
        row = await c.fetchrow("SELECT secret_hash FROM gateway_enrollments WHERE mac=$1", mac)
        if not row or not hmac.compare_digest(row["secret_hash"], _hash(body.secret)):
            raise HTTPException(404, "Không tìm thấy")
        await c.execute("UPDATE gateway_enrollments SET bundle=NULL, status='delivered' WHERE mac=$1", mac)
    return {"status": "done"}


@router.get("/provision/pending")
async def pending(request: Request, user: User = Depends(require("engineer"))):
    """Gateways that announced themselves in the last 24 h and are not yet claimed."""
    async with request.app.state.pool.acquire() as c:
        rows = await c.fetch("""SELECT mac, serial, hostname, hw_model, fw_version, ip, local_ips, first_seen, last_seen,
                                  last_seen > now() - make_interval(mins => $1) AS fresh
                                FROM gateway_enrollments WHERE status='pending' AND last_seen > now() - interval '24 hours'
                                ORDER BY last_seen DESC""", FRESH_MIN)
    return [dict(r) for r in rows]


def _bootstrap_config(s, gw_id: str, tenant: str, site: str) -> dict:
    """Minimal edge configuration: identity, MQTT, storage and the RS485 bus. Machines/points are
    added later on the web and pushed on the retained config topic."""
    return {
        "version": 1,
        "gateway": {"id": gw_id, "tenant": tenant, "site": site, "timezone": s.timezone},
        "mqtt": {"url": f"mqtts://{s.mqtt_host}:{s.mqtt_tls_port}", "username": gw_id,
                 "password_file": "/etc/edge-agent/mqtt.token", "ca_file": "/etc/edge-agent/ca.pem", "send_waveforms": True},
        "storage": {"dir": "/data/edge", "retention_days": 2, "max_bytes": 600_000_000},
        "log": {"level": "info", "file": "/data/edge/logs/edge-agent.log"},
        "buses": [{"id": "busA", "device": "/dev/ttyS6", "baud": 115200, "timeout_ms": 150, "raw_timeout_ms": 3000}],
        "machines": [],
    }


@router.post("/provision/claim", status_code=201)
async def claim(body: ClaimIn, request: Request, user: User = Depends(require("admin"))):
    """Attach a freshly announced gateway to a site by its MAC."""
    s = request.app.state.settings
    mac = norm_mac(body.mac)
    sites = user.sites("admin")
    site_id = body.site_id or (sites[0] if len(sites) == 1 else None)
    if not site_id:
        raise HTTPException(422, "Chọn khu vực (site) cho gateway")
    if user.role_for_site(site_id) < ROLE_RANK["admin"]:
        raise HTTPException(403, "Không đủ quyền với khu vực này")
    ca_path = Path(s.provision_ca_file)
    if not ca_path.is_file():
        raise HTTPException(500, f"Server chưa cấu hình chứng chỉ CA ({ca_path})")
    gw_id = body.gateway_id or f"t153-{mac.replace(':', '')[-6:]}"
    pool = request.app.state.pool
    async with pool.acquire() as c:
        async with c.transaction():
            row = await c.fetchrow("SELECT * FROM gateway_enrollments WHERE mac=$1 FOR UPDATE", mac)
            if not row:
                raise HTTPException(404, "Chưa thấy gateway có MAC này báo danh. Kiểm tra gateway đã cắm mạng và bật nguồn.")
            if row["status"] != "pending":
                raise HTTPException(409, f"Gateway này đã được thêm ({row['gateway_id']})")
            if row["last_seen"] < datetime.now(timezone.utc) - timedelta(minutes=FRESH_MIN):
                raise HTTPException(409, f"Gateway báo danh lần cuối quá {FRESH_MIN} phút trước – kiểm tra kết nối mạng rồi thử lại")
            if await c.fetchval("SELECT 1 FROM gateways WHERE id=$1 OR mac=$2", gw_id, mac):
                raise HTTPException(409, f"Đã có gateway {gw_id} hoặc MAC {mac}")
            tenant = await c.fetchval("SELECT tenant_id FROM sites WHERE id=$1", site_id)
            if tenant is None:
                raise HTTPException(404, "Không tìm thấy khu vực")
            token = new_token()
            await c.execute("""INSERT INTO gateways (id, site_id, hw_model, mqtt_username, mqtt_password_hash, mac, fw_version)
                               VALUES ($1,$2,$3,$1,$4,$5,$6)""", gw_id, site_id, row["hw_model"] or "T153-HelperBoard",
                            hash_password(token), mac, row["fw_version"])
            cfg = _bootstrap_config(s, gw_id, tenant, site_id)
            bundle = {"gateway_id": gw_id, "mqtt_token": token, "ca_pem": ca_path.read_text(), "config": cfg}
            await c.execute("""UPDATE gateway_enrollments SET status='claimed', gateway_id=$2, claimed_by=$3, claimed_at=now(),
                                 bundle=$4 WHERE mac=$1""", mac, gw_id, user.email, bundle)
    await gwconfig.save_and_publish(pool, s, gw_id, cfg, user.email)
    await audit(pool, user, "gateway.claim", gw_id, {"mac": mac, "site": site_id})
    return {"gateway_id": gw_id, "site_id": site_id, "mac": mac, "status": "claimed",
            "note": "Gateway sẽ nhận cấu hình ở lần báo danh tiếp theo (≤ 15 giây) rồi tự kết nối."}


@router.delete("/provision/{mac}", status_code=204)
async def forget(mac: str, request: Request, user: User = Depends(require("admin"))):
    """Drop an enrolment record (e.g. a test board); does not delete an already created gateway."""
    async with request.app.state.pool.acquire() as c:
        await c.execute("DELETE FROM gateway_enrollments WHERE mac=$1", norm_mac(mac))
    await audit(request.app.state.pool, user, "gateway.enrol_forget", norm_mac(mac))
