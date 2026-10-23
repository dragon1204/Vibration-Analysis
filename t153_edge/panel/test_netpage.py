import netpage as n

def snap(**kw):
    s = {"ifaces": [], "lan_link": True, "wifi_ip": None, "wifi_ssid": None, "ip": "10.0.0.5", "active": "eth0", "mac": "02:00", "router": "10.0.0.1",
         "server": "1.2.3.4:8883", "router_ok": True, "server_ok": True, "ts": 0}
    s.update(kw)
    return s

def states(s, mqtt=False, clock=True):
    return [x[1] for x in n.steps(s, mqtt, clock)]

def test_cable_missing():
    st = states(snap(lan_link=False, ip=None, router=None, router_ok=None, server_ok=None))
    assert st[0] == "fail" and st[1:] == ["skip", "skip", "skip", "skip", "ok"]
    assert n.overall(n.steps(snap(lan_link=False, ip=None, router=None, router_ok=None, server_ok=None), False, True)) == "fail"

def test_waiting_for_dhcp():
    st = states(snap(ip=None, router=None, router_ok=None, server_ok=None))
    assert st[0] == "ok" and st[1] == "wait"
    assert n.overall(n.steps(snap(ip=None, router=None, router_ok=None, server_ok=None), False, True)) == "wait"

def test_server_blocked_gives_port_hint():
    items = n.steps(snap(server_ok=False), False, True)
    assert items[3][1] == "fail" and "8883" in items[3][3]
    assert n.overall(items) == "fail"

def test_all_ok():
    items = n.steps(snap(), True, True)
    assert [x[1] for x in items] == ["ok"] * 6 and n.overall(items) == "ok"

def test_wifi_only_is_shown_as_connected():
    items = n.steps(snap(lan_link=False, wifi_ip="192.168.1.14", wifi_ssid="Nha may"), True, True)
    assert items[0] == ("Kết nối Wi-Fi", "ok", "Nha may", "")
    assert n.overall(items) == "ok"

def test_no_snapshot_yet():
    assert n.steps(None, False, False)[0][1] == "wait"
