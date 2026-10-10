"""Pydantic models of MQTT payloads (spec 5.10 + t153_edge/docs/CHANGELOG.md).

Models allow extra fields so newer edge versions can add data without breaking ingest.
"""
from __future__ import annotations

from datetime import datetime
from typing import Any, Literal, Optional

from pydantic import BaseModel, ConfigDict, Field


class _M(BaseModel):
    model_config = ConfigDict(extra="allow")


class XYZ(_M):
    x: Optional[float] = None
    y: Optional[float] = None
    z: Optional[float] = None


class SensorInfo(_M):
    model: str = "WTVB05"
    addr: Optional[int] = None
    sr_code: Optional[int] = None
    mode: Optional[int] = None
    fw: Optional[str] = None


class VibMetrics(_M):
    msg_id: Optional[str] = None
    ts: datetime
    window_s: int = 10
    point_id: str
    sensor: SensorInfo = Field(default_factory=SensorInfo)
    vel_mm_s: XYZ = Field(default_factory=XYZ)
    vel_mm_s_max: XYZ = Field(default_factory=XYZ)
    disp_um: XYZ = Field(default_factory=XYZ)
    freq_hz: XYZ = Field(default_factory=XYZ)
    acc_g: XYZ = Field(default_factory=XYZ)
    temp_c: Optional[float] = None
    flags: list[str] = Field(default_factory=list)


class VibStatAxis(_M):
    crest: Optional[float] = None
    kurtosis: Optional[float] = None
    acc_abs_mean_g: Optional[float] = None
    acc_var: Optional[float] = None
    acc_rms_g: Optional[float] = None
    wave_index: Optional[float] = None
    peak_index: Optional[float] = None
    pulse_coef: Optional[float] = None
    skew: Optional[float] = None
    vel_rms_mm_s: Optional[float] = None
    vel_kurt: Optional[float] = None
    disp_rms_mm: Optional[float] = None
    err_code: Optional[int] = None


class VibStat(_M):
    msg_id: Optional[str] = None
    ts: datetime
    point_id: str
    sr_code: Optional[int] = None
    mode: Optional[int] = None
    axes: dict[str, VibStatAxis]
    flags: list[str] = Field(default_factory=list)


class EnergyAxis(_M):
    points: list[float]
    areas: list[float]
    total: float


class VibEnergy(_M):
    msg_id: Optional[str] = None
    ts: datetime
    point_id: str
    axes: dict[str, EnergyAxis]


class PowerMetrics(_M):
    msg_id: Optional[str] = None
    ts: datetime
    window_s: int = 10
    machine_id: str
    u_v: list[Optional[float]]
    i_a: list[Optional[float]]
    p_kw: Optional[float] = None
    q_kvar: Optional[float] = None
    pf: Optional[float] = None
    f_hz: Optional[float] = None
    thd_u_pct: Optional[float] = None
    thd_i_pct: Optional[float] = None
    kwh: Optional[float] = None
    i_unbalance_pct: Optional[float] = None
    u_unbalance_pct: Optional[float] = None
    load_pct: Optional[float] = None
    running: Optional[bool] = None


class TempMetrics(_M):
    msg_id: Optional[str] = None
    ts: datetime
    machine_id: str
    frame_temp_c: Optional[float] = None
    ambient_temp_c: Optional[float] = None
    bearing_temp_c: Optional[float] = None
    winding_temp_est_c: Optional[float] = None
    winding_rise_est_k: Optional[float] = None
    thermal_model: Optional[str] = None


class FeatureSet(_M):
    msg_id: Optional[str] = None
    capture_id: str
    point_id: str
    machine_id: Optional[str] = None
    profile: Optional[str] = None
    ts: datetime
    fs_hz: float
    sr_code: Optional[int] = None
    frames: int = 1
    frames_contiguous: bool = False
    n_fft: Optional[int] = None
    df_hz: Optional[float] = None
    running: Optional[bool] = None
    load_pct: Optional[float] = None
    speed_hz: Optional[float] = None
    speed_confidence: Optional[str] = None
    axes: dict[str, dict[str, Any]]
    envelope: Optional[dict[str, Any]] = None
    isolation: Optional[dict[str, Any]] = None
    quality_flags: list[str] = Field(default_factory=list)
    waveform_ref: Optional[str] = None
    spectrum_ref: Optional[str] = None


class Blob(_M):
    msg_id: Optional[str] = None
    capture_id: str
    point_id: Optional[str] = None
    ts: datetime
    fs_hz: Optional[float] = None
    frames: Optional[int] = None
    frames_contiguous: bool = False
    encoding: str
    g_per_lsb: Optional[float] = None
    data: str


class Event(_M):
    msg_id: Optional[str] = None
    ts: datetime
    event_id: str
    type: str = "alarm"
    state: Literal["raised", "cleared", "acknowledged"] = "raised"
    severity: str = "info"
    machine_id: Optional[str] = None
    point_id: Optional[str] = None
    rule: Optional[str] = None
    metric: Optional[str] = None
    value: Optional[float] = None
    threshold: Optional[float] = None
    message: Optional[str] = None
    capture_id: Optional[str] = None
    source: str = "edge"


class Status(_M):
    online: bool
    version: Optional[str] = None


class Health(_M):
    msg_id: Optional[str] = None
    ts: datetime
    version: Optional[str] = None


class CmdAck(_M):
    cmd_id: str
    status: str
    detail: Optional[str] = None


TOPIC_MODELS: dict[str, type[BaseModel]] = {
    "metrics/vib": VibMetrics,
    "metrics/vibstat": VibStat,
    "metrics/vibenergy": VibEnergy,
    "metrics/power": PowerMetrics,
    "metrics/temp": TempMetrics,
    "features": FeatureSet,
    "waveform": Blob,
    "spectrum": Blob,
    "events": Event,
    "status": Status,
    "health": Health,
    "cmd/ack": CmdAck,
}


class Topic(BaseModel):
    tenant: str
    site: str
    gateway: str
    kind: str          # e.g. "metrics/vib", "features", "events"
    subject: Optional[str] = None  # point or machine id


def parse_topic(topic: str, root: str = "sm/v1") -> Optional[Topic]:
    """sm/v1/<tenant>/<site>/<gateway>/<kind>[/<subject>]"""
    if not topic.startswith(root + "/"):
        return None
    parts = topic[len(root) + 1:].split("/")
    if len(parts) < 4:
        return None
    tenant, site, gw, rest = parts[0], parts[1], parts[2], parts[3:]
    if rest[0] == "metrics" and len(rest) >= 3:
        return Topic(tenant=tenant, site=site, gateway=gw, kind=f"metrics/{rest[1]}", subject=rest[2])
    if rest[0] in ("features", "waveform", "spectrum") and len(rest) >= 2:
        return Topic(tenant=tenant, site=site, gateway=gw, kind=rest[0], subject=rest[1])
    if rest == ["cmd", "ack"]:
        return Topic(tenant=tenant, site=site, gateway=gw, kind="cmd/ack")
    if len(rest) == 1:
        return Topic(tenant=tenant, site=site, gateway=gw, kind=rest[0])
    return None
