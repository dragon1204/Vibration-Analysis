"""Sites and the overview dashboard (screen 1)."""
from fastapi import APIRouter, Depends, HTTPException, Query, Request

from ...common.iso import SEVERITY_ORDER, iso_limits
from ..deps import User, current_user

router = APIRouter(tags=["overview"])


@router.get("/sites")
async def sites(request: Request, user: User = Depends(current_user)):
    ids = user.sites()
    async with request.app.state.pool.acquire() as c:
        rows = await c.fetch("""SELECT s.*, t.name AS tenant_name,
                                  (SELECT count(*) FROM machines m WHERE m.site_id=s.id) AS machines
                                FROM sites s JOIN tenants t ON t.id=s.tenant_id WHERE s.id = ANY($1) ORDER BY s.id""", ids)
    return [dict(r) for r in rows]


def machine_status(active_sev: str | None, zone: str | None, online: bool | None) -> str:
    """normal | watch | warning | danger | offline (UI colours, spec 7.1)."""
    if online is False:
        return "offline"
    lvl = SEVERITY_ORDER.get(active_sev or "normal", 0)
    lvl = max(lvl, {"C": 2, "D": 3}.get(zone or "", 0))
    return {0: "normal", 1: "watch", 2: "warning", 3: "danger"}[lvl]


