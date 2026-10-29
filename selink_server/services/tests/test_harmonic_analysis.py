import numpy as np
from datetime import datetime, timedelta, timezone

from smartmotor.api.routers.machines import VENDOR_BRG2_COLUMNS, VENDOR_TABLE_HEADER, _nearest_vendor_row, _vendor_number, date_and_time, excel_time
from smartmotor.api.routers.points import _harmonic_findings, _harmonic_temporal
from smartmotor.common import dsp


def _row(order, occurrence, peak, relative=None, captures=10):
    return {
        "order": order,
        "label": f"{order}X",
        "detections": round(occurrence * captures / 100),
        "captures": captures,
        "occurrence_pct": occurrence,
        "peak_max": peak,
        "relative_to_1x": relative,
    }


def test_findings_require_repeated_evidence():
    weak = [_row(1, 20, 1.0, 1.0), _row(2, 20, 0.8, 0.8)]
    assert _harmonic_findings(weak) == []

    repeated = [
        _row(1, 80, 2.0, 1.0), _row(2, 70, 1.6, 0.8),
        _row(3, 50, 0.9, 0.45), _row(4, 40, 0.7, 0.35),
    ]
    codes = {x["code"] for x in _harmonic_findings(repeated)}
    assert codes == {"rotational_1x", "alignment_2x", "high_order_train"}


def test_order_tracking_follows_speed_change():
    values = np.full(501, 0.05)
    values[48] = 2.0
    fixed = dsp.harmonic_peaks(values, 1.0, 50.0, max_order=2, tolerance=0.02)
    tracked = dsp.harmonic_peaks(values, 1.0, 48.0, max_order=2, tolerance=0.02)
    assert not fixed[0]["detected"]
    assert tracked[0]["detected"] and tracked[0]["peak_hz"] == 48


def test_relative_threshold_rejects_tiny_prominent_line_without_hiding_detail():
    peaks = [
        {"order": 1, "amplitude": 5.0, "detected": True},
        {"order": 2, "amplitude": 1.0, "detected": True},
        {"order": 3, "amplitude": 0.2, "detected": True},
    ]
    result = dsp.apply_relative_harmonic_threshold(peaks, 5)
    assert result[1]["detected"] and result[1]["relative_to_1x_pct"] == 20
    assert not result[2]["detected"]
    assert result[2]["below_relative_threshold"]
    assert result[2]["relative_to_1x_pct"] == 4


def test_relative_threshold_is_not_applied_without_a_detected_1x_reference():
    peaks = [
        {"order": 1, "amplitude": 0.1, "detected": False},
        {"order": 2, "amplitude": 1.0, "detected": True},
    ]
    result = dsp.apply_relative_harmonic_threshold(peaks, 10)
    assert result[1]["detected"]
    assert result[1]["relative_to_1x_pct"] is None


def test_harmonic_temporal_detects_robust_growth_and_streak():
    start = datetime(2026, 1, 1, tzinfo=timezone.utc)
    amplitudes = [1.0, 1.1, 1.0, 8.0, 2.0, 2.2, 2.1]
    rows = [{"ts": (start + timedelta(hours=i)).isoformat(), "detected": i != 3,
             "amplitude": value, "peak_floor_ratio": 4 + i} for i, value in enumerate(amplitudes)]
    result = _harmonic_temporal(rows)
    assert result["trend"] == "rising"
    assert result["trend_pct"] >= 90
    assert result["longest_streak"] == 3
    assert result["persistence_pct"] == 42.9
    assert result["slope_per_hour"] > 0


def test_harmonic_temporal_needs_four_real_detections():
    start = datetime(2026, 1, 1, tzinfo=timezone.utc)
    rows = [{"ts": (start + timedelta(minutes=i)).isoformat(), "detected": i < 3,
             "amplitude": float(i + 1), "peak_floor_ratio": 3.5} for i in range(5)]
    result = _harmonic_temporal(rows)
    assert result["trend"] == "insufficient"
    assert result["trend_pct"] is None


def test_vendor_table_contract_and_timestamp_alignment():
    assert len(VENDOR_TABLE_HEADER) == 25
    assert VENDOR_TABLE_HEADER[:5] == ["Time", "Device name", "Acceleration X(g)", "Acceleration Y(g)", "Acceleration Z(g)"]
    assert VENDOR_TABLE_HEADER.count("Abase(X)m/s") == 3  # preserve the instrument's duplicated headers exactly
    assert [VENDOR_TABLE_HEADER[i] for i in VENDOR_BRG2_COLUMNS][0] == "Abrg2(X)m/s"
    assert VENDOR_TABLE_HEADER[19] == "Abase(X)m/s"


def test_excel_time_keeps_date_and_hour():
    from datetime import datetime
    assert excel_time(datetime(2026, 10, 29, 7, 44, 22, 800000)) == "2026-10-29T07:44:22.800"
    assert date_and_time(datetime(2026, 10, 29, 7, 44, 22, 800000)) == ["2026-10-29", "07:44:22,800"]
    start = datetime(2026, 1, 1, tzinfo=timezone.utc)
    rows = [{"ts": start, "vel_x": 17.11}, {"ts": start + timedelta(milliseconds=70), "vel_x": 18.0}]
    timestamps = [row["ts"] for row in rows]
    assert _nearest_vendor_row(rows, timestamps, start + timedelta(milliseconds=60), 20) is rows[1]
    assert _nearest_vendor_row(rows, timestamps, start + timedelta(milliseconds=40), 5) is None
    assert _vendor_number(rows[0], "vel_x", 0, 100) == 1711
