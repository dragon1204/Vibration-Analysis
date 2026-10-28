from smartmotor.common import installation as ins
from smartmotor.common.sensor_slots import build_point_for

DE_BASE = {"id": "motor-de-base", "name": "Motor DE + BASE", "algorithms": ["iso_corrected_rms", "run_detection"],
           "slots": [{"code": "DE", "role": "bearing"}, {"code": "BASE", "role": "base"}]}
VPUMP = {"id": "vertical-pump-4point", "name": "Bơm đứng", "algorithms": ["bearing_envelope", "axial_thrust"],
         "slots": [{"code": "DE", "role": "bearing"}, {"code": "NDE", "role": "thrust"}, {"code": "LOAD", "role": "driven"}]}


def test_edge_roles_from_model_roles():
    assert [ins.edge_role(r) for r in ("bearing", "thrust", "base", "driven", "gearbox_input", None)] == \
        ["bearing", "bearing", "base", "source", "source", "bearing"]


def test_only_implemented_algorithms_are_enabled():
    assert ins.algorithm_enabled(DE_BASE, "run_detection") and not ins.algorithm_enabled(DE_BASE, "bearing_envelope")
    assert not ins.algorithm_enabled(VPUMP, "axial_thrust"), "listed but not implemented"
    assert ins.algorithm_enabled(None, "run_detection") and not ins.algorithm_enabled(None, "gear_mesh")


def test_base_alpha_needs_the_algorithm_and_a_base_slot():
    assert ins.base_alpha({}, DE_BASE) == 0.8 and ins.base_alpha({"base_alpha": 0.67}, DE_BASE) == 0.67
    assert ins.base_alpha({"base_alpha": "x"}, DE_BASE) == 0.8 and ins.base_alpha({"base_alpha": 9}, DE_BASE) == 0.8
    assert ins.base_alpha({}, VPUMP) == -1.0, "no base slot and algorithm not selected"
    no_base = {**DE_BASE, "slots": [{"code": "DE", "role": "bearing"}]}
    assert ins.base_alpha({}, no_base) == -1.0


def test_check_points_reports_mismatches():
    pts = [{"id": "p1", "name": "DE", "location": "DE", "role": "bearing"},
           {"id": "p2", "name": "BASE", "location": "BASE", "role": "base"}]
    assert ins.check_points(DE_BASE, pts) == []
    issues = ins.check_points(VPUMP, pts)
    assert any("BASE" in i and "không có vị trí" in i for i in issues)
    assert any("Chưa lắp" in i and "NDE" in i and "LOAD" in i for i in issues)
    issues = ins.check_points(VPUMP, [{"id": "p3", "name": "NDE", "location": "NDE", "role": "source"}])
    assert any("source → bearing" in i for i in issues)


def test_build_point_for_any_model_code():
    p = build_point_for("m", "NDE", "bearing", 4, None, label="Đầu đối diện")
    assert p["id"] == "m-s4" and p["location"] == "NDE" and p["iso_axes"] == ["y", "z"] and p["name"] == "NDE – Đầu đối diện"
    g = build_point_for("m", "GEAR_IN", "source", 6, None)
    assert g["id"] == "m-gear_in" and g["iso_axes"] == [] and g["sensor"]["addr"] == 6
