"""Measurement points, time series, captures, waveform, spectrum, waterfall (screens 2, 5, 6)."""
import gzip
import json
import math
from datetime import timedelta
from typing import Optional

import numpy as np
from fastapi import APIRouter, Depends, HTTPException, Query, Request
from pydantic import BaseModel

from ...common import dsp, wavefile
from ...common.assets import AssetCache
from ...common.iso import iso_limits, rezone
from ..deps import User, audit, check_machine, check_point, current_user, require, time_range

router = APIRouter(tags=["points"])

RAW_FIELDS = {"vel_mm_s", "vel_mm_s_max", "disp_um", "freq_hz", "acc_g", "acc_rms_g", "vel_rms_mm_s", "disp_rms_mm", "crest",
              "kurtosis", "skew", "temp_c"}
# Per-axis values computed by the edge from the raw waveform of each capture (features.axes.<axis>.<key>).
# iso_vrms_mm_s is the ISO 20816 velocity RMS – the value comparable with a handheld meter.
CAPTURE_FIELDS = {"iso_vrms_mm_s": "iso_vrms_mm_s", "cap_acc_rms_g": "acc_rms_g", "cap_acc_peak_g": "acc_peak_g",
                  "cap_kurtosis": "kurtosis", "cap_crest": "crest"}


async def _point_limits(c, point_id: str):
    m = await c.fetchrow("""SELECT m.iso_group, m.foundation FROM measurement_points p JOIN machines m ON m.id=p.machine_id
                            WHERE p.id=$1""", point_id)
    return iso_limits(m["iso_group"], m["foundation"]) if m else None
AGG_FIELDS = {"vel_mm_s": "vel_avg", "vel_mm_s_max": "vel_max", "acc_rms_g": "acc_rms_avg", "kurtosis": "kurt_max",
              "temp_c": "temp_avg", "vel_rms_mm_s": "vel_rms_avg"}


class PointIn(BaseModel):
    id: Optional[str] = None
    machine_id: Optional[str] = None
    name: Optional[str] = None
    location: Optional[str] = None
    gateway_id: Optional[str] = None
    sensor_model: Optional[str] = None
    sensor_serial: Optional[str] = None
    sensor_addr: Optional[int] = None
    axes_map: Optional[dict] = None
    iso_axes: Optional[list[str]] = None
    bearing_id: Optional[int] = None
    calibration: Optional[list] = None
    photo_url: Optional[str] = None
    active: Optional[bool] = None
    role: Optional[str] = None


@router.get("/points")
async def list_points(request: Request, machine_id: Optional[str] = None, user: User = Depends(current_user)):
    async with request.app.state.pool.acquire() as c:
        rows = await c.fetch("""SELECT p.*, m.site_id FROM measurement_points p JOIN machines m ON m.id=p.machine_id
                                WHERE m.site_id = ANY($1) AND ($2::text IS NULL OR p.machine_id=$2) ORDER BY p.id""",
                             user.sites(), machine_id)
    return [dict(r) for r in rows]


@router.get("/points/{point_id}")
async def get_point(point_id: str, request: Request, user: User = Depends(current_user)):
    await check_point(request.app.state.pool, user, point_id)
    async with request.app.state.pool.acquire() as c:
        p = await c.fetchrow("""SELECT p.*, b.model AS bearing_model, b.n_balls, b.bd_mm, b.pd_mm, b.contact_deg
                                FROM measurement_points p LEFT JOIN bearings b ON b.id=p.bearing_id WHERE p.id=$1""", point_id)
    return dict(p)


@router.post("/points", status_code=201)
async def create_point(body: PointIn, request: Request, user: User = Depends(require("admin"))):
    if not body.id or not body.machine_id:
        raise HTTPException(400, "Cần id và machine_id")
    await check_machine(request.app.state.pool, user, body.machine_id, "admin")
    data = body.model_dump(exclude_none=True)
    cols = list(data)
    async with request.app.state.pool.acquire() as c:
        await c.execute(f"INSERT INTO measurement_points ({', '.join(cols)}) VALUES ({', '.join(f'${i+1}' for i in range(len(cols)))})",
                        *data.values())
    await audit(request.app.state.pool, user, "point.create", body.id, data)
    return {"id": body.id}


