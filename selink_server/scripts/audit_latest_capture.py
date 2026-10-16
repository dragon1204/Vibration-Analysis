"""Independently audit the latest raw capture against stored ISO and B1 values."""
from __future__ import annotations

import asyncio
import json
import math
import sys

import asyncpg
import numpy as np
from minio import Minio
from scipy.signal import periodogram

from smartmotor.common.settings import get_settings
from smartmotor.common.wavefile import counts_to_ms2, decode


async def main(point_id: str) -> None:
    settings = get_settings()
    pool = await asyncpg.create_pool(settings.db_url)
    async with pool.acquire() as conn:
        capture = await conn.fetchrow(
            """SELECT capture_id, ts, fs_hz, waveform_key, features
               FROM captures WHERE point_id=$1 AND features IS NOT NULL
               ORDER BY ts DESC LIMIT 1""",
            point_id,
        )
        if not capture:
            raise SystemExit(f"No capture found for {point_id}")
        b1 = await conn.fetch(
            """SELECT axis, count(*) AS n, avg(vel_mm_s) AS mean,
                      percentile_cont(0.5) WITHIN GROUP (ORDER BY vel_mm_s) AS median,
                      min(vel_mm_s) AS min, max(vel_mm_s) AS max
               FROM vib_metrics
               WHERE point_id=$1 AND ts BETWEEN $2::timestamptz - interval '1 second'
                                            AND $2::timestamptz + interval '1 second'
                     AND vel_mm_s IS NOT NULL
               GROUP BY axis ORDER BY axis""",
            point_id,
            capture["ts"],
        )
    await pool.close()

    client = Minio(
        settings.minio_endpoint,
        access_key=settings.minio_access_key,
        secret_key=settings.minio_secret_key,
        secure=settings.minio_secure,
    )
    response = client.get_object(settings.minio_bucket, capture["waveform_key"])
    try:
        payload = response.read()
    finally:
        response.close()
        response.release_conn()
    header, counts = decode(payload)
    samples = counts_to_ms2(counts)
    fs = float(header["fs_hz"])
    upper = min(1000.0, fs / 2.56)
    stored = capture["features"]
    if isinstance(stored, str):
        stored = json.loads(stored)

    result = {
        "capture_id": capture["capture_id"],
        "timestamp": capture["ts"].isoformat(),
        "fs_hz": fs,
        "samples_per_axis": len(samples),
        "evaluated_band_hz": [10.0, upper],
        "axes": {},
        "b1_same_timestamp": [dict(row) for row in b1],
    }
    for index, axis in enumerate(("x", "y", "z")):
        x = samples[:, index]
        frequencies, psd = periodogram(
            x,
            fs=fs,
            window="hann",
            detrend="constant",
            scaling="density",
            return_onesided=True,
        )
        mask = (frequencies >= 10.0) & (frequencies <= upper)
        velocity_psd = psd[mask] / np.square(2 * math.pi * frequencies[mask])
        independent = math.sqrt(float(np.trapezoid(velocity_psd, frequencies[mask]))) * 1000
        stored_value = float(stored["axes"][axis]["iso_vrms_mm_s"])
        result["axes"][axis] = {
            "stored_iso_vrms_mm_s": round(stored_value, 6),
            "independent_scipy_mm_s": round(independent, 6),
            "difference_pct": round((independent / stored_value - 1) * 100, 4),
            "raw_acc_rms_g": round(float(np.sqrt(np.mean(np.square(x - np.mean(x))))) / 9.80665, 6),
        }
    print(json.dumps(result, ensure_ascii=False, indent=2, default=str))


if __name__ == "__main__":
    asyncio.run(main(sys.argv[1] if len(sys.argv) > 1 else "pump-tg-01-p1"))
