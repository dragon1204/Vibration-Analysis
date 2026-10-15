import numpy as np
from datetime import datetime, timedelta, timezone

from smartmotor.api.routers.machines import VENDOR_TABLE_HEADER, _nearest_vendor_row, _vendor_number
from smartmotor.api.routers.points import _harmonic_findings
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


def test_vendor_table_contract_and_timestamp_alignment():
    assert len(VENDOR_TABLE_HEADER) == 25
    assert VENDOR_TABLE_HEADER[:5] == ["Time", "Device name", "Acceleration X(g)", "Acceleration Y(g)", "Acceleration Z(g)"]
    assert VENDOR_TABLE_HEADER.count("Abase(X)m/s") == 3  # preserve the instrument's duplicated headers exactly
    start = datetime(2026, 1, 1, tzinfo=timezone.utc)
    rows = [{"ts": start, "vel_x": 17.11}, {"ts": start + timedelta(milliseconds=70), "vel_x": 18.0}]
    timestamps = [row["ts"] for row in rows]
    assert _nearest_vendor_row(rows, timestamps, start + timedelta(milliseconds=60), 20) is rows[1]
    assert _nearest_vendor_row(rows, timestamps, start + timedelta(milliseconds=40), 5) is None
    assert _vendor_number(rows[0], "vel_x", 0, 100) == 1711
