import pytest
from pydantic import ValidationError

from smartmotor.common.customer_rules import CustomerRules, evaluate_rules


def rule(**changes):
    return {"code": "E02", "name": "Harmonic 2X", "order": 2, "min_count": 2,
            "occurrence_pct": 50, "relative_pct": 20, **changes}


def test_count_requires_same_capture_ratio_and_detected_peak():
    rows = [{"order": 2, "detected": True, "relative_to_1x_pct": value}
            for value in [20, 30, 5, None]]
    rows.append({"order": 2, "detected": False, "relative_to_1x_pct": 90})
    result = evaluate_rules([rule()], rows)[0]
    assert result["count"] == 2
    assert result["actual_pct"] == 40
    assert result["status"] == "not_matched"
    assert evaluate_rules([rule(occurrence_pct=40)], rows)[0]["status"] == "matched"


def test_no_data_and_missing_reference_do_not_match():
    assert evaluate_rules([rule()], [])[0]["status"] == "no_data"
    rows = [{"order": 2, "detected": True, "relative_to_1x_pct": None}]
    assert evaluate_rules([rule(min_count=1)], rows)[0]["status"] == "not_matched"
    assert evaluate_rules([rule(min_count=1, relative_pct=0)], rows)[0]["status"] == "matched"


@pytest.mark.parametrize("changes", [{"order": 31}, {"min_count": 0}, {"occurrence_pct": 101},
                                     {"relative_pct": float("nan")}, {"code": "  "}])
def test_invalid_rules_rejected(changes):
    with pytest.raises(ValidationError):
        CustomerRules(rules=[rule(**changes)])


def test_duplicate_codes_rejected_after_trimming():
    with pytest.raises(ValidationError):
        CustomerRules(rules=[rule(), rule(code=" e02 ")])


def test_empty_list_allows_removing_all_rules():
    assert CustomerRules(rules=[]).rules == []
