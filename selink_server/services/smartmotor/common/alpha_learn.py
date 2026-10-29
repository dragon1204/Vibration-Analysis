"""Learn the BASE → bearing transmissibility α from a window where the machine itself is stopped.

With the machine stopped and neighbouring machines running, the vibration at the bearing (DE)
comes only from the foundation, so α = RMS(DE) / RMS(BASE) per axis. Samples of the two sensors
are paired when their RMS results are less than PAIR_S apart (the sensors are read in turn).
The result is rejected when the foundation vibration is too close to the sensor noise floor.
"""
from __future__ import annotations

import bisect
import statistics
from datetime import datetime

PAIR_S = 3.0
NOISE_FLOOR_MM_S = 0.06      # measured RMS of a stopped, quiet installation (pump-tg-01, 2026-10-28)
MIN_BASE_MM_S = 0.15         # BASE must be well above the noise floor for a meaningful ratio
MIN_PAIRS = 30
MAX_RUNNING_SHARE = 0.05     # the machine itself must be stopped


def pair(de: list[tuple[datetime, float]], base: list[tuple[datetime, float]]) -> list[tuple[float, float]]:
    """(DE, BASE) value pairs whose timestamps are within PAIR_S."""
    if not de or not base:
        return []
    bt = [t for t, _ in base]
    out = []
    for t, v in de:
        i = bisect.bisect_left(bt, t)
        cand = [j for j in (i - 1, i) if 0 <= j < len(bt)]
        j = min(cand, key=lambda j: abs((bt[j] - t).total_seconds()))
        if abs((bt[j] - t).total_seconds()) <= PAIR_S:
            out.append((v, base[j][1]))
    return out


def learn_axis(pairs: list[tuple[float, float]]) -> dict:
    """α of one axis with the quality figures shown to the user."""
    usable = [(d, b) for d, b in pairs if b and b > 0 and d is not None]
    if len(usable) < MIN_PAIRS:
        return {"alpha": None, "pairs": len(usable), "reason": f"chỉ có {len(usable)} cặp mẫu (cần ≥ {MIN_PAIRS})"}
    ratios = [d / b for d, b in usable]
    base_med = statistics.median(b for _, b in usable)
    de_med = statistics.median(d for d, _ in usable)
    alpha = statistics.median(ratios)
    q = statistics.quantiles(ratios, n=4)
    out = {"alpha": round(alpha, 3), "pairs": len(usable), "base_mm_s": round(base_med, 3), "de_mm_s": round(de_med, 3),
           "spread": [round(q[0], 3), round(q[2], 3)], "reason": None}
    if base_med < MIN_BASE_MM_S:
        out["reason"] = (f"rung BASE {base_med:.3f} mm/s quá sát nhiễu cảm biến (~{NOISE_FLOOR_MM_S} mm/s); "
                         f"cần ≥ {MIN_BASE_MM_S} mm/s, tức các máy lân cận phải đang chạy")
        out["alpha"] = None
        out["alpha_raw"] = round(alpha, 3)
    return out


def combine(axes: dict[str, dict], iso_axes: list[str]) -> float | None:
    """One α for the bearing correction: mean of the valid ISO (radial) axes."""
    vals = [axes[a]["alpha"] for a in iso_axes if axes.get(a, {}).get("alpha") is not None]
    if not vals:
        return None
    return round(min(2.0, max(0.05, sum(vals) / len(vals))), 3)
