"""Gateway configuration management (spec 6.4 push_thresholds, 6.6 /gateways/{id}/config).

The full edge.yaml-equivalent JSON is versioned in gateway_configs. Server-managed parts
(baselines, calibration, bearing geometry, isolation α, band limits) are merged from the DB
into the latest version and published retained on .../<gw>/config.
"""
from __future__ import annotations

import copy
import logging

import asyncpg

from . import mqttpub
from .settings import Settings

log = logging.getLogger(__name__)

# Baseline features understood by the edge rules (features.featureValue / evaluateStats).
EDGE_FEATURES = {"iso_vrms_mm_s", "vel_rms_mm_s", "env.rms", "env.bpfo", "env.bpfi",
                 "x.orders.1", "y.orders.1", "z.orders.1", "x.orders.2", "y.orders.2", "z.orders.2",
                 "x.kurtosis", "y.kurtosis", "z.kurtosis"}


async def latest(conn: asyncpg.Connection, gateway_id: str) -> dict | None:
    r = await conn.fetchrow("SELECT version, config FROM gateway_configs WHERE gateway_id=$1 ORDER BY version DESC LIMIT 1",
                            gateway_id)
    return dict(r) if r else None


async def merge_managed(conn: asyncpg.Connection, cfg: dict) -> dict:
    cfg = copy.deepcopy(cfg)
    for m in cfg.get("machines") or []:
        mrow = await conn.fetchrow("SELECT isolation, band_limits, male_lobes FROM machines WHERE id=$1", m.get("id"))
        if mrow:
            if mrow["isolation"] and m.get("isolation") is not None:
                alpha = (mrow["isolation"] or {}).get("alpha")
                if alpha:
                    m["isolation"]["alpha"] = alpha
            if mrow["band_limits"]:
                m["band_limits"] = mrow["band_limits"]
            if mrow["male_lobes"]:
                m["male_lobes"] = mrow["male_lobes"]
        for p in m.get("points") or []:
            prow = await conn.fetchrow(
                """SELECT p.calibration, b.model, b.n_balls, b.bd_mm, b.pd_mm, b.contact_deg, b.bpfo_x, b.bpfi_x, b.bsf_x, b.ftf_x
                   FROM measurement_points p LEFT JOIN bearings b ON b.id=p.bearing_id WHERE p.id=$1""", p.get("id"))
            if not prow:
                continue
            if prow["calibration"]:
                p["calibration"] = prow["calibration"]
            if prow["model"] and prow["n_balls"]:
                p["bearing"] = {k: (float(prow[k]) if prow[k] is not None and k != "model" else prow[k])
                                for k in ("model", "n_balls", "bd_mm", "pd_mm", "contact_deg", "bpfo_x", "bpfi_x", "bsf_x", "ftf_x")}
                p["bearing"]["n_balls"] = int(prow["n_balls"])
            bl = await conn.fetch(
                """SELECT feature, median, warn, alarm FROM baselines
                   WHERE point_id=$1 AND status='active' AND load_bin='all'""", p.get("id"))
            p["baselines"] = [{"feature": r["feature"], "median": r["median"], "warn": r["warn"], "alarm": r["alarm"]}
                              for r in bl if r["feature"] in EDGE_FEATURES and r["warn"] is not None]
    return cfg


async def save_and_publish(pool: asyncpg.Pool, s: Settings, gateway_id: str, cfg: dict, created_by: str) -> int:
    async with pool.acquire() as conn:
        async with conn.transaction():
            cur = await conn.fetchval("SELECT COALESCE(max(version),0) FROM gateway_configs WHERE gateway_id=$1", gateway_id)
            ver = int(cur) + 1
            cfg = dict(cfg)
            cfg["version"] = ver
            await conn.execute("INSERT INTO gateway_configs(gateway_id, version, config, created_by) VALUES ($1,$2,$3,$4)",
                               gateway_id, ver, cfg, created_by)
            await conn.execute("UPDATE gateways SET config_version=$2 WHERE id=$1", gateway_id, ver)
        row = await conn.fetchrow("SELECT g.id, s.id AS site, s.tenant_id FROM gateways g JOIN sites s ON s.id=g.site_id WHERE g.id=$1",
                                  gateway_id)
    if row:
        topic = mqttpub.gateway_prefix(s, row["tenant_id"], row["site"], gateway_id) + "config"
        try:
            await mqttpub.publish(s, topic, cfg, qos=1, retain=True)
        except Exception as e:  # stored; will be retried on next push
            log.warning("publish config failed for %s: %s", gateway_id, e)
    return ver


async def push_managed(pool: asyncpg.Pool, s: Settings, gateway_id: str, created_by: str = "analytics") -> int | None:
    async with pool.acquire() as conn:
        cur = await latest(conn, gateway_id)
        if not cur:
            log.info("no base config for gateway %s; upload one via PUT /gateways/{id}/config", gateway_id)
            return None
        merged = await merge_managed(conn, cur["config"])
    if _strip_version(merged) == _strip_version(cur["config"]):
        return cur["version"]
    return await save_and_publish(pool, s, gateway_id, merged, created_by)


def _strip_version(c: dict) -> dict:
    c = dict(c)
    c.pop("version", None)
    return c
