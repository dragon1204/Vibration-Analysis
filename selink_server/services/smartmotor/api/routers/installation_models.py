"""Installation-model library: approved sensor layouts and analysis profiles."""
from __future__ import annotations

import re
from pathlib import Path
from uuid import uuid4

from fastapi import APIRouter, Depends, File, HTTPException, Request, Response, UploadFile
from pydantic import BaseModel, Field, field_validator

from ..deps import User, audit, current_user, require

router = APIRouter(tags=["installation-models"])

ALGORITHMS = {
    "iso_corrected_rms", "bearing_envelope", "run_detection", "alignment_screening",
    "unbalance_screening", "hydraulic_vane_pass", "belt_frequency", "fan_blade_pass",
    "gear_mesh", "screw_lobe_mesh", "axial_thrust",
}
SLOT_ROLES = {"bearing", "base", "driver", "driven", "gearbox_input", "gearbox_output", "thrust"}


class SlotIn(BaseModel):
    code: str
    label: str = ""
    role: str = "bearing"
    axes: list[str] = Field(default_factory=lambda: ["x", "y", "z"])
    marker: dict[str, float] | None = None

    @field_validator("code")
    @classmethod
    def slot_code(cls, value: str) -> str:
        value = value.strip().upper()
        if not re.fullmatch(r"[A-Z][A-Z0-9_-]{1,31}", value):
            raise ValueError("slot code must use A-Z, 0-9, _ or -")
        return value

    @field_validator("role")
    @classmethod
    def slot_role(cls, value: str) -> str:
        if value not in SLOT_ROLES:
            raise ValueError(f"role must be one of {sorted(SLOT_ROLES)}")
        return value

    @field_validator("axes")
    @classmethod
    def slot_axes(cls, value: list[str]) -> list[str]:
        axes = list(dict.fromkeys(value))
        if not axes or any(axis not in {"x", "y", "z"} for axis in axes):
            raise ValueError("axes must contain x, y or z")
        return axes


class InstallationModelIn(BaseModel):
    id: str | None = None
    name: str
    description: str = ""
    asset_class: str = "rotating_machine"
    image_url: str | None = None
    slots: list[SlotIn] = Field(min_length=2, max_length=12)
    algorithms: list[str] = Field(min_length=1, max_length=12)
    parameters: dict = Field(default_factory=dict)

    @field_validator("id")
    @classmethod
    def model_id(cls, value: str | None) -> str | None:
        if value is None:
            return None
        value = value.strip().lower()
        if not re.fullmatch(r"[a-z][a-z0-9-]{2,63}", value):
            raise ValueError("id must use lowercase letters, numbers and -")
        return value

    @field_validator("algorithms")
    @classmethod
    def model_algorithms(cls, value: list[str]) -> list[str]:
        value = list(dict.fromkeys(value))
        unknown = set(value) - ALGORITHMS
        if unknown:
            raise ValueError(f"unknown algorithms: {sorted(unknown)}")
        return value


def validate_model(model: InstallationModelIn) -> None:
    codes = [slot.code for slot in model.slots]
    if len(codes) != len(set(codes)):
        raise HTTPException(422, "sensor slot codes must be unique")
    if "iso_corrected_rms" in model.algorithms and not any(slot.role == "bearing" for slot in model.slots):
        raise HTTPException(422, "ISO profile needs at least one bearing slot")


def _out(row: dict) -> dict:
    row["image_url"] = row.get("image_url") or (f"/api/v1/installation-models/{row['id']}/image" if row.get("image_key") else None)
    return row


@router.get("/installation-models")
async def list_models(request: Request, user: User = Depends(current_user)):
    async with request.app.state.pool.acquire() as c:
        rows = await c.fetch("SELECT * FROM installation_models ORDER BY builtin DESC, name")
    return [_out(dict(row)) for row in rows]


