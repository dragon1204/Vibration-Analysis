import json

import pytest

from conftest import GOLDEN
from smartmotor.analytics.diagnose import DiagContext, diagnose, to_diagnosis
from smartmotor.common.iso import DEFAULT_BAND_LIMITS, enforce_rss, iso_limits

AXES_MAP = {"x": "radial_h", "y": "axial", "z": "radial_v"}


def _features(name):
    p = GOLDEN / f"{name}.json"
    if not p.exists():
        pytest.skip("golden files missing")
    f = json.loads(p.read_text(encoding="utf-8"))["features"]
    return {"axes": f["axes"], "envelope": f.get("envelope"), "isolation": f.get("isolation")}


@pytest.mark.parametrize("name,expected,zone", [
    ("unbalance_orders", "unbalance", "C"),
    ("misalignment_orders", "misalignment", "C"),
    ("bearing_outer_env", "bearing_outer", "B"),
])
def test_scenarios(name, expected, zone):
    cands = diagnose(_features(name), DiagContext(axes_map=AXES_MAP, iso_zone=zone))
    assert cands, "no diagnosis"
    assert cands[0]["fault"] == expected, cands[:3]
    d = to_diagnosis(cands)
    assert d["rules_version"] == "diag-v1" and d["evidence"]


def test_bearing_temperature_raises_confidence():
    f = _features("bearing_outer_env")
    base = diagnose(f, DiagContext(axes_map=AXES_MAP, iso_zone="B"))[0]["confidence"]
    hot = diagnose(f, DiagContext(axes_map=AXES_MAP, iso_zone="B", bearing_temp_c=95))[0]["confidence"]
    assert hot > base


def test_transmitted_peaks_are_ignored():
    f = _features("bearing_outer_env")
    bpfo = f["envelope"]["axes"]["x"]["faults"]["bpfo"]["freq_hz"]
    f["isolation"] = {"transmitted_peaks": [{"freq_hz": bpfo, "vel_mm_s": 1.0}], "axes": {}}
    faults = [c["fault"] for c in diagnose(f, DiagContext(axes_map=AXES_MAP, iso_zone="B"))]
    assert "bearing_outer" not in faults


def test_2x_without_axial_evidence_does_not_diagnose_misalignment():
    f = _features("misalignment_orders")
    for axis in f["axes"].values():
        axis.setdefault("orders", {})["1"] = 0.01
        axis.setdefault("orders", {})["2"] = 0.01
    # Keep strong radial 2X but remove the independent axial signature.
    f["axes"]["x"]["orders"].update({"1": 1.0, "2": 0.8})
    faults = [item["fault"] for item in diagnose(f, DiagContext(axes_map=AXES_MAP, iso_zone="C"))]
    assert "misalignment" not in faults


def test_iso_and_rss():
    l = iso_limits(1, "rigid")
    assert (l.ab, l.bc, l.cd) == (2.3, 4.5, 7.1)
    assert l.zone(5.0) == "C"
    scaled, k = enforce_rss(DEFAULT_BAND_LIMITS, iso_limits(2, "rigid").bc)
    assert k < 1 and sum(x["alarm"] ** 2 for x in scaled) ** 0.5 <= 2.8 + 1e-9
