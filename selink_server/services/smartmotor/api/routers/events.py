"""Events / alarms workflow (screen 7): raised → acknowledged → diagnosed → resolved → closed."""
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from pydantic import BaseModel

from ...common import bus
from ..deps import User, audit, current_user, time_range
from ..security import ROLE_RANK

router = APIRouter(tags=["events"])

STATES = ["raised", "acknowledged", "diagnosed", "resolved", "closed"]
STATE_ROLE = {"acknowledged": "operator", "diagnosed": "engineer", "resolved": "engineer", "closed": "engineer",
              "raised": "engineer"}


@router.get("/events")
async def list_events(request: Request, site_id: Optional[str] = None, machine_id: Optional[str] = None,
                      severity: Optional[str] = None, state: Optional[str] = None, type: Optional[str] = None,
                      rng=Depends(time_range), limit: int = Query(500, le=5000), user: User = Depends(current_user)):
    sites = [site_id] if site_id else user.sites()
    sites = [s for s in sites if s in user.sites()]
    frm, to = rng
    async with request.app.state.pool.acquire() as c:
        rows = await c.fetch(
            """SELECT e.*, m.name AS machine_name, m.site_id FROM events e
               LEFT JOIN machines m ON m.id = e.machine_id
               LEFT JOIN gateways g ON g.id = e.gateway_id
               WHERE (m.site_id = ANY($1) OR g.site_id = ANY($1))
                 AND ($2::text IS NULL OR e.machine_id = $2)
                 AND ($3::text[] IS NULL OR e.severity = ANY($3))
                 AND ($4::text[] IS NULL OR e.state = ANY($4))
                 AND ($5::text IS NULL OR e.type = $5)
                 AND e.ts BETWEEN $6 AND $7
               ORDER BY e.ts DESC LIMIT $8""",
            sites, machine_id, severity.split(",") if severity else None, state.split(",") if state else None, type,
            frm, to, limit)
    return [dict(r) for r in rows]


async def _event(request: Request, user: User, event_id: str) -> dict:
    async with request.app.state.pool.acquire() as c:
        row = await c.fetchrow("""SELECT e.*, COALESCE(m.site_id, g.site_id) AS site_id FROM events e
                                  LEFT JOIN machines m ON m.id=e.machine_id LEFT JOIN gateways g ON g.id=e.gateway_id
                                  WHERE e.event_id=$1""", event_id)
    if not row:
        raise HTTPException(404, "Không tìm thấy sự kiện")
    if row["site_id"] and user.role_for_site(row["site_id"]) < 1:
        raise HTTPException(403, "Không đủ quyền")
    return dict(row)


@router.get("/events/{event_id}")
async def get_event(event_id: str, request: Request, user: User = Depends(current_user)):
    ev = await _event(request, user, event_id)
    async with request.app.state.pool.acquire() as c:
        cap = None
        if ev.get("capture_id"):
            cap = await c.fetchrow("SELECT capture_id, ts, profile, iso_vrms_max_mm_s, iso_zone FROM captures WHERE capture_id=$1",
                                   ev["capture_id"])
        diag = await c.fetch("SELECT * FROM diagnoses WHERE event_id=$1 ORDER BY ts DESC", event_id)
    return {**ev, "capture": dict(cap) if cap else None, "diagnoses": [dict(d) for d in diag]}


class EventPatch(BaseModel):
    state: Optional[str] = None
    comment: Optional[str] = None
    feedback: Optional[dict] = None   # {"verdict": "correct|wrong|other", "actual_fault": "...", "note": "..."}


@router.patch("/events/{event_id}")
async def patch_event(event_id: str, body: EventPatch, request: Request, user: User = Depends(current_user)):
    ev = await _event(request, user, event_id)
    role = user.role_for_site(ev["site_id"]) if ev.get("site_id") else ROLE_RANK.get(user.max_role, 0)
    now = datetime.now(timezone.utc)
    sets, args = [], [event_id]

    def add(col, val):
        args.append(val)
        sets.append(f"{col}=${len(args)}")

    if body.state:
        if body.state not in STATES:
            raise HTTPException(400, "Trạng thái không hợp lệ")
        if role < ROLE_RANK[STATE_ROLE[body.state]]:
            raise HTTPException(403, "Không đủ quyền chuyển trạng thái")
        add("state", body.state)
        if body.state == "acknowledged":
            add("ack_by", user.email)
            add("ack_at", now)
        if body.state in ("resolved", "closed"):
            add("resolved_at", now)
    if body.feedback is not None:
        if role < ROLE_RANK["engineer"]:
            raise HTTPException(403, "Cần quyền kỹ sư để phản hồi chẩn đoán")
        add("feedback", {**body.feedback, "by": user.email, "ts": now.isoformat()})
    if body.comment:
        comments = list(ev.get("comments") or []) + [{"by": user.email, "ts": now.isoformat(), "text": body.comment}]
        add("comments", comments)
    if sets:
        async with request.app.state.pool.acquire() as c:
            await c.execute(f"UPDATE events SET {', '.join(sets)} WHERE event_id=$1", *args)
        await audit(request.app.state.pool, user, "event.update", event_id, body.model_dump(exclude_none=True))
        await bus.publish(request.app.state.redis, "rt:events", {"type": "event_update", "event_id": event_id,
                                                                  **body.model_dump(exclude_none=True)})
    return {"ok": True}
