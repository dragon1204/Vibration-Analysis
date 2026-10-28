"""The machine's installation model as the single source of truth for sensor positions and algorithms.

A model lists sensor slots (code, role) and the analysis algorithms that apply. Only some
algorithms are implemented; the others are accepted in the library but have no effect yet and
are reported as such so the UI never suggests a capability that does not exist.
"""
from __future__ import annotations

from .model_export import position_of

DEFAULT_MODEL = "motor-de-base"  # same default as the web (installationTemplates.ts)
DEFAULT_BASE_ALPHA = 0.8

# Algorithms the platform actually runs, and what each one switches on.
SUPPORTED_ALGORITHMS = {
    "iso_corrected_rms": "Rung riêng ổ đỡ = căn(ổ² − (α·BASE)²), hiển thị tham khảo",
    "bearing_envelope": "Phổ envelope và tần số lỗi ổ bi (BPFO/BPFI) khi có thông số ổ bi",
    "run_detection": "Phát hiện máy chạy/dừng từ rung",
}

# Model slot roles → roles understood by the edge, the rules and analytics.
# Thrust bearings are bearings for ISO 20816; driven/gearbox/driver slots are vibration sources.
EDGE_ROLE = {"bearing": "bearing", "thrust": "bearing", "base": "base", "driver": "source", "driven": "source",
             "gearbox_input": "source", "gearbox_output": "source"}


def edge_role(slot_role: str | None) -> str:
    return EDGE_ROLE.get(slot_role or "bearing", "bearing")


async def machine_model(conn, machine_id: str) -> tuple[dict, dict | None]:
    """(machine meta, installation model row) – the model falls back to the default one."""
    meta = await conn.fetchval("SELECT meta FROM machines WHERE id=$1", machine_id) or {}
    model_id = (meta or {}).get("installation_template") or DEFAULT_MODEL
    row = await conn.fetchrow("SELECT id, name, slots, algorithms, parameters FROM installation_models WHERE id=$1", model_id)
    return meta or {}, dict(row) if row else None


def slots(model: dict | None) -> list[dict]:
    return [s for s in (model or {}).get("slots") or [] if s.get("code")]


def slot(model: dict | None, code: str) -> dict | None:
    code = (code or "").upper()
    return next((s for s in slots(model) if str(s["code"]).upper() == code), None)


def algorithm_enabled(model: dict | None, name: str) -> bool:
    """Without a model every implemented algorithm stays on (behaviour before models existed)."""
    if model is None:
        return name in SUPPORTED_ALGORITHMS
    return name in (model.get("algorithms") or []) and name in SUPPORTED_ALGORITHMS


def base_alpha(meta: dict | None, model: dict | None) -> float:
    """α for the bearing's own vibration; -1 switches the display off (no BASE slot or algorithm off)."""
    if not algorithm_enabled(model, "iso_corrected_rms"):
        return -1.0
    if model is not None and not any(edge_role(s.get("role")) == "base" for s in slots(model)):
        return -1.0
    try:
        value = float((meta or {}).get("base_alpha", DEFAULT_BASE_ALPHA))
    except (TypeError, ValueError):
        value = DEFAULT_BASE_ALPHA
    return value if 0 < value <= 2 else DEFAULT_BASE_ALPHA


def check_points(model: dict | None, points: list[dict]) -> list[str]:
    """Human-readable mismatches between the installed sensors and the model."""
    if model is None:
        return []
    issues = []
    codes = {str(s["code"]).upper(): s for s in slots(model)}
    for p in points:
        pos = position_of(p)
        if pos is None:
            issues.append(f"Cảm biến {p.get('name') or p['id']} chưa có vị trí lắp (DE, NDE, BASE, LOAD)")
        elif pos not in codes:
            issues.append(f"Cảm biến {p.get('name') or p['id']} ở vị trí {pos}, mô hình {model['name']} không có vị trí này")
        elif (p.get("role") or "bearing") != edge_role(codes[pos].get("role")):
            issues.append(f"Cảm biến {pos} sẽ đổi vai trò {p.get('role') or 'bearing'} → {edge_role(codes[pos].get('role'))}")
    installed = {position_of(p) for p in points}
    missing = [c for c in codes if c not in installed]
    if missing:
        issues.append("Chưa lắp cảm biến ở: " + ", ".join(missing))
    return issues
