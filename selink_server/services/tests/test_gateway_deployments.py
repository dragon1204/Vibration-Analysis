from smartmotor.common.gwconfig import activate_deployment, deployment_machine


def test_switching_deployment_keeps_gateway_transport_and_removes_old_machine():
    config = {
        "version": 9, "buses": [{"id": "busA", "device": "/dev/ttyAS6"}],
        "machines": [{"id": "old", "points": [{"id": "old-de"}]}],
    }
    machine = {"id": "new", "name": "New pump", "foundation": "flexible", "iso_group": 1,
               "iso_band_lo_hz": 10, "iso_band_hi_hz": 1000}
    result = activate_deployment(config, machine)
    assert result["buses"] == config["buses"]
    assert "version" not in result
    assert result["machines"] == [{
        "id": "new", "name": "New pump", "type": "other", "rated_power_kw": 0,
        "rated_speed_rpm": 0, "poles": 0, "line_freq_hz": 50, "iso_group": 1,
        "foundation": "flexible", "iso_band_hz": [10, 1000], "thermal": {}, "points": [],
    }]
    assert config["machines"][0]["id"] == "old"


def test_deployment_reuses_points_when_gateway_is_reassigned_to_same_machine():
    machine = {"id": "pump", "name": "Pump", "foundation": "rigid"}
    result = deployment_machine(machine, {"points": [{"id": "pump-de"}], "temps": [{"role": "frame"}]})
    assert result["points"] == [{"id": "pump-de"}]
    assert result["temps"] == [{"role": "frame"}]
