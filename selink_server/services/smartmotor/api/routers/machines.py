"""Machines: CRUD, live status, power/temperature series, maintenance, diagnosis, health."""
from datetime import datetime
from typing import Any, Optional

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel

from ...common import bus
from ...common.iso import iso_limits
from ..deps import User, audit, check_machine, current_user, require, time_range

router = APIRouter(tags=["machines"])

MACHINE_FIELDS = ["site_id", "name", "type", "maker", "model", "serial", "rated_power_kw", "rated_speed_rpm", "poles",
                  "line_freq_hz", "rated_voltage_v", "rated_current_a", "insulation_class", "mounting", "iso_group",
                  "foundation", "iso_band_lo_hz", "iso_band_hi_hz", "thermal_params", "meta", "photo_url", "male_lobes",
                  "isolation", "band_limits"]


class MachineIn(BaseModel):
    id: Optional[str] = None
    site_id: Optional[str] = None
    name: Optional[str] = None
    type: Optional[str] = None
    maker: Optional[str] = None
    model: Optional[str] = None
    serial: Optional[str] = None
    rated_power_kw: Optional[float] = None
    rated_speed_rpm: Optional[float] = None
    poles: Optional[int] = None
    line_freq_hz: Optional[float] = None
    rated_voltage_v: Optional[float] = None
    rated_current_a: Optional[float] = None
    insulation_class: Optional[str] = None
    mounting: Optional[str] = None
    iso_group: Optional[int] = None
    foundation: Optional[str] = None
    iso_band_lo_hz: Optional[float] = None
    iso_band_hi_hz: Optional[float] = None
    thermal_params: Optional[dict] = None
    meta: Optional[dict] = None
    photo_url: Optional[str] = None
    male_lobes: Optional[int] = None
    isolation: Optional[dict] = None
    band_limits: Optional[list] = None


@router.get("/machines")
async def list_machines(request: Request, site_id: Optional[str] = None, user: User = Depends(current_user)):
    sites = [site_id] if site_id and site_id in user.sites() else user.sites()
    async with request.app.state.pool.acquire() as c:
        rows = await c.fetch("SELECT * FROM machines WHERE site_id = ANY($1) ORDER BY site_id, id", sites)
    return [dict(r) for r in rows]


@router.get("/machines/{machine_id}")
async def get_machine(machine_id: str, request: Request, user: User = Depends(current_user)):
    await check_machine(request.app.state.pool, user, machine_id)
    async with request.app.state.pool.acquire() as c:
        m = await c.fetchrow("SELECT * FROM machines WHERE id=$1", machine_id)
        pts = await c.fetch("""SELECT p.*, b.model AS bearing_model, g.online AS gateway_online FROM measurement_points p
                               LEFT JOIN bearings b ON b.id=p.bearing_id LEFT JOIN gateways g ON g.id=p.gateway_id
                               WHERE p.machine_id=$1 ORDER BY p.id""", machine_id)
    lim = iso_limits(m["iso_group"], m["foundation"])
    return {**dict(m), "points": [dict(p) for p in pts], "iso_limits": {"ab": lim.ab, "bc": lim.bc, "cd": lim.cd}}


@router.post("/machines", status_code=201)
async def create_machine(body: MachineIn, request: Request, user: User = Depends(require("admin"))):
    if not body.id or not body.site_id or not body.name:
        raise HTTPException(400, "Cần id, site_id, name")
    if user.role_for_site(body.site_id) < 5:
        raise HTTPException(403, "Không đủ quyền với site")
    data = body.model_dump(exclude_none=True)
    cols = list(data.keys())
    async with request.app.state.pool.acquire() as c:
        await c.execute(f"INSERT INTO machines ({', '.join(cols)}) VALUES ({', '.join(f'${i+1}' for i in range(len(cols)))})",
                        *data.values())
    await audit(request.app.state.pool, user, "machine.create", body.id, data)
    return {"id": body.id}


