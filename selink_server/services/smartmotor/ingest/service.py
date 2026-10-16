"""Ingest service (spec 6.3): subscribe MQTT → validate → dedupe → DB/MinIO → realtime."""
from __future__ import annotations

import asyncio
import base64
import gzip
import json
import logging
import math
import time
from collections import defaultdict
from datetime import datetime, timezone
from urllib.parse import urlparse

import aiomqtt
from pydantic import ValidationError

from ..common import bus
from ..common.assets import AssetCache
from ..common.db import create_pool, migrate, migrations_dir
from ..common.schemas import TOPIC_MODELS, Topic, parse_topic
from ..common.settings import Settings
from ..common.storage import Storage, capture_key
from ..common import wavefile

log = logging.getLogger("ingest")

AXES = ("x", "y", "z")

SQL_VIB = """
INSERT INTO vib_metrics (ts, point_id, axis, vel_mm_s, vel_mm_s_max, disp_um, freq_hz, acc_g, temp_c, sr_code, mode, flags, msg_id)
VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
ON CONFLICT (point_id, axis, ts) DO UPDATE SET vel_mm_s=EXCLUDED.vel_mm_s, vel_mm_s_max=EXCLUDED.vel_mm_s_max,
  disp_um=EXCLUDED.disp_um, freq_hz=EXCLUDED.freq_hz, acc_g=EXCLUDED.acc_g, temp_c=EXCLUDED.temp_c,
  sr_code=EXCLUDED.sr_code, mode=EXCLUDED.mode, flags=EXCLUDED.flags, msg_id=EXCLUDED.msg_id"""

SQL_VIBSTAT = """
INSERT INTO vib_metrics (ts, point_id, axis, acc_rms_g, vel_rms_mm_s, disp_rms_mm, crest, kurtosis, skew, wave_index,
  peak_index, pulse_coef, acc_var, vel_kurt, err_code)
VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
ON CONFLICT (point_id, axis, ts) DO UPDATE SET acc_rms_g=EXCLUDED.acc_rms_g, vel_rms_mm_s=EXCLUDED.vel_rms_mm_s,
  disp_rms_mm=EXCLUDED.disp_rms_mm, crest=EXCLUDED.crest, kurtosis=EXCLUDED.kurtosis, skew=EXCLUDED.skew,
  wave_index=EXCLUDED.wave_index, peak_index=EXCLUDED.peak_index, pulse_coef=EXCLUDED.pulse_coef,
  acc_var=EXCLUDED.acc_var, vel_kurt=EXCLUDED.vel_kurt, err_code=EXCLUDED.err_code"""

SQL_ENERGY = """
INSERT INTO vib_energy (ts, point_id, axis, points, areas, total) VALUES ($1,$2,$3,$4,$5,$6)
ON CONFLICT (point_id, axis, ts) DO NOTHING"""

SQL_POWER = """
INSERT INTO power_metrics (ts, machine_id, u_v, i_a, p_kw, q_kvar, pf, f_hz, thd_u_pct, thd_i_pct, kwh,
  i_unbalance_pct, u_unbalance_pct, load_pct, running)
VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15) ON CONFLICT (machine_id, ts) DO NOTHING"""

SQL_TEMP = """
INSERT INTO temp_metrics (ts, machine_id, frame_temp_c, ambient_temp_c, bearing_temp_c, winding_temp_est_c,
  winding_rise_est_k, thermal_model) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
ON CONFLICT (machine_id, ts) DO NOTHING"""


def _num(v):
    if v is None:
        return None
    try:
        f = float(v)
    except (TypeError, ValueError):
        return None
    return None if math.isnan(f) or math.isinf(f) else f


