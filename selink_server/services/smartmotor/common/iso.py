"""ISO 20816-3 zones, narrowband limits and RSS constraint (spec 5.8, 13.2; Beer HN slides 18–21)."""
from __future__ import annotations

import math
from dataclasses import dataclass


@dataclass(frozen=True)
class ISOLimits:
    ab: float
    bc: float
    cd: float

    def zone(self, v: float | None) -> str | None:
        if v is None or math.isnan(v):
            return None
        if v <= self.ab:
            return "A"
        if v <= self.bc:
            return "B"
        if v <= self.cd:
            return "C"
        return "D"

    def criterion2_threshold(self, mode: str = "spec") -> float:
        if mode == "beerhn":
            return 0.25 * (self.bc - self.ab)
        return 0.25 * self.bc


def iso_limits(group: int | None, foundation: str | None) -> ISOLimits:
    flexible = foundation == "flexible"
    if group == 1:
        return ISOLimits(3.5, 7.1, 11.0) if flexible else ISOLimits(2.3, 4.5, 7.1)
    return ISOLimits(2.3, 4.5, 7.1) if flexible else ISOLimits(1.4, 2.8, 4.5)


DEFAULT_BAND_LIMITS = [
    {"band": "1x", "warn": 1.5, "alarm": 2.3},
    {"band": "2x", "warn": 1.0, "alarm": 1.8},
    {"band": "3x4x", "warn": 0.8, "alarm": 1.5},
    {"band": "bpfo", "warn": 0.5, "alarm": 1.0},
    {"band": "bpfi", "warn": 0.4, "alarm": 0.8},
]


def enforce_rss(limits: list[dict], zone_bc: float) -> tuple[list[dict], float]:
    """Scale limits so sqrt(sum(alarm^2)) <= zone B/C."""
    rss = math.sqrt(sum(l["alarm"] ** 2 for l in limits))
    if rss <= zone_bc or rss == 0:
        return [dict(l) for l in limits], 1.0
    k = zone_bc / rss
    return [{**l, "warn": l["warn"] * k, "alarm": l["alarm"] * k} for l in limits], k


def baseline_limits(method: str, center: float, spread: float, warn_k: float | None = None,
                    alarm_k: float | None = None) -> tuple[float, float]:
    """method 'mad' (spec): med + k·1.4826·MAD (3/6); 'sigma' (Beer HN): μ + 2σ / μ + 3σ."""
    if method == "sigma":
        return center + (warn_k or 2) * spread, center + (alarm_k or 3) * spread
    s = 1.4826 * spread
    return center + (warn_k or 3) * s, center + (alarm_k or 6) * s


SEVERITY_ORDER = {"info": 0, "normal": 0, "watch": 1, "warning": 2, "danger": 3}
ZONE_SEVERITY = {"A": "normal", "B": "normal", "C": "warning", "D": "danger"}
