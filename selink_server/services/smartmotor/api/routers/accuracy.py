"""Accuracy verification < 5 % (spec 9, screen 9) and PDF reports (screen 10)."""
from datetime import datetime
from typing import Optional

import numpy as np
from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import Response
from pydantic import BaseModel

from ...common import reports
from ..deps import User, audit, check_point, current_user, require

router = APIRouter(tags=["accuracy", "reports"])


class AccuracyIn(BaseModel):
    point_id: str
    ts: Optional[datetime] = None
    load_state: Optional[str] = None
    reference_device: Optional[str] = None
    reference_cert: Optional[str] = None
    quantity: str            # iso_vrms | acc_rms | amp_1x | peak_freq | temp
    axis: Optional[str] = None
    freq_hz: Optional[float] = None
    ref_value: float
    dut_value: Optional[float] = None   # if omitted, taken from capture_id features
    capture_id: Optional[str] = None
    operator: Optional[str] = None
    notes: Optional[str] = None


def _dut_from_capture(features: dict, quantity: str, axis: str | None) -> float | None:
    ax = (features.get("axes") or {}).get(axis or "x") or {}
    if quantity == "iso_vrms":
        return ax.get("iso_vrms_mm_s")
    if quantity == "acc_rms":
        return ax.get("acc_rms_g")
    if quantity == "amp_1x":
        return (ax.get("orders") or {}).get("1")
    return None


def error_pct(quantity: str, ref: float, dut: float) -> float:
    if quantity in ("temp", "peak_freq"):
        return abs(dut - ref)  # absolute (°C or Hz), judged separately
    return abs(dut - ref) / abs(ref) * 100 if ref else float("nan")


@router.get("/accuracy-tests")
async def list_tests(request: Request, point_id: Optional[str] = None, user: User = Depends(current_user)):
    async with request.app.state.pool.acquire() as c:
        rows = await c.fetch("""SELECT a.* FROM accuracy_tests a JOIN measurement_points p ON p.id=a.point_id
                                JOIN machines m ON m.id=p.machine_id WHERE m.site_id = ANY($1)
                                AND ($2::text IS NULL OR a.point_id=$2) ORDER BY a.ts DESC""", user.sites(), point_id)
    return [dict(r) for r in rows]


@router.post("/accuracy-tests", status_code=201)
async def add_tests(body: list[AccuracyIn], request: Request, user: User = Depends(require("analyst"))):
    pool = request.app.state.pool
    ids = []
    async with pool.acquire() as c:
        for t in body:
            await check_point(pool, user, t.point_id, "analyst")
            dut = t.dut_value
            if dut is None and t.capture_id:
                f = await c.fetchval("SELECT features FROM captures WHERE capture_id=$1", t.capture_id)
                dut = _dut_from_capture(f or {}, t.quantity, t.axis)
            if dut is None:
                raise HTTPException(400, f"Thiếu dut_value cho {t.quantity} (không suy ra được từ capture)")
            e = error_pct(t.quantity, t.ref_value, dut)
            ids.append(await c.fetchval(
                """INSERT INTO accuracy_tests (point_id, ts, load_state, reference_device, reference_cert, quantity, axis, freq_hz,
                     ref_value, dut_value, error_pct, capture_id, operator, notes)
                   VALUES ($1,COALESCE($2,now()),$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) RETURNING id""",
                t.point_id, t.ts, t.load_state, t.reference_device, t.reference_cert, t.quantity, t.axis, t.freq_hz,
                t.ref_value, dut, e, t.capture_id, t.operator or user.email, t.notes))
    await audit(pool, user, "accuracy.add", ",".join(map(str, ids)))
    return {"ids": ids}


def summarize(tests: list[dict]) -> list[dict]:
    """Spec 9.2: pass if mean(e) ≤ 5 % and P95(e) ≤ 8 %; temp ≤ 2 °C; peak frequency ≤ 1 bin (freq_hz holds Δf)."""
    groups: dict = {}
    for t in tests:
        groups.setdefault((t["quantity"], t.get("load_state")), []).append(t)
    out = []
    for (q, load), ts in sorted(groups.items(), key=lambda kv: (kv[0][0], kv[0][1] or "")):
        e = np.array([t["error_pct"] for t in ts if t["error_pct"] is not None], dtype=float)
        if len(e) == 0:
            continue
        mean, p95 = float(e.mean()), float(np.percentile(e, 95))
        if q == "temp":
            ok = bool((e <= 2).all())
        elif q == "peak_freq":
            ok = all(t["error_pct"] <= (t.get("freq_hz") or 0) for t in ts)  # freq_hz = Δf (bin width)
        else:
            ok = mean <= 5 and p95 <= 8
        out.append({"quantity": q, "load_state": load, "n": len(e), "mean_pct": mean, "p95_pct": p95, "pass": ok})
    return out


@router.get("/accuracy-tests/report")
async def accuracy_report(point_id: str, request: Request, format: str = "json", user: User = Depends(current_user)):
    pool = request.app.state.pool
    await check_point(pool, user, point_id)
    async with pool.acquire() as c:
        tests = [dict(r) for r in await c.fetch("SELECT * FROM accuracy_tests WHERE point_id=$1 ORDER BY ts", point_id)]
        point = dict(await c.fetchrow("SELECT * FROM measurement_points WHERE id=$1", point_id))
    summary = summarize(tests)
    if format == "pdf":
        pdf = reports.accuracy_report(point, tests, summary)
        return Response(pdf, media_type="application/pdf",
                        headers={"Content-Disposition": f'attachment; filename="bien-ban-sai-so-{point_id}.pdf"'})
    return {"point_id": point_id, "summary": summary, "n_tests": len(tests),
            "pass": bool(summary) and all(s["pass"] for s in summary)}


@router.get("/reports")
async def list_reports(request: Request, machine_id: Optional[str] = None, month: Optional[str] = None,
                       user: User = Depends(current_user)):
    async with request.app.state.pool.acquire() as c:
        rows = await c.fetch("""SELECT r.*, m.name AS machine_name FROM reports r JOIN machines m ON m.id=r.machine_id
                                WHERE m.site_id = ANY($1) AND ($2::text IS NULL OR r.machine_id=$2) AND ($3::text IS NULL OR r.period=$3)
                                ORDER BY r.period DESC, r.machine_id""", user.sites(), machine_id, month)
    return [dict(r) for r in rows]


@router.get("/reports/{report_id}/download")
async def download_report(report_id: int, request: Request, user: User = Depends(current_user)):
    async with request.app.state.pool.acquire() as c:
        r = await c.fetchrow("SELECT r.*, m.site_id FROM reports r JOIN machines m ON m.id=r.machine_id WHERE r.id=$1", report_id)
    if not r or r["site_id"] not in user.sites():
        raise HTTPException(404, "Không tìm thấy báo cáo")
    data = await request.app.state.storage.get(r["object_key"])
    if not data:
        raise HTTPException(404, "File báo cáo không còn")
    return Response(data, media_type="application/pdf",
                    headers={"Content-Disposition": f'attachment; filename="{r["machine_id"]}-{r["period"]}.pdf"'})
