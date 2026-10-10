"""Baseline statistics (spec 6.4 baseline_learn; Beer HN slide 18 μ+2σ/μ+3σ)."""
from __future__ import annotations

import numpy as np

from ..common.iso import baseline_limits


def load_bin(load_pct: float | None) -> str:
    if load_pct is None:
        return "all"
    if load_pct < 50:
        return "<50"
    if load_pct <= 80:
        return "50-80"
    return ">80"


def robust_stats(values: list[float]) -> dict:
    x = np.asarray([v for v in values if v is not None and np.isfinite(v)], dtype=float)
    if len(x) == 0:
        return {"n": 0}
    med = float(np.median(x))
    mad = float(np.median(np.abs(x - med)))
    return {"n": len(x), "median": med, "mad": mad, "mean": float(x.mean()), "std": float(x.std(ddof=1)) if len(x) > 1 else 0.0}


def thresholds(stats: dict, method: str = "mad", warn_k=None, alarm_k=None, warn_min=None, alarm_min=None) -> tuple[float, float]:
    if method == "sigma":
        w, a = baseline_limits("sigma", stats["mean"], stats["std"], warn_k, alarm_k)
    else:
        w, a = baseline_limits("mad", stats["median"], stats["mad"], warn_k, alarm_k)
    if warn_min is not None:
        w = max(w, warn_min)
    if alarm_min is not None:
        a = max(a, alarm_min)
    return w, a


def extract_capture_features(features: dict, iso_axes: list[str]) -> dict[str, float]:
    """Flatten a FeatureSet into baseline feature names (e.g. 'x.orders.1', 'env.bpfo')."""
    out: dict[str, float] = {}
    axes = features.get("axes") or {}
    isov = []
    for a, ax in axes.items():
        for k in ("iso_vrms_mm_s", "acc_rms_g", "kurtosis", "crest", "mesh_mm_s", "line_2x_mm_s"):
            if ax.get(k) is not None:
                out[f"{a}.{k}"] = float(ax[k])
        for o, v in (ax.get("orders") or {}).items():
            out[f"{a}.orders.{o}"] = float(v)
        if a in iso_axes and ax.get("iso_vrms_mm_s") is not None:
            isov.append(float(ax["iso_vrms_mm_s"]))
    iso = features.get("isolation") or {}
    if iso.get("iso_vrms_max_mm_s") is not None:
        out["iso_vrms_mm_s"] = float(iso["iso_vrms_max_mm_s"])
        for a, ia in (iso.get("axes") or {}).items():
            for o, v in (ia.get("orders") or {}).items():
                out[f"iso.{a}.orders.{o}"] = float(v)
    elif isov:
        out["iso_vrms_mm_s"] = max(isov)
    env = features.get("envelope") or {}
    if env.get("env_rms_g") is not None:
        out["env.rms"] = float(env["env_rms_g"])
    for k in ("bpfo", "bpfi"):
        if env.get(f"{k}_env_g") is not None:
            out[f"env.{k}"] = float(env[f"{k}_env_g"])
    return out
