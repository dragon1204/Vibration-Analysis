"""Plausibility checks applied to harmonic screening before it is shown as a finding.

Three things made the 1X…nX screening misleading on a mains-fed pump (pump-tg-01, 2026-10-29):

* the per-capture speed estimate locked onto the 50 Hz supply component (an induction motor
  cannot run at synchronous speed), so "1X" was really the electrical line frequency;
* with a 3.9 Hz FFT bin and a ±15 % search band, 1X/2X cannot be told apart from 50/100 Hz
  electrical components, so "2X → misalignment" may be 2×line magnetic vibration;
* most of the bearing's vibration came up from the foundation (BASE), which a single-point
  analysis attributes to the bearing.

These helpers mark such cases and soften the findings instead of hiding them.
"""
from __future__ import annotations

import math

TRANSMITTED_SHARE = 0.7   # α·BASE explains ≥ 70 % of the order amplitude → mainly transmitted


def plausible_speed(speed_hz: float | None, line_hz: float | None, poles: int | None, df_hz: float) -> float | None:
    """The capture speed estimate, or None when it is the supply frequency or above synchronous speed."""
    if not speed_hz or speed_hz <= 0:
        return None
    line = float(line_hz or 0)
    if line > 0:
        tol = max(df_hz, 0.3)
        if any(abs(speed_hz - k * line) <= tol for k in (1, 2)):
            return None
        if poles and poles >= 2 and speed_hz > 2 * line / poles * 1.005:
            return None
    return speed_hz


def line_overlap(order: int, f1x: float, tolerance: float, df_hz: float, line_hz: float | None) -> list[float]:
    """Electrical frequencies (k × line, k = 1…4) that fall inside the search band of an order."""
    line = float(line_hz or 0)
    if line <= 0 or f1x <= 0:
        return []
    target = order * f1x
    lo, hi = target * (1 - tolerance) - df_hz, target * (1 + tolerance) + df_hz
    return [k * line for k in (1, 2, 3, 4) if lo <= k * line <= hi]


def own_amplitude(bearing: float | None, base: float | None, alpha: float | None) -> tuple[float | None, float | None]:
    """(own amplitude √(B² − (α·BASE)²), share of the bearing amplitude explained by α·BASE)."""
    if bearing is None or base is None or alpha is None or alpha <= 0 or bearing <= 0:
        return None, None
    transmitted = alpha * base
    own = math.sqrt(max(0.0, bearing * bearing - transmitted * transmitted))
    return own, min(1.0, transmitted / bearing)


def review(findings: list[dict], harmonics: list[dict], iso_median: float | None, zone_ab: float | None) -> list[dict]:
    """Annotate and soften findings that electrical overlap, transmission or a healthy level explain."""
    by_order = {h["order"]: h for h in harmonics}
    healthy = iso_median is not None and zone_ab is not None and iso_median < zone_ab
    for f in findings:
        notes, factor = [], 1.0
        rows = [by_order[o] for o in f.get("orders", []) if o in by_order]
        lines = sorted({hz for h in rows for hz in h.get("line_overlap_hz") or []})
        if lines:
            notes.append("trùng tần số điện " + "/".join(f"{hz:g}" for hz in lines)
                         + " Hz; độ phân giải hiện tại không tách được cơ khí và điện")
            factor *= 0.5
        shares = [h["transmitted_share"] for h in rows if h.get("transmitted_share") is not None]
        if shares and min(shares) >= TRANSMITTED_SHARE:
            notes.append(f"khoảng {round(min(shares) * 100)}% biên độ là rung truyền từ đế (α·BASE)")
            factor *= 0.5
        if healthy:
            notes.append(f"RMS ISO trung vị {iso_median:.2f} mm/s vẫn ở vùng A (< {zone_ab:g})")
        if notes:
            f["evidence"] = f["evidence"] + " Lưu ý: " + "; ".join(notes) + "."
        if factor < 1:
            f["confidence"] = round(f["confidence"] * factor)
        if factor < 1 or healthy:
            f["severity"] = "watch"
            f["action"] = "Chỉ theo dõi, chưa đủ cơ sở can thiệp. " + f["action"]
        f["caveats"] = notes
    return sorted(findings, key=lambda x: x["confidence"], reverse=True)
