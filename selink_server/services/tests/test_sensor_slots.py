from smartmotor.common.sensor_slots import SLOTS, add_point_to_config, build_edge_point, point_id, point_name, slot_of

TEMPLATE = {
    "id": "m-p1", "role": "bearing", "location": "DE",
    "sensor": {"driver": "wtvb05", "bus": "busA", "addr": 2, "velocity_scale": 0.01},
    "axes_map": {"x": "axial", "y": "radial_h", "z": "radial_v"}, "iso_axes": ["y", "z"], "idle_sr": 3,
    "profiles": [{"name": "orders", "sr": 3, "frames": 1, "every_s": 30}],
}


def test_slot_of_reads_position_codes_and_legacy_slots():
    assert [slot_of(x) for x in ("COMP", " base ", "DE", "NDE")] == [1, 2, 3, 4]
    assert [slot_of(x) for x in ("S1", " s4 ", "S3")] == [1, 4, 3]
    assert slot_of("other") is None and slot_of("S5") is None and slot_of(None) is None


def test_slots_have_fixed_roles():
    assert {n: s["role"] for n, s in SLOTS.items()} == {1: "source", 2: "base", 3: "bearing", 4: "bearing"}
    assert SLOTS[3]["location"] == "DE" and point_name(3) == "DE – Đầu truyền động"
    assert point_id("pump-1", 2) == "pump-1-s2"


def test_base_sensor_gets_no_iso_axes_and_keeps_wiring():
    p = build_edge_point("m", 2, 3, TEMPLATE)
    assert p["role"] == "base" and p["iso_axes"] == [] and p["location"] == "BASE"
    assert p["sensor"] == {"driver": "wtvb05", "bus": "busA", "addr": 3, "velocity_scale": 0.01}
    assert p["axes_map"] == TEMPLATE["axes_map"]
    assert TEMPLATE["sensor"]["addr"] == 2, "the template must not be modified"


def test_bearing_sensor_copies_iso_axes_and_profiles():
    p = build_edge_point("m", 4, 5, TEMPLATE, name="Ổ sau")
    assert p["role"] == "bearing" and p["iso_axes"] == ["y", "z"] and p["name"] == "Ổ sau"
    p["profiles"][0]["every_s"] = 99
    assert TEMPLATE["profiles"][0]["every_s"] == 30


def test_without_template_uses_defaults():
    p = build_edge_point("m", 3, 7, None)
    assert p["sensor"]["bus"] == "busA" and p["axes_map"]["z"] == "radial_v" and p["profiles"][0]["sr"] == 3


def test_add_point_is_idempotent_and_drops_version():
    cfg = {"version": 5, "machines": [{"id": "m", "points": [TEMPLATE]}]}
    pt = build_edge_point("m", 2, 3, TEMPLATE)
    once = add_point_to_config(cfg, "m", pt)
    twice = add_point_to_config(once, "m", pt)
    assert "version" not in once and len(once["machines"][0]["points"]) == 2 == len(twice["machines"][0]["points"])
    assert len(cfg["machines"][0]["points"]) == 1, "input must not be modified"


def test_unknown_machine_raises():
    import pytest
    with pytest.raises(KeyError):
        add_point_to_config({"machines": []}, "x", {"id": "p"})
