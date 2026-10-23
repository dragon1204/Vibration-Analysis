"""Network status page of the gateway LCD: shown first after power-up.

It answers "why is the gateway not online?" without a laptop: cable, IP address, router,
server reachability, MQTT session and clock, each as a step with a hint when it fails.
The checks run in a background thread and only use sysfs, `ip` and plain TCP connects.
"""

import os
import re
import socket
import subprocess
import threading
import time

NET_DIR = os.environ.get("PANEL_NET_DIR", "/sys/class/net")
EDGE_CONF = os.environ.get("PANEL_EDGE_CONF", "/etc/edge-agent/edge.yaml")
DEFAULT_SERVER = ("160.191.87.104", 8883)


def server_endpoint():
    """Host and port of the MQTT broker from edge.yaml (falls back to the production server)."""
    try:
        with open(EDGE_CONF, encoding="utf-8") as f:
            m = re.search(r"^\s*url:\s*\w+://([^:/\s]+)(?::(\d+))?", f.read(), re.M)
        if m:
            return m.group(1), int(m.group(2) or 8883)
    except OSError:
        pass
    return DEFAULT_SERVER


def _read(path):
    try:
        with open(path) as f:
            return f.read().strip()
    except OSError:
        return ""


def _run(*cmd):
    try:
        return subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL, timeout=3).stdout.decode()
    except (OSError, subprocess.SubprocessError):
        return ""


def wifi_ssid(iface):
    """Connected SSID, without depending on NetworkManager being installed."""
    ssid = _run("iwgetid", "-r").strip()
    if ssid:
        return ssid
    m = re.search(r"^\s*SSID:\s*(.+)$", _run("iw", "dev", iface, "link"), re.M)
    return m.group(1).strip() if m else ""


def tcp_ok(host, port, timeout=2.5):
    try:
        with socket.create_connection((host, port), timeout=timeout):
            return True
    except OSError:
        return False


def interfaces():
    """Wired and Wi-Fi interfaces with link state and IPv4 address."""
    addrs = {}
    for line in _run("ip", "-4", "-o", "addr", "show").splitlines():
        p = line.split()
        if len(p) >= 4:
            addrs[p[1]] = p[3].split("/")[0]
    out = []
    try:
        names = sorted(os.listdir(NET_DIR))
    except OSError:
        names = []
    for n in names:
        if not re.match(r"(eth|en|wl)", n):
            continue
        kind = "wifi" if n.startswith("wl") else "lan"
        out.append({"name": n, "kind": kind, "link": _read("%s/%s/carrier" % (NET_DIR, n)) == "1",
                    "mac": _read("%s/%s/address" % (NET_DIR, n)), "ip": addrs.get(n),
                    "ssid": wifi_ssid(n) if kind == "wifi" and addrs.get(n) else ""})
    return out


def default_route():
    m = re.search(r"default via (\S+) dev (\S+)", _run("ip", "route", "show", "default"))
    return (m.group(1), m.group(2)) if m else (None, None)


def collect(host, port):
    """One snapshot of the whole network path."""
    ifs = interfaces()
    gw, gw_if = default_route()
    lan = [i for i in ifs if i["kind"] == "lan"]
    wifi = [i for i in ifs if i["kind"] == "wifi"]
    up_lan = next((i for i in lan if i["link"]), None)
    # The active interface is the one carrying the default route, else any with an address.
    active = next((i for i in ifs if i["name"] == gw_if), None) or next((i for i in ifs if i["ip"]), None)
    up_wifi = next((i for i in wifi if i["ip"]), None)
    snap = {"ifaces": ifs, "lan_link": up_lan is not None, "wifi_ip": up_wifi["ip"] if up_wifi else None,
            "wifi_ssid": up_wifi.get("ssid") if up_wifi else None,
            "ip": active["ip"] if active else None, "active": active["name"] if active else None,
            "mac": (up_lan or (lan[0] if lan else {}) or {}).get("mac", ""), "router": gw,
            "server": "%s:%d" % (host, port), "router_ok": None, "server_ok": None, "ts": time.time()}
    if snap["ip"] and gw:
        snap["router_ok"] = tcp_ok(gw, 80, 1.0) or _arp_has(gw)
    if snap["ip"]:
        snap["server_ok"] = tcp_ok(host, port)
    return snap


