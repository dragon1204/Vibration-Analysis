"""Machine condition reports (screen 10).

Lifecycle: POST creates a row in status ``queued`` and returns 202 with its id; the analytics
service builds it (``running`` → ``done`` | ``failed``). Clients poll ``GET /reports/{id}``
and download the PDF once ``status == "done"``. ``GET /reports/{id}/data`` returns the same
assessment as machine-readable JSON.
"""
from __future__ import annotations

from datetime import datetime
from typing import Literal, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response
from pydantic import BaseModel, Field

from ...common import bus
from ...common.report_analysis import period_bounds
from ..deps import ROLE_RANK, User, audit, check_machine, current_user, require

router = APIRouter(tags=["reports"])

Status = Literal["queued", "running", "done", "failed"]
_META = """r.id, r.machine_id, m.name AS machine_name, r.period, r.period_type, r.period_start, r.period_end, r.status,
           r.error, r.requested_by, r.created_at, r.started_at, r.finished_at, r.size_bytes, r.summary, r.format_version"""


class ReportCreate(BaseModel):
    machine_id: str
    period_type: Literal["month", "quarter", "custom"]
    period: Optional[str] = Field(None, description="YYYY-MM (month) hoặc YYYY-Qn (quarter)", examples=["2026-10", "2026-Q4"])
    frm: Optional[datetime] = Field(None, alias="from", description="custom: thời điểm bắt đầu (ISO 8601)")
    to: Optional[datetime] = Field(None, description="custom: thời điểm kết thúc, không bao gồm (ISO 8601)")

    model_config = {"populate_by_name": True}


def _out(row) -> dict:
    d = dict(row)
    d["links"] = {"self": f"/api/v1/reports/{d['id']}", "data": f"/api/v1/reports/{d['id']}/data",
                  "download": f"/api/v1/reports/{d['id']}/download" if d["status"] == "done" else None}
    return d


async def _get(request: Request, user: User, report_id: int, cols: str = _META) -> dict:
    async with request.app.state.pool.acquire() as c:
        row = await c.fetchrow(f"SELECT {cols}, m.site_id FROM reports r JOIN machines m ON m.id=r.machine_id WHERE r.id=$1",
                               report_id)
    if not row or row["site_id"] not in user.sites():
        raise HTTPException(404, "Không tìm thấy báo cáo")
    return dict(row)


@router.post("/reports", status_code=202)
async def create_report(body: ReportCreate, request: Request, user: User = Depends(require("analyst"))):
    """Queue one report for one machine and period. Returns immediately with the report id."""
    pool = request.app.state.pool
    await check_machine(pool, user, body.machine_id, "analyst")
    try:
        start, end, label = period_bounds(body.period_type, body.period, body.frm, body.to)
    except ValueError as e:
        raise HTTPException(422, str(e)) from e
    async with pool.acquire() as c:
        busy = await c.fetchval("""SELECT id FROM reports WHERE machine_id=$1 AND period_start=$2 AND period_end=$3
                                     AND status IN ('queued','running')""", body.machine_id, start, end)
        if busy:
            raise HTTPException(409, f"Báo cáo cho kỳ này đang được tạo (id {busy})")
        tenant = await c.fetchval("SELECT s.tenant_id FROM machines m JOIN sites s ON s.id=m.site_id WHERE m.id=$1",
                                  body.machine_id)
        rid = await c.fetchval("""INSERT INTO reports (tenant_id, machine_id, period, period_type, period_start, period_end,
                                     status, requested_by, format_version) VALUES ($1,$2,$3,$4,$5,$6,'queued',$7,2) RETURNING id""",
                               tenant, body.machine_id, label, body.period_type, start, end, user.email)
        row = await c.fetchrow(f"SELECT {_META} FROM reports r JOIN machines m ON m.id=r.machine_id WHERE r.id=$1", rid)
    await bus.publish(request.app.state.redis, "analytics:cmd", {"job": "report_build", "report_id": rid})
    await audit(pool, user, "report.create", body.machine_id, {"report_id": rid, "period": label})
    return _out(row)


