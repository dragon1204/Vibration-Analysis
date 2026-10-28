"""CSV export laid out by the machine's installation model (e.g. DE + BASE).

One column block per sensor position of the model, in the model's order. Units are SI-derived
and stated in every header: acceleration mm/s², velocity mm/s, displacement µm, frequency Hz,
temperature °C. Times are Vietnam local time (GMT+7).

RMS values are computed by the gateway from the raw waveform (velocity in the ISO 10–1000 Hz band);
"đỉnh (cảm biến)" values are the WTVB05's own peak-type registers and are several times larger than
RMS, so they must not be compared with ISO limits.
"""
from __future__ import annotations

import bisect
from datetime import datetime, timedelta

G_MM_S2 = 9806.65  # 1 g in mm/s²
POSITIONS = ("DE", "NDE", "BASE", "LOAD")
LEGACY = {"S1": "LOAD", "S2": "BASE", "S3": "DE", "S4": "NDE", "COMP": "LOAD"}
DEFAULT_AXES = {"x": "axial", "y": "radial_h", "z": "radial_v"}
ROLE_VI = {"axial": "dọc trục", "radial_h": "ngang", "radial_v": "đứng"}
RMS_MAX_AGE = timedelta(seconds=10)  # fast RMS refreshes every ~1–3 s per sensor


def position_of(point: dict) -> str | None:
    """Mounting position code of a measurement point (DE, NDE, BASE, LOAD)."""
    loc = str(point.get("location") or "").strip().upper()
    loc = LEGACY.get(loc, loc)
    if loc in POSITIONS:
        return loc
    return "BASE" if point.get("role") == "base" else None


def slot_points(model_slots: list[dict] | None, points: list[dict]) -> list[tuple[str, dict | None]]:
    """(position, point) in the model's order; without a model, the installed positions in standard order."""
    by_pos: dict[str, dict] = {}
    for p in points:
        pos = position_of(p)
        if pos and pos not in by_pos:
            by_pos[pos] = p
    codes = [str(s.get("code") or "").upper() for s in model_slots or []]
    codes = [c for c in codes if c] or [c for c in POSITIONS if c in by_pos]
    return [(c, by_pos.get(c)) for c in codes]


def _axis_title(point: dict | None, axis: str) -> str:
    role = ((point or {}).get("axes_map") or DEFAULT_AXES).get(axis, DEFAULT_AXES[axis])
    return f"{axis.upper()} {ROLE_VI.get(role, role)}"


# (title, unit, row key prefix, source, digits, scale) — source "rms": gateway RMS, "reg": sensor register.
QUANTITIES = (
    ("Vận tốc RMS ISO 10-1000 Hz", "mm/s", "rms", "rms", 3, 1.0),
    ("Gia tốc RMS", "mm/s²", "arms", "rms", 1, G_MM_S2),
    ("Vận tốc đỉnh (cảm biến)", "mm/s", "vel", "reg", 2, 1.0),
    ("Gia tốc đỉnh (cảm biến)", "mm/s²", "acc", "reg", 1, G_MM_S2),
    ("Dịch chuyển đỉnh (cảm biến)", "µm", "disp", "reg", 0, 1.0),
    ("Tần số rung (cảm biến)", "Hz", "freq", "reg", 1, 1.0),
)
SLOT_COLUMNS = 3 * len(QUANTITIES) + 1


def header(slots: list[tuple[str, dict | None]]) -> list[str]:
    cols = ["Thời gian (GMT+7)", "Thiết bị"]
    for code, point in slots:
        for qty, unit, *_ in QUANTITIES:
            cols += [f"{code} {qty} {_axis_title(point, a)} ({unit})" for a in "xyz"]
        cols.append(f"{code} Nhiệt độ (°C)")
    return cols


def _num(v, digits: int, scale: float = 1.0):
    if v is None:
        return ""
    v = round(float(v) * scale, digits)
    return int(v) if digits == 0 else v


def slot_values(metric: dict | None, rms: dict | None) -> list:
    """The values of one position for one output row (sensor registers + gateway RMS)."""
    m, r = metric or {}, rms or {}
    out = []
    for _, _, key, source, digits, scale in QUANTITIES:
        src = r if source == "rms" else m
        out += [_num(src.get(f"{key}_{a}"), digits, scale) for a in "xyz"]
    return out + [_num(m.get("temp_c"), 2)]


def nearest(rows: list[dict], stamps: list[datetime], t: datetime, max_skew: timedelta) -> dict | None:
    if not rows:
        return None
    i = bisect.bisect_left(stamps, t)
    best = min((j for j in (i - 1, i) if 0 <= j < len(rows)), key=lambda j: abs(stamps[j] - t))
    return rows[best] if abs(stamps[best] - t) <= max_skew else None


def latest_before(rows: list[dict], stamps: list[datetime], t: datetime, max_age: timedelta = RMS_MAX_AGE) -> dict | None:
    """Most recent RMS result at or before t (carried forward while it is fresh)."""
    i = bisect.bisect_right(stamps, t) - 1
    return rows[i] if i >= 0 and t - stamps[i] <= max_age else None
