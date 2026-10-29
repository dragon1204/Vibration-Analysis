from smartmotor.common import harmonic_review as hr


def test_supply_frequency_is_not_a_shaft_speed():
    assert hr.plausible_speed(50.0, 50, 2, 3.906) is None          # locked on the 50 Hz line
    assert hr.plausible_speed(50.26, 50, 2, 0.1) is None           # above synchronous speed for 2 poles
    assert hr.plausible_speed(48.6, 50, 2, 0.5) == 48.6
    assert hr.plausible_speed(24.6, 50, 4, 0.5) == 24.6
    assert hr.plausible_speed(None, 50, 2, 1) is None


def test_orders_overlapping_electrical_lines():
    assert hr.line_overlap(1, 46.67, 0.15, 3.9, 50) == [50]
    assert hr.line_overlap(2, 46.67, 0.15, 3.9, 50) == [100]
    assert hr.line_overlap(3, 46.67, 0.02, 0.5, 50) == []


def test_own_amplitude_and_transmitted_share():
    own, share = hr.own_amplitude(1.0, 1.0, 0.8)
    assert round(own, 3) == 0.6 and share == 0.8
    assert hr.own_amplitude(1.0, None, 0.8) == (None, None)


def test_review_softens_findings_explained_elsewhere():
    harmonics = [{"order": 2, "line_overlap_hz": [100.0], "transmitted_share": 0.9}]
    findings = [{"code": "alignment_2x", "orders": [2], "confidence": 76, "severity": "warning",
                 "evidence": "2X xuất hiện 96%.", "action": "Kiểm tra đồng tâm."}]
    out = hr.review(findings, harmonics, 1.59, 3.5)[0]
    assert out["confidence"] == 19 and out["severity"] == "watch"
    assert "100 Hz" in out["evidence"] and "truyền từ đế" in out["evidence"] and "vùng A" in out["evidence"]
    assert out["action"].startswith("Chỉ theo dõi")
    clean = [{"code": "x", "orders": [3], "confidence": 60, "severity": "warning", "evidence": "e.", "action": "a"}]
    assert hr.review(clean, [{"order": 3}], 5.0, 3.5)[0]["severity"] == "warning"