@router.get("/reports")
async def list_reports(request: Request, machine_id: Optional[str] = None,
                       period: Optional[str] = Query(None, description="Lọc đúng nhãn kỳ, ví dụ 2026-10 hoặc 2026-Q4"),
                       month: Optional[str] = Query(None, deprecated=True, description="Tên cũ của period"),
                       status: Optional[Status] = None,
                       limit: int = Query(50, ge=1, le=200), offset: int = Query(0, ge=0),
                       user: User = Depends(current_user)):
    """Paged list, newest first: ``{items, total, limit, offset}``."""
    period = period or month
    args = (user.sites(), machine_id, period, status)
    where = """m.site_id = ANY($1) AND ($2::text IS NULL OR r.machine_id=$2) AND ($3::text IS NULL OR r.period=$3)
               AND ($4::text IS NULL OR r.status=$4)"""
    async with request.app.state.pool.acquire() as c:
        total = await c.fetchval(f"SELECT count(*) FROM reports r JOIN machines m ON m.id=r.machine_id WHERE {where}", *args)
        rows = await c.fetch(f"""SELECT {_META} FROM reports r JOIN machines m ON m.id=r.machine_id WHERE {where}
                                 ORDER BY r.created_at DESC, r.id DESC LIMIT $5 OFFSET $6""", *args, limit, offset)
    return {"items": [_out(r) for r in rows], "total": total, "limit": limit, "offset": offset}


@router.get("/reports/{report_id}")
async def get_report(report_id: int, request: Request, user: User = Depends(current_user)):
    """Status and summary of one report (poll this after POST)."""
    d = await _get(request, user, report_id)
    d.pop("site_id", None)
    return _out(d)


@router.get("/reports/{report_id}/data")
async def report_data(report_id: int, request: Request, user: User = Depends(current_user)):
    """Full assessment as JSON (statistics, zone shares, daily series, orders, findings, events, limitations)."""
    d = await _get(request, user, report_id, _META + ", r.analysis")
    if d["status"] != "done":
        raise HTTPException(409, f"Báo cáo chưa sẵn sàng (trạng thái {d['status']})")
    if d.get("analysis") is None:
        raise HTTPException(404, "Báo cáo tạo bằng phiên bản cũ, không có dữ liệu phân tích")
    return {"id": d["id"], "machine_id": d["machine_id"], "period": d["period"], "period_start": d["period_start"],
            "period_end": d["period_end"], "format_version": d["format_version"], "analysis": d["analysis"]}


@router.get("/reports/{report_id}/download")
async def download_report(report_id: int, request: Request, user: User = Depends(current_user)):
    d = await _get(request, user, report_id, _META + ", r.object_key")
    if d["status"] != "done":
        raise HTTPException(409, f"Báo cáo chưa sẵn sàng (trạng thái {d['status']})")
    data = await request.app.state.storage.get(d["object_key"]) if d.get("object_key") else None
    if not data:
        raise HTTPException(410, "File báo cáo không còn trong kho lưu trữ")
    return Response(data, media_type="application/pdf",
                    headers={"Content-Disposition": f'attachment; filename="{d["machine_id"]}-{d["period"]}-{report_id}.pdf"'})


@router.post("/reports/{report_id}/retry", status_code=202)
async def retry_report(report_id: int, request: Request, user: User = Depends(require("analyst"))):
    """Rebuild a failed report with the same machine and period."""
    d = await _get(request, user, report_id)
    if d["status"] != "failed":
        raise HTTPException(409, "Chỉ tạo lại được báo cáo lỗi")
    async with request.app.state.pool.acquire() as c:
        await c.execute("UPDATE reports SET status='queued', error=NULL WHERE id=$1", report_id)
    await bus.publish(request.app.state.redis, "analytics:cmd", {"job": "report_build", "report_id": report_id})
    return {"id": report_id, "status": "queued"}


@router.delete("/reports/{report_id}", status_code=204)
async def delete_report(report_id: int, request: Request, user: User = Depends(current_user)):
    d = await _get(request, user, report_id, _META + ", r.object_key")
    if user.role_for_site(d["site_id"]) < ROLE_RANK["admin"]:
        raise HTTPException(403, "Chỉ admin được xóa báo cáo")
    if d["status"] in ("queued", "running"):
        raise HTTPException(409, "Báo cáo đang được tạo")
    if d.get("object_key"):
        try:
            await request.app.state.storage.delete(d["object_key"])
        except Exception:  # the row is the source of truth; a missing object must not block deletion
            pass
    async with request.app.state.pool.acquire() as c:
        await c.execute("DELETE FROM reports WHERE id=$1", report_id)
    await audit(request.app.state.pool, user, "report.delete", d["machine_id"], {"report_id": report_id})
    return Response(status_code=204)