@router.patch("/machines/{machine_id}")
async def update_machine(machine_id: str, body: MachineIn, request: Request, user: User = Depends(require("analyst"))):
    pool = request.app.state.pool
    await check_machine(pool, user, machine_id, "analyst")
    data = {k: v for k, v in body.model_dump(exclude_none=True).items() if k in MACHINE_FIELDS}
    if not data:
        return {"ok": True}
    sets = ", ".join(f"{k}=${i + 2}" for i, k in enumerate(data))
    async with pool.acquire() as c:
        await c.execute(f"UPDATE machines SET {sets} WHERE id=$1", machine_id, *data.values())
    await audit(pool, user, "machine.update", machine_id, data)
    return {"ok": True}


@router.get("/machines/{machine_id}/status")
async def machine_status(machine_id: str, request: Request, user: User = Depends(current_user)):
    """Latest values per point × axis, power, temperatures, estimated winding temperature (screen 2)."""
    pool = request.app.state.pool
    await check_machine(pool, user, machine_id)
    async with pool.acquire() as c:
        pts = await c.fetch("SELECT id, name, location, role, iso_axes, axes_map FROM measurement_points WHERE machine_id=$1 ORDER BY id",
                            machine_id)
        out_pts = []
        for p in pts:
            rows = await c.fetch("""SELECT DISTINCT ON (axis) axis, ts, vel_mm_s, vel_mm_s_max, disp_um, freq_hz, acc_g, temp_c,
                                      acc_rms_g, vel_rms_mm_s, kurtosis, crest FROM vib_metrics
                                    WHERE point_id=$1 AND ts > now() - interval '1 hour' ORDER BY axis, ts DESC""", p["id"])
            cap = await c.fetchrow("""SELECT capture_id, ts, profile, iso_vrms_max_mm_s, iso_zone, speed_hz, anomaly_score,
                                        features->'isolation' AS isolation FROM captures WHERE point_id=$1 AND features IS NOT NULL
                                      ORDER BY ts DESC LIMIT 1""", p["id"])
            out_pts.append({**dict(p), "axes": {r["axis"]: dict(r) for r in rows}, "last_capture": dict(cap) if cap else None})
        power = await c.fetchrow("SELECT * FROM power_metrics WHERE machine_id=$1 ORDER BY ts DESC LIMIT 1", machine_id)
        temp = await c.fetchrow("SELECT * FROM temp_metrics WHERE machine_id=$1 ORDER BY ts DESC LIMIT 1", machine_id)
        acc = await c.fetch("""SELECT quantity, count(*) n, avg(error_pct) mean_pct,
                                 percentile_cont(0.95) WITHIN GROUP (ORDER BY error_pct) p95_pct
                               FROM accuracy_tests a JOIN measurement_points p ON p.id=a.point_id
                               WHERE p.machine_id=$1 GROUP BY quantity""", machine_id)
    return {"machine_id": machine_id, "points": out_pts, "power": dict(power) if power else None,
            "temps": dict(temp) if temp else None, "accuracy": [dict(a) for a in acc]}


@router.get("/machines/{machine_id}/power")
async def machine_power(machine_id: str, request: Request, rng=Depends(time_range), user: User = Depends(current_user)):
    await check_machine(request.app.state.pool, user, machine_id)
    frm, to = rng
    bucket = _bucket(frm, to)
    async with request.app.state.pool.acquire() as c:
        rows = await c.fetch(f"""SELECT time_bucket('{bucket}', ts) AS ts, avg(i_a[1]) i1, avg(i_a[2]) i2, avg(i_a[3]) i3,
                                   avg(u_v[1]) u1, avg(u_v[2]) u2, avg(u_v[3]) u3, avg(p_kw) p_kw, avg(pf) pf,
                                   avg(load_pct) load_pct, avg(i_unbalance_pct) i_unbalance_pct, avg(thd_i_pct) thd_i_pct
                                 FROM power_metrics WHERE machine_id=$1 AND ts BETWEEN $2 AND $3 GROUP BY 1 ORDER BY 1""",
                             machine_id, frm, to)
    return {"bucket": bucket, "rows": [dict(r) for r in rows]}


