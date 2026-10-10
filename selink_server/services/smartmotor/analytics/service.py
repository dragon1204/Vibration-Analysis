"""Analytics worker (spec 6.4): capture reprocessing, diagnosis, baselines, Criterion II,
trends, anomaly detection, RUL, monthly reports and gateway watch."""
from __future__ import annotations

import asyncio
import json
import logging
import math
import time
import uuid
from collections import defaultdict
from datetime import datetime, timedelta, timezone

import numpy as np
from apscheduler.schedulers.asyncio import AsyncIOScheduler

from ..common import bus, dsp, gwconfig, reports, wavefile
from ..common.assets import AssetCache
from ..common.db import create_pool, migrate, migrations_dir
from ..common.iso import SEVERITY_ORDER, iso_limits
from ..common.settings import Settings
from ..common.storage import Storage
from . import anomaly
from .baseline import extract_capture_features, load_bin, robust_stats, thresholds
from .diagnose import DiagContext, diagnose, to_diagnosis

log = logging.getLogger("analytics")

CAPTURE_DELAY_S = 20  # wait for the waveform after features arrive
CLEAN_EXCLUDE_FLAGS = {"saturated", "flatline", "spike", "time_unsynced"}


class Analytics:
    def __init__(self, s: Settings):
        self.s = s
        self.pool = None
        self.redis = None
        self.storage = Storage(s)
        self.assets: AssetCache | None = None
        self.pending: dict[str, float] = {}
        self.models: dict[str, tuple[float, dict | None]] = {}
        self.high_scores: dict[str, int] = defaultdict(int)

    async def start(self) -> None:
        self.pool = await create_pool(self.s.db_url, max_size=6)
        await migrate(self.pool, migrations_dir(self.s.migrations_dir))
        self.redis = bus.connect(self.s.redis_url)
        await self.storage.ensure_bucket()
        self.assets = AssetCache(self.pool)
        await self.assets.refresh(force=True)

    async def run(self) -> None:
        await self.start()
        sch = AsyncIOScheduler(timezone=self.s.timezone)
        sch.add_job(self.job_baseline_learn, "cron", hour=2, minute=0, id="baseline_learn")
        sch.add_job(self.job_criterion2, "cron", minute=5, id="criterion2")
        sch.add_job(self.job_trend_rate, "cron", minute=15, id="trend_rate")
        sch.add_job(self.job_anomaly_train, "cron", day_of_week="sun", hour=3, id="anomaly_train")
        sch.add_job(self.job_rul_estimate, "cron", hour=4, id="rul_estimate")
        sch.add_job(self.job_monthly_report, "cron", day=1, hour=5, id="monthly_report")
        sch.add_job(self.job_gateway_watch, "interval", minutes=1, id="gateway_watch")
        sch.add_job(self.job_reminders, "interval", minutes=1, id="reminders")
        sch.start()
        await asyncio.gather(self._listen(), self._worker())

    # ------------------------------------------------------------------ capture pipeline
    async def _listen(self) -> None:
        ps = self.redis.pubsub()
        await ps.subscribe("analytics:capture", "analytics:event", "analytics:cmd")
        async for m in ps.listen():
            if m.get("type") != "message":
                continue
            try:
                d = json.loads(m["data"])
            except (TypeError, json.JSONDecodeError):
                continue
            ch = m["channel"]
            if ch == "analytics:capture":
                delay = 1 if d.get("stage") == "waveform" else CAPTURE_DELAY_S
                self.pending[d["capture_id"]] = time.monotonic() + delay
            elif ch == "analytics:event":
                asyncio.create_task(self._safe(self.diagnose_for_event(d)))
            elif ch == "analytics:cmd":
                asyncio.create_task(self._safe(self.run_command(d)))

    async def _safe(self, coro) -> None:
        try:
            await coro
        except Exception:
            log.exception("analytics task failed")

    async def _worker(self) -> None:
        while True:
            await asyncio.sleep(1)
            now = time.monotonic()
            due = [c for c, t in self.pending.items() if t <= now]
            for cid in due:
                self.pending.pop(cid, None)
                await self._safe(self.process_capture(cid))

    async def run_command(self, d: dict) -> None:
        """Manual triggers from the API: {"job": "baseline_learn" | "anomaly_train" | ..., "machine_id"?}."""
        job = getattr(self, "job_" + d.get("job", ""), None)
        if job:
            await job()

    async def process_capture(self, capture_id: str) -> None:
        await self.assets.refresh()
        async with self.pool.acquire() as c:
            row = await c.fetchrow("SELECT * FROM captures WHERE capture_id=$1", capture_id)
        if not row or not row["features"]:
            return
        cap = dict(row)
        point = self.assets.points.get(cap["point_id"])
        machine = self.assets.machine_of(cap["point_id"])
        if not point or not machine:
            return
        features = cap["features"]
        if cap["waveform_key"]:
            features = await self.reprocess(cap, point, machine, features)
        lim = iso_limits(machine.get("iso_group"), machine.get("foundation"))
        score = await self.anomaly_for_capture(cap, point, machine, features)
        if point.get("role", "bearing") != "bearing":
            return
        if cap["iso_zone"] in ("B", "C", "D") or (score or 0) > 0.7:
            await self.run_diagnosis(cap, point, machine, features, lim, score)

    async def reprocess(self, cap: dict, point: dict, machine: dict, features: dict) -> dict:
        """reprocess_capture: recompute features from raw waveform with calibration, keep edge copy."""
        data = await self.storage.get(cap["waveform_key"])
        if not data:
            return features
        header, counts = wavefile.decode(data)
        samples = wavefile.counts_to_ms2(counts)
        env = features.get("envelope") or {}
        band = env.get("band_hz")
        ctx = dsp.FeatureContext(
            nominal_f1x=float(machine["rated_speed_rpm"] or 0) / 60,
            iso_band=(float(machine.get("iso_band_lo_hz") or 10), float(machine.get("iso_band_hi_hz") or 1000)),
            line_freq=float(machine.get("line_freq_hz") or 50), bearing=AssetCache.bearing_geom(point),
            calibration=point.get("calibration"), bandpass=tuple(band) if band else None,
            contiguous=bool(header.get("frames_contiguous")),
            mesh_hz=(machine.get("male_lobes") or 0) * float(machine["rated_speed_rpm"] or 0) / 60)
        out, _ = await asyncio.to_thread(dsp.compute_features, samples, float(header["fs_hz"]),
                                         int(header.get("frames") or 1), ctx)
        server_axes = out["axes"]
        diffs = []
        for a, ax in (features.get("axes") or {}).items():
            e, p = ax.get("iso_vrms_mm_s"), server_axes.get(a, {}).get("iso_vrms_mm_s")
            if e and p:
                diffs.append(abs(p - e) / max(e, 1e-6))
        if diffs and max(diffs) > 0.005 and not point.get("calibration"):
            log.warning("edge/server mismatch %.2f%% on %s", max(diffs) * 100, cap["capture_id"])
        new = dict(features)
        new["edge"] = {"axes": features.get("axes"), "envelope": features.get("envelope")}
        new["axes"] = server_axes
        if out.get("envelope"):
            new["envelope"] = out["envelope"]
        iso_axes = point.get("iso_axes") or ["x", "y", "z"]
        vals = [server_axes[a]["iso_vrms_mm_s"] for a in iso_axes if a in server_axes]
        v = max(vals) if vals else None
        if (features.get("isolation") or {}).get("iso_vrms_max_mm_s") is not None:
            v = features["isolation"]["iso_vrms_max_mm_s"]
        lim = iso_limits(machine.get("iso_group"), machine.get("foundation"))
        zone = lim.zone(v) if point.get("role", "bearing") == "bearing" else None
        async with self.pool.acquire() as c:
            await c.execute("""UPDATE captures SET features=$2, iso_vrms_max_mm_s=$3, iso_zone=$4, processed_by='edge+server',
                               reprocessed_at=now() WHERE capture_id=$1""", cap["capture_id"], _jsonable(new), v, zone)
        cap["iso_zone"] = zone
        return _jsonable(new)

    async def _context(self, machine: dict, point: dict) -> DiagContext:
        async with self.pool.acquire() as c:
            t = await c.fetchrow("SELECT * FROM temp_metrics WHERE machine_id=$1 AND ts > now()-interval '30 min' ORDER BY ts DESC LIMIT 1",
                                 machine["id"])
            p = await c.fetchrow("SELECT * FROM power_metrics WHERE machine_id=$1 AND ts > now()-interval '30 min' ORDER BY ts DESC LIMIT 1",
                                 machine["id"])
            vt = await c.fetchval("SELECT avg(temp_c) FROM vib_metrics WHERE point_id=$1 AND ts > now()-interval '10 min'", point["id"])
            bl = await c.fetch("SELECT feature, median, warn, alarm FROM baselines WHERE point_id=$1 AND status='active' AND load_bin='all'",
                               point["id"])
            rule = await c.fetchrow("""SELECT params FROM alarm_rules WHERE rule='diagnose' AND enabled
                                       AND (scope='global' OR (scope='machine' AND scope_id=$1)) ORDER BY scope='machine' DESC LIMIT 1""",
                                    machine["id"])
        baseline = {r["feature"]: dict(r) for r in bl}
        bearing_t = (t["bearing_temp_c"] if t and t["bearing_temp_c"] is not None else None) or vt
        mesh_base = None
        for k in ("x.mesh_mm_s", "z.mesh_mm_s"):
            if k in baseline and baseline[k]["median"]:
                mesh_base = max(mesh_base or 0, baseline[k]["median"])
        return DiagContext(axes_map=point.get("axes_map") or {}, baseline=baseline, bearing_temp_c=bearing_t,
                           winding_temp_c=t["winding_temp_est_c"] if t else None,
                           i_unbalance_pct=p["i_unbalance_pct"] if p else None, thd_i_pct=p["thd_i_pct"] if p else None,
                           load_pct=p["load_pct"] if p else None, mesh_baseline_mm_s=mesh_base,
                           params=(rule["params"] if rule else {}) or {})

    async def run_diagnosis(self, cap: dict, point: dict, machine: dict, features: dict, lim, score, event_id=None) -> dict | None:
        ctx = await self._context(machine, point)
        ctx.iso_zone = cap.get("iso_zone")
        ctx.anomaly_score = score
        cands = diagnose(features, ctx)
        d = to_diagnosis(cands)
        if not d:
            return None
        async with self.pool.acquire() as c:
            await c.execute("""INSERT INTO diagnoses (machine_id, point_id, capture_id, fault, confidence, evidence, recommendation,
                                 rules_version, candidates, event_id) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)""",
                            machine["id"], point["id"], cap["capture_id"], d["fault"], d["confidence"], d["evidence"],
                            d["recommendation"], d["rules_version"], cands, event_id)
            if event_id:
                await c.execute("UPDATE events SET diagnosis=$2 WHERE event_id=$1", event_id, d)
            else:
                await c.execute("""UPDATE events SET diagnosis=$2 WHERE event_id = (
                                     SELECT event_id FROM events WHERE machine_id=$1 AND type='alarm' AND diagnosis IS NULL
                                       AND state IN ('raised','acknowledged') AND ts > now() - interval '1 day'
                                     ORDER BY ts DESC LIMIT 1)""", machine["id"], d)
        await bus.publish(self.redis, f"rt:machine:{machine['id']}", {"type": "diagnosis", "point_id": point["id"], **d})
        return d

    async def diagnose_for_event(self, ev: dict) -> None:
        if not ev.get("point_id"):
            return
        await asyncio.sleep(CAPTURE_DELAY_S * 3)  # let the event capture arrive
        await self.assets.refresh()
        point = self.assets.points.get(ev["point_id"])
        machine = self.assets.machine_of(ev["point_id"])
        if not point or not machine:
            return
        async with self.pool.acquire() as c:
            row = await c.fetchrow("SELECT * FROM captures WHERE point_id=$1 AND features IS NOT NULL ORDER BY ts DESC LIMIT 1",
                                   ev["point_id"])
        if row:
            cap = dict(row)
            await self.run_diagnosis(cap, point, machine, cap["features"], iso_limits(machine.get("iso_group"), machine.get("foundation")),
                                     cap.get("anomaly_score"), event_id=ev["event_id"])

    # ------------------------------------------------------------------ anomaly
    async def _model(self, machine_id: str) -> dict | None:
        cached = self.models.get(machine_id)
        if cached and time.monotonic() - cached[0] < 3600:
            return cached[1]
        data = await self.storage.get(f"models/{machine_id}.joblib")
        bundle = anomaly.loads(data) if data else None
        self.models[machine_id] = (time.monotonic(), bundle)
        return bundle

    async def _medians(self, point_id: str, lb: str) -> dict:
        async with self.pool.acquire() as c:
            rows = await c.fetch("SELECT feature, median FROM baselines WHERE point_id=$1 AND load_bin IN ($2,'all') ORDER BY load_bin='all'",
                                 point_id, lb)
        out = {}
        for r in rows:
            out[r["feature"]] = r["median"]
        return out

    async def anomaly_for_capture(self, cap: dict, point: dict, machine: dict, features: dict) -> float | None:
        bundle = await self._model(machine["id"])
        if not bundle or point.get("role", "bearing") != "bearing":
            return None
        flat = extract_capture_features(features, point.get("iso_axes") or ["x", "z"])
        med = await self._medians(point["id"], load_bin(cap.get("load_pct")))
        x = anomaly.vectorize(flat, med, {"load_pct": cap.get("load_pct"), "speed_hz": cap.get("speed_hz")})
        if len(x) != len(bundle["features"]) + 4:
            return None
        sc = anomaly.score(bundle, x)
        async with self.pool.acquire() as c:
            await c.execute("UPDATE captures SET anomaly_score=$2 WHERE capture_id=$1", cap["capture_id"], sc)
            await c.execute("""INSERT INTO machine_health (ts, machine_id, point_id, health_index, anomaly_score)
                               VALUES ($1,$2,$3,$4,$5)""", cap["ts"], machine["id"], point["id"], 100 * (1 - sc), sc)
        key = point["id"]
        self.high_scores[key] = self.high_scores[key] + 1 if sc > 0.7 else 0
        if self.high_scores[key] == 3:
            await self.server_event(machine["id"], point["id"], "anomaly", "anomaly_score", sc, 0.7, "watch",
                                    "Điểm bất thường AI > 0,7 trong 3 capture liên tiếp", cap["capture_id"])
        return sc

    # ------------------------------------------------------------------ events
    async def server_event(self, machine_id, point_id, rule, metric, value, threshold, severity, message,
                           capture_id=None, dedupe_hours: int = 24, typ: str = "alarm", gateway_id: str | None = None) -> str | None:
        async with self.pool.acquire() as c:
            exists = await c.fetchval(
                """SELECT event_id FROM events WHERE source='server' AND rule=$1 AND COALESCE(point_id,'')=COALESCE($2,'')
                     AND COALESCE(machine_id,'')=COALESCE($3,'') AND COALESCE(gateway_id,'')=COALESCE($5,'')
                     AND state NOT IN ('resolved','closed') AND cleared_at IS NULL
                     AND ts > now() - make_interval(hours => $4)""", rule, point_id, machine_id, dedupe_hours, gateway_id)
            if exists:
                return None
            eid = f"ev_srv_{uuid.uuid4().hex[:16]}"
            await c.execute("""INSERT INTO events (event_id, ts, machine_id, point_id, type, severity, state, rule, metric, value,
                                 threshold, message, capture_id, source, gateway_id)
                               VALUES ($1, now(), $2,$3,$4,$5,'raised',$6,$7,$8,$9,$10,$11,'server',$12)""",
                            eid, machine_id, point_id, typ, severity, rule, metric, _f(value), _f(threshold), message, capture_id,
                            gateway_id)
        ev = {"type": "event", "event_id": eid, "machine_id": machine_id, "point_id": point_id, "severity": severity,
              "rule": rule, "message": message, "state": "raised", "source": "server", "ts": datetime.now(timezone.utc).isoformat()}
        await bus.publish(self.redis, "rt:events", ev)
        if SEVERITY_ORDER.get(severity, 0) >= 1:
            await bus.publish(self.redis, "notify", {"event_id": eid})
        return eid

    # ------------------------------------------------------------------ scheduled jobs
    async def _rule_params(self, rule: str, machine_id: str | None = None) -> dict:
        async with self.pool.acquire() as c:
            r = await c.fetchrow("""SELECT params FROM alarm_rules WHERE rule=$1 AND enabled AND (scope='global' OR
                                     (scope='machine' AND scope_id=$2)) ORDER BY scope='machine' DESC LIMIT 1""", rule, machine_id)
        return (r["params"] if r else {}) or {}

    async def job_baseline_learn(self) -> None:
        """Learn median/MAD (or μ/σ) per feature and load bin from clean data (spec 6.4)."""
        await self.assets.refresh(force=True)
        changed_gw = set()
        for pid, point in self.assets.points.items():
            if not point.get("active", True) or point.get("role", "bearing") != "bearing":
                continue
            machine = self.assets.machines.get(point["machine_id"])
            if not machine:
                continue
            params = {**(await self._rule_params("baseline")), **(await self._rule_params("baseline", machine["id"]))}
            async with self.pool.acquire() as c:
                start = await c.fetchval(
                    """SELECT max(ts) FROM maintenance_logs WHERE reset_baseline AND (point_id=$1 OR (point_id IS NULL AND machine_id=$2))""",
                    pid, machine["id"])
                if start is None:
                    start = await c.fetchval("SELECT min(ts) FROM captures WHERE point_id=$1", pid)
                if start is None:
                    continue
                days = (params.get("learn_days") or [14, 28])[1]
                end = min(start + timedelta(days=days), datetime.now(timezone.utc))
                caps = await c.fetch(
                    """SELECT c.ts, c.load_pct, c.features, c.quality_flags FROM captures c
                       WHERE c.point_id=$1 AND c.ts BETWEEN $2 AND $3 AND c.running AND c.features IS NOT NULL
                         AND NOT EXISTS (SELECT 1 FROM events e WHERE e.point_id=c.point_id AND e.severity IN ('warning','danger')
                                         AND e.ts BETWEEN c.ts - interval '1 hour' AND c.ts + interval '1 hour')""",
                    pid, start, end)
                metrics = await c.fetch(
                    """SELECT ts, max(vel_rms_mm_s) AS v FROM vib_metrics WHERE point_id=$1 AND ts BETWEEN $2 AND $3
                         AND axis = ANY($4) AND vel_rms_mm_s IS NOT NULL AND NOT COALESCE(flags && $5::text[], false) GROUP BY ts""",
                    pid, start, end, point.get("iso_axes") or ["x", "z"], list(CLEAN_EXCLUDE_FLAGS))
            groups: dict[tuple[str, str], list[float]] = defaultdict(list)
            for cap in caps:
                if CLEAN_EXCLUDE_FLAGS & set(cap["quality_flags"] or []):
                    continue
                flat = extract_capture_features(cap["features"], point.get("iso_axes") or ["x", "z"])
                for lb in {load_bin(cap["load_pct"]), "all"}:
                    for k, v in flat.items():
                        groups[(k, lb)].append(v)
            for r in metrics:
                groups[("vel_rms_mm_s", "all")].append(r["v"])
            method = params.get("method", "mad")
            async with self.pool.acquire() as c:
                for (feature, lb), vals in groups.items():
                    st = robust_stats(vals)
                    if st["n"] < 10:
                        continue
                    floor = 0.05 * st["median"] if st["median"] else 0
                    warn, alarm = thresholds(st, method, params.get("warn_k"), params.get("alarm_k"))
                    # Avoid zero-width thresholds on very stable data.
                    warn, alarm = max(warn, st["median"] + floor), max(alarm, st["median"] + 2 * floor)
                    is_metric = feature == "vel_rms_mm_s"
                    enough = st["n"] >= (params.get("min_samples_metrics", 500) if is_metric else params.get("min_samples_captures", 200))
                    await c.execute(
                        """INSERT INTO baselines (point_id, machine_id, feature, load_bin, median, mad, mean, std, n_samples,
                             period_from, period_to, warn, alarm, status, method, updated_at)
                           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15, now())
                           ON CONFLICT (point_id, feature, load_bin) DO UPDATE SET median=EXCLUDED.median, mad=EXCLUDED.mad,
                             mean=EXCLUDED.mean, std=EXCLUDED.std, n_samples=EXCLUDED.n_samples, period_from=EXCLUDED.period_from,
                             period_to=EXCLUDED.period_to,
                             warn=GREATEST(EXCLUDED.warn, COALESCE(baselines.warn_min, EXCLUDED.warn)),
                             alarm=GREATEST(EXCLUDED.alarm, COALESCE(baselines.alarm_min, EXCLUDED.alarm)),
                             status=CASE WHEN baselines.status='frozen' THEN 'frozen' ELSE EXCLUDED.status END,
                             method=EXCLUDED.method, version=baselines.version+1, updated_at=now()
                           WHERE baselines.status <> 'frozen'""",
                        pid, machine["id"], feature, lb, st["median"], st["mad"], st["mean"], st["std"], st["n"], start, end,
                        warn, alarm, "active" if enough else "learning", method)
            if point.get("gateway_id"):
                changed_gw.add(point["gateway_id"])
        for gw in changed_gw:
            await gwconfig.push_managed(self.pool, self.s, gw, "baseline_learn")
        log.info("baseline_learn done for %d gateways", len(changed_gw))

    async def job_criterion2(self) -> None:
        """|median iso_vrms (1 h) − baseline| > 0.25 × B/C → watch (ISO 20816-1)."""
        await self.assets.refresh()
        async with self.pool.acquire() as c:
            rows = await c.fetch(
                """SELECT c.point_id, percentile_cont(0.5) WITHIN GROUP (ORDER BY c.iso_vrms_max_mm_s) AS v, b.median
                   FROM captures c JOIN baselines b ON b.point_id=c.point_id AND b.feature='iso_vrms_mm_s' AND b.load_bin='all'
                     AND b.status='active'
                   WHERE c.ts > now() - interval '1 hour' AND c.running AND c.iso_vrms_max_mm_s IS NOT NULL
                   GROUP BY c.point_id, b.median""")
        for r in rows:
            machine = self.assets.machine_of(r["point_id"])
            if not machine:
                continue
            lim = iso_limits(machine.get("iso_group"), machine.get("foundation"))
            thr = lim.criterion2_threshold("spec")
            if abs(r["v"] - r["median"]) > thr:
                await self.server_event(machine["id"], r["point_id"], "criterion2", "iso_vrms_mm_s", r["v"], r["median"] + thr,
                                        "watch", f"Criterion II: RMS {r['v']:.2f} lệch baseline {r['median']:.2f} quá 0,25×B/C")

    async def job_trend_rate(self) -> None:
        params = await self._rule_params("trend_rate")
        days = params.get("days", 7)
        max_slope = params.get("max_slope_pct_per_day", 5)
        async with self.pool.acquire() as c:
            rows = await c.fetch(
                """SELECT point_id, bucket, vel_rms_avg FROM vib_metrics_1h
                   WHERE bucket > now() - make_interval(days => $1) AND vel_rms_avg IS NOT NULL""", days)
        series: dict[str, list] = defaultdict(list)
        for r in rows:
            series[r["point_id"]].append((r["bucket"].timestamp() / 86400, r["vel_rms_avg"]))
        for pid, pts in series.items():
            if len(pts) < 48:
                continue
            t, y = np.array([p[0] for p in pts]), np.array([p[1] for p in pts], dtype=float)
            b, a = np.polyfit(t - t.min(), y, 1)
            pred = a + b * (t - t.min())
            r2 = 1 - ((y - pred) ** 2).sum() / max(((y - y.mean()) ** 2).sum(), 1e-12)
            slope_pct = b / max(y.mean(), 1e-6) * 100
            if slope_pct > max_slope and r2 > 0.5:
                m = self.assets.machine_of(pid)
                await self.server_event(m["id"] if m else None, pid, "trend_rate", "vel_rms_mm_s", slope_pct, max_slope, "watch",
                                        f"Rung tăng nhanh bất thường: +{slope_pct:.1f}%/ngày trong {days} ngày (R²={r2:.2f})")

    async def job_anomaly_train(self) -> None:
        params = await self._rule_params("anomaly")
        min_days = params.get("min_days", 60)
        await self.assets.refresh(force=True)
        for mid, machine in self.assets.machines.items():
            pts = [p for p in self.assets.points.values() if p["machine_id"] == mid and p.get("role", "bearing") == "bearing"]
            X = []
            async with self.pool.acquire() as c:
                span = await c.fetchval("SELECT extract(epoch from max(ts)-min(ts))/86400 FROM captures WHERE point_id = ANY($1)",
                                        [p["id"] for p in pts])
                if not span or span < min_days:
                    continue
                for p in pts:
                    rows = await c.fetch(
                        """SELECT c.features, c.load_pct, c.speed_hz, c.quality_flags FROM captures c WHERE c.point_id=$1 AND c.running
                             AND c.features IS NOT NULL AND c.ts > now() - interval '180 days'
                             AND NOT EXISTS (SELECT 1 FROM events e WHERE e.point_id=c.point_id AND e.severity IN ('warning','danger')
                                             AND e.ts BETWEEN c.ts - interval '1 hour' AND c.ts + interval '1 hour')""", p["id"])
                    for r in rows:
                        if CLEAN_EXCLUDE_FLAGS & set(r["quality_flags"] or []):
                            continue
                        med = await self._medians(p["id"], load_bin(r["load_pct"]))
                        flat = extract_capture_features(r["features"], p.get("iso_axes") or ["x", "z"])
                        X.append(anomaly.vectorize(flat, med, {"load_pct": r["load_pct"], "speed_hz": r["speed_hz"]}))
            if len(X) < 100:
                continue
            bundle = await asyncio.to_thread(anomaly.train, np.vstack(X))
            await self.storage.put(f"models/{mid}.joblib", anomaly.dumps(bundle))
            self.models.pop(mid, None)
            log.info("anomaly model trained for %s on %d vectors", mid, len(X))

    async def job_rul_estimate(self) -> None:
        async with self.pool.acquire() as c:
            pts = await c.fetch("""SELECT DISTINCT b.point_id, b.machine_id, b.feature, b.alarm FROM baselines b
                                   WHERE b.status='active' AND b.load_bin='all' AND b.feature IN ('env.bpfo','env.bpfi','iso_vrms_mm_s')""")
            for p in pts:
                rows = await c.fetch("""SELECT ts, features FROM captures WHERE point_id=$1 AND ts > now()-interval '60 days'
                                        AND running ORDER BY ts""", p["point_id"])
                t, y = [], []
                for r in rows:
                    v = extract_capture_features(r["features"] or {}, ["x", "y", "z"]).get(p["feature"])
                    if v is not None:
                        t.append(r["ts"].timestamp() / 86400)
                        y.append(v)
                if len(t) < 10:
                    continue
                t0 = min(t)
                res = anomaly.rul_exponential(np.array(t) - t0, np.array(y), float(p["alarm"]))
                if not res or res.get("rul_days") is None:
                    continue
                await c.execute("""INSERT INTO machine_health (ts, machine_id, point_id, rul_days, rul_lo_days, rul_hi_days, detail)
                                   VALUES (now(), $1,$2,$3,$4,$5,$6)""", p["machine_id"], p["point_id"], res["rul_days"],
                                res.get("rul_lo_days"), res.get("rul_hi_days"), {"feature": p["feature"], **res})

    async def job_monthly_report(self) -> None:
        now = datetime.now(timezone.utc)
        first = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        start = (first - timedelta(days=1)).replace(day=1)
        period = f"{start:%Y-%m}"
        await self.assets.refresh(force=True)
        for mid, m in self.assets.machines.items():
            async with self.pool.acquire() as c:
                zrows = await c.fetch(
                    """SELECT point_id, avg(iso_vrms_max_mm_s) a, max(iso_vrms_max_mm_s) mx, max(iso_zone) z, count(*) n
                       FROM captures c JOIN measurement_points p ON p.id=c.point_id
                       WHERE p.machine_id=$1 AND c.ts >= $2 AND c.ts < $3 GROUP BY point_id ORDER BY point_id""", mid, start, first)
                evs = await c.fetch("""SELECT ts, severity, point_id, message, state, diagnosis FROM events WHERE machine_id=$1
                                       AND ts >= $2 AND ts < $3 ORDER BY ts""", mid, start, first)
                tenant = await c.fetchval("SELECT tenant_id FROM sites WHERE id=$1", m["site_id"])
            if not zrows and not evs:
                continue
            recs = sorted({(e["diagnosis"] or {}).get("recommendation") for e in evs if e["diagnosis"]} - {None})
            pdf = reports.monthly_report(
                m, period,
                [[r["point_id"], f"{r['a'] or 0:.2f}", f"{r['mx'] or 0:.2f}", r["z"] or "–", r["n"]] for r in zrows],
                [[f"{e['ts']:%d/%m %H:%M}", e["severity"], e["point_id"] or "", (e["message"] or "")[:80], e["state"]] for e in evs],
                recs)
            key = f"reports/{tenant}/{period}/{mid}.pdf"
            await self.storage.put(key, pdf, "application/pdf")
            async with self.pool.acquire() as c:
                await c.execute("INSERT INTO reports (tenant_id, machine_id, period, object_key) VALUES ($1,$2,$3,$4)",
                                tenant, mid, period, key)
            await bus.publish(self.redis, "notify", {"report": key, "machine_id": mid, "period": period})

    async def job_gateway_watch(self) -> None:
        """Gateway without health for > 3 min → offline event (cleared when it returns)."""
        async with self.pool.acquire() as c:
            stale = await c.fetch("""UPDATE gateways SET online=false WHERE online AND last_seen < now() - interval '3 minutes'
                                     RETURNING id, site_id""")
            back = await c.fetch("""SELECT e.event_id FROM events e JOIN gateways g ON g.id = e.gateway_id
                                    WHERE e.type='gateway' AND e.rule='gateway_offline' AND e.cleared_at IS NULL AND g.online""")
            for b in back:
                await c.execute("UPDATE events SET cleared_at=now() WHERE event_id=$1", b["event_id"])
        for g in stale:
            await self.server_event(None, None, "gateway_offline", "last_seen", None, None, "warning",
                                    f"Gateway {g['id']} mất kết nối > 3 phút", typ="gateway", dedupe_hours=1,
                                    gateway_id=g["id"])
            await bus.publish(self.redis, "rt:gateways", {"type": "status", "gateway_id": g["id"], "online": False})

    async def job_reminders(self) -> None:
        """Re-notify un-acknowledged events: warning after 30 min, danger after 10 min (spec 6.7)."""
        async with self.pool.acquire() as c:
            rows = await c.fetch("""SELECT event_id, severity, ts FROM events WHERE state='raised' AND cleared_at IS NULL AND (
                                      (severity='warning' AND ts < now() - interval '30 minutes') OR
                                      (severity='danger' AND ts < now() - interval '10 minutes'))
                                      AND ts > now() - interval '2 days'""")
        for r in rows:
            every = 30 * 60 if r["severity"] == "warning" else 10 * 60
            if await self.redis.set(f"remind:{r['event_id']}", 1, ex=every, nx=True):
                await bus.publish(self.redis, "notify", {"event_id": r["event_id"], "reminder": True})


def _f(v):
    try:
        f = float(v)
        return None if math.isnan(f) else f
    except (TypeError, ValueError):
        return None


def _jsonable(o):
    return json.loads(json.dumps(o, default=lambda x: float(x) if isinstance(x, (np.floating, np.integer)) else str(x)))
