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


EXPORT_HEADER = ["Frame", "Mẫu", "t trong frame (s)", "Count X", "Count Y", "Count Z",
                 "g X", "g Y", "g Z", "m/s² X", "m/s² Y", "m/s² Z"]


def export_rows(header: dict, counts: np.ndarray) -> list[list]:
    """Every RAWFIFO sample, one row each: frame, index, time in frame, raw counts, g and m/s².

    Frames are not contiguous, so time restarts at 0 in each frame; nothing is decimated or rounded
    beyond float precision, so the file reproduces the spectrum exactly.
    """
    fs = float(header["fs_hz"])
    frames = max(1, int(header.get("frames") or 1))
    n = len(counts) // frames
    g = counts.astype(np.float64) * G_PER_LSB
    ms2 = g * G0
    rows: list[list] = [list(EXPORT_HEADER)]
    for i in range(frames * n):
        f, k = divmod(i, n)
        c = counts[i]
        rows.append([f + 1, k, k / fs, int(c[0]), int(c[1]), int(c[2]),
                     float(g[i, 0]), float(g[i, 1]), float(g[i, 2]),
                     float(ms2[i, 0]), float(ms2[i, 1]), float(ms2[i, 2])])
    return rows
