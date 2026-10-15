"""Measurement points, time series, captures, waveform, spectrum, waterfall (screens 2, 5, 6)."""
import asyncio
import gzip
import json
import math
from datetime import datetime, timedelta
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


def _harmonic_effect(order: int) -> str:
    if order == 1:
        return "Thành phần đồng bộ tốc độ quay; khi trội có thể liên quan mất cân bằng, lệch tâm hoặc cộng hưởng."
    if order == 2:
        return "2X lặp lại mạnh thường gợi ý lệch trục, trục cong hoặc lỏng cơ khí; cần đối chiếu pha và phương đo."
    if order <= 5:
        return "Nhiều hài 3X–5X thường đi cùng độ rơ, lỏng liên kết, cọ xát hoặc đáp ứng phi tuyến."
    return "Hài bậc cao có thể liên quan va đập tuần hoàn, tần số cánh/răng hoặc cộng hưởng; không kết luận lỗi chỉ từ biên độ."


def _harmonic_temporal(rows: list[dict]) -> dict:
    """Describe persistence and a robust amplitude trend for one harmonic.

    Trend uses only significant detections.  This avoids turning movement of the
    local noise floor into an apparent machine trend.  The median pairwise
    slope is deliberately used instead of least squares so a single impulsive
    capture cannot dominate the result.
    """
    ordered = sorted(rows, key=lambda row: row["ts"])
    found = [row for row in ordered if row.get("detected") and row.get("amplitude") is not None]
    longest = current = 0
    for row in ordered:
        current = current + 1 if row.get("detected") else 0
        longest = max(longest, current)

    ratios = [float(row["peak_floor_ratio"]) for row in found if row.get("peak_floor_ratio") is not None]
    result = {
        "longest_streak": longest,
        "persistence_pct": round(longest / len(ordered) * 100, 1) if ordered else 0.0,
        "first_detected_ts": found[0]["ts"] if found else None,
        "last_detected_ts": found[-1]["ts"] if found else None,
        "median_peak_floor_ratio": round(float(np.median(ratios)), 2) if ratios else None,
        "trend": "insufficient",
        "trend_pct": None,
        "slope_per_hour": None,
        "trend_points": len(found),
    }
    if len(found) < 4:
        return result

    amplitudes = np.asarray([float(row["amplitude"]) for row in found], dtype=float)
    split = max(2, len(amplitudes) // 2)
    early = float(np.median(amplitudes[:split]))
    late = float(np.median(amplitudes[-split:]))
    change_pct = (late - early) / early * 100 if early > 0 else None
    times = np.asarray([datetime.fromisoformat(row["ts"]).timestamp() / 3600 for row in found], dtype=float)
    slopes = [(amplitudes[j] - amplitudes[i]) / (times[j] - times[i])
              for i in range(len(found)) for j in range(i + 1, len(found)) if times[j] > times[i]]
    slope = float(np.median(slopes)) if slopes else None
    if change_pct is not None:
        result["trend"] = "rising" if change_pct >= 20 else "falling" if change_pct <= -20 else "stable"
        result["trend_pct"] = round(change_pct, 1)
    result["slope_per_hour"] = round(slope, 6) if slope is not None and math.isfinite(slope) else None
    return result


def _harmonic_findings(harmonics: list[dict]) -> list[dict]:
    """Conservative, evidence-backed screening patterns (not final diagnoses)."""
    by_order = {x["order"]: x for x in harmonics}
    one, two = by_order.get(1), by_order.get(2)
    higher = [x for x in harmonics if 3 <= x["order"] <= 8 and x["detections"]]
    findings = []
    if one and one["occurrence_pct"] >= 35:
        confidence = min(95, round(45 + one["occurrence_pct"] * 0.45))
        findings.append({"code": "rotational_1x", "title": "Kích thích đồng bộ 1X", "confidence": confidence,
                         "severity": "warning" if one["occurrence_pct"] >= 70 else "watch",
                         "evidence": f"1X xuất hiện {one['detections']}/{one['captures']} capture; đỉnh {one['peak_max']}.",
                         "action": "Kiểm tra cân bằng, độ đảo/lệch tâm và khả năng cộng hưởng; đối chiếu pha trước khi kết luận."})
    if two and two["occurrence_pct"] >= 25 and (two.get("relative_to_1x") or 0) >= 0.35:
        confidence = min(92, round(35 + two["occurrence_pct"] * 0.45 + min(two["relative_to_1x"], 1) * 20))
        findings.append({"code": "alignment_2x", "title": "Mẫu 2X cần kiểm tra đồng tâm", "confidence": confidence,
                         "severity": "warning" if two["relative_to_1x"] >= 0.7 else "watch",
                         "evidence": f"2X xuất hiện {two['occurrence_pct']}% và bằng {two['relative_to_1x']}× đỉnh 1X.",
                         "action": "Đo pha hướng tâm/dọc trục, kiểm tra đồng tâm khớp nối, trục cong và chân mềm."})
    recurring = [x for x in higher if x["occurrence_pct"] >= 25]
    if len(recurring) >= 2:
        avg_occurrence = float(np.mean([x["occurrence_pct"] for x in recurring]))
        findings.append({"code": "high_order_train", "title": "Chuỗi hài bậc cao lặp lại",
                         "confidence": min(90, round(38 + 8 * len(recurring) + avg_occurrence * 0.25)),
                         "severity": "warning" if len(recurring) >= 4 else "watch",
                         "evidence": f"{', '.join(x['label'] for x in recurring)} cùng lặp lại trong ≥25% capture.",
                         "action": "Kiểm tra độ rơ/lỏng bulông, cọ xát, khe hở và dạng sóng thời gian để tìm va đập."})
    growing = [x for x in harmonics if x.get("trend") == "rising" and x.get("trend_pct", 0) >= 25
               and x.get("occurrence_pct", 0) >= 25]
    if growing:
        strongest = max(growing, key=lambda x: x.get("trend_pct", 0))
        findings.append({"code": "rising_harmonic", "title": f"{strongest['label']} đang tăng theo thời gian",
                         "confidence": min(92, round(45 + strongest["occurrence_pct"] * 0.25
                                                     + min(strongest["trend_pct"], 100) * 0.2)),
                         "severity": "warning" if strongest["trend_pct"] >= 50 else "watch",
                         "evidence": f"Trung vị nửa sau cao hơn nửa đầu {strongest['trend_pct']}%; "
                                     f"chuỗi liên tiếp dài nhất {strongest['longest_streak']} capture.",
                         "action": "Rút ngắn chu kỳ theo dõi, kiểm tra tải/tốc độ cùng thời điểm và xác nhận lại bằng waveform, pha hoặc coherence."})
    return sorted(findings, key=lambda x: x["confidence"], reverse=True)


@router.get("/captures/{capture_id}/spectrum")
async def capture_spectrum(capture_id: str, request: Request, axis: str = "x", type: str = "vel", fmax: Optional[float] = None,
                           user: User = Depends(require("engineer"))):
    """type: acc (g RMS) | vel (mm/s RMS) | disp (µm) | env (g peak) | iso (isolated velocity, Beer HN)."""
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
        elif type == "disp":
            displacement = np.zeros_like(acc)
            mask = (f >= float(machine.get("iso_band_lo_hz") or 2) * 0.5) & (f > 0)
            displacement[mask] = acc[mask] / ((2 * np.pi * f[mask]) ** 2) * 1_000_000
            vals, unit = displacement.tolist(), "µm"
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


@router.get("/points/{point_id}/harmonic-analysis")
async def harmonic_analysis(point_id: str, request: Request, rng=Depends(time_range), axis: str = "x", type: str = "vel",
                            base_hz: Optional[float] = Query(None, gt=0), tolerance_pct: float = Query(15, ge=1, le=30),
                            max_order: int = Query(10, ge=1, le=30), prominence_ratio: float = Query(3, ge=1.2, le=10),
                            tracking: str = Query("capture", pattern="^(fixed|capture)$"),
                            limit: int = Query(300, ge=1, le=500), user: User = Depends(require("engineer"))):
    """Aggregate significant 1X…nX peaks with fixed-speed or per-capture order tracking."""
    await check_point(request.app.state.pool, user, point_id)
    if axis not in ("x", "y", "z"):
        raise HTTPException(400, "axis phải là x|y|z")
    if type not in ("vel", "acc", "disp", "env"):
        raise HTTPException(400, "type phải là vel|acc|disp|env")
    frm, to = rng
    async with request.app.state.pool.acquire() as c:
        point = dict(await c.fetchrow("SELECT * FROM measurement_points WHERE id=$1", point_id))
        machine = dict(await c.fetchrow("SELECT * FROM machines WHERE id=$1", point["machine_id"]))
        available = await c.fetchval("""SELECT count(*) FROM captures WHERE point_id=$1 AND ts BETWEEN $2 AND $3
                                         AND spectrum_key IS NOT NULL""", point_id, frm, to)
        caps = await c.fetch("""SELECT capture_id, ts, speed_hz, speed_confidence, fs_hz, spectrum_key
                                FROM captures WHERE point_id=$1 AND ts BETWEEN $2 AND $3
                                  AND spectrum_key IS NOT NULL
                                ORDER BY ts DESC LIMIT $4""", point_id, frm, to, limit)
    nominal_hz = float(machine.get("rated_speed_rpm") or 0) / 60
    f1x = float(base_hz or nominal_hz or machine.get("line_freq_hz") or 50)
    tolerance = tolerance_pct / 100
    unit = "g" if type in ("acc", "env") else "µm" if type == "disp" else "mm/s"
    details: list[dict] = []
    skipped = 0
    max_available_hz: list[float] = []
    resolutions_hz: list[float] = []
    bases_hz: list[float] = []
    capture_speeds_hz: list[float] = []
    semaphore = asyncio.Semaphore(8)

    async def load_spectrum(cap):
        async with semaphore:
            return cap, await request.app.state.storage.get(cap["spectrum_key"])

    loaded = await asyncio.gather(*(load_spectrum(cap) for cap in caps))
    for cap, raw in loaded:
        if not raw:
            skipped += 1
            continue
        try:
            doc = json.loads(gzip.decompress(raw))
            if type == "env":
                env = doc.get("env") or {}
                df = float(env["df_hz"])
                values = np.asarray(env["amp_g"][axis], dtype=float)
            else:
                df = float(doc["df_hz"])
                acc = np.asarray(doc["acc"][axis], dtype=float)
                if type == "acc":
                    values = acc / dsp.G0
                elif type == "disp":
                    freq = np.arange(len(acc)) * df
                    values = np.zeros_like(acc)
                    low = float(machine.get("iso_band_lo_hz") or 2) * 0.5
                    mask = (freq >= low) & (freq > 0)
                    values[mask] = acc[mask] / ((2 * np.pi * freq[mask]) ** 2) * 1_000_000
                else:
                    freq = np.arange(len(acc)) * df
                    values = np.zeros_like(acc)
                    low = float(machine.get("iso_band_lo_hz") or 2) * 0.5
                    mask = (freq >= low) & (freq > 0)
                    values[mask] = acc[mask] / (2 * np.pi * freq[mask]) * 1000
        except (KeyError, TypeError, ValueError, json.JSONDecodeError, OSError):
            skipped += 1
            continue
        capture_speed = float(cap["speed_hz"]) if cap["speed_hz"] is not None and float(cap["speed_hz"]) > 0 else None
        reliable_speed = capture_speed if cap["speed_confidence"] == "high" else None
        used_f1x = reliable_speed if tracking == "capture" and reliable_speed else f1x
        max_available_hz.append((len(values) - 1) * df)
        resolutions_hz.append(df)
        bases_hz.append(used_f1x)
        if reliable_speed:
            capture_speeds_hz.append(reliable_speed)
        for peak in dsp.harmonic_peaks(values, df, used_f1x, max_order, tolerance, prominence_ratio):
            clean_peak = {k: (round(v, 6) if math.isfinite(v) else None) if isinstance(v, float) else v
                          for k, v in peak.items()}
            details.append({
                "capture_id": cap["capture_id"], "ts": cap["ts"].isoformat(),
                "capture_speed_hz": round(capture_speed, 4) if capture_speed else None,
                "speed_confidence": cap["speed_confidence"],
                "base_hz_used": round(used_f1x, 4), "df_hz": round(df, 6),
                **clean_peak,
            })
    analyzed = len(caps) - skipped
    summary_f1x = float(np.median(bases_hz)) if bases_hz else f1x
    harmonics = []
    for order in range(1, max_order + 1):
        rows = [x for x in details if x["order"] == order]
        if not rows:
            continue
        found = [x for x in rows if x["detected"]]
        max_row = max(found, key=lambda x: x["amplitude"]) if found else None
        amps = [x["amplitude"] for x in found]
        occurrence = len(found) / analyzed * 100 if analyzed else 0
        harmonic = {
            "order": order, "label": f"{order}X", "target_hz": round(order * summary_f1x, 4),
            "band_hz": [round(order * summary_f1x * (1 - tolerance), 4), round(order * summary_f1x * (1 + tolerance), 4)],
            "detections": len(found), "captures": analyzed, "occurrence_pct": round(occurrence, 1),
            "peak_max": round(max(amps), 6) if amps else None,
            "peak_mean": round(float(np.mean(amps)), 6) if amps else None,
            "peak_p95": round(float(np.percentile(amps, 95)), 6) if amps else None,
            "peak_freq_hz": max_row["peak_hz"] if max_row else None,
            "peak_ts": max_row["ts"] if max_row else None,
            "peak_capture_id": max_row["capture_id"] if max_row else None,
            "level": "warning" if occurrence >= 60 else "watch" if occurrence >= 25 else "info" if found else "none",
            "effect": _harmonic_effect(order),
        }
        harmonic.update(_harmonic_temporal(rows))
        harmonics.append(harmonic)
    one_max = next((x["peak_max"] for x in harmonics if x["order"] == 1), None)
    for row in harmonics:
        row["relative_to_1x"] = round(row["peak_max"] / one_max, 3) if one_max and row["peak_max"] is not None else None
    min_fmax = min(max_available_hz) if max_available_hz else 0.0
    median_df = float(np.median(resolutions_hz)) if resolutions_hz else 0.0
    resolution_pct = median_df / summary_f1x * 100 if summary_f1x else 0.0
    covered_order = min(max_order, int(min_fmax // summary_f1x)) if summary_f1x else 0
    speed_coverage = len(capture_speeds_hz) / analyzed * 100 if analyzed else 0.0
    speed_spread = ((max(capture_speeds_hz) - min(capture_speeds_hz)) / float(np.median(capture_speeds_hz)) * 100
                    if len(capture_speeds_hz) > 1 and np.median(capture_speeds_hz) else 0.0)
    skipped_pct = skipped / len(caps) * 100 if caps else 0.0
    confidence_score = 100.0
    confidence_score -= min(35, skipped_pct * 0.7)
    confidence_score -= min(25, max(0.0, resolution_pct - 2) * 3)
    confidence_score -= max(0, max_order - covered_order) * 5
    if tracking == "capture":
        confidence_score -= max(0.0, 90 - speed_coverage) * 0.25
    confidence_score = round(max(0.0, min(100.0, confidence_score)))
    quality_issues = []
    if resolution_pct > 5:
        quality_issues.append(f"Độ phân giải FFT {median_df:.3f} Hz ({resolution_pct:.1f}% của 1X) còn thô; nên tăng độ dài waveform.")
    if covered_order < max_order:
        quality_issues.append(f"Phổ chỉ đủ phủ đến khoảng {covered_order}X; không đánh giá các bậc cao hơn.")
    if skipped:
        quality_issues.append(f"Bỏ qua {skipped} capture do thiếu hoặc lỗi dữ liệu phổ.")
    if tracking == "capture" and speed_coverage < 90:
        quality_issues.append(f"Chỉ {speed_coverage:.0f}% capture có tốc độ quay độ tin cậy cao; capture còn lại dùng 1X cố định.")
    if int(available or 0) > len(caps):
        quality_issues.append(f"Khoảng chọn có {available} capture; kết quả dùng {len(caps)} capture mới nhất theo giới hạn truy vấn.")
    findings = _harmonic_findings(harmonics)
    for finding in findings:
        finding["confidence"] = round(finding["confidence"] * confidence_score / 100)
    detected = [x for x in harmonics if x["detections"]]
    dominant = max(detected, key=lambda x: x["peak_max"]) if detected else None
    conclusions = []
    if not analyzed:
        conclusions.append("Không có capture chứa phổ trong khoảng đã chọn.")
    elif dominant:
        conclusions.append(f"{dominant['label']} có đỉnh lớn nhất {dominant['peak_max']} {unit} tại {dominant['peak_freq_hz']} Hz, xuất hiện trong {dominant['occurrence_pct']}% capture.")
    else:
        conclusions.append(f"Chưa có đỉnh nào vượt ngưỡng nổi bật {prominence_ratio}× nền phổ trong các dải hài đã chọn.")
    if quality_issues:
        conclusions.append(f"Chất lượng phân tích {confidence_score}/100; cần xem các cảnh báo chất lượng trước khi sử dụng kết quả.")
    conclusions.append("Kết quả là chỉ báo sàng lọc, không thay thế chẩn đoán có pha/coherence và kiểm tra cơ khí tại hiện trường.")
    return {
        "point_id": point_id, "point_name": point.get("name"), "axis": axis, "type": type, "unit": unit,
        "from": frm.isoformat(), "to": to.isoformat(),
        "settings": {"base_hz": round(f1x, 6), "representative_base_hz": round(summary_f1x, 6),
                     "tracking": tracking, "tolerance_pct": tolerance_pct, "max_order": max_order,
                     "prominence_ratio": prominence_ratio},
        "total_captures": int(available or 0), "selected_captures": len(caps), "analyzed_captures": analyzed,
        "skipped_captures": skipped, "truncated": int(available or 0) > len(caps),
        "max_available_hz": round(min_fmax, 3) if max_available_hz else None,
        "quality": {"score": confidence_score, "grade": "high" if confidence_score >= 80 else "medium" if confidence_score >= 60 else "low",
                    "resolution_hz": round(median_df, 6), "resolution_pct_1x": round(resolution_pct, 2),
                    "covered_order": covered_order, "speed_coverage_pct": round(speed_coverage, 1),
                    "speed_spread_pct": round(speed_spread, 1), "issues": quality_issues},
        "harmonics": harmonics, "details": details, "findings": findings, "conclusions": conclusions,
    }


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
