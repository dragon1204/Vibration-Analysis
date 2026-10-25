import pytest
from fastapi import HTTPException
from pydantic import ValidationError

from smartmotor.api.routers.installation_models import InstallationModelIn, validate_model


def model(**changes):
    data = {
        "id": "motor-pump-4point",
        "name": "Motor pump 4 point",
        "slots": [
            {"code": "MTR_DE", "role": "bearing", "axes": ["x", "y", "z"]},
            {"code": "PUMP_DE", "role": "driven", "axes": ["x", "z"]},
        ],
        "algorithms": ["iso_corrected_rms", "alignment_screening"],
    }
    data.update(changes)
    return InstallationModelIn(**data)


def test_installation_model_accepts_typed_slots_and_algorithms():
    item = model()
    validate_model(item)
    assert item.slots[0].code == "MTR_DE"


def test_installation_model_rejects_duplicate_slots():
    item = model(slots=[
        {"code": "DE", "role": "bearing", "axes": ["x"]},
        {"code": "DE", "role": "base", "axes": ["z"]},
    ])
    with pytest.raises(HTTPException, match="unique"):
        validate_model(item)


def test_installation_model_rejects_unknown_algorithm():
    with pytest.raises(ValidationError, match="unknown algorithms"):
        model(algorithms=["arbitrary_python"])