@router.get("/machines/{machine_id}/temps")
async def machine_temps(machine_id: str, request: Request, rng=Depends(time_range), user: User = Depends(current_user)):
    await check_machine(request.app.state.pool, user, machine_id)
    frm, to = rng
    bucket = _bucket(frm, to)
    async with request.app.state.pool.acquire() as c:
        rows = await c.fetch(f"""SELECT time_bucket('{bucket}', ts) AS ts, avg(frame_temp_c) frame_temp_c,
                                   avg(ambient_temp_c) ambient_temp_c, avg(bearing_temp_c) bearing_temp_c,
                                   avg(winding_temp_est_c) winding_temp_est_c, avg(winding_rise_est_k) winding_rise_est_k
                                 FROM temp_metrics WHERE machine_id=$1 AND ts BETWEEN $2 AND $3 GROUP BY 1 ORDER BY 1""",
                             machine_id, frm, to)
    return {"bucket": bucket, "rows": [dict(r) for r in rows]}


def _bucket(frm: datetime, to: datetime) -> str:
    h = (to - frm).total_seconds() / 3600
    if h <= 6:
        return "10 seconds"
    if h <= 48:
        return "1 minute"
    if h <= 24 * 14:
        return "15 minutes"
    return "1 hour"


class MaintenanceIn(BaseModel):
    ts: Optional[datetime] = None
    point_id: Optional[str] = None
    action: str
    description: Optional[str] = None
    found_fault: Optional[str] = None
    photos: list[str] = []
    reset_baseline: bool = False


@router.get("/machines/{machine_id}/maintenance")
async def list_maintenance(machine_id: str, request: Request, user: User = Depends(current_user)):
    await check_machine(request.app.state.pool, user, machine_id)
    async with request.app.state.pool.acquire() as c:
        rows = await c.fetch("SELECT * FROM maintenance_logs WHERE machine_id=$1 ORDER BY ts DESC", machine_id)
    return [dict(r) for r in rows]


@router.post("/machines/{machine_id}/maintenance", status_code=201)
async def add_maintenance(machine_id: str, body: MaintenanceIn, request: Request, user: User = Depends(require("engineer"))):
    pool = request.app.state.pool
    await check_machine(pool, user, machine_id, "engineer")
    async with pool.acquire() as c:
        mid = await c.fetchval("""INSERT INTO maintenance_logs (machine_id, point_id, ts, action, description, found_fault, photos,
                                    by_user, reset_baseline) VALUES ($1,$2,COALESCE($3, now()),$4,$5,$6,$7,$8,$9) RETURNING id""",
                               machine_id, body.point_id, body.ts, body.action, body.description, body.found_fault, body.photos,
                               user.email, body.reset_baseline)
        if body.reset_baseline:
            # Baselines re-learn from data after this maintenance (analytics baseline_learn).
            if body.point_id:
                await c.execute("UPDATE baselines SET status='learning' WHERE point_id=$1 AND status<>'frozen'", body.point_id)
            else:
                await c.execute("UPDATE baselines SET status='learning' WHERE machine_id=$1 AND status<>'frozen'", machine_id)
    await audit(pool, user, "maintenance.create", machine_id, body.model_dump(mode="json"))
    return {"id": mid}