@router.patch("/points/{point_id}")
async def update_point(point_id: str, body: PointIn, request: Request, user: User = Depends(require("analyst"))):
    pool = request.app.state.pool
    await check_point(pool, user, point_id, "analyst")
    data = body.model_dump(exclude_none=True, exclude={"id"})
    if data:
        sets = ", ".join(f"{k}=${i + 2}" for i, k in enumerate(data))
        async with pool.acquire() as c:
            await c.execute(f"UPDATE measurement_points SET {sets} WHERE id=$1", point_id, *data.values())
        await audit(pool, user, "point.update", point_id, data)
    return {"ok": True}


@router.get("/points/{point_id}/metrics")
async def point_metrics(point_id: str, request: Request, rng=Depends(time_range), fields: str = "vel_mm_s",
                        axis: Optional[str] = None, agg: str = "auto", user: User = Depends(current_user)):
    await check_point(request.app.state.pool, user, point_id)
    frm, to = rng
    requested = fields.split(",")
    flds = [f for f in requested if f in RAW_FIELDS]
    cap_flds = [f for f in requested if f in CAPTURE_FIELDS]
    if not flds and not cap_flds:
        raise HTTPException(400, f"fields phải thuộc {sorted(RAW_FIELDS | set(CAPTURE_FIELDS))}")
    axes = [a for a in (axis or "x,y,z").split(",") if a in ("x", "y", "z")]
    use_agg = agg == "1h" or (agg == "auto" and to - frm > timedelta(days=2))
    series: dict = {a: {f: [] for f in flds + cap_flds} for a in axes}
    mode = "capture"
    async with request.app.state.pool.acquire() as c:
        if cap_flds:
            cols = ", ".join(f"(e.value->>'{CAPTURE_FIELDS[f]}')::float8 AS {f}" for f in cap_flds)
            crows = await c.fetch(f"""SELECT c.ts, e.key AS axis, {cols} FROM captures c, jsonb_each(c.features->'axes') e
                                      WHERE c.point_id=$1 AND c.ts BETWEEN $2 AND $3 AND e.key = ANY($4)
                                      ORDER BY c.ts LIMIT 200000""", point_id, frm, to, axes)
            for r in crows:
                for f in cap_flds:
                    if r[f] is not None and math.isfinite(r[f]):
                        series[r["axis"]][f].append([r["ts"].isoformat(), round(float(r[f]), 4)])
        if not flds:
            return {"point_id": point_id, "agg": mode, "series": series}
        if use_agg and all(f in AGG_FIELDS for f in flds):
            cols = ", ".join(f"{AGG_FIELDS[f]} AS {f}" for f in flds)
            rows = await c.fetch(f"""SELECT bucket AS ts, axis, {cols} FROM vib_metrics_1h WHERE point_id=$1 AND bucket BETWEEN $2 AND $3
                                     AND axis = ANY($4) ORDER BY bucket""", point_id, frm, to, axes)
            mode = "1h"
        else:
            cols = ", ".join(flds)
            rows = await c.fetch(f"""SELECT ts, axis, {cols} FROM vib_metrics WHERE point_id=$1 AND ts BETWEEN $2 AND $3
                                     AND axis = ANY($4) ORDER BY ts LIMIT 200000""", point_id, frm, to, axes)
            mode = "raw"
    for r in rows:
        for f in flds:
            if r[f] is not None:
                series[r["axis"]][f].append([r["ts"].isoformat(), round(float(r[f]), 4)])
    return {"point_id": point_id, "agg": mode, "series": series}


@router.get("/points/{point_id}/captures")
async def point_captures(point_id: str, request: Request, rng=Depends(time_range), profile: Optional[str] = None,
                         limit: int = Query(200, le=2000), user: User = Depends(current_user)):
    await check_point(request.app.state.pool, user, point_id)
    frm, to = rng
    async with request.app.state.pool.acquire() as c:
        rows = await c.fetch("""SELECT capture_id, ts, profile, fs_hz, frames, running, load_pct, speed_hz, speed_confidence,
                                  iso_vrms_max_mm_s, iso_zone, anomaly_score, quality_flags, processed_by,
                                  waveform_key IS NOT NULL AS has_waveform, spectrum_key IS NOT NULL AS has_spectrum,
                                  features->'isolation'->'iso_vrms_max_mm_s' AS iso_isolated
                                FROM captures WHERE point_id=$1 AND ts BETWEEN $2 AND $3 AND ($4::text IS NULL OR profile=$4)
                                ORDER BY ts DESC LIMIT $5""", point_id, frm, to, profile, limit)
        lim = await _point_limits(c, point_id)
    return [rezone(dict(r), lim) if lim else dict(r) for r in rows]


