"""Measurement-time checks for data from gateways without a battery-backed clock.

The gateway corrects data measured before its clock was verified and reports the step in
``time_corrected_s``. Data it could not correct arrives with ``time_unsynced``; the server then
uses the gateway clock error seen on its health messages (server receive time − gateway time,
only while the gateway itself reports an unverified clock and its outbox is empty, so delivery
delay is not mistaken for clock error). Every such row keeps a flag for the CSV export.
"""
from __future__ import annotations

from datetime import datetime, timedelta, timezone

MIN_STEP_S = 2.0
MAX_OUTBOX_FOR_OFFSET = 25  # a backlog means old health messages: their age is delay, not clock error


def flag_corrected(step_s: float, by: str) -> str:
    return f"time_corrected:{by}:{step_s:+.1f}"


class ClockWatch:
    def __init__(self):
        self.offsets: dict[str, float] = {}

    def observe_health(self, gateway: str, ts: datetime, unsynced: bool, outbox: int | None,
                       now: datetime | None = None) -> float:
        """Record the gateway clock error from a health message; returns server − gateway in seconds."""
        now = now or datetime.now(timezone.utc)
        offset = round((now - ts).total_seconds(), 1)
        if unsynced and (outbox or 0) <= MAX_OUTBOX_FOR_OFFSET:
            self.offsets[gateway] = offset
        elif not unsynced:
            self.offsets.pop(gateway, None)
        return offset

    def apply(self, gateway: str, data) -> None:
        """Flag (and, for uncorrected data, shift) the measurement time of one message in place."""
        extra = getattr(data, "model_extra", None) or {}
        note = None
        step = extra.get("time_corrected_s")
        if isinstance(step, (int, float)) and step != 0:
            note = flag_corrected(float(step), "gateway")
        elif extra.get("time_unsynced"):
            offset = self.offsets.get(gateway)
            if offset is not None and abs(offset) >= MIN_STEP_S and hasattr(data, "ts"):
                data.ts = data.ts + timedelta(seconds=offset)
                note = flag_corrected(offset, "server")
            else:
                note = "time_unsynced"
        if note:
            for flags in (getattr(data, "flags", None), getattr(data, "quality_flags", None)):
                if isinstance(flags, list) and note not in flags:
                    flags.append(note)


def describe(flags: list[str] | None) -> str:
    """CSV text for the time note of one row ('' when the time was verified)."""
    for f in flags or []:
        if f.startswith("time_corrected:"):
            _, by, step = f.split(":", 2)
            return f"đã hiệu chỉnh {step} s ({'gateway' if by == 'gateway' else 'server'})"
        if f == "time_unsynced":
            return "giờ chưa đồng bộ"
    return ""