@router.get("/machines/{machine_id}/diagnosis")
async def machine_diagnosis(machine_id: str, request: Request, user: User = Depends(current_user)):
    """Current AI diagnosis per point + evidence + recommendation (screen 3)."""
    await check_machine(request.app.state.pool, user, machine_id)
    async with request.app.state.pool.acquire() as c:
        latest = await c.fetch("""SELECT DISTINCT ON (point_id) * FROM diagnoses WHERE machine_id=$1 AND ts > now() - interval '7 days'
                                  ORDER BY point_id, ts DESC""", machine_id)
        health = await c.fetchrow("""SELECT avg(health_index) health_index, avg(anomaly_score) anomaly_score FROM machine_health
                                     WHERE machine_id=$1 AND ts > now() - interval '24 hours' AND health_index IS NOT NULL""", machine_id)
        rul = await c.fetchrow("""SELECT rul_days, rul_lo_days, rul_hi_days, detail, ts FROM machine_health
                                  WHERE machine_id=$1 AND rul_days IS NOT NULL ORDER BY ts DESC LIMIT 1""", machine_id)
        events = await c.fetch("""SELECT event_id, ts, point_id, severity, rule, metric, value, threshold, message, state, diagnosis
                                  FROM events WHERE machine_id=$1 AND type='alarm' AND ts > now() - interval '7 days'
                                  ORDER BY ts DESC LIMIT 20""", machine_id)
        m = await c.fetchrow("SELECT isolation, male_lobes, band_limits FROM machines WHERE id=$1", machine_id)
    items = sorted([dict(r) for r in latest], key=lambda d: d["confidence"] or 0, reverse=True)
    return {"machine_id": machine_id, "diagnoses": items, "health": dict(health) if health else None,
            "rul": dict(rul) if rul else None, "events": [dict(e) for e in events],
            "isolation": m["isolation"] if m else None, "band_limits": m["band_limits"] if m else None}


class FeedbackIn(BaseModel):
    verdict: str  # correct | wrong | other
    actual_fault: Optional[str] = None
    note: Optional[str] = None


@router.post("/diagnoses/{diag_id}/feedback")
async def diagnosis_feedback(diag_id: int, body: FeedbackIn, request: Request, user: User = Depends(require("engineer"))):
    pool = request.app.state.pool
    async with pool.acquire() as c:
        row = await c.fetchrow("SELECT machine_id, event_id FROM diagnoses WHERE id=$1", diag_id)
        if not row:
            raise HTTPException(404, "Không tìm thấy chẩn đoán")
        await check_machine(pool, user, row["machine_id"], "engineer")
        fb = {**body.model_dump(), "by": user.email, "ts": datetime.utcnow().isoformat() + "Z"}
        await c.execute("UPDATE diagnoses SET feedback=$2 WHERE id=$1", diag_id, fb)
        if row["event_id"]:
            await c.execute("UPDATE events SET feedback=$2 WHERE event_id=$1", row["event_id"], fb)
    return {"ok": True}


@router.get("/machines/{machine_id}/health")
async def machine_health(machine_id: str, request: Request, rng=Depends(time_range), user: User = Depends(current_user)):
    await check_machine(request.app.state.pool, user, machine_id)
    frm, to = rng
    async with request.app.state.pool.acquire() as c:
        rows = await c.fetch("""SELECT ts, point_id, health_index, anomaly_score, rul_days, rul_lo_days, rul_hi_days
                                FROM machine_health WHERE machine_id=$1 AND ts BETWEEN $2 AND $3 ORDER BY ts""", machine_id, frm, to)
    return [dict(r) for r in rows]


class AnalyticsCmd(BaseModel):
    job: str
    params: dict[str, Any] = {}


@router.post("/analytics/run")
async def run_analytics(body: AnalyticsCmd, request: Request, user: User = Depends(require("analyst"))):
    if body.job not in ("baseline_learn", "anomaly_train", "criterion2", "trend_rate", "rul_estimate", "monthly_report"):
        raise HTTPException(400, "job không hợp lệ")
    await bus.publish(request.app.state.redis, "analytics:cmd", {"job": body.job, **body.params})
    await audit(request.app.state.pool, user, "analytics.run", body.job)
    return {"queued": body.job}
