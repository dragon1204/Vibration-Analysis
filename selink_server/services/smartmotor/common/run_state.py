"""Server-side RUN/STOP from vibration for gateways that do not publish ``metrics/run``.

Mirrors the edge rule (t153_edge/internal/agent/machine.go): selected axes of each source
are compared with its threshold; mode "any" runs when one source is above, mode "all" stops
as soon as one source is below. A change is confirmed after on/off delay. As soon as the
gateway publishes its own run state, the server stops deriving one for that machine.
"""
from __future__ import annotations

import math
from datetime import datetime, timedelta

AXES = ("x", "y", "z")
LEGACY_THRESHOLD = 0.3
HEARTBEAT = timedelta(seconds=60)      # keeps the state fresh for the web (stale after 180 s)
GATEWAY_HOLD = timedelta(minutes=10)   # gateway run state wins for this long after its last message
SOURCE = "server_vibration"


def rule_of(meta: dict | None) -> dict:
    meta = meta or {}
    rule = meta.get("run_detection") or {}
    return {
        "mode": rule.get("mode") or "any",
        "sources": rule.get("sources") or [],
        "on_delay_s": float(rule.get("on_delay_s") or 10),
        "off_delay_s": float(rule.get("off_delay_s") or 10),
        "legacy": float(meta.get("running_vrms_mm_s") or LEGACY_THRESHOLD),
    }


def _above(values: dict, axes, threshold: float) -> bool:
    for axis in axes or AXES:
        v = values.get(axis)
        if v is not None and not math.isnan(v) and v > threshold:
            return True
    return False


def matched(rule: dict, latest: dict[str, dict]) -> bool:
    """RUN condition on the latest per-point velocities; points without data are ignored."""
    if not rule["sources"]:
        return any(_above(v, AXES, rule["legacy"]) for v in latest.values())
    every = rule["mode"] == "all"
    seen = 0
    for source in rule["sources"]:
        values = latest.get(source.get("point_id"))
        if values is None:
            continue
        seen += 1
        above = _above(values, source.get("axes"), float(source.get("threshold_mm_s") or rule["legacy"]))
        if above and not every:
            return True
        if not above and every:
            return False
    return every and seen > 0


class RunTracker:
    def __init__(self):
        self.latest: dict[str, dict[str, dict]] = {}
        self.state: dict[str, dict] = {}
        self.gateway_seen: dict[str, datetime] = {}

    def gateway_run(self, machine_id: str, ts: datetime) -> None:
        self.gateway_seen[machine_id] = ts

    def observe(self, machine: dict, point_id: str, ts: datetime, vel: dict) -> tuple[datetime, bool] | None:
        """Record one velocity sample; return (ts, running) when a state row should be written."""
        mid = machine["id"]
        seen = self.gateway_seen.get(mid)
        if seen is not None and ts - seen < GATEWAY_HOLD:
            return None
        self.latest.setdefault(mid, {})[point_id] = vel
        rule = rule_of(machine.get("meta"))
        now = matched(rule, self.latest[mid])
        st = self.state.setdefault(mid, {"running": None, "cand": None, "since": None, "emitted": None})
        if now == st["running"]:
            st["cand"] = st["since"] = None
        else:
            if st["cand"] != now:
                st["cand"], st["since"] = now, ts
            delay = rule["on_delay_s"] if now else rule["off_delay_s"]
            if (ts - st["since"]).total_seconds() >= delay:
                st["running"], st["cand"], st["since"] = now, None, None
                st["emitted"] = ts
                return ts, now
        if st["running"] is not None and (st["emitted"] is None or ts - st["emitted"] >= HEARTBEAT):
            st["emitted"] = ts
            return ts, st["running"]
        return None