class Batcher:
    """Collects rows per SQL statement and flushes every second or at 500 rows (spec 6.3 step 5)."""

    def __init__(self, pool, max_rows: int = 500, interval: float = 1.0):
        self.pool = pool
        self.max_rows = max_rows
        self.interval = interval
        self.rows: dict[str, list[tuple]] = defaultdict(list)
        self.lock = asyncio.Lock()

    async def add(self, sql: str, rows: list[tuple]) -> None:
        async with self.lock:
            self.rows[sql].extend(rows)
            full = len(self.rows[sql]) >= self.max_rows
        if full:
            await self.flush()

    async def flush(self) -> None:
        async with self.lock:
            pending, self.rows = self.rows, defaultdict(list)
        if not pending:
            return
        async with self.pool.acquire() as c:
            for sql, rows in pending.items():
                try:
                    await c.executemany(sql, rows)
                except Exception:  # keep ingest alive; log the failing batch
                    log.exception("batch insert failed (%d rows)", len(rows))

    async def run(self) -> None:
        while True:
            await asyncio.sleep(self.interval)
            await self.flush()


class Ingest:
    def __init__(self, s: Settings):
        self.s = s
        self.pool = None
        self.redis = None
        self.storage = Storage(s)
        self.assets: AssetCache | None = None
        self.batch: Batcher | None = None
        self.stats = defaultdict(int)
        self._warned: set[str] = set()

    async def start(self) -> None:
        self.pool = await create_pool(self.s.db_url, max_size=8)
        await migrate(self.pool, migrations_dir(self.s.migrations_dir))
        self.redis = bus.connect(self.s.redis_url)
        await self.storage.ensure_bucket()
        self.assets = AssetCache(self.pool)
        await self.assets.refresh(force=True)
        self.batch = Batcher(self.pool)

    async def run(self) -> None:
        await self.start()
        asyncio.create_task(self.batch.run())
        asyncio.create_task(self._stats_loop())
        u = urlparse(self.s.mqtt_url)
        tls = u.scheme in ("mqtts", "ssl")
        while True:
            try:
                async with aiomqtt.Client(hostname=u.hostname, port=u.port or (8883 if tls else 1883),
                                          username=self.s.mqtt_ingest_user, password=self.s.mqtt_ingest_pass,
                                          identifier="svc-ingest", clean_session=False,
                                          tls_params=aiomqtt.TLSParameters() if tls else None) as client:
                    await client.subscribe(f"{self.s.mqtt_topic_root}/+/+/+/#", qos=1)
                    log.info("subscribed to %s/+/+/+/#", self.s.mqtt_topic_root)
                    async for msg in client.messages:
                        try:
                            await self.handle(str(msg.topic), bytes(msg.payload))
                        except Exception:
                            self.stats["errors"] += 1
                            log.exception("handle failed topic=%s", msg.topic)
            except aiomqtt.MqttError as e:
                log.warning("mqtt disconnected: %s; retrying in 5 s", e)
                await asyncio.sleep(5)

    async def _stats_loop(self) -> None:
        while True:
            await asyncio.sleep(60)
            if self.stats:
                log.info("ingest stats %s", dict(self.stats))
                self.stats.clear()

    # ------------------------------------------------------------------ dispatch
    async def handle(self, topic: str, payload: bytes) -> None:
        t = parse_topic(topic, self.s.mqtt_topic_root)
        if t is None or t.kind in ("cmd", "config"):
            return
        await self.assets.refresh()
        if not self.assets.gateway_ok(t.gateway, t.tenant, t.site):
            await self.assets.refresh(force=True)
            if not self.assets.gateway_ok(t.gateway, t.tenant, t.site):
                self._warn_once(f"gw:{t.gateway}", "unknown gateway or tenant/site mismatch: %s", topic)
                self.stats["rejected"] += 1
                return
        model = TOPIC_MODELS.get(t.kind)
        if model is None:
            return
        try:
            data = model.model_validate_json(payload)
        except ValidationError as e:
            self.stats["invalid"] += 1
            log.warning("invalid payload topic=%s: %s", topic, e.errors()[:3])
            return
        msg_id = getattr(data, "msg_id", None)
        if not await bus.dedupe(self.redis, msg_id):
            self.stats["duplicate"] += 1
            return
        self.stats[t.kind] += 1
        handler = getattr(self, "on_" + t.kind.replace("/", "_"))
        await handler(t, data)

    def _warn_once(self, key: str, fmt: str, *args) -> None:
        if key not in self._warned:
            self._warned.add(key)
            log.warning(fmt, *args)

    def _point_ok(self, point_id: str) -> bool:
        if point_id in self.assets.points:
            return True
        self._warn_once(f"pt:{point_id}", "unknown point %s (add it to measurement_points)", point_id)
        return False

    async def _touch_gateway(self, gw: str, **fields) -> None:
        sets = ["last_seen = now()", "online = true"]
        args: list = [gw]
        for k, v in fields.items():
            args.append(v)
            sets.append(f"{k} = ${len(args)}")
        async with self.pool.acquire() as c:
            await c.execute(f"UPDATE gateways SET {', '.join(sets)} WHERE id = $1", *args)

    # ------------------------------------------------------------------ metrics
    async def on_metrics_vib(self, t: Topic, d) -> None:
        if not self._point_ok(d.point_id):
            return
        rows = []
        for a in AXES:
            rows.append((d.ts, d.point_id, a, _num(getattr(d.vel_mm_s, a)), _num(getattr(d.vel_mm_s_max, a)),
                         _num(getattr(d.disp_um, a)), _num(getattr(d.freq_hz, a)), _num(getattr(d.acc_g, a)),
                         _num(d.temp_c), d.sensor.sr_code, d.sensor.mode, d.flags, d.msg_id))
        await self.batch.add(SQL_VIB, rows)
        m = self.assets.machine_of(d.point_id)
        msg = {"type": "vib", "point_id": d.point_id, "machine_id": m["id"] if m else None,
               "ts": d.ts.isoformat(), "vel_mm_s": d.vel_mm_s.model_dump(), "disp_um": d.disp_um.model_dump(),
               "acc_g": d.acc_g.model_dump(), "freq_hz": d.freq_hz.model_dump(), "temp_c": d.temp_c, "flags": d.flags}
        await bus.publish(self.redis, f"rt:point:{d.point_id}", msg)
        if m:
            await bus.publish(self.redis, f"rt:machine:{m['id']}", msg)

    async def on_metrics_vibstat(self, t: Topic, d) -> None:
        if not self._point_ok(d.point_id):
            return
        # WTVB05 firmware 193.24 exposes B2 but returns an all-zero statistics
        # block in MODE=1. It is not a real zero-vibration observation and must
        # not dilute trends/baselines. Fast RMS computed from RAWFIFO uses the
        # explicit edge_raw_iso source and remains eligible below.
        if d.source == "sensor_b2" and not any(
            (s.vel_rms_mm_s or 0) != 0 or (s.acc_rms_g or 0) != 0
            for s in d.axes.values()
        ):
            self.stats["ignored_empty_vibstat"] += 1
            return
        rows = []
        for a, s in d.axes.items():
            if a not in AXES:
                continue
            rows.append((d.ts, d.point_id, a, _num(s.acc_rms_g), _num(s.vel_rms_mm_s), _num(s.disp_rms_mm), _num(s.crest),
                         _num(s.kurtosis), _num(s.skew), _num(s.wave_index), _num(s.peak_index), _num(s.pulse_coef),
                         _num(s.acc_var), _num(s.vel_kurt), s.err_code))
        await self.batch.add(SQL_VIBSTAT, rows)
        msg = {"type": "vibstat", "point_id": d.point_id, "ts": d.ts.isoformat(), "source": d.source,
               "window_ms": d.window_ms, "frames": d.frames,
               "axes": {a: s.model_dump() for a, s in d.axes.items()}}
        await bus.publish(self.redis, f"rt:point:{d.point_id}", msg)
        # The live machine dashboard subscribes once at machine level. Forward
        # statistics there as well so RMS values can update without polling.
        machine = self.assets.machine_of(d.point_id)
        if machine:
            await bus.publish(self.redis, f"rt:machine:{machine['id']}", msg)

    async def on_metrics_vibenergy(self, t: Topic, d) -> None:
        if not self._point_ok(d.point_id):
            return
        rows = [(d.ts, d.point_id, a, e.points, e.areas, e.total) for a, e in d.axes.items() if a in AXES]
        await self.batch.add(SQL_ENERGY, rows)

    async def on_metrics_power(self, t: Topic, d) -> None:
        u = [_num(v) for v in d.u_v]
        i = [_num(v) for v in d.i_a]
        await self.batch.add(SQL_POWER, [(d.ts, d.machine_id, u, i, _num(d.p_kw), _num(d.q_kvar), _num(d.pf),
                                          _num(d.f_hz), _num(d.thd_u_pct), _num(d.thd_i_pct), _num(d.kwh),
                                          _num(d.i_unbalance_pct), _num(d.u_unbalance_pct), _num(d.load_pct), d.running)])
        await bus.publish(self.redis, f"rt:machine:{d.machine_id}", {"type": "power", **json.loads(d.model_dump_json())})

    async def on_metrics_temp(self, t: Topic, d) -> None:
        await self.batch.add(SQL_TEMP, [(d.ts, d.machine_id, _num(d.frame_temp_c), _num(d.ambient_temp_c),
                                         _num(d.bearing_temp_c), _num(d.winding_temp_est_c), _num(d.winding_rise_est_k),
                                         d.thermal_model)])
        await bus.publish(self.redis, f"rt:machine:{d.machine_id}", {"type": "temp", **json.loads(d.model_dump_json())})

    # ------------------------------------------------------------------ captures
    async def on_features(self, t: Topic, d) -> None:
        if not self._point_ok(d.point_id):
            return
        point = self.assets.points[d.point_id]
        machine = self.assets.machine_of(d.point_id)
        lim = self.assets.limits_for(machine)
        iso_axes = point.get("iso_axes") or list(AXES)
        vals = [d.axes[a].get("iso_vrms_mm_s") for a in iso_axes if a in d.axes]
        vals = [v for v in vals if v is not None]
        v = max(vals) if vals else None
        if d.isolation and d.isolation.get("iso_vrms_max_mm_s") is not None:
            v = d.isolation["iso_vrms_max_mm_s"]
        zone = lim.zone(v) if point.get("role", "bearing") == "bearing" else None
        features = {"axes": d.axes, "envelope": d.envelope, "isolation": d.isolation}
        async with self.pool.acquire() as c:
            await c.execute(
                """INSERT INTO captures (capture_id, ts, point_id, profile, fs_hz, sr_code, frames, frames_contiguous, n_fft,
                     df_hz, running, load_pct, speed_hz, speed_confidence, features, iso_vrms_max_mm_s, iso_zone,
                     quality_flags, processed_by)
                   VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,'edge')
                   ON CONFLICT (capture_id) DO UPDATE SET ts=EXCLUDED.ts, point_id=EXCLUDED.point_id, profile=EXCLUDED.profile,
                     fs_hz=EXCLUDED.fs_hz, sr_code=EXCLUDED.sr_code, frames=EXCLUDED.frames,
                     frames_contiguous=EXCLUDED.frames_contiguous, n_fft=EXCLUDED.n_fft, df_hz=EXCLUDED.df_hz,
                     running=EXCLUDED.running, load_pct=EXCLUDED.load_pct, speed_hz=EXCLUDED.speed_hz,
                     speed_confidence=EXCLUDED.speed_confidence, features=EXCLUDED.features,
                     iso_vrms_max_mm_s=EXCLUDED.iso_vrms_max_mm_s, iso_zone=EXCLUDED.iso_zone,
                     quality_flags=EXCLUDED.quality_flags""",
                d.capture_id, d.ts, d.point_id, d.profile, d.fs_hz, d.sr_code, d.frames, d.frames_contiguous, d.n_fft,
                d.df_hz, d.running, _num(d.load_pct), _num(d.speed_hz), d.speed_confidence, features, _num(v), zone,
                d.quality_flags)
        summary = {"type": "capture", "capture_id": d.capture_id, "point_id": d.point_id, "profile": d.profile,
                   "ts": d.ts.isoformat(), "iso_vrms_max_mm_s": v, "iso_zone": zone, "speed_hz": d.speed_hz,
                   # per-axis values so the live page can update its cards straight from the push
                   "axes_iso": {a: {k: (d.axes[a] or {}).get(k) for k in ("iso_vrms_mm_s", "acc_rms_g", "acc_peak_g")}
                                for a in d.axes}}
        await bus.publish(self.redis, f"rt:point:{d.point_id}", summary)
        if machine:
            await bus.publish(self.redis, f"rt:machine:{machine['id']}", summary)
        await bus.publish(self.redis, "analytics:capture", {"capture_id": d.capture_id, "point_id": d.point_id,
                                                             "machine_id": machine["id"] if machine else None,
                                                             "stage": "features"})

    async def _ensure_capture(self, c, d, point_id: str) -> None:
        await c.execute("INSERT INTO captures (capture_id, ts, point_id) VALUES ($1,$2,$3) ON CONFLICT DO NOTHING",
                        d.capture_id, d.ts, point_id)

    async def on_waveform(self, t: Topic, d) -> None:
        point_id = d.point_id or t.subject
        if not self._point_ok(point_id):
            return
        raw = base64.b64decode(d.data)
        interleaved = gzip.decompress(raw) if raw[:2] == b"\x1f\x8b" else raw
        header = {"fs_hz": d.fs_hz, "frames": d.frames, "frames_contiguous": d.frames_contiguous,
                  "capture_id": d.capture_id, "point_id": point_id, "ts": d.ts.isoformat(),
                  "scale": f"g_per_lsb={d.g_per_lsb or wavefile.G_PER_LSB}"}
        key = capture_key("raw", point_id, d.ts.astimezone(timezone.utc), d.capture_id, ".bin.gz")
        await self.storage.put(key, wavefile.encode(header, interleaved), "application/gzip")
        async with self.pool.acquire() as c:
            await self._ensure_capture(c, d, point_id)
            await c.execute("UPDATE captures SET waveform_key=$2 WHERE capture_id=$1", d.capture_id, key)
        m = self.assets.machine_of(point_id)
        await bus.publish(self.redis, "analytics:capture", {"capture_id": d.capture_id, "point_id": point_id,
                                                             "machine_id": m["id"] if m else None, "stage": "waveform"})

    async def on_spectrum(self, t: Topic, d) -> None:
        point_id = d.point_id or t.subject
        if not self._point_ok(point_id):
            return
        raw = base64.b64decode(d.data)
        key = capture_key("spec", point_id, d.ts.astimezone(timezone.utc), d.capture_id, ".json.gz")
        await self.storage.put(key, raw if raw[:2] == b"\x1f\x8b" else gzip.compress(raw), "application/gzip")
        async with self.pool.acquire() as c:
            await self._ensure_capture(c, d, point_id)
            await c.execute("UPDATE captures SET spectrum_key=$2 WHERE capture_id=$1", d.capture_id, key)

    # ------------------------------------------------------------------ events & gateway
    async def on_events(self, t: Topic, d) -> None:
        async with self.pool.acquire() as c:
            if d.state == "cleared":
                n = await c.execute("UPDATE events SET cleared_at=$2 WHERE event_id=$1", d.event_id, d.ts)
                if n.endswith(" 0"):
                    await c.execute(
                        """INSERT INTO events (event_id, ts, machine_id, point_id, type, severity, state, rule, metric, value,
                             threshold, message, capture_id, source, cleared_at, gateway_id)
                           VALUES ($1,$2,$3,$4,$5,$6,'resolved',$7,$8,$9,$10,$11,$12,$13,$2,$14) ON CONFLICT DO NOTHING""",
                        d.event_id, d.ts, d.machine_id, d.point_id, d.type, d.severity, d.rule, d.metric, _num(d.value),
                        _num(d.threshold), d.message, d.capture_id, d.source, t.gateway)
            else:
                await c.execute(
                    """INSERT INTO events (event_id, ts, machine_id, point_id, type, severity, state, rule, metric, value,
                         threshold, message, capture_id, source, gateway_id)
                       VALUES ($1,$2,$3,$4,$5,$6,'raised',$7,$8,$9,$10,$11,$12,$13,$14)
                       ON CONFLICT (event_id) DO UPDATE SET severity=EXCLUDED.severity, value=EXCLUDED.value,
                         threshold=EXCLUDED.threshold, message=EXCLUDED.message,
                         capture_id=COALESCE(EXCLUDED.capture_id, events.capture_id)""",
                    d.event_id, d.ts, d.machine_id, d.point_id, d.type, d.severity, d.rule, d.metric, _num(d.value),
                    _num(d.threshold), d.message, d.capture_id, d.source, t.gateway)
        if d.rule == "alpha_learned" and d.machine_id and d.point_id and d.message and ": " in d.message:
            await self._store_alpha(d.machine_id, d.point_id, d.message.split(": ", 1)[1])
        ev = json.loads(d.model_dump_json())
        ev["gateway_id"] = t.gateway
        await bus.publish(self.redis, "rt:events", {"type": "event", **ev})
        if d.machine_id:
            await bus.publish(self.redis, f"rt:machine:{d.machine_id}", {"type": "event", **ev})
        if d.state == "raised" and d.severity in ("watch", "warning", "danger"):
            await bus.publish(self.redis, "notify", {"event_id": d.event_id})
            if d.type == "alarm":
                await bus.publish(self.redis, "analytics:event", {"event_id": d.event_id, "machine_id": d.machine_id,
                                                                  "point_id": d.point_id, "capture_id": d.capture_id})

    async def _store_alpha(self, machine_id: str, point_id: str, table_json: str) -> None:
        """Persist α learned at the edge into machines.isolation.alpha (Beer HN)."""
        try:
            table = json.loads(table_json)
        except json.JSONDecodeError:
            return
        async with self.pool.acquire() as c:
            await c.execute(
                """UPDATE machines SET isolation = jsonb_set(COALESCE(isolation,'{}'::jsonb), '{alpha}',
                     COALESCE(isolation->'alpha','{}'::jsonb) || jsonb_build_object($2::text, $3::jsonb))
                   WHERE id=$1""", machine_id, point_id, table)
        log.info("stored learned alpha for %s/%s: %s", machine_id, point_id, table)

    async def on_status(self, t: Topic, d) -> None:
        async with self.pool.acquire() as c:
            await c.execute("UPDATE gateways SET online=$2, fw_version=COALESCE($3, fw_version), last_seen=now() WHERE id=$1",
                            t.gateway, d.online, d.version)
        await bus.publish(self.redis, "rt:gateways", {"type": "status", "gateway_id": t.gateway, "online": d.online})

    async def on_health(self, t: Topic, d) -> None:
        h = json.loads(d.model_dump_json())
        await self._touch_gateway(t.gateway, health=h, fw_version=d.version)
        await bus.publish(self.redis, "rt:gateways", {"type": "health", "gateway_id": t.gateway, **h})

    async def on_cmd_ack(self, t: Topic, d) -> None:
        async with self.pool.acquire() as c:
            await c.execute("UPDATE gateway_commands SET status=$2, detail=$3, acked_at=now() WHERE cmd_id=$1",
                            d.cmd_id, d.status, d.detail)
        await bus.publish(self.redis, "rt:gateways", {"type": "cmd_ack", "gateway_id": t.gateway, **d.model_dump()})