async def _capture(request: Request, user: User, capture_id: str) -> dict:
    async with request.app.state.pool.acquire() as c:
        row = await c.fetchrow("SELECT * FROM captures WHERE capture_id=$1", capture_id)
    if not row:
        raise HTTPException(404, "Không tìm thấy capture")
    await check_point(request.app.state.pool, user, row["point_id"])
    return dict(row)


@router.get("/captures/{capture_id}")
async def capture_detail(capture_id: str, request: Request, user: User = Depends(current_user)):
    cap = await _capture(request, user, capture_id)
    async with request.app.state.pool.acquire() as c:
        lim = await _point_limits(c, cap["point_id"])
    return rezone(cap, lim) if lim else cap


async def _samples(request: Request, cap: dict) -> tuple[dict, np.ndarray]:
    if not cap.get("waveform_key"):
        raise HTTPException(404, "Capture không có sóng thô (gateway tắt send_waveforms?)")
    data = await request.app.state.storage.get(cap["waveform_key"])
    if not data:
        raise HTTPException(404, "Không đọc được sóng thô")
    return wavefile.decode(data)


@router.get("/captures/{capture_id}/waveform")
async def capture_waveform(capture_id: str, request: Request, axis: str = "x,y,z", max_points: int = Query(4096, le=65536),
                           user: User = Depends(require("engineer"))):
    cap = await _capture(request, user, capture_id)
    header, counts = await _samples(request, cap)
    g = counts.astype(float) * wavefile.G_PER_LSB
    step = max(1, math.ceil(len(g) / max_points))
    fs = float(header["fs_hz"])
    out = {"capture_id": capture_id, "fs_hz": fs, "frames": header.get("frames"), "unit": "g", "dt_s": step / fs,
           "frames_contiguous": header.get("frames_contiguous"), "axes": {}}
    for a in axis.split(","):
        if a in "xyz" and a:
            i = "xyz".index(a)
            out["axes"][a] = np.round(g[::step, i], 5).tolist()
    return out


def _markers(cap: dict, point: dict, machine: dict) -> list[dict]:
    f1 = cap.get("speed_hz") or (float(machine.get("rated_speed_rpm") or 0) / 60)
    out = [{"label": f"{k}X", "freq_hz": round(k * f1, 3), "kind": "order"} for k in (0.5, 1, 2, 3, 4, 5, 6)]
    lf = float(machine.get("line_freq_hz") or 50)
    out.append({"label": "2×f_line", "freq_hz": 2 * lf, "kind": "electrical"})
    if machine.get("male_lobes"):
        out.append({"label": "f_mesh", "freq_hz": round(machine["male_lobes"] * f1, 3), "kind": "mesh"})
    ff = ((cap.get("features") or {}).get("envelope") or {}).get("fault_freqs_hz") or \
        dsp.bearing_freqs(AssetCache.bearing_geom(point) or {}, f1)
    for k, v in (ff or {}).items():
        out.append({"label": k.upper(), "freq_hz": round(v, 3), "kind": "bearing"})
    return out