@router.get("/installation-models/{model_id}")
async def get_model(model_id: str, request: Request, user: User = Depends(current_user)):
    async with request.app.state.pool.acquire() as c:
        row = await c.fetchrow("SELECT * FROM installation_models WHERE id=$1", model_id)
    if not row:
        raise HTTPException(404, "Installation model not found")
    return _out(dict(row))


@router.post("/installation-models", status_code=201)
async def create_model(body: InstallationModelIn, request: Request, user: User = Depends(require("analyst"))):
    validate_model(body)
    model_id = body.id or re.sub(r"[^a-z0-9]+", "-", body.name.lower()).strip("-")[:64]
    if len(model_id) < 3:
        raise HTTPException(422, "model id is too short")
    data = body.model_dump()
    data["id"] = model_id
    async with request.app.state.pool.acquire() as c:
        try:
            row = await c.fetchrow("""INSERT INTO installation_models
                (id,name,description,asset_class,image_url,slots,algorithms,parameters)
                VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *""", model_id, data["name"], data["description"],
                data["asset_class"], data["image_url"], data["slots"], data["algorithms"], data["parameters"])
        except Exception as exc:
            if "unique" in str(exc).lower():
                raise HTTPException(409, "Installation model id already exists") from exc
            raise
    await audit(request.app.state.pool, user, "installation_model.create", model_id, data)
    return _out(dict(row))


@router.patch("/installation-models/{model_id}")
async def update_model(model_id: str, body: InstallationModelIn, request: Request, user: User = Depends(require("analyst"))):
    validate_model(body)
    data = body.model_dump()
    async with request.app.state.pool.acquire() as c:
        existing = await c.fetchrow("SELECT id, builtin FROM installation_models WHERE id=$1", model_id)
        if not existing:
            raise HTTPException(404, "Installation model not found")
        row = await c.fetchrow("""UPDATE installation_models SET name=$2, description=$3, asset_class=$4,
            image_url=$5, slots=$6, algorithms=$7, parameters=$8, updated_at=now() WHERE id=$1 RETURNING *""",
            model_id, data["name"], data["description"], data["asset_class"], data["image_url"], data["slots"],
            data["algorithms"], data["parameters"])
    await audit(request.app.state.pool, user, "installation_model.update", model_id, data)
    return _out(dict(row))


@router.post("/installation-models/{model_id}/image")
async def upload_image(model_id: str, request: Request, image: UploadFile = File(...), user: User = Depends(require("analyst"))):
    content_type = image.content_type or ""
    if not content_type.startswith("image/"):
        raise HTTPException(415, "Only image files are accepted")
    data = await image.read()
    if not data or len(data) > 10 * 1024 * 1024:
        raise HTTPException(413, "Image must be between 1 byte and 10 MB")
    async with request.app.state.pool.acquire() as c:
        exists = await c.fetchval("SELECT 1 FROM installation_models WHERE id=$1", model_id)
    if not exists:
        raise HTTPException(404, "Installation model not found")
    ext = Path(image.filename or "image").suffix.lower() or ".img"
    key = f"installation-models/{model_id}/{uuid4().hex}{ext}"
    await request.app.state.storage.put(key, data, content_type)
    async with request.app.state.pool.acquire() as c:
        await c.execute("UPDATE installation_models SET image_key=$2,image_content_type=$3,image_url=NULL,updated_at=now() WHERE id=$1",
                        model_id, key, content_type)
    await audit(request.app.state.pool, user, "installation_model.image", model_id, {"key": key})
    return {"image_url": f"/api/v1/installation-models/{model_id}/image"}


@router.get("/installation-models/{model_id}/image", include_in_schema=False)
async def get_image(model_id: str, request: Request):
    async with request.app.state.pool.acquire() as c:
        row = await c.fetchrow("SELECT image_key,image_content_type FROM installation_models WHERE id=$1", model_id)
    if not row or not row["image_key"]:
        raise HTTPException(404, "No uploaded image")
    data = await request.app.state.storage.get(row["image_key"])
    if data is None:
        raise HTTPException(404, "Image object not found")
    return Response(data, media_type=row["image_content_type"] or "application/octet-stream")
