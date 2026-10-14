"""Anomaly detection (Isolation Forest) and RUL estimation (spec 6.4)."""
from __future__ import annotations

import io
import math

import joblib
import numpy as np
from sklearn.ensemble import IsolationForest
from scipy.stats import kendalltau, theilslopes

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


RUL_MODEL_VERSION = "rul-exp-theilsen-v2"


def _rul_result(status: str, **values) -> dict:
    return {"model_version": RUL_MODEL_VERSION, "status": status, "rul_days": None,
            "rul_lo_days": None, "rul_hi_days": None, **values}


def _time_bin_medians(t: np.ndarray, y: np.ndarray, bin_days: float) -> tuple[np.ndarray, np.ndarray]:
    """Reduce serially correlated captures to one robust observation per time bin."""
    origin = float(t.min())
    bins = np.floor((t - origin) / bin_days).astype(np.int64)
    tb, yb = [], []
    for b in np.unique(bins):
        take = bins == b
        tb.append(float(np.median(t[take])))
        yb.append(float(np.median(y[take])))
    return np.asarray(tb), np.asarray(yb)


def rul_exponential(t_days: np.ndarray, y: np.ndarray, threshold: float, n_boot: int = 500, seed: int = 0,
                    min_raw_points: int = 30, min_bins: int = 10, min_span_days: float = 14,
                    bin_days: float = 1, max_horizon_days: float = 3650) -> dict:
    """Robust conditional time-to-threshold estimate for a degrading positive feature.

    Captures are reduced to daily medians, gross residual outliers are removed, and
    log(y) is fit with a Theil-Sen line. A result is exposed only when the observation
    span, R², monotonic association and 95% slope interval all support degradation.
    The returned quantity is time to the configured alarm threshold, not a certified
    physical failure time.
    """
    t = np.asarray(t_days, dtype=float)
    values = np.asarray(y, dtype=float)
    mask = np.isfinite(t) & np.isfinite(values) & (values > 0)
    t, values = t[mask], values[mask]
    n_raw = int(len(t))
    base = {"n_raw": n_raw, "threshold": float(threshold) if np.isfinite(threshold) else None,
            "prediction_kind": "time_to_alarm_threshold"}
    if not np.isfinite(threshold) or threshold <= 0:
        return _rul_result("invalid_threshold", **base)
    if n_raw < min_raw_points:
        return _rul_result("insufficient_samples", required_raw=min_raw_points, **base)

    order = np.argsort(t)
    t, values = t[order], values[order]
    t, values = _time_bin_medians(t, values, bin_days)
    span = float(t[-1] - t[0]) if len(t) > 1 else 0.0
    base.update({"n": int(len(t)), "span_days": span, "latest_value": float(values[-1])})
    if len(t) < min_bins:
        return _rul_result("insufficient_time_bins", required_bins=min_bins, **base)
    if span < min_span_days:
        return _rul_result("insufficient_span", required_span_days=min_span_days, **base)
    if values[-1] >= threshold:
        return {**_rul_result("threshold_reached", **base), "rul_days": 0.0,
                "rul_lo_days": 0.0, "rul_hi_days": 0.0, "confidence": "high"}

    ly = np.log(values)
    first = theilslopes(ly, t, 0.95)
    residual = ly - (float(first.intercept) + float(first.slope) * t)
    med_res = float(np.median(residual))
    mad_res = float(np.median(np.abs(residual - med_res)))
    # A tiny numerical MAD is common for near-ideal exponential data; retain a
    # small floor so a single gross excursion is still recognised as an outlier.
    residual_scale = max(1.4826 * mad_res, 1e-9)
    keep = np.abs(residual - med_res) <= 4 * residual_scale
    removed = int((~keep).sum())
    t, ly, values = t[keep], ly[keep], values[keep]
    base.update({"n": int(len(t)), "outliers_removed": removed, "latest_value": float(values[-1])})
    if len(t) < min_bins:
        return _rul_result("too_many_outliers", required_bins=min_bins, **base)

    fit = theilslopes(ly, t, 0.95)
    slope, intercept = float(fit.slope), float(fit.intercept)
    pred = intercept + slope * t
    ss_res = float(np.square(ly - pred).sum())
    ss_tot = float(np.square(ly - ly.mean()).sum())
    r2 = 1 - ss_res / max(ss_tot, 1e-12)
    tau, trend_p = kendalltau(t, ly)
    tau = float(tau) if np.isfinite(tau) else 0.0
    trend_p = float(trend_p) if np.isfinite(trend_p) else 1.0
    base.update({"r2": r2, "slope_per_day": slope, "slope_ci95": [float(fit.low_slope), float(fit.high_slope)],
                 "kendall_tau": tau, "trend_p_value": trend_p})
    if slope <= 0 or fit.low_slope <= 0:
        return _rul_result("no_significant_positive_trend", **base)
    if r2 < 0.7:
        return _rul_result("poor_fit", required_r2=0.7, **base)
    if tau < 0.5 or trend_p > 0.05:
        return _rul_result("weak_monotonic_trend", required_tau=0.5, **base)

    t_now = float(t.max())

    def hit(bb: float, aa: float) -> float:
        return (math.log(threshold) - aa) / bb - t_now

    rul = max(hit(slope, intercept), 0.0)
    if rul > max_horizon_days:
        return _rul_result("horizon_too_long", max_horizon_days=max_horizon_days, **base)

    rng = np.random.default_rng(seed)
    centered = (ly - pred) - float(np.mean(ly - pred))
    boots: list[float] = []
    for _ in range(n_boot):
        simulated = pred + rng.choice(centered, size=len(centered), replace=True)
        bf = theilslopes(simulated, t, 0.95)
        if bf.slope > 0:
            estimate = hit(float(bf.slope), float(bf.intercept))
            if np.isfinite(estimate):
                boots.append(max(float(estimate), 0.0))
    if len(boots) < max(50, n_boot // 2):
        return _rul_result("unstable_bootstrap", bootstrap_valid=len(boots), **base)
    lo, hi = float(np.percentile(boots, 10)), float(np.percentile(boots, 90))
    # Include the central estimate in the reported interval despite harmless
    # floating-point differences on essentially noiseless data.
    lo, hi = min(lo, rul), max(hi, rul)
    relative_width = (hi - lo) / max(rul, 1.0)
    confidence = "high" if r2 >= 0.85 and relative_width <= 0.5 else "medium" if relative_width <= 1 else "low"
    return {**base, "status": "ok", "model_version": RUL_MODEL_VERSION, "rul_days": rul,
            "rul_lo_days": lo, "rul_hi_days": hi, "bootstrap_valid": len(boots),
            "confidence": confidence, "interval_relative_width": relative_width}
