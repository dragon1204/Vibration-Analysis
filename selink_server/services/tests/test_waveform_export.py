import numpy as np

from smartmotor.common import dsp, table_export, wavefile


def _capture(frames=4, n=1024, fs=4000.0):
    rng = np.random.default_rng(1)
    counts = rng.integers(-3000, 3000, size=(frames * n, 3)).astype("<i2")
    counts[:, 2] -= 2048  # gravity on Z
    return {"fs_hz": fs, "frames": frames}, counts


def test_every_sample_exported_once_with_exact_scaling():
    header, counts = _capture()
    rows = wavefile.export_rows(header, counts)
    assert rows[0] == wavefile.EXPORT_HEADER
    body = rows[1:]
    assert len(body) == 4 * 1024
    assert [r[0] for r in body[1022:1026]] == [1, 1, 2, 2]          # frame boundary
    assert [r[1] for r in body[1022:1026]] == [1022, 1023, 0, 1]    # index restarts per frame
    assert body[1025][2] == 1 / 4000                                 # time restarts per frame
    assert [r[3:6] for r in body] == counts.tolist()
    r = body[7]
    assert r[6] == counts[7, 0] * 16 / 32768
    assert r[11] == counts[7, 2] * 16 / 32768 * 9.80665


def test_exported_samples_reproduce_the_spectrum():
    header, counts = _capture(frames=2)
    rows = wavefile.export_rows(header, counts)[1:]
    ms2 = np.array([r[9:12] for r in rows])
    ref = wavefile.counts_to_ms2(counts)
    a = dsp.compute_spectrum(ms2[:1024, 1], 4000.0).amp
    b = dsp.compute_spectrum(ref[:1024, 1], 4000.0).amp
    assert np.allclose(a, b, rtol=0, atol=1e-12)


def test_csv_and_xlsx_responses():
    header, counts = _capture(frames=1)
    rows = wavefile.export_rows(header, counts)
    csv = table_export.response(rows, "p1_song-tho_20261114-164037", "csv")
    assert csv.headers["content-disposition"].endswith('song-tho_20261114-164037.csv"')
    text = csv.body.decode("utf-8-sig").splitlines()
    assert len(text) == 1025 and text[0].startswith("Frame,Mẫu,")
    xlsx = table_export.response(rows, "p1", "xlsx")
    assert xlsx.body[:2] == b"PK"
