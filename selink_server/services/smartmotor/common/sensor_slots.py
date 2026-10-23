"""Fixed WTVB05 mounting positions and edge-configuration helpers.

The physical mounting position (DE, NDE, BASE or COMP) is the identity shown
to users; the Modbus address is only wiring. Legacy ``S1``..``S4`` location
values remain readable while existing configurations are migrated.
"""
from __future__ import annotations

import copy
import re


# Numeric slots are an internal stable ordering for the API and legacy point IDs.
# ISO zones apply only to bearing positions.
SLOTS: dict[int, dict] = {
    1: {"location": "COMP", "label": "Đỉnh của tải", "short": "COMP", "role": "source"},
    2: {"location": "BASE", "label": "Đế", "short": "BASE", "role": "base"},
    3: {"location": "DE", "label": "Đầu truyền động", "short": "DE", "role": "bearing"},
    4: {"location": "NDE", "label": "Đầu đối diện", "short": "NDE", "role": "bearing"},
}
LOCATION_TO_SLOT = {spec["location"]: slot for slot, spec in SLOTS.items()}
DEFAULT_AXES_MAP = {"x": "axial", "y": "radial_h", "z": "radial_v"}
FACTORY_ADDRS = (0x50, 0x01)


def slot_of(location: str | None) -> int | None:
    """Internal slot for a position code, also accepting legacy ``S1``..``S4``."""
    text = (location or "").strip().upper()
    if text in LOCATION_TO_SLOT:
        return LOCATION_TO_SLOT[text]
    m = re.fullmatch(r"S([1-4])", text)
    return int(m.group(1)) if m else None


def point_name(slot: int) -> str:
    spec = SLOTS[slot]
    return f"{spec['short']} – {spec['label']}"


def point_id(machine_id: str, slot: int) -> str:
    """Keep legacy stable IDs; position names are used in every user-facing label."""
    return f"{machine_id}-s{slot}"


def build_edge_point(machine_id: str, slot: int, addr: int, template: dict | None, name: str | None = None) -> dict:
    """Point block for a new sensor, modelled on an existing point of the machine."""
    spec = SLOTS[slot]
    t = copy.deepcopy(template) if template else {}
    sensor = dict(t.get("sensor") or {"driver": "wtvb05", "bus": "busA", "velocity_scale": 0.01})
    sensor["addr"] = addr
    bearing = spec["role"] == "bearing"
    return {
        "id": point_id(machine_id, slot), "name": name or point_name(slot), "location": spec["location"], "role": spec["role"],
        "sensor": sensor, "axes_map": t.get("axes_map") or dict(DEFAULT_AXES_MAP),
        "iso_axes": list(t.get("iso_axes") or ["y", "z"]) if bearing else [],
        "bearing": None, "idle_sr": t.get("idle_sr", 3),
        "profiles": copy.deepcopy(t.get("profiles") or [{"name": "orders", "sr": 3, "frames": 1, "every_s": 30}]),
        "calibration": [], "baselines": [],
    }


def add_point_to_config(cfg: dict, machine_id: str, point: dict) -> dict:
    """Append ``point`` to a machine configuration idempotently; return a new config."""
    out = copy.deepcopy(cfg)
    machine = next((m for m in out.get("machines") or [] if m.get("id") == machine_id), None)
    if machine is None:
        raise KeyError(machine_id)
    points = machine.setdefault("points", [])
    if not any(p.get("id") == point["id"] for p in points):
        points.append(point)
    out.pop("version", None)
    return out
