"""Machines: CRUD, live status, power/temperature series, maintenance, diagnosis, health."""
import bisect
import csv
import io
from datetime import datetime
from typing import Any, Optional
import math
from zoneinfo import ZoneInfo

from fastapi import APIRouter, Depends, File, HTTPException, Query, Request, UploadFile
from fastapi.responses import Response
from pathlib import Path
from uuid import uuid4
from pydantic import BaseModel

from ...common import bus
from ...common import gwconfig
from ...common.iso import iso_limits, rezone
from ..deps import User, audit, check_machine, current_user, require, time_range

router = APIRouter(tags=["machines"])

VENDOR_TABLE_HEADER = [
    "Time", "Device name", "Acceleration X(g)", "Acceleration Y(g)", "Acceleration Z(g)",
    "X-axis vibration speed(mm/s)", "Abrg1(X)m/s", "Y-axis vibration speed(mm/s)", "Abrg1(Y) m/s",
    "Z-axis vibration speed(mm/s)", "Abrg 1(Z)m/s", "X-axis vibration displacement(um)",
    "Y-axis vibration displacement(um)", "Z-axis vibration displacement(um)", "Abrg2(X)m/s",
    "Y-axis vibration speed(mm/s)", "Abrg2(Y) m/s", "Z-axis vibration speed(mm/s)", "Abrg 2(Z)m/s",
    "Abase(X)m/s", "Abase(X)m/s", "Abase(X)m/s", "Tần số Z", "Chip Time()", "Temperature(℃)",
]


def _nearest_vendor_row(rows: list[dict], timestamps: list[datetime], target: datetime, max_skew_ms: int) -> dict | None:
    if not rows:
        return None
    index = bisect.bisect_left(timestamps, target)
    candidates = [i for i in (index - 1, index) if 0 <= i < len(rows)]
    best = min(candidates, key=lambda i: abs((timestamps[i] - target).total_seconds()))
    return rows[best] if abs((timestamps[best] - target).total_seconds() * 1000) <= max_skew_ms else None


def _vendor_number(row: dict | None, key: str, digits: int = 4, scale: float = 1.0):
    value = row.get(key) if row else None
    if value is None:
        return ""
    number = float(value) * scale
    return round(number) if digits == 0 else round(number, digits)


def runtime_summary(rows: list[dict], frm: datetime, to: datetime, prior_running: bool = False,
                    max_gap_s: float = 90.0) -> dict[str, float | bool | int]:
    """Integrate gateway RUN samples without counting a disconnect as runtime."""
    run_s = 0.0
    cursor = frm
    running = prior_running
    for row in rows:
        elapsed = max(0.0, (row["ts"] - cursor).total_seconds())
        if running:
            run_s += min(max_gap_s, elapsed)
        cursor = row["ts"]
        running = bool(row["running"])
    if running:
        run_s += min(max_gap_s, max(0.0, (to - cursor).total_seconds()))
    total_s = max(1.0, (to - frm).total_seconds())
    return {"run_seconds": round(run_s), "total_seconds": round(total_s),
            "rate_pct": round(run_s / total_s * 100, 2), "samples": len(rows), "running": running}

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