@router.get("/captures/{capture_id}/spectrum")
async def capture_spectrum(capture_id: str, request: Request, axis: str = "x", type: str = "vel", fmax: Optional[float] = None,
                           user: User = Depends(require("engineer"))):
    """type: acc (g RMS) | vel (mm/s RMS) | env (g peak) | iso (isolated velocity, Beer HN)."""
    cap = await _capture(request, user, capture_id)
    pool = request.app.state.pool
    async with pool.acquire() as c:
        point = dict(await c.fetchrow("""SELECT p.*, b.n_balls, b.bd_mm, b.pd_mm, b.contact_deg, b.bpfo_x, b.bpfi_x, b.bsf_x, b.ftf_x
                                         FROM measurement_points p LEFT JOIN bearings b ON b.id=p.bearing_id WHERE p.id=$1""",
                                      cap["point_id"]))
        machine = dict(await c.fetchrow("SELECT * FROM machines WHERE id=$1", point["machine_id"]))
    doc = None
    if cap.get("spectrum_key"):
        raw = await request.app.state.storage.get(cap["spectrum_key"])
        if raw:
            doc = json.loads(gzip.decompress(raw))
    if axis not in ("x", "y", "z"):
        raise HTTPException(400, "axis phải là x|y|z")
    if type == "env":
        if doc and doc.get("env"):
            df, vals = doc["env"]["df_hz"], doc["env"]["amp_g"][axis]
        else:
            header, counts = await _samples(request, cap)
            band = ((cap.get("features") or {}).get("envelope") or {}).get("band_hz") or [1000, 3000]
            fs = float(header["fs_hz"])
            x = wavefile.counts_to_ms2(counts)[:, "xyz".index(axis)]
            r = dsp.envelope(x[:1024 * int(header.get("frames") or 1)], fs, band[0], band[1])
            df, vals = r.df, r.amp_g.tolist()
        unit = "g"
    else:
        if doc:
            df, acc = doc["df_hz"], np.asarray(doc["acc"][axis], dtype=float)
            fs, n = doc["fs_hz"], doc["n_fft"]
        else:
            header, counts = await _samples(request, cap)
            fs = float(header["fs_hz"])
            frames = int(header.get("frames") or 1)
            x = wavefile.counts_to_ms2(counts)[:, "xyz".index(axis)]
            nf = len(x) // frames
            s = dsp.welch([dsp.compute_spectrum(x[i * nf:(i + 1) * nf], fs) for i in range(frames)])
            df, acc, n = s.df, s.amp, s.n
        f = np.arange(len(acc)) * df
        if type == "acc":
            vals, unit = (acc / dsp.G0).tolist(), "g"
        else:
            v = np.zeros_like(acc)
            lo = float(machine.get("iso_band_lo_hz") or 2) * 0.5
            m = f >= lo
            v[m] = acc[m] / (2 * np.pi * f[m]) * 1000
            unit = "mm/s"
            if type == "iso":
                iso = (cap.get("features") or {}).get("isolation") or {}
                ref_id = iso.get("reference_capture_id")
                alpha = ((machine.get("isolation") or {}).get("alpha") or {}).get(cap["point_id"]) or []
                if ref_id:
                    async with pool.acquire() as c:
                        rk = await c.fetchval("SELECT spectrum_key FROM captures WHERE capture_id=$1", ref_id)
                    rraw = await request.app.state.storage.get(rk) if rk else None
                    if rraw:
                        rdoc = json.loads(gzip.decompress(rraw))
                        ra = np.asarray(rdoc["acc"][axis], dtype=float)[: len(acc)]
                        t = dsp.Spectrum(fs, n, df, acc.copy(), acc.copy() ** 2)
                        r = dsp.Spectrum(fs, n, df, ra, ra ** 2)
                        isov = dsp.isolate(t, r, alpha).amp
                        v = np.zeros_like(isov)
                        v[m] = isov[m] / (2 * np.pi * f[m]) * 1000
            vals = v.tolist()
    if fmax:
        vals = vals[: int(fmax / df) + 1]
    return {"capture_id": capture_id, "axis": axis, "type": type, "unit": unit, "df_hz": df,
            "values": [round(x, 6) for x in vals], "speed_hz": cap.get("speed_hz"), "markers": _markers(cap, point, machine)}


@router.get("/points/{point_id}/waterfall")
async def waterfall(point_id: str, request: Request, rng=Depends(time_range), type: str = "vel", axis: str = "x",
                    profile: Optional[str] = None, bins: int = Query(400, le=2000), user: User = Depends(require("engineer"))):
    await check_point(request.app.state.pool, user, point_id)
    frm, to = rng
    async with request.app.state.pool.acquire() as c:
        caps = await c.fetch("""SELECT capture_id, ts, spectrum_key FROM captures WHERE point_id=$1 AND ts BETWEEN $2 AND $3
                                AND spectrum_key IS NOT NULL AND ($4::text IS NULL OR profile=$4) ORDER BY ts DESC LIMIT 40""",
                             point_id, frm, to, profile)
    out = []
    df = None
    for cap in reversed(caps):
        raw = await request.app.state.storage.get(cap["spectrum_key"])
        if not raw:
            continue
        doc = json.loads(gzip.decompress(raw))
        if type == "env" and doc.get("env"):
            arr, d = np.asarray(doc["env"]["amp_g"][axis]), doc["env"]["df_hz"]
        else:
            acc = np.asarray(doc["acc"][axis])
            d = doc["df_hz"]
            f = np.arange(len(acc)) * d
            arr = np.where(f > 1, acc / np.maximum(2 * np.pi * f, 1e-9) * 1000, 0) if type == "vel" else acc / dsp.G0
        arr = arr[:bins]
        df = d
        out.append({"capture_id": cap["capture_id"], "ts": cap["ts"].isoformat(), "df_hz": d, "values": np.round(arr, 5).tolist()})
    return {"point_id": point_id, "type": type, "axis": axis, "df_hz": df, "rows": out}
