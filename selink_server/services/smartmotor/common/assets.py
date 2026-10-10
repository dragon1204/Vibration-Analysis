"""Cached lookups of gateways, machines and points used by ingest and analytics."""
from __future__ import annotations

import time
from typing import Any

import asyncpg

from .iso import iso_limits


class AssetCache:
    def __init__(self, pool: asyncpg.Pool, ttl_s: float = 60):
        self.pool = pool
        self.ttl = ttl_s
        self._loaded = 0.0
        self.gateways: dict[str, dict[str, Any]] = {}
        self.points: dict[str, dict[str, Any]] = {}
        self.machines: dict[str, dict[str, Any]] = {}

    async def refresh(self, force: bool = False) -> None:
        if not force and time.monotonic() - self._loaded < self.ttl:
            return
        async with self.pool.acquire() as c:
            gws = await c.fetch("SELECT g.id, g.site_id, s.tenant_id FROM gateways g JOIN sites s ON s.id = g.site_id")
            ms = await c.fetch("SELECT * FROM machines")
            ps = await c.fetch(
                "SELECT p.*, b.n_balls, b.bd_mm, b.pd_mm, b.contact_deg, b.bpfo_x, b.bpfi_x, b.bsf_x, b.ftf_x, b.model AS bearing_model "
                "FROM measurement_points p LEFT JOIN bearings b ON b.id = p.bearing_id")
        self.gateways = {r["id"]: dict(r) for r in gws}
        self.machines = {r["id"]: dict(r) for r in ms}
        self.points = {r["id"]: dict(r) for r in ps}
        self._loaded = time.monotonic()

    def gateway_ok(self, gw: str, tenant: str, site: str) -> bool:
        g = self.gateways.get(gw)
        return bool(g and g["site_id"] == site and g["tenant_id"] == tenant)

    def machine_of(self, point_id: str) -> dict | None:
        p = self.points.get(point_id)
        return self.machines.get(p["machine_id"]) if p else None

    def limits_for(self, machine: dict | None):
        if not machine:
            return iso_limits(2, "rigid")
        return iso_limits(machine.get("iso_group"), machine.get("foundation"))

    @staticmethod
    def bearing_geom(point: dict) -> dict | None:
        keys = ("n_balls", "bd_mm", "pd_mm", "contact_deg", "bpfo_x", "bpfi_x", "bsf_x", "ftf_x")
        g = {k: (float(point[k]) if point.get(k) is not None else None) for k in keys}
        if g["n_balls"]:
            g["n_balls"] = int(g["n_balls"])
        return g if any(v for v in g.values()) else None