def validate_run_detection(meta: dict | None, point_ids: set[str]) -> None:
    """Reject unsafe RUN rules before they are versioned and sent to a gateway."""
    if not meta or "run_detection" not in meta:
        return
    rule = meta["run_detection"]
    if not isinstance(rule, dict):
        raise HTTPException(422, "run_detection phải là một đối tượng")
    for key in ("on_delay_s", "off_delay_s"):
        value = rule.get(key, 10)
        if not isinstance(value, (int, float)) or not math.isfinite(value) or value < 0 or value > 3600:
            raise HTTPException(422, f"{key} phải nằm trong khoảng 0–3600 giây")
    sources = rule.get("sources", [])
    if not isinstance(sources, list) or not sources:
        raise HTTPException(422, "Cần cấu hình ít nhất một nguồn RUN")
    for source in sources:
        if not isinstance(source, dict) or source.get("point_id") not in point_ids:
            raise HTTPException(422, "RUN source phải thuộc động cơ đang cấu hình")
        axes = source.get("axes")
        if not isinstance(axes, list) or not axes or any(axis not in {"x", "y", "z"} for axis in axes):
            raise HTTPException(422, "RUN source cần chọn ít nhất một trục X, Y hoặc Z")
        threshold = source.get("threshold_mm_s")
        if not isinstance(threshold, (int, float)) or not math.isfinite(threshold) or threshold <= 0 or threshold > 100:
            raise HTTPException(422, "Ngưỡng RUN phải lớn hơn 0 và không quá 100 mm/s")


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
        m = await c.fetchrow("SELECT m.*, s.name AS site_name FROM machines m LEFT JOIN sites s ON s.id=m.site_id WHERE m.id=$1", machine_id)
        pts = await c.fetch("""SELECT p.*, b.model AS bearing_model,
                               CASE WHEN d.id IS NOT NULL THEN g.online ELSE FALSE END AS gateway_online
                               FROM measurement_points p
                               LEFT JOIN bearings b ON b.id=p.bearing_id LEFT JOIN gateways g ON g.id=p.gateway_id
                               LEFT JOIN gateway_deployments d ON d.gateway_id=p.gateway_id AND d.machine_id=p.machine_id AND d.state='active'
                               WHERE p.machine_id=$1 ORDER BY p.id""", machine_id)
    lim = iso_limits(m["iso_group"], m["foundation"])
    return {**dict(m), "points": [dict(p) for p in pts], "iso_limits": {"ab": lim.ab, "bc": lim.bc, "cd": lim.cd}}