def _arp_has(ip):
    return ip in _run("ip", "neigh", "show", ip) and "FAILED" not in _run("ip", "neigh", "show", ip)


class NetProbe:
    """Runs collect() every few seconds in a daemon thread."""

    def __init__(self, period=3.0):
        self.host, self.port = server_endpoint()
        self.snap = None
        self.period = period
        threading.Thread(target=self._run, daemon=True).start()

    def _run(self):
        while True:
            t0 = time.time()
            try:
                self.snap = collect(self.host, self.port)
            except Exception:  # noqa: BLE001 – the page must never die on a probe error
                pass
            time.sleep(max(0.5, self.period - (time.time() - t0)))


def steps(snap, mqtt_ok, clock_ok):
    """Ordered checklist: (title, state, detail, hint). state is ok | fail | wait | skip."""
    if snap is None:
        return [("Đang kiểm tra mạng...", "wait", "", "")]
    out = []
    if snap["wifi_ip"]:
        out.append(("Kết nối Wi-Fi", "ok", snap.get("wifi_ssid") or snap["wifi_ip"], ""))
    elif snap["lan_link"]:
        out.append(("Dây mạng LAN", "ok", "Đã cắm, có tín hiệu", ""))
    else:
        out.append(("Dây mạng LAN", "fail", "Chưa có tín hiệu", "Cắm dây LAN vào một cổng LAN; đầu kia vào router hoặc switch"))
    if snap["ip"]:
        out.append(("Địa chỉ IP", "ok", "%s (%s)" % (snap["ip"], snap["active"]), ""))
    elif snap["lan_link"]:
        out.append(("Địa chỉ IP", "wait", "Đang xin IP từ router...",
                    "Nếu chờ quá 30 giây: mạng không có DHCP hoặc cổng mạng bị khóa"))
    else:
        out.append(("Địa chỉ IP", "skip", "–", ""))
    if snap["ip"]:
        if snap["router_ok"]:
            out.append(("Router", "ok", snap["router"] or "", ""))
        else:
            out.append(("Router", "fail", (snap["router"] or "không có") + " không trả lời", "Kiểm tra router hoặc dây mạng"))
    else:
        out.append(("Router", "skip", "–", ""))
    if snap["ip"]:
        if snap["server_ok"]:
            out.append(("Máy chủ Smart Motor", "ok", "%s truy cập được" % snap["server"], ""))
        elif snap["server_ok"] is False:
            out.append(("Máy chủ Smart Motor", "fail", "%s không vào được" % snap["server"],
                        "Mạng chặn Internet hoặc cổng %s; nhờ quản trị mạng mở cổng này đi ra" % snap["server"].split(":")[1]))
        else:
            out.append(("Máy chủ Smart Motor", "wait", "Đang kiểm tra...", ""))
    else:
        out.append(("Máy chủ Smart Motor", "skip", "–", ""))
    if mqtt_ok:
        out.append(("Phiên làm việc với máy chủ", "ok", "Đã đăng nhập (MQTT)", ""))
    elif snap["server_ok"]:
        out.append(("Phiên làm việc với máy chủ", "wait", "Đang đăng nhập...", "Nếu chờ lâu: kiểm tra lại giờ hệ thống"))
    else:
        out.append(("Phiên làm việc với máy chủ", "skip", "–", ""))
    out.append(("Đồng hồ hệ thống", "ok" if clock_ok else "wait",
                "Đã đúng giờ" if clock_ok else "Đang lấy giờ từ máy chủ...", ""))
    return out


def overall(items):
    states = [s for _, s, _, _ in items]
    if all(s == "ok" for s in states):
        return "ok"
    if "fail" in states:
        return "fail"
    return "wait"
