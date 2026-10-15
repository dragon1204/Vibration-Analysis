"""Signal processing identical to the edge implementation (t153_edge/internal/dsp, spec 5.6),
used by analytics.reprocess_capture for cross-checking and by the spectrum API.
Golden test: same waveform → edge vs server differ < 0.5 % (spec 11)."""
from __future__ import annotations

import math
from dataclasses import dataclass, field

import numpy as np
from scipy import signal

G0 = 9.80665
DEFAULT_ORDERS = [0.5, 1, 1.5, 2, 3, 4, 5, 6]


@dataclass
class Spectrum:
    fs: float
    n: int
    df: float
    amp: np.ndarray  # A_rms per bin, m/s^2
    psd: np.ndarray  # one-sided PSD (m/s^2)^2/Hz

    @property
    def freq(self) -> np.ndarray:
        return np.arange(len(self.amp)) * self.df


def compute_spectrum(x: np.ndarray, fs: float) -> Spectrum:
    x = np.asarray(x, dtype=np.float64)
    n = len(x)
    a = x - x.mean()
    w = np.hanning(n)
    X = np.fft.rfft(a * w)
    m = np.abs(X)
    amp = 2 * m / w.sum() / math.sqrt(2)
    psd = m * m * 2 / (fs * (w * w).sum())
    amp[0] /= 2
    psd[0] /= 2
    if n % 2 == 0:
        amp[-1] /= 2
        psd[-1] /= 2
    return Spectrum(fs, n, fs / n, amp, psd)


def welch(specs: list[Spectrum]) -> Spectrum:
    if len(specs) == 1:
        return specs[0]
    s0 = specs[0]
    amp = np.sqrt(np.mean([s.amp ** 2 for s in specs], axis=0))
    psd = np.mean([s.psd for s in specs], axis=0)
    return Spectrum(s0.fs, s0.n, s0.df, amp, psd)


def max_analysis_hz(fs: float) -> float:
    return fs / 2.56


def band_rms_acc(s: Spectrum, f1: float, f2: float) -> float:
    f = s.freq
    m = (f >= f1) & (f <= f2)
    return float(math.sqrt(s.psd[m].sum() * s.df))


def band_rms_vel(s: Spectrum, f1: float, f2: float) -> float:
    f = s.freq
    m = (f >= f1) & (f <= f2) & (f > 0)
    w = 2 * np.pi * f[m]
    return float(math.sqrt((s.psd[m] / (w * w)).sum() * s.df) * 1000)


def velocity_amp(s: Spectrum, f_lo: float) -> np.ndarray:
    f = s.freq
    out = np.zeros_like(s.amp)
    m = (f >= f_lo) & (f > 0)
    out[m] = s.amp[m] / (2 * np.pi * f[m]) * 1000
    return out


def order_amp_acc(s: Spectrum, fk: float) -> float:
    half = max(2 * s.df, 0.02 * fk)
    f = s.freq
    m = np.abs(f - fk) <= half
    return float(math.sqrt(s.psd[m].sum() * s.df))


def orders(s: Spectrum, f1x: float, ks=DEFAULT_ORDERS) -> dict[str, float]:
    out = {}
    fmax = max_analysis_hz(s.fs)
    for k in ks:
        fk = k * f1x
        if fk <= 0 or fk > fmax:
            continue
        out[_okey(k)] = order_amp_acc(s, fk) / (2 * math.pi * fk) * 1000
    return out


