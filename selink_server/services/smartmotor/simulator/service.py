"""MQTT sensor/gateway simulator for end-to-end commissioning without hardware.

It discovers configured assets from PostgreSQL and publishes the same JSON topics as
the T153 edge gateway. No database table is written directly by this process.
"""
from __future__ import annotations

import asyncio
import base64
import gzip
import json
import logging
import math
import os
import time
import uuid
from collections import defaultdict
from datetime import datetime, timezone
from urllib.parse import urlparse

import aiomqtt
import numpy as np

from ..common.db import create_pool, migrate, migrations_dir
from ..common.iso import iso_limits
from ..common.settings import Settings
from ..common.wavefile import G_PER_LSB

log = logging.getLogger("simulator")


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def msg_id(prefix: str) -> str:
    return f"sim-{prefix}-{uuid.uuid4().hex}"


class Simulator:
    def __init__(self, settings: Settings):
        self.s = settings
        self.interval = max(1.0, float(os.getenv("SIM_INTERVAL_S", "2")))
        self.capture_interval = max(15.0, float(os.getenv("SIM_CAPTURE_INTERVAL_S", "60")))
        self.scenario = os.getenv("SIM_SCENARIO", "demo").lower()
        self.fs_hz = float(os.getenv("SIM_FS_HZ", "6400"))
        self.n_fft = int(os.getenv("SIM_N_FFT", "2048"))
        self.frames = int(os.getenv("SIM_FRAMES", "2"))
        self.started = time.monotonic()
        self.assets: list[dict] = []
        self.by_gateway: dict[str, list[dict]] = defaultdict(list)
        self.gateway_info: dict[str, dict] = {}
        self._capture_requested: set[str] = set()
        self._rng = np.random.default_rng(int(os.getenv("SIM_SEED", "153")))

    async def load_assets(self) -> None:
        pool = await create_pool(self.s.db_url, max_size=2)
        await migrate(pool, migrations_dir(self.s.migrations_dir))
        async with pool.acquire() as c:
            gateways = await c.fetch(
                """SELECT g.id AS gateway_id, s.id AS site_id, s.tenant_id
                   FROM gateways g JOIN sites s ON s.id=g.site_id ORDER BY g.id""")
            rows = await c.fetch(
                """SELECT p.id AS point_id, p.name AS point_name, p.sensor_addr, p.role, p.iso_axes,
                          m.id AS machine_id, m.name AS machine_name, m.rated_power_kw, m.rated_speed_rpm,
                          m.rated_voltage_v, m.rated_current_a, m.iso_group, m.foundation,
                          g.id AS gateway_id, s.id AS site_id, s.tenant_id
                   FROM measurement_points p JOIN machines m ON m.id=p.machine_id
                   JOIN gateways g ON g.id=p.gateway_id JOIN sites s ON s.id=g.site_id
                   ORDER BY g.id, m.id, p.id""")
        await pool.close()
        self.assets = [dict(row) for row in rows]
        self.gateway_info = {row["gateway_id"]: dict(row) for row in gateways}
        self.by_gateway.clear()
        for gateway_id in self.gateway_info:
            self.by_gateway[gateway_id] = []
        for asset in self.assets:
            self.by_gateway[asset["gateway_id"]].append(asset)
        if not self.assets:
            raise RuntimeError("No measurement points are configured")
        log.info("loaded %d points on %d gateways", len(self.assets), len(self.gateway_info))

    def prefix(self, asset: dict) -> str:
        return f"{self.s.mqtt_topic_root}/{asset['tenant_id']}/{asset['site_id']}/{asset['gateway_id']}"

    def gateway_prefix(self, gateway_id: str) -> str:
        gateway = self.gateway_info[gateway_id]
        return f"{self.s.mqtt_topic_root}/{gateway['tenant_id']}/{gateway['site_id']}/{gateway_id}"

    async def publish(self, client: aiomqtt.Client, topic: str, payload: dict, retain: bool = False) -> None:
        await client.publish(topic, json.dumps(payload, separators=(",", ":"), allow_nan=False), qos=1, retain=retain)

    def level(self, asset: dict, tick: float) -> float:
        limits = iso_limits(asset.get("iso_group"), asset.get("foundation"))
        if self.scenario == "normal":
            target = limits.ab * 0.65
        elif self.scenario == "warning":
            target = (limits.bc + limits.cd) / 2
        elif self.scenario == "danger":
            target = limits.cd * 1.12
        else:
            # Demo deliberately spans ISO zones without producing unsafe-looking values for every machine.
            targets = {
                "ga55-01": limits.bc * 0.82,
                "ga55-02": (limits.bc + limits.cd) / 2,
                "pump-01": limits.ab * 0.72,
                "pump-02": (limits.ab + limits.bc) / 2,
                "pump-03": limits.bc * 0.88,
                "mycom-01": (limits.ab + limits.bc) / 2,
            }
            target = targets.get(asset["machine_id"], limits.ab * 0.75)
        point_factor = 0.92 + (sum(asset["point_id"].encode()) % 17) / 100
        breathing = 1 + 0.045 * math.sin(tick / 23 + (sum(asset["point_id"].encode()) % 13))
        return round(target * point_factor * breathing, 4)

    async def publish_gateway(self, client: aiomqtt.Client, gateway_id: str, points: list[dict]) -> None:
        pfx = self.gateway_prefix(gateway_id)
        ts = now_iso()
        await self.publish(client, f"{pfx}/status", {"online": True, "version": "sim-1.0.0"}, retain=True)
        devices = {p["point_id"]: {"offline": False, "last_ok": ts} for p in points}
        bus_devices = {p["point_id"]: {"requests": 1000, "timeouts": 0, "crc": 0} for p in points}
        await self.publish(client, f"{pfx}/health", {
            "msg_id": msg_id("health"), "ts": ts, "version": "sim-1.0.0",
            "uptime_s": int(time.monotonic() - self.started), "cpu_pct": 14.0 + len(points),
            "mem_rss_mb": 86.5, "soc_temp_c": 45.2, "disk_free_mb": 12288,
            "data_used_mb": 128.4, "outbox_pending": 0, "local_alarm_on": False,
            "net_iface": "sim0", "rssi_dbm": -48, "devices": devices,
            "bus_stats": {"sim-rs485": {"devices": bus_devices}},
        })

    async def publish_point(self, client: aiomqtt.Client, asset: dict, tick: float) -> None:
        ts = now_iso()
        speed_hz = float(asset.get("rated_speed_rpm") or 1500) / 60
        value = self.level(asset, tick)
        ratios = {"x": 1.0, "y": 0.48, "z": 0.78}
        vel = {axis: round(value * ratio * (1 + 0.015 * self._rng.normal()), 4) for axis, ratio in ratios.items()}
        acc = {axis: round(v / 1000 * 2 * math.pi * speed_hz / 9.80665, 5) for axis, v in vel.items()}
        disp = {axis: round(v / (2 * math.pi * speed_hz) * 2 * math.sqrt(2) * 1000, 2) for axis, v in vel.items()}
        topic = f"{self.prefix(asset)}/metrics/vib/{asset['point_id']}"
        await self.publish(client, topic, {
            "msg_id": msg_id("vib"), "ts": ts, "window_s": round(self.interval), "point_id": asset["point_id"],
            "sensor": {"model": "WTVB05-SIM", "addr": asset.get("sensor_addr"), "sr_code": 6, "mode": 1, "fw": "sim-1.0"},
            "vel_mm_s": vel, "vel_mm_s_max": {a: round(v * 1.08, 4) for a, v in vel.items()},
            "disp_um": disp, "freq_hz": {a: round(speed_hz, 3) for a in "xyz"}, "acc_g": acc,
            "temp_c": round(52 + value * 2.8 + 0.4 * math.sin(tick / 31), 2), "flags": ["simulated"],
        })
        axes = {}
        for axis in "xyz":
            axes[axis] = {
                "acc_rms_g": acc[axis], "vel_rms_mm_s": vel[axis], "disp_rms_mm": disp[axis] / 2000,
                "crest": 1.7, "kurtosis": 3.05, "skew": 0.03, "wave_index": 1.2,
                "peak_index": 2.1, "pulse_coef": 2.4, "acc_var": acc[axis] ** 2, "vel_kurt": 3.0, "err_code": 0,
            }
        await self.publish(client, f"{self.prefix(asset)}/metrics/vibstat/{asset['point_id']}", {
            "msg_id": msg_id("stat"), "ts": ts, "point_id": asset["point_id"], "sr_code": 6, "mode": 1,
            "axes": axes, "flags": ["simulated"],
        })

    async def publish_machine(self, client: aiomqtt.Client, asset: dict, tick: float) -> None:
        ts = now_iso()
        rated_kw = float(asset.get("rated_power_kw") or 55)
        load = 71 + 5 * math.sin(tick / 37 + sum(asset["machine_id"].encode()) % 9)
        voltage = float(asset.get("rated_voltage_v") or 400)
        current = float(asset.get("rated_current_a") or rated_kw * 1.75) * load / 100
        p_kw = rated_kw * load / 100
        await self.publish(client, f"{self.prefix(asset)}/metrics/power/{asset['machine_id']}", {
            "msg_id": msg_id("power"), "ts": ts, "window_s": round(self.interval), "machine_id": asset["machine_id"],
            "u_v": [round(voltage * x, 2) for x in (1.002, 0.997, 1.001)],
            "i_a": [round(current * x, 2) for x in (1.012, 0.991, 0.997)],
            "p_kw": round(p_kw, 2), "q_kvar": round(p_kw * 0.31, 2), "pf": 0.955,
            "f_hz": 50.01, "thd_u_pct": 2.1, "thd_i_pct": 4.8, "kwh": round(10000 + tick * p_kw / 3600, 3),
            "i_unbalance_pct": 1.8, "u_unbalance_pct": 0.5, "load_pct": round(load, 2), "running": True,
        })
        bearing = 57 + p_kw / max(rated_kw, 1) * 12
        winding = 79 + p_kw / max(rated_kw, 1) * 25
        await self.publish(client, f"{self.prefix(asset)}/metrics/temp/{asset['machine_id']}", {
            "msg_id": msg_id("temp"), "ts": ts, "machine_id": asset["machine_id"],
            "frame_temp_c": round(bearing - 7, 2), "ambient_temp_c": 31.5,
            "bearing_temp_c": round(bearing, 2), "winding_temp_est_c": round(winding, 2),
            "winding_rise_est_k": round(winding - 31.5, 2), "thermal_model": "simulated-rated-load",
        })

    def waveform(self, asset: dict, value: float) -> bytes:
        total = self.n_fft * self.frames
        t = np.arange(total, dtype=np.float64) / self.fs_hz
        f1 = float(asset.get("rated_speed_rpm") or 1500) / 60
        arrays = []
        for ratio, phase in ((1.0, 0.0), (0.48, 0.7), (0.78, 1.3)):
            vel_rms = value * ratio / 1000
            peak_g = vel_rms * 2 * math.pi * f1 * math.sqrt(2) / 9.80665
            g = peak_g * np.sin(2 * math.pi * f1 * t + phase)
            g += peak_g * 0.16 * np.sin(2 * math.pi * 2 * f1 * t + phase / 2)
            g += self._rng.normal(0, max(peak_g * 0.035, 0.0002), total)
            arrays.append(np.clip(np.rint(g / G_PER_LSB), -32768, 32767).astype("<i2"))
        return np.column_stack(arrays).astype("<i2").tobytes()

    async def publish_capture(self, client: aiomqtt.Client, asset: dict) -> None:
        ts = now_iso()
        tick = time.monotonic() - self.started
        value = self.level(asset, tick)
        speed_hz = float(asset.get("rated_speed_rpm") or 1500) / 60
        cid = f"sim-{asset['point_id']}-{datetime.now(timezone.utc):%Y%m%dT%H%M%S}-{uuid.uuid4().hex[:6]}"
        axes = {}
        for axis, ratio in {"x": 1.0, "y": 0.48, "z": 0.78}.items():
            v = value * ratio
            axes[axis] = {
                "iso_vrms_mm_s": round(v, 4), "acc_rms_g": round(v / 1000 * 2 * math.pi * speed_hz / 9.80665, 5),
                "kurtosis": 3.05, "crest": 1.7, "orders": {
                    "0.5": round(v * 0.025, 4), "1": round(v * 0.88, 4), "1.5": round(v * 0.02, 4),
                    "2": round(v * 0.14, 4), "3": round(v * 0.04, 4), "4": round(v * 0.025, 4),
                }, "line_2x_mm_s": round(v * 0.08, 4), "mesh_mm_s": round(v * 0.12, 4),
            }
        isolation = None
        if asset["machine_id"] == "mycom-01" and asset.get("role") == "bearing":
            isolated_axes = {}
            for axis, feature in axes.items():
                isolated_axes[axis] = {
                    **feature,
                    "iso_vrms_mm_s": round(feature["iso_vrms_mm_s"] * 0.82, 4),
                    "orders": {key: round(val * (0.82 if key == "1" else 0.65), 4) for key, val in feature["orders"].items()},
                }
            isolated_max = max(isolated_axes[a]["iso_vrms_mm_s"] for a in (asset.get("iso_axes") or ["x", "z"]))
            isolation = {
                "reference_point": "mycom-01-s2", "source_point": "mycom-01-s1", "alpha_learned": True,
                "alpha": {"method": "simulated-transfer-function", "samples": 120},
                "iso_vrms_max_mm_s": round(isolated_max, 4),
                "zone": iso_limits(asset.get("iso_group"), asset.get("foundation")).zone(isolated_max),
                "axes": isolated_axes,
                "mesh": {"freq_hz": round(speed_hz * 4, 3), "expected_hz": round(speed_hz * 4, 3), "match_expected": True, "harmonics": 3},
                "bands": [
                    {"band": "1x", "axis": "x", "vel_mm_s": round(isolated_axes["x"]["orders"]["1"], 4), "warn": 1.5, "alarm": 2.3, "level": "warning"},
                    {"band": "2x", "axis": "x", "vel_mm_s": round(isolated_axes["x"]["orders"]["2"], 4), "warn": 1.0, "alarm": 1.8, "level": "normal"},
                    {"band": "3x4x", "axis": "x", "vel_mm_s": round(isolated_axes["x"]["orders"]["3"], 4), "warn": 0.8, "alarm": 1.5, "level": "normal"},
                ],
                "local_peaks": [{"freq_hz": round(speed_hz, 3), "vel_mm_s": round(isolated_axes["x"]["orders"]["1"], 4)}],
                "transmitted_peaks": [{"freq_hz": round(speed_hz * 4, 3), "vel_mm_s": round(value * 0.12, 4)}],
            }
        pfx = self.prefix(asset)
        await self.publish(client, f"{pfx}/features/{asset['point_id']}", {
            "msg_id": msg_id("features"), "capture_id": cid, "point_id": asset["point_id"],
            "machine_id": asset["machine_id"], "profile": "sim-demo", "ts": ts, "fs_hz": self.fs_hz,
            "sr_code": 6, "frames": self.frames, "frames_contiguous": True, "n_fft": self.n_fft,
            "df_hz": self.fs_hz / self.n_fft, "running": True, "load_pct": 72.0,
            "speed_hz": speed_hz, "speed_confidence": "high", "axes": axes,
            "envelope": {"band_hz": [800, 2500], "axes": {}}, "isolation": isolation, "quality_flags": ["simulated"],
        })
        compressed = gzip.compress(self.waveform(asset, value))
        await self.publish(client, f"{pfx}/waveform/{asset['point_id']}", {
            "msg_id": msg_id("wave"), "capture_id": cid, "point_id": asset["point_id"], "ts": ts,
            "fs_hz": self.fs_hz, "frames": self.frames, "frames_contiguous": True,
            "encoding": "int16le+gzip+base64", "g_per_lsb": G_PER_LSB,
            "data": base64.b64encode(compressed).decode(),
        })
        log.info("capture %s point=%s iso=%.2f", cid, asset["point_id"], value)

    async def consume_commands(self, client: aiomqtt.Client) -> None:
        async for message in client.messages:
            topic = str(message.topic)
            if not topic.endswith("/cmd"):
                continue
            try:
                command = json.loads(bytes(message.payload))
                parts = topic.split("/")
                gateway_id = parts[-2]
                points = self.by_gateway.get(gateway_id) or []
                if command.get("type") in ("capture_now", "group_capture"):
                    requested = command.get("point_id") or (command.get("params") or {}).get("point_id")
                    if requested:
                        self._capture_requested.add(requested)
                    else:
                        self._capture_requested.update(p["point_id"] for p in points)
                detail = "simulator accepted command"
                if gateway_id in self.gateway_info:
                    await self.publish(client, f"{self.gateway_prefix(gateway_id)}/cmd/ack", {
                        "cmd_id": command.get("cmd_id", "unknown"), "status": "ok", "detail": detail,
                    })
            except Exception:
                log.exception("invalid simulator command on %s", topic)

    async def run(self) -> None:
        await self.load_assets()
        url = urlparse(self.s.mqtt_url)
        tls = url.scheme in ("mqtts", "ssl")
        while True:
            try:
                async with aiomqtt.Client(
                    hostname=url.hostname, port=url.port or (8883 if tls else 1883),
                    username=self.s.mqtt_ingest_user, password=self.s.mqtt_ingest_pass,
                    identifier="svc-simulator", tls_params=aiomqtt.TLSParameters() if tls else None,
                ) as client:
                    await client.subscribe(f"{self.s.mqtt_topic_root}/+/+/+/cmd", qos=1)
                    command_task = asyncio.create_task(self.consume_commands(client))
                    next_capture = 0.0
                    try:
                        while True:
                            tick = time.monotonic() - self.started
                            for gateway_id, points in self.by_gateway.items():
                                await self.publish_gateway(client, gateway_id, points)
                            for asset in self.assets:
                                await self.publish_point(client, asset, tick)
                            first_by_machine = {a["machine_id"]: a for a in self.assets}
                            for asset in first_by_machine.values():
                                await self.publish_machine(client, asset, tick)
                            if tick >= next_capture or self._capture_requested:
                                targets = self.assets if tick >= next_capture else [a for a in self.assets if a["point_id"] in self._capture_requested]
                                self._capture_requested.clear()
                                for asset in targets:
                                    await self.publish_capture(client, asset)
                                next_capture = tick + self.capture_interval
                            await asyncio.sleep(self.interval)
                    finally:
                        command_task.cancel()
            except aiomqtt.MqttError:
                log.exception("MQTT disconnected; retrying")
                await asyncio.sleep(5)