@router.get("/machines/{machine_id}/vendor-table.csv")
async def vendor_compatible_table(machine_id: str, request: Request, rng=Depends(time_range),
                                  point_id: Optional[str] = None,
                                  device_name: Optional[str] = Query(None, max_length=64),
                                  max_skew_ms: int = Query(1000, ge=0, le=10_000),
                                  limit: int = Query(50_000, ge=1, le=100_000),
                                  user: User = Depends(require("engineer"))):
    """Export the 25-column CSV layout used by the comparison instrument."""
    await check_machine(request.app.state.pool, user, machine_id)
    frm, to = rng
    async with request.app.state.pool.acquire() as c:
        points = [dict(row) for row in await c.fetch(
            "SELECT * FROM measurement_points WHERE machine_id=$1 ORDER BY id", machine_id)]
        if not points:
            raise HTTPException(404, "Máy chưa có điểm đo")
        selected = next((p for p in points if p["id"] == point_id), None) if point_id else None
        if point_id and not selected:
            raise HTTPException(400, "Điểm đo không thuộc máy đã chọn")
        brg1 = selected or next((p for p in points if p.get("role") == "bearing"), None) or points[0]
        brg2 = next((p for p in points if p.get("role") == "bearing" and p["id"] != brg1["id"]), None)
        base = next((p for p in points if p.get("role") == "base" and p["id"] != brg1["id"]), None)

        truncated = [False]

        async def metric_rows(pid: str | None) -> list[dict]:
            if not pid:
                return []
            rows = await c.fetch("""SELECT ts,
                       max(acc_g) FILTER (WHERE axis='x') AS acc_x,
                       max(acc_g) FILTER (WHERE axis='y') AS acc_y,
                       max(acc_g) FILTER (WHERE axis='z') AS acc_z,
                       max(vel_mm_s) FILTER (WHERE axis='x') AS vel_x,
                       max(vel_mm_s) FILTER (WHERE axis='y') AS vel_y,
                       max(vel_mm_s) FILTER (WHERE axis='z') AS vel_z,
                       max(disp_um) FILTER (WHERE axis='x') AS disp_x,
                       max(disp_um) FILTER (WHERE axis='y') AS disp_y,
                       max(disp_um) FILTER (WHERE axis='z') AS disp_z,
                       max(freq_hz) FILTER (WHERE axis='z') AS freq_z,
                       max(temp_c) AS temp_c
                     FROM vib_metrics WHERE point_id=$1 AND ts BETWEEN $2 AND $3
                       AND (acc_g IS NOT NULL OR vel_mm_s IS NOT NULL OR disp_um IS NOT NULL
                            OR freq_hz IS NOT NULL OR temp_c IS NOT NULL)
                     GROUP BY ts ORDER BY ts DESC LIMIT $4""", pid, frm, to, limit + 1)
            # Newest rows win when the range exceeds the limit; flag it and restore time order.
            truncated[0] = truncated[0] or len(rows) > limit
            return [dict(row) for row in reversed(rows[:limit])]

        brg1_rows = await metric_rows(brg1["id"])
        brg2_rows = await metric_rows(brg2["id"] if brg2 else None)
        base_rows = await metric_rows(base["id"] if base else None)
    if not brg1_rows:
        raise HTTPException(404, "Không có dữ liệu metric trong khoảng thời gian đã chọn")

    brg2_ts = [row["ts"] for row in brg2_rows]
    base_ts = [row["ts"] for row in base_rows]
    name = (device_name or brg1.get("sensor_serial") or brg1.get("gateway_id") or brg1["id"]).replace("\r", " ").replace("\n", " ")
    timezone = ZoneInfo("Asia/Ho_Chi_Minh")
    output = io.StringIO(newline="")
    writer = csv.writer(output, lineterminator="\r\n")
    writer.writerow(VENDOR_TABLE_HEADER)
    for row in brg1_rows:
        ts = row["ts"]
        local = ts.astimezone(timezone)
        second = _nearest_vendor_row(brg2_rows, brg2_ts, ts, max_skew_ms)
        base_row = _nearest_vendor_row(base_rows, base_ts, ts, max_skew_ms)
        writer.writerow([
            local.strftime("%H:%M:%S.%f")[:-3], name,
            _vendor_number(row, "acc_x"), _vendor_number(row, "acc_y"), _vendor_number(row, "acc_z"),
            _vendor_number(row, "vel_x", 0, 100), _vendor_number(row, "vel_x", 4),
            _vendor_number(row, "vel_y", 0, 100), _vendor_number(row, "vel_y", 4),
            _vendor_number(row, "vel_z", 0, 100), _vendor_number(row, "vel_z", 4),
            _vendor_number(row, "disp_x", 2), _vendor_number(row, "disp_y", 2), _vendor_number(row, "disp_z", 2),
            _vendor_number(second, "vel_x", 4), _vendor_number(second, "vel_y", 0, 100),
            _vendor_number(second, "vel_y", 4), _vendor_number(second, "vel_z", 0, 100),
            _vendor_number(second, "vel_z", 4), _vendor_number(base_row, "vel_x", 4),
            _vendor_number(base_row, "vel_y", 4), _vendor_number(base_row, "vel_z", 4),
            _vendor_number(row, "freq_z", 3), local.strftime("%Y-%m-%d %H:%M:%S.%f")[:-3],
            _vendor_number(row, "temp_c", 2),
        ])
    filename = f"{machine_id}-{brg1['id']}-bang-hang.csv"
    data = ("\ufeff" + output.getvalue()).encode("utf-8")
    return Response(data, media_type="text/csv; charset=utf-8", headers={
        "Content-Disposition": f'attachment; filename="{filename}"', "Cache-Control": "no-store",
        "X-Rows-Truncated": "1" if truncated[0] else "0", "Access-Control-Expose-Headers": "X-Rows-Truncated",
    })


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
        if "meta" in data:
            point_rows = await c.fetch("SELECT id FROM measurement_points WHERE machine_id=$1", machine_id)
            validate_run_detection(data["meta"], {row["id"] for row in point_rows})
        await c.execute(f"UPDATE machines SET {sets} WHERE id=$1", machine_id, *data.values())
        gateways = [r["gateway_id"] for r in await c.fetch(
            "SELECT DISTINCT gateway_id FROM measurement_points WHERE machine_id=$1 AND gateway_id IS NOT NULL", machine_id)]
    await audit(pool, user, "machine.update", machine_id, data)
    versions = {}
    for gateway_id in gateways:
        versions[gateway_id] = await gwconfig.push_managed(pool, request.app.state.settings, gateway_id, user.email)
    return {"ok": True, "config_versions": versions}


