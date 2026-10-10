"""Anomaly detection (Isolation Forest) and RUL estimation (spec 6.4)."""
from __future__ import annotations

import io
import math

import joblib
import numpy as np
from sklearn.ensemble import IsolationForest

VECTOR_FEATURES = [
    "iso_vrms_mm_s", "x.orders.1", "y.orders.1", "z.orders.1", "x.orders.2", "y.orders.2", "z.orders.2",
    "x.orders.3", "z.orders.3", "x.acc_rms_g", "z.acc_rms_g", "x.kurtosis", "z.kurtosis", "x.crest", "z.crest",
    "env.rms", "env.bpfo", "env.bpfi",
]


def vectorize(flat: dict, medians: dict, extra: dict | None = None) -> np.ndarray:
    """Feature vector normalised by baseline medians of the same load bin."""
    v = []
    for k in VECTOR_FEATURES:
        x = flat.get(k)
        m = medians.get(k)
        if x is None:
            v.append(1.0)
        elif m and m > 0:
            v.append(float(x) / m)
        else:
            v.append(float(x))
    for k in ("temp_c", "winding_rise_est_k", "load_pct", "speed_hz"):
        val = (extra or {}).get(k)
        v.append(float(val) / 100 if val is not None else 0.0)
    return np.asarray(v)


def train(X: np.ndarray, seed: int = 0) -> dict:
    model = IsolationForest(n_estimators=200, contamination="auto", random_state=seed).fit(X)
    s = -model.score_samples(X)
    return {"model": model, "p50": float(np.percentile(s, 50)), "p99": float(np.percentile(s, 99)),
            "features": VECTOR_FEATURES, "n": len(X)}


def score(bundle: dict, x: np.ndarray) -> float:
    """Anomaly score 0..1; training P99 maps to 0.7 (the alarm threshold)."""
    s = float(-bundle["model"].score_samples(x.reshape(1, -1))[0])
    span = max(bundle["p99"] - bundle["p50"], 1e-6)
    return float(np.clip(0.7 * (s - bundle["p50"]) / span, 0, 1))


def dumps(bundle: dict) -> bytes:
    buf = io.BytesIO()
    joblib.dump(bundle, buf)
    return buf.getvalue()


def loads(data: bytes) -> dict:
    return joblib.load(io.BytesIO(data))


def rul_exponential(t_days: np.ndarray, y: np.ndarray, threshold: float, n_boot: int = 200, seed: int = 0) -> dict | None:
    """Fit y = a·e^(b·t) (log-linear) and return days until y reaches threshold with a bootstrap CI.
    Only valid when R² > 0.7, ≥ 10 points and b > 0 (spec 6.4 rul_estimate)."""
    mask = (y > 0) & np.isfinite(y)
    t, y = t_days[mask], y[mask]
    if len(t) < 10 or threshold <= 0:
        return None
    ly = np.log(y)
    b, la = np.polyfit(t, ly, 1)
    pred = la + b * t
    ss_res = float(((ly - pred) ** 2).sum())
    ss_tot = float(((ly - ly.mean()) ** 2).sum()) or 1e-12
    r2 = 1 - ss_res / ss_tot
    if b <= 0 or r2 < 0.7:
        return {"r2": r2, "slope_per_day": float(b), "rul_days": None}
    t_now = float(t.max())

    def hit(bb, aa):
        return (math.log(threshold) - aa) / bb - t_now

    rul = hit(b, la)
    rng = np.random.default_rng(seed)
    boots = []
    for _ in range(n_boot):
        idx = rng.integers(0, len(t), len(t))
        if len(set(idx)) < 3:
            continue
        bb, aa = np.polyfit(t[idx], ly[idx], 1)
        if bb > 0:
            boots.append(hit(bb, aa))
    lo, hi = (float(np.percentile(boots, 10)), float(np.percentile(boots, 90))) if boots else (None, None)
    return {"r2": r2, "slope_per_day": float(b), "rul_days": max(rul, 0.0),
            "rul_lo_days": max(lo, 0.0) if lo is not None else None, "rul_hi_days": max(hi, 0.0) if hi is not None else None}
