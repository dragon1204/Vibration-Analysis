import pytest
from fastapi import HTTPException

from smartmotor.api.routers.machines import validate_run_detection


def test_run_detection_accepts_per_sensor_thresholds():
    validate_run_detection(
        {
            "run_detection": {
                "on_delay_s": 10,
                "off_delay_s": 30,
                "sources": [
                    {"point_id": "de", "axes": ["z"], "threshold_mm_s": 0.5},
                    {"point_id": "nde", "axes": ["x", "y"], "threshold_mm_s": 0.8},
                ],
            }
        },
        {"de", "nde", "base"},
    )


@pytest.mark.parametrize(
    "meta",
    [
        {"run_detection": {"sources": [{"point_id": "other", "axes": ["z"], "threshold_mm_s": 0.5}]}},
        {"run_detection": {"sources": [{"point_id": "de", "axes": [], "threshold_mm_s": 0.5}]}},
        {"run_detection": {"sources": [{"point_id": "de", "axes": ["q"], "threshold_mm_s": 0.5}]}},
        {"run_detection": {"sources": [{"point_id": "de", "axes": ["z"], "threshold_mm_s": 0}]}},
        {"run_detection": {"sources": []}},
        {"run_detection": {"on_delay_s": -1, "sources": [{"point_id": "de", "axes": ["z"], "threshold_mm_s": 0.5}]}},
    ],
)
def test_run_detection_rejects_invalid_rules(meta):
    with pytest.raises(HTTPException) as err:
        validate_run_detection(meta, {"de"})
    assert err.value.status_code == 422
