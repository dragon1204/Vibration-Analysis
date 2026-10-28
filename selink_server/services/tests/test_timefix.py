from datetime import datetime, timedelta, timezone

from smartmotor.common.schemas import VibMetrics
from smartmotor.common.timefix import ClockWatch, describe
from smartmotor.common import model_export as me

T = datetime(2026, 10, 19, 8, 0, tzinfo=timezone.utc)


def vib(**extra):
    return VibMetrics.model_validate({"ts": T.isoformat(), "point_id": "p1", **extra})


def test_gateway_corrected_data_is_only_flagged():
    d = vib(time_corrected_s=1500.0)
    ClockWatch().apply("gw", d)
    assert d.ts == T and d.flags == ["time_corrected:gateway:+1500.0"]
    assert describe(d.flags) == "đã hiệu chỉnh +1500.0 s (gateway)"


def test_uncorrected_data_uses_gateway_clock_error_from_health():
    w = ClockWatch()
    # health sent at gateway time T, received 25 min later with an empty outbox while unverified
    assert w.observe_health("gw", T, True, 0, now=T + timedelta(minutes=25)) == 1500.0
    d = vib(time_unsynced=True, flags=["time_unsynced"])
    w.apply("gw", d)
    assert d.ts == T + timedelta(seconds=1500) and "time_corrected:server:+1500.0" in d.flags
    # a backlog (old health message) or a verified clock is not a clock error
    w2 = ClockWatch()
    w2.observe_health("gw", T, True, 500, now=T + timedelta(minutes=25))
    d2 = vib(time_unsynced=True)
    w2.apply("gw", d2)
    assert d2.ts == T and describe(d2.flags) == "giờ chưa đồng bộ"
    w.observe_health("gw", T, False, 0, now=T + timedelta(seconds=3))
    d3 = vib(time_unsynced=True)
    w.apply("gw", d3)
    assert d3.ts == T


def test_verified_data_is_untouched_and_csv_has_note_column():
    d = vib()
    ClockWatch().apply("gw", d)
    assert d.ts == T and d.flags == [] and describe(d.flags) == ""
    h = me.header([("DE", None)])
    assert h[-1] == "Ghi chú thời gian" and len(h) == 3 + me.SLOT_COLUMNS
