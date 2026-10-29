from datetime import datetime, timedelta, timezone

from smartmotor.common import alpha_learn as al

T = datetime(2026, 10, 29, 1, tzinfo=timezone.utc)


def series(values, offset_s=0.0):
    return [(T + timedelta(seconds=3 * i + offset_s), v) for i, v in enumerate(values)]


def test_alpha_is_median_ratio_of_paired_samples():
    base = [0.3 + 0.01 * (i % 5) for i in range(60)]
    de = [b * 0.7 for b in base]
    r = al.learn_axis(al.pair(series(de, 1.0), series(base)))
    assert r["alpha"] == 0.7 and r["pairs"] == 60 and r["reason"] is None


def test_noise_floor_and_too_few_pairs_are_rejected():
    quiet = al.learn_axis(al.pair(series([0.05] * 60), series([0.05] * 60)))
    assert quiet["alpha"] is None and quiet["alpha_raw"] == 1.0 and "nhiễu" in quiet["reason"]
    assert al.learn_axis(al.pair(series([0.2] * 5), series([0.3] * 5)))["alpha"] is None
    # samples further apart than PAIR_S are not paired
    assert al.pair(series([1.0]), series([1.0], 10.0)) == []


def test_combine_uses_valid_iso_axes():
    axes = {"x": {"alpha": 0.2}, "y": {"alpha": 0.6}, "z": {"alpha": 0.9}}
    assert al.combine(axes, ["y", "z"]) == 0.75
    assert al.combine({"y": {"alpha": None}, "z": {"alpha": 0.8}}, ["y", "z"]) == 0.8
    assert al.combine({"y": {"alpha": None}}, ["y", "z"]) is None
