from datetime import datetime, timedelta, timezone

from smartmotor.common import model_export as me

DE = {"id": "m-p1", "location": "DE", "role": "bearing", "axes_map": {"x": "axial", "y": "radial_h", "z": "radial_v"}}
BASE = {"id": "m-p2", "location": "BASE", "role": "base", "axes_map": None}
MODEL = [{"code": "DE"}, {"code": "BASE"}]


def test_positions_and_legacy_codes():
    assert me.position_of(DE) == "DE" and me.position_of({"location": "S2"}) == "BASE"
    assert me.position_of({"location": "comp"}) == "LOAD" and me.position_of({"location": "Đế máy", "role": "base"}) == "BASE"
    assert me.position_of({"location": "de-may", "role": "bearing"}) is None


def test_slots_follow_the_model_order():
    assert [(c, p and p["id"]) for c, p in me.slot_points(MODEL, [BASE, DE])] == [("DE", "m-p1"), ("BASE", "m-p2")]
    four = [{"code": c} for c in ("LOAD", "DE", "NDE", "BASE")]
    assert [p is None for _, p in me.slot_points(four, [DE, BASE])] == [True, False, True, False]
    assert [c for c, _ in me.slot_points(None, [BASE, DE])] == ["DE", "BASE"]


def test_header_has_units_and_directions():
    h = me.header(me.slot_points(MODEL, [DE, BASE]))
    assert h[:3] == ["Ngày", "Giờ (GMT+7)", "Thiết bị"] and len(h) == 5 + 2 * me.SLOT_COLUMNS == 5 + 2 * 19
    assert h[3] == "DE Vận tốc RMS ISO 10-1000 Hz X dọc trục (mm/s)" and "DE Gia tốc RMS Z đứng (mm/s²)" in h
    assert "DE Gia tốc đỉnh (cảm biến) X dọc trục (mm/s²)" in h and "BASE Vận tốc đỉnh (cảm biến) Z đứng (mm/s)" in h
    assert "DE Dịch chuyển đỉnh (cảm biến) Y ngang (µm)" in h and "DE Tần số rung (cảm biến) X dọc trục (Hz)" in h
    assert "BASE Nhiệt độ (°C)" in h


def test_acceleration_is_converted_from_g_to_mm_s2():
    v = me.slot_values({"acc_x": 1.0, "acc_y": 0.5, "acc_z": None, "vel_x": 5.28, "disp_x": 3.0, "freq_x": 408.1,
                        "temp_c": 43.4}, {"rms_x": 4.1, "arms_x": 0.52})
    assert v[0] == 4.1 and v[3] == 5099.5                     # RMS velocity, RMS acceleration (0.52 g)
    assert v[6] == 5.28 and v[9] == 9806.6 and v[10] == 4903.3 and v[11] == ""
    assert v[12] == 3 and isinstance(v[12], int) and v[15] == 408.1 and v[18] == 43.4
    assert me.slot_values(None, None) == [""] * me.SLOT_COLUMNS
    glitch = me.slot_values({"acc_x": 0.0, "acc_y": 0.0, "acc_z": 0.0, "vel_x": 10.9}, {})
    assert glitch[9:12] == ["", "", ""] and glitch[6] == 10.9          # zero block while running → empty
    stopped = me.slot_values({"acc_x": 0.0, "acc_y": 0.0, "acc_z": 0.0, "vel_x": 0.0}, {})
    assert stopped[9:12] == [0.0, 0.0, 0.0]                             # a stopped machine stays 0


def test_run_state_column():
    t0 = datetime(2026, 10, 29, 17, tzinfo=timezone.utc)
    states = [{"ts": t0, "running": True}, {"ts": t0 + timedelta(minutes=5), "running": False}]
    stamps = [s["ts"] for s in states]
    assert me.run_state_at(states, stamps, t0 + timedelta(minutes=1), None) == "CHẠY"
    assert me.run_state_at(states, stamps, t0 + timedelta(minutes=6), None) == "DỪNG"
    assert me.run_state_at(states, stamps, t0 - timedelta(minutes=1), False) == "DỪNG"
    assert me.run_state_at([], [], t0, None) == ""


def test_rms_is_carried_forward_only_while_fresh():
    t0 = datetime(2026, 10, 28, 13, 0, tzinfo=timezone.utc)
    rows = [{"rms_x": 1.0}, {"rms_x": 2.0}]
    stamps = [t0, t0 + timedelta(seconds=3)]
    assert me.latest_before(rows, stamps, t0 + timedelta(seconds=2))["rms_x"] == 1.0
    assert me.latest_before(rows, stamps, t0 + timedelta(seconds=4))["rms_x"] == 2.0
    assert me.latest_before(rows, stamps, t0 + timedelta(seconds=30)) is None
    assert me.latest_before(rows, stamps, t0 - timedelta(seconds=1)) is None


def test_nearest_respects_skew():
    t0 = datetime(2026, 10, 28, 13, 0, tzinfo=timezone.utc)
    rows, stamps = [{"v": 1}, {"v": 2}], [t0, t0 + timedelta(milliseconds=800)]
    assert me.nearest(rows, stamps, t0 + timedelta(milliseconds=500), timedelta(seconds=1))["v"] == 2
    assert me.nearest(rows, stamps, t0 + timedelta(seconds=5), timedelta(seconds=1)) is None