@router.get("/machines/{machine_id}/status")
async def machine_status(machine_id: str, request: Request, user: User = Depends(current_user)):
    """Latest values per point × axis, power, temperatures, estimated winding temperature (screen 2)."""
    pool = request.app.state.pool
    await check_machine(pool, user, machine_id)
    async with pool.acquire() as c:
        m = await c.fetchrow("SELECT iso_group, foundation FROM machines WHERE id=$1", machine_id)
        lim = iso_limits(m["iso_group"], m["foundation"])
        pts = await c.fetch("""SELECT p.id, p.name, p.location, p.role, p.iso_axes, p.axes_map, p.gateway_id, g.online AS gateway_online,
                                 g.last_seen AS gateway_last_seen
                               FROM measurement_points p LEFT JOIN gateways g ON g.id=p.gateway_id
                               WHERE p.machine_id=$1 ORDER BY p.id""", machine_id)
        out_pts = []
        for p in pts:
            rows = await c.fetch("""SELECT DISTINCT ON (axis) axis, ts, vel_mm_s, vel_mm_s_max, disp_um, freq_hz, acc_g, temp_c,
                                      acc_rms_g, vel_rms_mm_s, kurtosis, crest FROM vib_metrics
                                    WHERE point_id=$1 AND ts > now() - interval '1 hour' ORDER BY axis, ts DESC""", p["id"])
            # The newest row per axis is usually a B1 row without RMS statistics; the 1 s RMS row is older.
            # Overlay the latest non-null RMS fields so a refetch never drops the fast values.
            rms_rows = await c.fetch("""SELECT DISTINCT ON (axis) axis, ts AS rms_ts, acc_rms_g, vel_rms_mm_s, kurtosis, crest
                                        FROM vib_metrics WHERE point_id=$1 AND ts > now() - interval '1 hour'
                                          AND vel_rms_mm_s IS NOT NULL ORDER BY axis, ts DESC""", p["id"])
            rms_by_axis = {r["axis"]: dict(r) for r in rms_rows}
            # axes_iso: per-axis ISO velocity RMS / acc RMS computed from the raw waveform – the values
            # comparable with a handheld meter (the sensor's VX register is not an RMS value).
            cap = await c.fetchrow("""SELECT capture_id, ts, profile, iso_vrms_max_mm_s, iso_zone, speed_hz, anomaly_score,
                                        features->'isolation' AS isolation,
                                        (SELECT jsonb_object_agg(k, jsonb_build_object(
                                                  'iso_vrms_mm_s', v->'iso_vrms_mm_s', 'acc_rms_g', v->'acc_rms_g',
                                                  'acc_peak_g', v->'acc_peak_g', 'iso_band_hz', v->'iso_band_hz'))
                                           FROM jsonb_each(features->'axes') AS e(k, v)) AS axes_iso
                                      FROM captures WHERE point_id=$1 AND features IS NOT NULL
                                      ORDER BY ts DESC LIMIT 1""", p["id"])
            out_pts.append({**dict(p), "axes": {r["axis"]: {**dict(r), **{k: v for k, v in rms_by_axis.get(r["axis"], {}).items() if k != "axis"}} for r in rows},
                            "last_capture": rezone(dict(cap), lim) if cap else None})
        power = await c.fetchrow("SELECT * FROM power_metrics WHERE machine_id=$1 ORDER BY ts DESC LIMIT 1", machine_id)
        run_state = await c.fetchrow("SELECT ts, running, source FROM machine_run_states WHERE machine_id=$1 ORDER BY ts DESC LIMIT 1", machine_id)
        temp = await c.fetchrow("SELECT * FROM temp_metrics WHERE machine_id=$1 ORDER BY ts DESC LIMIT 1", machine_id)
        acc = await c.fetch("""SELECT quantity, count(*) n, avg(error_pct) mean_pct,
                                 percentile_cont(0.95) WITHIN GROUP (ORDER BY error_pct) p95_pct
                               FROM accuracy_tests a JOIN measurement_points p ON p.id=a.point_id
                               WHERE p.machine_id=$1 GROUP BY quantity""", machine_id)
    return {"machine_id": machine_id, "points": out_pts, "power": dict(power) if power else None,
            "run_state": dict(run_state) if run_state else None,
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
                                   avg(ambient_temp_c) ambient_temp_c, avg(bearing_temp_c) bearing_temp_c, avg(sensor_temp_c) sensor_temp_c,
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


MAINTENANCE_IMAGE_TYPES = {"image/jpeg": ".jpg", "image/png": ".png", "image/webp": ".webp"}


@router.post("/machines/{machine_id}/maintenance/photos", status_code=201)
async def upload_maintenance_photo(machine_id: str, request: Request, photo: UploadFile = File(...),
                                   user: User = Depends(require("engineer"))):
    """Store a maintenance evidence photo outside the database (maximum 5 MiB)."""
    await check_machine(request.app.state.pool, user, machine_id, "engineer")
    suffix = MAINTENANCE_IMAGE_TYPES.get(photo.content_type or "")
    if not suffix:
        raise HTTPException(415, "Chỉ chấp nhận ảnh JPEG, PNG hoặc WebP")
    data = await photo.read(5 * 1024 * 1024 + 1)
    if not data or len(data) > 5 * 1024 * 1024:
        raise HTTPException(413, "Ảnh phải có dung lượng từ 1 byte đến 5 MiB")
    photo_id = f"{uuid4().hex}{suffix}"
    key = f"maintenance/{machine_id}/{photo_id}"
    await request.app.state.storage.put(key, data, photo.content_type)
    await audit(request.app.state.pool, user, "maintenance.photo.upload", machine_id,
                {"photo_id": photo_id, "original_name": Path(photo.filename or "photo").name})
    return {"id": photo_id, "url": f"/api/v1/machines/{machine_id}/maintenance/photos/{photo_id}"}


@router.get("/machines/{machine_id}/maintenance/photos/{photo_id}")
async def get_maintenance_photo(machine_id: str, photo_id: str, request: Request,
                                user: User = Depends(current_user)):
    await check_machine(request.app.state.pool, user, machine_id)
    if Path(photo_id).name != photo_id or Path(photo_id).suffix.lower() not in (".jpg", ".png", ".webp"):
        raise HTTPException(400, "Mã ảnh không hợp lệ")
    data = await request.app.state.storage.get(f"maintenance/{machine_id}/{photo_id}")
    if data is None:
        raise HTTPException(404, "Không tìm thấy ảnh")
    media = {".jpg": "image/jpeg", ".png": "image/png", ".webp": "image/webp"}[Path(photo_id).suffix.lower()]
    return Response(data, media_type=media, headers={"Cache-Control": "private, max-age=3600"})


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
                                  WHERE machine_id=$1 AND detail->>'kind'='rul' ORDER BY ts DESC LIMIT 1""", machine_id)
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
        rows = await c.fetch("""SELECT ts, point_id, health_index, anomaly_score, rul_days, rul_lo_days, rul_hi_days, detail
                                FROM machine_health WHERE machine_id=$1 AND ts BETWEEN $2 AND $3 ORDER BY ts""", machine_id, frm, to)
    return [dict(r) for r in rows]


@router.get("/machines/{machine_id}/runtime")
async def machine_runtime(machine_id: str, request: Request, rng=Depends(time_range), user: User = Depends(current_user)):
    """Observed RUN duration and utilization rate from independent gateway state samples."""
    await check_machine(request.app.state.pool, user, machine_id)
    frm, to = rng
    async with request.app.state.pool.acquire() as c:
        prior = await c.fetchrow("""SELECT ts, running FROM machine_run_states
                                    WHERE machine_id=$1 AND ts < $2 ORDER BY ts DESC LIMIT 1""", machine_id, frm)
        rows = await c.fetch("""SELECT ts, running FROM machine_run_states
                                WHERE machine_id=$1 AND ts >= $2 AND ts <= $3 ORDER BY ts""", machine_id, frm, to)
        # Backward-compatible fallback until a gateway begins emitting metrics/run.
        legacy = False
        if not rows and not prior:
            point = await c.fetchrow("""SELECT id FROM measurement_points WHERE machine_id=$1
                                        ORDER BY CASE WHEN upper(location)='DE' THEN 0 ELSE 1 END, id LIMIT 1""", machine_id)
            if not point:
                raise HTTPException(404, "Máy chưa có điểm đo")
            rows = await c.fetch("""SELECT ts, running FROM captures WHERE point_id=$1 AND ts >= $2 AND ts <= $3
                                    ORDER BY ts""", point["id"], frm, to)
            legacy = True
    summary = runtime_summary([dict(row) for row in rows], frm, to, bool(prior["running"]) if prior else False)
    return {"machine_id": machine_id, "from": frm, "to": to, **summary,
            "source": "captures" if legacy else "run_state"}


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