def harmonic_peaks(values: np.ndarray, df: float, f1x: float, max_order: int = 10,
                   tolerance: float = 0.15, prominence_ratio: float = 3.0) -> list[dict]:
    """Find the strongest significant peak around each integer order.

    ``values`` is a one-sided amplitude spectrum in its presentation unit.  An
    order is considered present when its strongest bin is at least
    ``prominence_ratio`` times the local median floor.  The search window is a
    percentage of the nominal order frequency, which makes the result useful
    when speed varies slightly between captures (the UI defaults to ±15%).
    """
    arr = np.asarray(values, dtype=np.float64)
    if arr.ndim != 1 or len(arr) < 3 or df <= 0 or f1x <= 0:
        return []
    max_order = max(1, min(int(max_order), 50))
    tolerance = max(0.001, min(float(tolerance), 0.49))
    prominence_ratio = max(1.0, float(prominence_ratio))
    fmax = (len(arr) - 1) * df
    out: list[dict] = []
    for order in range(1, max_order + 1):
        target = order * f1x
        lo, hi = target * (1 - tolerance), target * (1 + tolerance)
        if lo > fmax:
            break
        i0 = max(1, int(math.ceil(lo / df)))
        i1 = min(len(arr) - 1, int(math.floor(hi / df)))
        if i0 > i1:
            continue
        band = arr[i0:i1 + 1]
        finite = np.isfinite(band)
        if not finite.any():
            continue
        safe = np.where(finite, band, -np.inf)
        peak_i = i0 + int(np.argmax(safe))
        peak = float(arr[peak_i])
        # Use the order band itself as a local baseline, excluding the peak and
        # its two neighbouring bins.  Expand the context for low-resolution FFTs.
        pad = max(4, i1 - i0 + 1)
        c0, c1 = max(1, i0 - pad), min(len(arr) - 1, i1 + pad)
        floor_values = np.concatenate((arr[c0:max(c0, peak_i - 2)], arr[min(c1 + 1, peak_i + 3):c1 + 1]))
        floor_values = floor_values[np.isfinite(floor_values) & (floor_values >= 0)]
        floor = float(np.median(floor_values)) if len(floor_values) else 0.0
        ratio = peak / floor if floor > 0 else (float("inf") if peak > 0 else 0.0)
        out.append({
            "order": order,
            "target_hz": round(target, 6),
            "band_hz": [round(lo, 6), round(min(hi, fmax), 6)],
            "peak_hz": round(peak_i * df, 6),
            "amplitude": peak,
            "floor": floor,
            "peak_floor_ratio": ratio,
            "detected": bool(peak > 0 and ratio >= prominence_ratio),
            "overlap_rejected": False,
            "_peak_bin": peak_i,
        })
    # Relative tolerance bands overlap from the higher orders onward.  A very
    # strong physical line must not therefore be counted as two different
    # harmonics.  Assign a shared winning bin to the nearest nominal order.
    owners: dict[int, dict] = {}
    for peak in out:
        if not peak["detected"]:
            continue
        bin_index = peak["_peak_bin"]
        previous = owners.get(bin_index)
        error = abs(peak["peak_hz"] - peak["target_hz"]) / peak["target_hz"]
        if previous is None:
            owners[bin_index] = peak
            continue
        previous_error = abs(previous["peak_hz"] - previous["target_hz"]) / previous["target_hz"]
        loser, winner = (previous, peak) if error < previous_error else (peak, previous)
        loser["detected"] = False
        loser["overlap_rejected"] = True
        owners[bin_index] = winner
    for peak in out:
        peak.pop("_peak_bin", None)
    return out


def _okey(k: float) -> str:
    return str(int(k)) if float(k).is_integer() else repr(float(k))


def estimate_speed(s: Spectrum, nominal: float, hint: float = 0.0) -> tuple[float, str]:
    if nominal <= 0:
        return nominal, "low"
    lo = max(1, int(math.floor((0.97 * nominal - s.df) / s.df)))
    hi = min(len(s.amp) - 2, int(math.ceil((1.03 * nominal + s.df) / s.df)))
    if lo > hi:
        return nominal, "low"
    peak = lo + int(np.argmax(s.amp[lo:hi + 1]))
    f = peak * s.df
    a, b, c = s.amp[peak - 1], s.amp[peak], s.amp[peak + 1]
    if a > 0 and b > 0 and c > 0:
        la, lb, lc = math.log(a), math.log(b), math.log(c)
        den = la - 2 * lb + lc
        if den != 0:
            d = 0.5 * (la - lc) / den
            if abs(d) <= 0.5:
                f = (peak + d) * s.df
    k0, k1 = int(0.75 * nominal / s.df), int(1.25 * nominal / s.df)
    floor = [s.amp[k] for k in range(max(k0, 1), min(k1, len(s.amp) - 1) + 1) if not (peak - 2 <= k <= peak + 2)]
    med = float(np.median(floor)) if floor else 0.0
    if med > 0 and b < 3 * med:
        if hint and abs(hint - nominal) <= 0.03 * nominal:
            return hint, "low"
        return nominal, "low"
    return f, "high"


