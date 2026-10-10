"""Waveform file format (spec 5.9): JSON header line + int16 LE interleaved X,Y,Z, gzip."""
from __future__ import annotations

import gzip
import json

import numpy as np

G_PER_LSB = 0.00048828125
G0 = 9.80665


def encode(header: dict, interleaved: bytes) -> bytes:
    h = dict(header)
    h.setdefault("axes", ["x", "y", "z"])
    h.setdefault("scale", f"g_per_lsb={G_PER_LSB}")
    return gzip.compress(json.dumps(h).encode() + b"\n" + interleaved)


def decode(data: bytes) -> tuple[dict, np.ndarray]:
    """Return (header, counts[n, 3] int16)."""
    raw = gzip.decompress(data)
    nl = raw.index(b"\n")
    header = json.loads(raw[:nl])
    body = raw[nl + 1:]
    arr = np.frombuffer(body[: len(body) // 6 * 6], dtype="<i2").reshape(-1, 3)
    return header, arr


def counts_to_ms2(counts: np.ndarray, g_per_lsb: float = G_PER_LSB) -> np.ndarray:
    return counts.astype(np.float64) * g_per_lsb * G0
