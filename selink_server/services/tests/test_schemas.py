from smartmotor.common.schemas import RunState, TempMetrics, VibMetrics


def test_vibration_metrics_accept_subsecond_window_contract():
    message = VibMetrics.model_validate({
        "ts": "2026-10-16T00:00:00.500Z",
        "point_id": "pump-tg-01-p1",
        "window_s": 0,
        "window_ms": 500,
        "samples": 2,
    })
    assert message.window_ms == 500
    assert message.window_s == 0
    assert message.model_extra["samples"] == 2


def test_run_state_accepts_vibration_and_power_sources():
    message = RunState.model_validate({"ts": "2026-10-25T00:00:00Z", "machine_id": "m1", "running": True})
    assert message.source == "vibration"


def test_temperature_keeps_sensor_and_pt100_channels_distinct():
    message = TempMetrics.model_validate({
        "ts": "2026-10-25T00:00:00Z", "machine_id": "m1", "sensor_temp_c": 46, "frame_temp_c": 61,
    })
    assert message.sensor_temp_c == 46
    assert message.frame_temp_c == 61