def time_stats(x: np.ndarray) -> dict[str, float]:
    x = np.asarray(x, dtype=np.float64)
    d = x - x.mean()
    var = float((d * d).mean())
    std = math.sqrt(var)
    peak = float(np.abs(d).max()) if len(d) else 0.0
    out = {"rms": std, "peak": peak, "crest": 0.0, "kurtosis": 0.0, "skew": 0.0}
    if std > 0:
        out["crest"] = peak / std
        out["kurtosis"] = float((d ** 4).mean() / var ** 2)
        out["skew"] = float((d ** 3).mean() / (var * std))
    return out


def butter_bandpass_sos(lo: float, hi: float, fs: float, order: int = 4) -> np.ndarray:
    hp = signal.butter(order, lo, "highpass", fs=fs, output="sos")
    lp = signal.butter(order, hi, "lowpass", fs=fs, output="sos")
    return np.vstack([hp, lp])


@dataclass
class EnvelopeResult:
    df: float
    amp_g: np.ndarray
    rms_g: float
    band_hz: tuple[float, float]


def envelope(x: np.ndarray, fs: float, lo: float, hi: float, max_hz: float = 500) -> EnvelopeResult:
    if hi >= fs / 2:
        hi = 0.45 * fs
    g = np.asarray(x, dtype=np.float64) / G0
    g = g - g.mean()
    y = signal.sosfiltfilt(butter_bandpass_sos(lo, hi, fs), g)
    env = np.abs(signal.hilbert(y))
    env = env - env.mean()
    rms = float(math.sqrt((env * env).mean()))
    n = len(env)
    w = np.hanning(n)
    X = np.fft.rfft(env * w)
    df = fs / n
    kmax = min(len(X) - 1, int(max_hz / df))
    amp = 2 * np.abs(X[: kmax + 1]) / w.sum()
    amp[0] /= 2
    return EnvelopeResult(df, amp, rms, (lo, hi))


def envelope_average(frames: list[np.ndarray], fs: float, lo: float, hi: float, max_hz: float = 500) -> EnvelopeResult:
    rs = [envelope(f, fs, lo, hi, max_hz) for f in frames]
    if len(rs) == 1:
        return rs[0]
    amp = np.sqrt(np.mean([r.amp_g ** 2 for r in rs], axis=0))
    rms = math.sqrt(np.mean([r.rms_g ** 2 for r in rs]))
    return EnvelopeResult(rs[0].df, amp, rms, rs[0].band_hz)


def fault_amplitude(e: EnvelopeResult, f: float) -> dict:
    harm, ratios, nh = [], [], 0
    for h in (1, 2, 3):
        k = int(round(h * f / e.df))
        if k < 1 or k >= len(e.amp_g):
            break
        lo, hi = max(1, k - 2), min(len(e.amp_g) - 1, k + 2)
        best = float(e.amp_g[lo:hi + 1].max())
        floor = [e.amp_g[j] for j in range(max(1, k - 12), min(len(e.amp_g), k + 13)) if j < k - 3 or j > k + 3]
        med = float(np.median(floor)) if floor else 0.0
        r = best / med if med > 0 else 0.0
        harm.append(best)
        ratios.append(r)
        nh += r >= 3
    return {"freq_hz": f, "harmonics_g": harm, "peak_floor": ratios, "n_harmonics": nh,
            "amp_g": harm[0] if harm else 0.0}


def bearing_freqs(geom: dict, fr: float) -> dict[str, float] | None:
    if not geom:
        return None
    xs = [geom.get(k) for k in ("bpfo_x", "bpfi_x", "bsf_x", "ftf_x")]
    if all(v for v in xs):
        return {"bpfo": xs[0] * fr, "bpfi": xs[1] * fr, "bsf": xs[2] * fr, "ftf": xs[3] * fr}
    n, bd, pd = geom.get("n_balls"), geom.get("bd_mm"), geom.get("pd_mm")
    if not (n and bd and pd):
        return None
    r = float(bd) / float(pd) * math.cos(math.radians(float(geom.get("contact_deg") or 0)))
    return {"bpfo": n / 2 * fr * (1 - r), "bpfi": n / 2 * fr * (1 + r),
            "bsf": float(pd) / (2 * float(bd)) * fr * (1 - r * r), "ftf": fr / 2 * (1 - r)}


# ----- Calibration & isolation (Beer HN) -----

