from datetime import datetime, timedelta, timezone

from smartmotor.api.routers.machines import runtime_summary


def test_runtime_integrates_run_intervals():
    start = datetime(2026, 10, 25, tzinfo=timezone.utc)
    rows = [
        {"ts": start + timedelta(seconds=10), "running": True},
        {"ts": start + timedelta(seconds=40), "running": False},
        {"ts": start + timedelta(seconds=50), "running": True},
    ]
    got = runtime_summary(rows, start, start + timedelta(seconds=70))
    assert got == {"run_seconds": 50, "total_seconds": 70, "rate_pct": 71.43, "samples": 3, "running": True}


def test_runtime_caps_unknown_disconnect_gap():
    start = datetime(2026, 10, 25, tzinfo=timezone.utc)
    got = runtime_summary([], start, start + timedelta(hours=3), prior_running=True)
    assert got["run_seconds"] == 90
    assert got["rate_pct"] == 0.83