@router.get("/overview")
async def overview(request: Request, site_id: str | None = Query(None), user: User = Depends(current_user)):
    allowed = user.sites()
    if site_id:
        if site_id not in allowed:
            raise HTTPException(403, "Không đủ quyền")
        allowed = [site_id]
    async with request.app.state.pool.acquire() as c:
        machines = await c.fetch("SELECT * FROM machines WHERE site_id = ANY($1) ORDER BY site_id, id", allowed)
        mids = [m["id"] for m in machines]
        sev = await c.fetch("""SELECT machine_id, severity FROM events WHERE machine_id = ANY($1) AND cleared_at IS NULL
                               AND state IN ('raised','acknowledged','diagnosed') AND severity IN ('watch','warning','danger')""", mids)
        zones = await c.fetch("""SELECT DISTINCT ON (c.point_id) p.machine_id, c.point_id, c.iso_zone, c.iso_vrms_max_mm_s, c.ts
                                 FROM captures c JOIN measurement_points p ON p.id=c.point_id
                                 WHERE p.machine_id = ANY($1) AND p.role='bearing' AND c.iso_zone IS NOT NULL
                                 ORDER BY c.point_id, c.ts DESC""", mids)
        vib = await c.fetch("""SELECT p.machine_id, max(v.vel_mm_s) AS vmax, max(v.temp_c) AS tmax, max(v.ts) AS last
                               FROM vib_metrics v JOIN measurement_points p ON p.id=v.point_id
                               WHERE p.machine_id = ANY($1) AND p.role='bearing' AND v.ts > now() - interval '10 minutes'
                               GROUP BY p.machine_id""", mids)
        temps = await c.fetch("""SELECT DISTINCT ON (machine_id) machine_id, winding_temp_est_c, bearing_temp_c, frame_temp_c
                                 FROM temp_metrics WHERE machine_id = ANY($1) AND ts > now() - interval '30 minutes'
                                 ORDER BY machine_id, ts DESC""", mids)
        power = await c.fetch("""SELECT DISTINCT ON (machine_id) machine_id, running, load_pct FROM power_metrics
                                 WHERE machine_id = ANY($1) AND ts > now() - interval '5 minutes' ORDER BY machine_id, ts DESC""", mids)
        health = await c.fetch("""SELECT DISTINCT ON (machine_id) machine_id, health_index, rul_days, rul_lo_days, rul_hi_days
                                  FROM machine_health WHERE machine_id = ANY($1) AND ts > now() - interval '7 days'
                                  ORDER BY machine_id, ts DESC""", mids)
        gw = await c.fetch("""SELECT DISTINCT p.machine_id, g.online FROM measurement_points p JOIN gateways g ON g.id=p.gateway_id
                              WHERE p.machine_id = ANY($1)""", mids)
        trend = await c.fetch("""SELECT p.machine_id, time_bucket('1 hour', h.bucket) AS t, max(h.vel_avg) AS v
                                 FROM vib_metrics_1h h JOIN measurement_points p ON p.id=h.point_id
                                 WHERE p.machine_id = ANY($1) AND p.role='bearing' AND h.bucket > now() - interval '7 days'
                                 GROUP BY 1, 2 ORDER BY 2""", mids)
        events = await c.fetch("""SELECT e.*, m.name AS machine_name FROM events e LEFT JOIN machines m ON m.id=e.machine_id
                                  LEFT JOIN gateways g ON g.id=e.gateway_id
                                  WHERE COALESCE(m.site_id, g.site_id) = ANY($1) AND e.severity <> 'info'
                                  ORDER BY e.ts DESC LIMIT 15""", allowed)
    by = lambda rows: {r["machine_id"]: dict(r) for r in rows}  # noqa: E731
    vib_m, temp_m, pow_m, health_m = by(vib), by(temps), by(power), by(health)
    online_m: dict = {}
    for r in gw:
        online_m[r["machine_id"]] = online_m.get(r["machine_id"], True) and bool(r["online"])
    for mid in vib_m:  # fresh data (last 10 min) proves the machine is reachable
        online_m[mid] = True
    sev_m: dict = {}
    for r in sev:
        if SEVERITY_ORDER[r["severity"]] > SEVERITY_ORDER.get(sev_m.get(r["machine_id"], "normal"), 0):
            sev_m[r["machine_id"]] = r["severity"]
    zone_m: dict = {}
    for r in zones:
        cur = zone_m.get(r["machine_id"])
        if cur is None or (r["iso_zone"] or "A") > (cur["iso_zone"] or "A"):
            zone_m[r["machine_id"]] = dict(r)
    trend_m: dict = {}
    for r in trend:
        trend_m.setdefault(r["machine_id"], []).append([r["t"].isoformat(), r["v"]])
    cards, counts = [], {"normal": 0, "watch": 0, "warning": 0, "danger": 0, "offline": 0}
    for m in machines:
        mid = m["id"]
        z = zone_m.get(mid) or {}
        lim = iso_limits(m["iso_group"], m["foundation"])
        running = (pow_m.get(mid) or {}).get("running")
        if running is None and mid in vib_m:
            running = (vib_m[mid]["vmax"] or 0) > 0.3
        st = machine_status(sev_m.get(mid), z.get("iso_zone"), online_m.get(mid))
        counts[st] += 1
        h = health_m.get(mid) or {}
        cards.append({
            "id": mid, "name": m["name"], "site_id": m["site_id"], "type": m["type"], "photo_url": m["photo_url"],
            "rated_power_kw": m["rated_power_kw"], "status": st, "online": online_m.get(mid),
            "health_index": h.get("health_index"), "rul_days": h.get("rul_days"), "rul_lo_days": h.get("rul_lo_days"),
            "rul_hi_days": h.get("rul_hi_days"), "iso_zone": z.get("iso_zone"), "iso_vrms_mm_s": z.get("iso_vrms_max_mm_s"),
            "vib_max_mm_s": (vib_m.get(mid) or {}).get("vmax"),
            "bearing_temp_c": (temp_m.get(mid) or {}).get("bearing_temp_c") or (vib_m.get(mid) or {}).get("tmax"),
            "winding_temp_est_c": (temp_m.get(mid) or {}).get("winding_temp_est_c"), "running": running,
            "load_pct": (pow_m.get(mid) or {}).get("load_pct"),
            "iso_limits": {"ab": lim.ab, "bc": lim.bc, "cd": lim.cd}, "trend_7d": trend_m.get(mid, []),
        })
    return {"counts": counts, "machines": cards, "events": [dict(e) for e in events]}