def interp_log(table: list[dict], f: float, xkey: str, ykey: str, default: float) -> float:
    if not table:
        return default
    t = sorted(table, key=lambda p: p[xkey])
    if f <= t[0][xkey]:
        return t[0][ykey]
    if f >= t[-1][xkey]:
        return t[-1][ykey]
    for a, b in zip(t, t[1:]):
        if a[xkey] <= f <= b[xkey]:
            u = (math.log(f) - math.log(a[xkey])) / (math.log(b[xkey]) - math.log(a[xkey]))
            return a[ykey] + u * (b[ykey] - a[ykey])
    return default


def apply_calibration(s: Spectrum, table: list[dict] | None) -> None:
    if not table:
        return
    g = np.array([interp_log(table, f, "f_hz", "factor", 1.0) for f in s.freq])
    s.amp *= g
    s.psd *= g * g


def isolate(target: Spectrum, ref: Spectrum, alpha: list[dict]) -> Spectrum:
    """A_iso(f) = sqrt(A_t² − (α(f)·A_ref)²), 0 if negative."""
    a = np.array([interp_log(alpha, f, "f_hz", "alpha", 0.0) if f > 0 else 0.0 for f in target.freq])
    t2 = target.amp ** 2
    d = t2 - (a * ref.amp[: len(t2)]) ** 2
    ratio = np.where((d > 0) & (t2 > 0), d / np.where(t2 > 0, t2, 1), 0.0)
    return Spectrum(target.fs, target.n, target.df, np.sqrt(np.clip(d, 0, None)), target.psd * ratio)


def _prominent(s: Spectrum, f: float, ratio: float = 3.0) -> bool:
    k = int(round(f / s.df))
    if k < 1 or k >= len(s.amp):
        return False
    peak = float(s.amp[max(1, k - 2): k + 3].max())
    floor = [s.amp[j] for j in range(max(1, k - 15), min(len(s.amp), k + 16)) if j < k - 3 or j > k + 3]
    med = float(np.median(floor)) if floor else 0.0
    return med > 0 and peak >= ratio * med


def learn_alpha(targets: list[Spectrum], refs: list[Spectrum], f: float) -> tuple[float, int]:
    """α(f) = mean(A_t/A_ref); pairs without a clear reference peak at f are skipped."""
    vals = []
    for t, r in zip(targets, refs):
        ar = order_amp_acc(r, f)
        if ar > 1e-9 and _prominent(r, f):
            vals.append(order_amp_acc(t, f) / ar)
    return (float(np.mean(vals)), len(vals)) if vals else (0.0, 0)


def dominant_peak(s: Spectrum, f1: float, f2: float, exclude=(), tol: float = 0.03) -> tuple[float, float]:
    v = velocity_amp(s, f1)
    f = s.freq
    m = (f >= f1) & (f <= f2)
    for e in exclude:
        m &= np.abs(f - e) > max(tol * e, 2 * s.df)
    if not m.any():
        return 0.0, 0.0
    idx = np.where(m)[0][np.argmax(v[m])]
    return float(f[idx]), float(v[idx])


def detect_mesh(s: Spectrum, f1x: float, lobes: int | None) -> dict:
    fmax = min(1000, max_analysis_hz(s.fs))
    fp, vp = dominant_peak(s, 10, fmax, [f1x])
    out = {"freq_hz": fp, "vel_mm_s": vp, "expected_hz": None, "match_expected": False, "harmonics": 0}
    if lobes and f1x:
        exp = lobes * f1x
        out["expected_hz"] = exp
        out["match_expected"] = abs(fp - exp) <= max(2 * s.df, 0.03 * exp)
    v = velocity_amp(s, 10)
    f = s.freq
    floor = float(np.median(v[(f >= 10) & (f <= fmax)])) if fp else 0
    for h in (2, 3):
        fh = h * fp
        if fh > fmax or not fp:
            break
        if floor > 0 and order_amp_acc(s, fh) / (2 * math.pi * fh) * 1000 >= 3 * floor:
            out["harmonics"] += 1
    return out


def transmitted_from_source(source: Spectrum, f: float, target_vel: float, ratio: float = 0.5) -> bool:
    v = velocity_amp(source, 1)
    k = int(round(f / source.df))
    if k < 1 or k >= len(v):
        return False
    peak = float(v[max(1, k - 2): k + 3].max())
    floor = [v[j] for j in range(max(1, k - 15), min(len(v), k + 16)) if j < k - 3 or j > k + 3]
    med = float(np.median(floor)) if floor else 0
    return med > 0 and peak >= 3 * med and peak >= ratio * target_vel


