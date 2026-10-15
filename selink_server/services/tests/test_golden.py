"""Golden test (spec 11): same waveform → edge (Go) vs server (Python) differ < 0.5 %."""
import json

import numpy as np
import pytest

from conftest import GOLDEN
from smartmotor.common import dsp, wavefile

CASES = ["unbalance_orders", "misalignment_orders", "bearing_outer_env"]


def _load(name):
    if not (GOLDEN / f"{name}.json").exists():
        pytest.skip("golden files missing (run GOLDEN_WRITE=1 go test ./internal/features in t153_edge)")
    meta = json.loads((GOLDEN / f"{name}.json").read_text(encoding="utf-8"))
    header, counts = wavefile.decode((GOLDEN / f"{name}.bin.gz").read_bytes())
    return meta, header, wavefile.counts_to_ms2(counts)


def _close(a, b, rel=0.005, abs_=1e-4):
    return abs(a - b) <= max(rel * abs(b), abs_)


@pytest.mark.parametrize("name", CASES)
def test_golden_features_match_edge(name):
    meta, header, samples = _load(name)
    edge = meta["features"]
    bearing = meta.get("bearing")
    geom = None
    if bearing:
        geom = {"n_balls": bearing.get("NBalls"), "bd_mm": bearing.get("BdMm"), "pd_mm": bearing.get("PdMm"),
                "contact_deg": bearing.get("ContactDeg")}
    ctx = dsp.FeatureContext(nominal_f1x=meta["nominal_f1x_hz"], iso_band=tuple(meta["iso_band_hz"]),
                             line_freq=meta["line_freq_hz"], bearing=geom,
                             bandpass=tuple(meta["bandpass_hz"]) if meta.get("bandpass_hz") else None)
    out, _ = dsp.compute_features(samples, header["fs_hz"], header["frames"], ctx)
    assert _close(out["speed_hz"], edge["speed_hz"], rel=0.001)
    for a in "xyz":
        e, p = edge["axes"][a], out["axes"][a]
        for k in ("iso_vrms_mm_s", "acc_rms_g", "kurtosis", "crest"):
            assert _close(p[k], e[k]), (a, k, p[k], e[k])
        for o, v in e["orders"].items():
            assert _close(p["orders"][o], v, abs_=2e-4), (a, o, p["orders"][o], v)
    if edge.get("envelope"):
        ee, pe = edge["envelope"], out["envelope"]
        assert _close(pe["env_rms_g"], ee["env_rms_g"], rel=0.005)
        assert _close(pe["bpfo_env_g"], ee["bpfo_env_g"], rel=0.005)


def test_isolation_learn_and_cancel():
    fs, n = 2000.0, 1024
    t = np.arange(n) / fs
    fm = 4 * 49.17
    rng = np.random.default_rng(1)

    def acc(vrms, f, ph=0.0):
        return vrms / 1000 * np.sqrt(2) * 2 * np.pi * f * np.sin(2 * np.pi * f * t + ph)

    targets, refs = [], []
    for i in range(5):
        ph = rng.uniform(0, 6)
        base = acc(3.0, fm, ph) + 1e-3 * rng.standard_normal(n)
        refs.append(dsp.compute_spectrum(base, fs))
        targets.append(dsp.compute_spectrum(0.4 * base, fs))
    alpha, cnt = dsp.learn_alpha(targets, refs, fm)
    assert cnt == 5 and abs(alpha - 0.4) < 0.01
    base = acc(3.0, fm)
    s3 = dsp.compute_spectrum(0.4 * base + acc(2.0, 49.17, 0.3), fs)
    iso = dsp.isolate(s3, dsp.compute_spectrum(base, fs), [{"f_hz": fm, "alpha": alpha}])
    assert dsp.order_amp_acc(iso, fm) / (2 * np.pi * fm) * 1000 < 0.1
    assert abs(dsp.order_amp_acc(iso, 49.17) / (2 * np.pi * 49.17) * 1000 - 2.0) < 0.05


def test_harmonic_peaks_uses_tolerance_and_prominence():
    df = 1.0
    values = np.full(401, 0.1)
    # 1X has drifted +10 %, 2X is nominal and 3X is only noise.
    values[55] = 2.5
    values[100] = 1.5
    values[150] = 0.2
    peaks = dsp.harmonic_peaks(values, df, 50.0, max_order=5, tolerance=0.15, prominence_ratio=3.0)
    assert [p["order"] for p in peaks] == [1, 2, 3, 4, 5]
    assert peaks[0]["detected"] and peaks[0]["peak_hz"] == 55
    assert peaks[1]["detected"] and peaks[1]["peak_hz"] == 100
    assert not peaks[2]["detected"]


def test_harmonic_peaks_stops_above_available_spectrum():
    peaks = dsp.harmonic_peaks(np.ones(121), 1.0, 50.0, max_order=10)
    assert [p["order"] for p in peaks] == [1, 2]


def test_harmonic_peaks_does_not_double_count_overlapping_bands():
    values = np.full(401, 0.1)
    values[225] = 5.0  # shared boundary/strongest line for the 4X and 5X bands
    peaks = dsp.harmonic_peaks(values, 1.0, 50.0, max_order=6, tolerance=0.15)
    owners = [p for p in peaks if p["detected"] and p["peak_hz"] == 225]
    rejected = [p for p in peaks if p["overlap_rejected"]]
    assert len(owners) == 1
    assert len(rejected) == 1
