"""Report assessment: period bounds, zone re-derivation and rule-based findings."""
from datetime import datetime, timedelta, timezone

import pytest

from smartmotor.common import report_analysis as ra
from smartmotor.common.iso import iso_limits

VN = timezone(timedelta(hours=7))


def test_period_bounds():
    s, e, label = ra.period_bounds("quarter", "2026-Q4")
    assert (s, e, label) == (datetime(2026, 10, 1, tzinfo=VN), datetime(2027, 1, 1, tzinfo=VN), "2026-Q4")
    s, e, label = ra.period_bounds("month", "2026-12")
    assert e == datetime(2027, 1, 1, tzinfo=VN) and label == "2026-12"
    with pytest.raises(ValueError):
        ra.period_bounds("month", "2026-13")
    with pytest.raises(ValueError):
        ra.period_bounds("custom", frm=datetime(2026, 1, 1, tzinfo=VN), to=datetime(2027, 6, 1, tzinfo=VN))


def _cap(ts, radial_1x, axial_1x, iso_r):
    ax = lambda iso, o1, o2: {"iso_vrms_mm_s": iso, "orders": {"1": o1, "2": o2, "3": 0.1, "0.5": 0.02},
                              "kurtosis": 3.0, "crest": 3.3}
    return {"point_id": "p1", "ts": ts, "speed_hz": 49.3, "df_hz": 3.9,
            "axes": {"x": ax(5.0, axial_1x, 1.0), "y": ax(iso_r, radial_1x, 1.5), "z": ax(2.0, 1.0, 0.5)}}


def test_analyze_rezones_and_flags_unbalance_and_misalignment():
    lim = iso_limits(1, "flexible")
    start = datetime(2026, 10, 1, tzinfo=VN)
    caps = [_cap(start + timedelta(hours=6 * i), 5.0, 4.0, 6.0) for i in range(80)]  # 20 days
    caps[0]["axes"]["y"]["iso_vrms_mm_s"] = 8.2           # one short excursion into zone C
    point = {"id": "p1", "name": "S1", "axes_map": {"x": "axial", "y": "radial_h", "z": "radial_v"}, "iso_axes": ["y", "z"]}
    machine = {"id": "m", "poles": 2, "line_freq_hz": 50, "rated_speed_rpm": 2960}
    out = ra.analyze(machine, [point], caps, [], lim, start, start + timedelta(days=31))
    p = out["points"][0]
    assert p["stats"]["zone_p95"] == "B" and p["stats"]["zone_max"] == "C"   # derived from limits, not stored zone
    texts = " ".join(t for _l, t, _s in p["findings"])
    assert "mất cân bằng" in texts and "lệch trục góc" in texts
    assert "lỏng cơ khí" in texts and "Không thấy xung va đập" in texts
    assert any("2×tần số lưới" in t for t in p["limits"])                   # 2X 98.6 Hz within 2 bins of 100 Hz
    assert out["zone_overall"] == "B"


def test_trend_needs_two_weeks():
    lim = iso_limits(1, "flexible")
    start = datetime(2026, 10, 1, tzinfo=VN)
    caps = [_cap(start + timedelta(days=i), 5.0, 1.0, 5.0 + i) for i in range(5)]
    p = ra.analyze({"id": "m"}, [{"id": "p1", "iso_axes": ["y"]}], caps, [], lim, start, start + timedelta(days=31))["points"][0]
    assert any("chưa đủ để đánh giá xu hướng" in t for _l, t, _s in p["findings"])


def test_humanize_baseline_event():
    point = {"axes_map": {"x": "axial", "y": "radial_h", "z": "radial_v"}}
    assert ra.humanize_event("Vượt ngưỡng baseline z.orders.2", point) == \
        "Thành phần 2X – trục Z (đứng) vượt ngưỡng nền học được"