# ----- Full feature computation (mirrors edge features.Compute) -----

@dataclass
class FeatureContext:
    nominal_f1x: float
    iso_band: tuple[float, float]
    line_freq: float = 50.0
    bearing: dict | None = None
    calibration: list[dict] | None = None
    bandpass: tuple[float, float] | None = None
    contiguous: bool = False
    mesh_hz: float = 0.0
    extra: dict = field(default_factory=dict)


def compute_features(samples: np.ndarray, fs: float, frames: int, ctx: FeatureContext) -> tuple[dict, list[Spectrum]]:
    """samples: (n, 3) m/s^2, n = 1024·frames. Returns (FeatureSet-like dict, spectra per axis)."""
    n_frame = len(samples) // max(frames, 1)
    specs: list[Spectrum] = []
    for a in range(3):
        x = samples[:, a]
        if ctx.contiguous:
            s = compute_spectrum(x, fs)
        else:
            s = welch([compute_spectrum(x[i * n_frame:(i + 1) * n_frame], fs) for i in range(frames)])
        apply_calibration(s, ctx.calibration)
        specs.append(s)
    best = (ctx.nominal_f1x, "low", -1.0)
    for s in specs:
        f, conf = estimate_speed(s, ctx.nominal_f1x)
        if conf == "high":
            amp = order_amp_acc(s, f)
            if amp > best[2]:
                best = (f, conf, amp)
    f1x, conf = best[0], best[1]
    f2 = min(ctx.iso_band[1], max_analysis_hz(fs))
    axes = {}
    for a, name in enumerate("xyz"):
        st = time_stats(samples[:, a] / G0)
        ax = {
            "acc_rms_g": st["rms"], "acc_peak_g": st["peak"], "crest": st["crest"], "kurtosis": st["kurtosis"],
            "skew": st["skew"], "iso_vrms_mm_s": band_rms_vel(specs[a], ctx.iso_band[0], f2),
            "iso_band_hz": [ctx.iso_band[0], round(f2, 1)], "orders": orders(specs[a], f1x), "orders_unit": "mm_s_rms",
        }
        lf = 2 * ctx.line_freq
        if 0 < lf < max_analysis_hz(fs):
            ax["line_2x_mm_s"] = order_amp_acc(specs[a], lf) / (2 * math.pi * lf) * 1000
        if 0 < ctx.mesh_hz < max_analysis_hz(fs):
            ax["mesh_mm_s"] = order_amp_acc(specs[a], ctx.mesh_hz) / (2 * math.pi * ctx.mesh_hz) * 1000
        axes[name] = ax
    out = {"speed_hz": f1x, "speed_confidence": conf, "axes": axes, "envelope": None,
           "n_fft": specs[0].n, "df_hz": specs[0].df}
    if ctx.bandpass:
        ff = bearing_freqs(ctx.bearing or {}, f1x)
        env = {"band_hz": None, "axes": {}, "env_rms_g": 0.0, "fault_freqs_hz": ff}
        for a, name in enumerate("xyz"):
            x = samples[:, a]
            if ctx.contiguous:
                r = envelope(x, fs, *ctx.bandpass)
            else:
                r = envelope_average([x[i * n_frame:(i + 1) * n_frame] for i in range(frames)], fs, *ctx.bandpass)
            env["band_hz"] = list(r.band_hz)
            env["df_hz"] = r.df
            ea = {"env_rms_g": r.rms_g}
            if ff:
                faults = {"bpfo": fault_amplitude(r, ff["bpfo"]), "bpfi": fault_amplitude(r, ff["bpfi"]),
                          "bsf2": fault_amplitude(r, 2 * ff["bsf"]), "ftf": fault_amplitude(r, ff["ftf"])}
                ea["faults"] = faults
                for k, src in (("bpfo_env_g", "bpfo"), ("bpfi_env_g", "bpfi"), ("bsf_env_g", "bsf2"), ("ftf_env_g", "ftf")):
                    ea[k] = faults[src]["amp_g"]
                env["bpfo_env_g"] = max(env.get("bpfo_env_g") or 0, ea["bpfo_env_g"])
                env["bpfi_env_g"] = max(env.get("bpfi_env_g") or 0, ea["bpfi_env_g"])
            env["env_rms_g"] = max(env["env_rms_g"], r.rms_g)
            env["axes"][name] = ea
        out["envelope"] = env
    return out, specs
