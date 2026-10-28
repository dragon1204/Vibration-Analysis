from datetime import datetime, timedelta, timezone

from smartmotor.common.run_state import RunTracker, matched, rule_of

T0 = datetime(2026, 10, 28, 12, tzinfo=timezone.utc)
META = {"run_detection": {"mode": "all", "on_delay_s": 5, "off_delay_s": 5, "sources": [
    {"point_id": "de", "axes": ["z"], "threshold_mm_s": 1}, {"point_id": "base", "axes": ["z"], "threshold_mm_s": 0.1}]}}


def test_all_mode_stops_when_one_source_is_below():
    rule = rule_of(META)
    assert matched(rule, {"de": {"z": 2.0}, "base": {"z": 0.2}})
    assert not matched(rule, {"de": {"z": 2.0}, "base": {"z": 0.05}})
    assert matched({**rule, "mode": "any"}, {"de": {"z": 2.0}, "base": {"z": 0.05}})
    assert not matched(rule, {})


def test_tracker_confirms_after_delay_and_yields_to_gateway():
    m = {"id": "pump", "meta": META}
    tr = RunTracker()
    out = [tr.observe(m, "de", T0 + timedelta(seconds=s), {"z": 0.05}) for s in range(0, 7)]
    assert out[:5] == [None] * 5 and out[5] == (T0 + timedelta(seconds=5), False)
    # heartbeat after 60 s while still stopped
    assert tr.observe(m, "de", T0 + timedelta(seconds=66), {"z": 0.05}) == (T0 + timedelta(seconds=66), False)
    tr.gateway_run("pump", T0 + timedelta(seconds=70))
    assert tr.observe(m, "de", T0 + timedelta(seconds=200), {"z": 3}) is None
