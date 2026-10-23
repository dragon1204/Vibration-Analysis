#!/usr/bin/env python3
"""Smart Motor local LCD panel for the T153 gateway (LVDS 7", 1024x600, touch).

Reads the edge-agent loopback endpoint (local_ui.listen, default 127.0.0.1:8091) once per
second and shows the ISO 20816-3 vibration state of each measurement point. It does not
depend on the server, so the panel keeps working when the uplink is down.

Run on the framebuffer without X:
  QT_QPA_PLATFORM=linuxfb:fb=/dev/fb0 python3 smartmotor_panel.py
"""

import json
import math
import os
import socket
import sys
import threading
import time
import urllib.request
from datetime import datetime

from PyQt5.QtCore import Qt, QTimer, pyqtSignal, QObject, QPointF, QRectF
from PyQt5.QtGui import QFont, QColor, QPainter, QPen, QBrush, QPolygonF, QPixmap
from PyQt5.QtWidgets import (QApplication, QWidget, QLabel, QFrame, QHBoxLayout, QVBoxLayout,
                             QGridLayout, QPushButton, QButtonGroup, QSizePolicy, QStackedWidget)
import pyqtgraph as pg

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import netpage  # noqa: E402

STATE_URL = os.environ.get("PANEL_STATE_URL", "http://127.0.0.1:8091/api/local/state?history=1")
BACKLIGHT = os.environ.get("PANEL_BACKLIGHT", "/sys/class/backlight/backlight0")
STALE_S = 15          # fast RMS older than this is shown as "no signal"
TREND_MIN = 10        # minutes shown on the trend chart
FONT = "DejaVu Sans"

C = {
    "bg": "#0c1015", "card": "#141a21", "head": "#1b232d", "border": "#2c3744", "text": "#e8edf2", "muted": "#8b99a9",
    "A": "#2fa84f", "B": "#d9a406", "C": "#e8710a", "D": "#d62f3a", "none": "#5d6b7b", "accent": "#4c8fc7",
    "x": "#58a6d8", "y": "#a595e0", "z": "#e08fb2", "ok": "#2fa84f", "bad": "#d62f3a", "warn": "#d9a406",
}
ZONE_TEXT = {"A": "Tốt", "B": "Chấp nhận được", "C": "Cảnh báo: cần lên kế hoạch xử lý", "D": "Nguy hiểm: dừng máy kiểm tra"}
ROLE_LABEL = {"radial_h": "Ngang", "radial_v": "Đứng", "axial": "Dọc trục"}
DEFAULT_ROLES = {"x": "radial_h", "y": "axial", "z": "radial_v"}
ROLE_ORDER = ["radial_h", "radial_v", "axial"]
SEV_TEXT = {"danger": "NGUY HIỂM", "warning": "CẢNH BÁO", "watch": "THEO DÕI", "info": "THÔNG TIN"}
SEV_COLOR = {"danger": C["D"], "warning": C["C"], "watch": C["B"], "info": C["muted"]}


def font(size, bold=False):
    f = QFont(FONT, size)
    f.setBold(bold)
    return f


def parse_ts(s):
    if not s:
        return None
    try:
        s = s.replace("Z", "+00:00")
        if "." in s:  # Python 3.8 accepts at most 6 fractional digits
            head, rest = s.split(".", 1)
            n = 0
            while n < len(rest) and rest[n].isdigit():
                n += 1
            frac = rest[:n]
            tz = rest[len(frac):]
            s = head + "." + frac[:6].ljust(6, "0") + tz
        return datetime.fromisoformat(s).timestamp()
    except ValueError:
        return None


def fmt(v, digits=2):
    if v is None or (isinstance(v, float) and math.isnan(v)):
        return "--"
    return ("{:.%df}" % digits).format(v).replace(".", ",")


def zone_of(v, lim):
    if v is None:
        return None
    if v < lim["ab"]:
        return "A"
    if v < lim["bc"]:
        return "B"
    if v < lim["cd"]:
        return "C"
    return "D"


def main_axis(pinfo):
    """Vertical radial axis, used only as a display fallback when no ISO axis has data."""
    roles = dict(DEFAULT_ROLES)
    roles.update(pinfo.get("axes_map") or {})
    for a in ("z", "x", "y"):
        if roles.get(a) == "radial_v":
            return a
    return None


def pos_label(i, pinfo):
    """Short sensor name by mounting position, including legacy S1..S4 configs."""
    role = pinfo.get("role", "bearing")
    if role == "base":
        return "BASE"
    if role == "source":
        return "COMP"
    loc = str(pinfo.get("location") or "").strip().upper()
    legacy = {"S1": "COMP", "S2": "BASE", "S3": "DE", "S4": "NDE"}
    loc = legacy.get(loc, loc)
    if loc in ("DE", "NDE", "BASE", "COMP"):
        return loc
    return loc[:8] if loc else "--"


def local_ip():
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        s.connect(("10.255.255.255", 1))  # no packet is sent for UDP connect
        return s.getsockname()[0]
    except OSError:
        return "--"
    finally:
        s.close()


def ago(sec):
    if sec is None:
        return "--"
    sec = max(0, int(sec))
    if sec < 60:
        return "%d giây trước" % sec
    if sec < 3600:
        return "%d phút trước" % (sec // 60)
    if sec < 86400:
        return "%d giờ trước" % (sec // 3600)
    return "%d ngày trước" % (sec // 86400)


class Fetcher(QObject):
    """Polls the edge-agent in a background thread so the UI never blocks."""
    got = pyqtSignal(object)
    failed = pyqtSignal(str)

    def start(self):
        threading.Thread(target=self._run, daemon=True).start()

    def _run(self):
        while True:
            t0 = time.time()
            try:
                with urllib.request.urlopen(STATE_URL, timeout=2) as r:
                    self.got.emit(json.loads(r.read().decode("utf-8")))
            except Exception as e:  # noqa: BLE001 – any failure means "agent not reachable"
                self.failed.emit(str(e))
            time.sleep(max(0.2, 1.0 - (time.time() - t0)))


class Card(QFrame):
    """Flat panel with a 1 px frame; an optional 4 px edge carries a state colour."""

    def __init__(self, parent=None):
        super().__init__(parent)
        self.setObjectName("card")
        self.accent(None)

    def accent(self, color, side="left"):
        edge = "border-%s:4px solid %s;" % (side, color) if color else ""
        self.setStyleSheet("#card{background:%s;border:1px solid %s;%s}" % (C["card"], C["border"], edge))


def caption(text):
    """Small upper-case section title, as on a control panel."""
    lb = label(text.upper(), 8, C["muted"], True)
    f = lb.font()
    f.setLetterSpacing(QFont.AbsoluteSpacing, 1)
    lb.setFont(f)
    return lb


def flat_button(text, w, h, bg=None, fg=None, size=10):
    b = QPushButton(text)
    b.setFont(font(size, True))
    b.setFixedSize(w, h)
    bg, fg = bg or C["head"], fg or C["text"]
    b.setStyleSheet("QPushButton{color:%s;background:%s;border:1px solid %s;border-radius:0;}"
                    "QPushButton:pressed{background:%s;}" % (fg, bg, C["border"], C["border"]))
    return b


def label(text="", size=11, color=None, bold=False, align=Qt.AlignLeft | Qt.AlignVCenter):
    lb = QLabel(text)
    lb.setFont(font(size, bold))
    lb.setStyleSheet("color:%s;background:transparent;border:none;" % (color or C["text"]))
    lb.setAlignment(align)
    # Long texts must not widen the 1024 px window: let the layout clip them instead.
    lb.setSizePolicy(QSizePolicy.Ignored, QSizePolicy.Preferred)
    lb.setMinimumWidth(0)
    return lb


def fixw(w, width):
    """Fixed-width widget; Ignored + fixed width confuses QBoxLayout placement."""
    w.setFixedWidth(width)
    w.setSizePolicy(QSizePolicy.Fixed, QSizePolicy.Preferred)


class ZoneScale(QWidget):
    """Horizontal A/B/C/D bar with a marker at the current value."""

    def __init__(self):
        super().__init__()
        self.lim = {"ab": 3.5, "bc": 7.1, "cd": 11.0}
        self.value = None
        self.setMinimumHeight(46)

    def set(self, value, lim):
        self.value, self.lim = value, lim
        self.update()

    def paintEvent(self, _):
        p = QPainter(self)
        w, h = self.width(), self.height()
        top, bh = 14, 12
        vmax = self.lim["cd"] * 1.35
        x = lambda v: 4 + (w - 8) * min(v, vmax) / vmax
        edges = [(0, self.lim["ab"], "A"), (self.lim["ab"], self.lim["bc"], "B"),
                 (self.lim["bc"], self.lim["cd"], "C"), (self.lim["cd"], vmax, "D")]
        for a, b, z in edges:
            p.fillRect(QRectF(x(a), top, x(b) - x(a), bh), QColor(C[z]))
            p.setPen(QColor("#0b1220"))
            p.setFont(font(8, True))
            p.drawText(QRectF(x(a), top, x(b) - x(a), bh), Qt.AlignCenter, z)
        p.setPen(QColor(C["muted"]))
        p.setFont(font(8))
        for v in (self.lim["ab"], self.lim["bc"], self.lim["cd"]):
            p.drawText(QRectF(x(v) - 20, top + bh + 2, 40, 14), Qt.AlignCenter, fmt(v, 1))
        if self.value is not None:
            mx = x(self.value)
            p.setBrush(QBrush(QColor(C["text"])))
            p.setPen(Qt.NoPen)
            p.drawPolygon(QPolygonF([QPointF(mx - 6, 1), QPointF(mx + 6, 1), QPointF(mx, top - 1)]))
            p.setPen(QPen(QColor(C["text"]), 2))
            p.drawLine(QPointF(mx, top), QPointF(mx, top + bh))
        p.end()


class AxisCard(Card):
    def __init__(self):
        super().__init__()
        lay = QVBoxLayout(self)
        lay.setContentsMargins(12, 8, 12, 8)
        lay.setSpacing(0)
        self.title = label("", 10, C["muted"], True)
        row = QHBoxLayout()
        self.value = label("--", 24, C["text"], True)
        self.unit = label("mm/s", 9, C["muted"], align=Qt.AlignLeft | Qt.AlignBottom)
        row.addWidget(self.value)
        row.addWidget(self.unit)
        row.addStretch(1)
        self.zone = label("", 9, C["none"], True, Qt.AlignRight | Qt.AlignVCenter)
        fixw(self.zone, 76)
        fixw(self.value, 86)
        fixw(self.unit, 38)
        row.addWidget(self.zone)
        self.sub = label("", 9, C["muted"])
        lay.addWidget(self.title)
        lay.addLayout(row)
        lay.addWidget(self.sub)

    def set(self, title, color, v, z, iso, sub):
        self.title.setText(title.upper())
        self.title.setStyleSheet("color:%s;background:transparent;border:none;" % C["muted"])
        self.value.setText(fmt(v))
        if iso and z:
            self.zone.setText("VÙNG " + z)
            self.zone.setStyleSheet("color:%s;background:transparent;border:none;" % C[z])
            self.accent(C[z])
        else:
            self.zone.setText("" if iso else "NGOÀI ISO")
            self.zone.setStyleSheet("color:%s;background:transparent;border:none;" % C["muted"])
            self.accent(None)
        self.sub.setText(sub)


class Panel(QWidget):
    def __init__(self):
        super().__init__()
        self.state = None
        self.err = None
        self.last_ok = None
        self.sel = 0              # selected point index (flattened over machines)
        self.zone_hold = {}       # point id -> displayed zone (hysteresis)
        self.btns = []            # per-sensor selector buttons (only with 2+ sensors)
        self._btn_n = -1
        self.ip = local_ip()
        self.setAttribute(Qt.WA_StyledBackground, True)  # paint the page colour inside the QStackedWidget
        self.setStyleSheet("background:%s;" % C["bg"])
        self.setCursor(Qt.BlankCursor)
        self._build()
        self.fetch = Fetcher()
        self.fetch.got.connect(self.on_state)
        self.fetch.failed.connect(self.on_error)
        self.fetch.start()
        self.clock = QTimer(self)
        self.clock.timeout.connect(self.tick)
        self.clock.start(1000)
        QTimer.singleShot(0, self.tick)

    # ---------- layout ----------
    def _build(self):
        root = QVBoxLayout(self)
        root.setContentsMargins(10, 6, 10, 4)
        root.setSpacing(6)

        head = QHBoxLayout()
        head.setSpacing(8)
        head.setContentsMargins(10, 0, 8, 0)
        self.h_machine = label("", 12, C["text"], True)
        self.h_machine.setToolTip("Tên máy đang theo dõi")
        fixw(self.h_machine, 304)
        head.addWidget(self.h_machine)
        self.point_btns = QHBoxLayout()
        self.point_btns.setSpacing(4)
        head.addLayout(self.point_btns)
        self.pill_server = label("", 9, C["muted"], True, Qt.AlignCenter)
        self.pill_sensor = label("", 9, C["muted"], True, Qt.AlignCenter)
        self.h_clock = label("", 13, C["text"], True, Qt.AlignRight | Qt.AlignVCenter)
        for w in (self.pill_server, self.pill_sensor):
            fixw(w, 150)
            head.addWidget(w)
        fixw(self.h_clock, 92)
        head.addWidget(self.h_clock)
        hdr = QFrame()
        hdr.setObjectName("hdr")
        hdr.setStyleSheet("#hdr{background:%s;border:1px solid %s;}" % (C["head"], C["border"]))
        hdr.setFixedHeight(40)
        hdr.setLayout(head)
        root.addWidget(hdr)

        body = QHBoxLayout()
        body.setSpacing(8)
        root.addLayout(body, 1)

        # Left: overall state and machine info.
        left = QVBoxLayout()
        left.setSpacing(8)
        self.zone_card = Card()
        self.zone_card.setFixedWidth(284)
        zl = QVBoxLayout(self.zone_card)
        zl.setContentsMargins(14, 10, 14, 10)
        zl.setSpacing(2)
        self.z_caption = caption("Tình trạng rung | ISO 20816-3")
        zl.addWidget(self.z_caption)
        self.z_letter = label("--", 60, C["none"], True, Qt.AlignCenter)
        self.z_text = label("", 13, C["text"], True, Qt.AlignCenter)
        self.z_text.setWordWrap(True)
        self.z_value = label("", 24, C["text"], True, Qt.AlignCenter)
        self.z_hint = label("", 9, C["muted"], align=Qt.AlignCenter)
        self.z_hint.setWordWrap(True)
        self.z_scale = ZoneScale()
        for w in (self.z_letter, self.z_text, self.z_value, self.z_hint, self.z_scale):
            zl.addWidget(w)
        left.addWidget(self.zone_card, 1)

        info = Card()
        info.setFixedWidth(284)
        il = QGridLayout(info)
        il.setContentsMargins(14, 8, 14, 8)
        il.setVerticalSpacing(4)
        self.info = {}
        for i, (k, t) in enumerate([("speed", "Tốc độ quay"), ("temp", "Nhiệt độ cảm biến"),
                                    ("run", "Trạng thái máy"), ("cap", "Phân tích phổ")]):
            key = label(t, 10, C["muted"])
            fixw(key, 132)
            il.addWidget(key, i, 0)
            v = label("--", 11, C["text"], True, Qt.AlignRight | Qt.AlignVCenter)
            il.addWidget(v, i, 1)
            self.info[k] = v
        left.addWidget(info)
        body.addLayout(left)

        # Right: axis cards, trend, orders and alarms.
        right = QVBoxLayout()
        right.setSpacing(8)
        cards = QHBoxLayout()
        cards.setSpacing(8)
        self.axis_cards = [AxisCard() for _ in range(3)]
        for c in self.axis_cards:
            c.setFixedHeight(104)
            cards.addWidget(c)
        right.addLayout(cards)

        pg.setConfigOptions(antialias=False, background=C["card"], foreground=C["muted"])
        trend_card = Card()
        tl = QVBoxLayout(trend_card)
        tl.setContentsMargins(8, 6, 8, 4)
        tl.setSpacing(0)
        tl.addWidget(caption("Xu hướng RMS %d phút gần nhất, mm/s" % TREND_MIN))
        self.trend = pg.PlotWidget()
        self.trend.setMenuEnabled(False)
        self.trend.setMouseEnabled(False, False)
        self.trend.hideButtons()
        self.trend.showGrid(x=True, y=True, alpha=0.15)
        self.trend.setXRange(-TREND_MIN, 0, padding=0)
        for ax in ("bottom", "left"):
            self.trend.getAxis(ax).setTickFont(font(8))
        self.trend.getAxis("bottom").setTicks([[(-v, "-%d'" % v if v else "0") for v in range(0, TREND_MIN + 1, 2)]])
        self.trend_lines = {}
        for a in ("x", "y", "z"):
            self.trend_lines[a] = self.trend.plot([], [], pen=pg.mkPen(C[a], width=2))
        self.limit_lines = []
        for z in ("B", "C", "D"):
            ln = pg.InfiniteLine(angle=0, pen=pg.mkPen(C[z], width=1, style=Qt.DashLine))
            self.trend.addItem(ln)
            self.limit_lines.append(ln)
        tl.addWidget(self.trend, 1)
        right.addWidget(trend_card, 1)

        bottom = QHBoxLayout()
        bottom.setContentsMargins(0, 0, 0, 0)
        bottom.setSpacing(8)
        ord_card = Card()
        ol = QVBoxLayout(ord_card)
        ol.setContentsMargins(8, 6, 8, 4)
        ol.setSpacing(0)
        self.ord_title = caption("Thành phần 1X-5X, mm/s RMS")
        ol.addWidget(self.ord_title)
        self.orders = pg.PlotWidget()
        self.orders.setMenuEnabled(False)
        self.orders.setMouseEnabled(False, False)
        self.orders.hideButtons()
        self.orders.getAxis("bottom").setTicks([[(i + 1, "%dX" % (i + 1)) for i in range(5)]])
        self.orders.setXRange(0.4, 5.6, padding=0)
        for ax in ("bottom", "left"):
            self.orders.getAxis(ax).setTickFont(font(8))
        self.bars = []
        ol.addWidget(self.orders, 1)
        bottom.addWidget(ord_card, 1)

        al_card = Card()
        al = QVBoxLayout(al_card)
        al.setContentsMargins(10, 6, 10, 6)
        al.setSpacing(3)
        al.addWidget(caption("Cảnh báo đang mở"))
        self.alarm_rows = []
        for _ in range(4):
            r = label("", 10, C["text"])
            r.setWordWrap(False)
            al.addWidget(r)
            self.alarm_rows.append(r)
        al.addStretch(1)
        bottom.addWidget(al_card, 1)
        bottom_w = QWidget()
        bottom_w.setLayout(bottom)
        bottom_w.setFixedHeight(150)
        right.addWidget(bottom_w)
        body.addLayout(right, 1)

        foot = QHBoxLayout()
        self.f_left = label("", 9, C["muted"])
        foot.addWidget(self.f_left, 1)
        self.on_net = None  # set by Main: opens the network page
        nb = flat_button("MẠNG", 70, 24, size=9)
        nb.clicked.connect(lambda: self.on_net and self.on_net())
        self.on_compare = None  # set by Main: opens the sensor comparison page
        self.cmp_btn = flat_button("SO SÁNH", 84, 24, size=9)
        self.cmp_btn.clicked.connect(lambda: self.on_compare and self.on_compare())
        self.cmp_btn.setVisible(False)
        foot.addWidget(self.cmp_btn)
        foot.addWidget(nb)
        for text, step in (("SÁNG -", -40), ("SÁNG +", 40)):
            b = flat_button(text, 70, 24, size=9)
            b.clicked.connect(lambda _, s=step: self.brightness(s))
            foot.addWidget(b)
        root.addLayout(foot)

    # ---------- data ----------
    def points(self):
        out = []
        for m in (self.state or {}).get("machines") or []:
            for p in m.get("points") or []:
                out.append((m, p))
        order = ("DE", "NDE", "BASE", "COMP")   # fixed order on screen, whatever the config order is
        out.sort(key=lambda mp: order.index(pos_label(0, mp[1])) if pos_label(0, mp[1]) in order else len(order))
        return out

    def on_state(self, st):
        first = self.state is None
        self.state, self.err, self.last_ok = st, None, time.time()
        if first or len(self.points()) != self._btn_n:
            self._point_buttons()
        self.render()

    def on_error(self, msg):
        self.err = msg
        self.render()

    def _point_buttons(self):
        while self.point_btns.count():
            w = self.point_btns.takeAt(0).widget()
            if w:
                w.deleteLater()
        pts = self.points()
        self._btn_n = len(pts)
        self.btns = []
        if len(pts) < 2:
            return
        # One touch button per sensor, coloured by its ISO zone ("2|B").
        self.group = QButtonGroup(self)
        for i, (_, pi) in enumerate(pts):
            b = QPushButton(pos_label(i, pi))
            b.setCheckable(True)
            b.setChecked(i == self.sel)
            b.setFont(font(10, True))
            b.setFixedSize(70, 28)
            b.clicked.connect(lambda _, k=i: self.select(k))
            self.group.addButton(b)
            self.point_btns.addWidget(b)
            self.btns.append(b)

    def paint_buttons(self, zones):
        for i, b in enumerate(self.btns):
            z = zones[i] if i < len(zones) else None
            pi = self.points()[i][1] if i < len(self.points()) else {}
            b.setText(pos_label(i, pi))
            color = C[z] if z in ("A", "B", "C", "D") else C["none"]
            border = C["text"] if i == self.sel else color
            b.setChecked(i == self.sel)
            b.setStyleSheet("QPushButton{color:#0b1220;background:%s;border:%dpx solid %s;border-radius:0;}"
                            % (color, 3 if i == self.sel else 1, border))

    def role_value(self, pinfo, role, now):
        """Fresh fast RMS of the axis playing `role` for one point (None when stale or offline)."""
        roles = dict(DEFAULT_ROLES)
        roles.update(pinfo.get("axes_map") or {})
        axis = next((a for a in ("x", "y", "z") if roles.get(a) == role), None)
        ps = ((self.state or {}).get("points") or {}).get(pinfo["id"]) or {}
        fast = ps.get("fast") or {}
        t = parse_ts(fast.get("ts"))
        if axis is None or not ps.get("online", True) or t is None or now - t > STALE_S:
            return None
        return ((fast.get("axes") or {}).get(axis) or {}).get("vrms_mm_s")

    def corrected_axis_value(self, machine, pinfo, axis, now, raw):
        """Bearing-corrected RMS = sqrt(DE² - (alpha * BASE)²), matched by physical axis role."""
        if pinfo.get("role", "bearing") != "bearing" or raw is None:
            return raw
        role_map = dict(DEFAULT_ROLES)
        role_map.update(pinfo.get("axes_map") or {})
        role = role_map.get(axis)
        base = next((p for p in machine.get("points") or [] if p.get("role") == "base"), None)
        if base is None or role is None:
            return raw
        base_value = self.role_value(base, role, now)
        if base_value is None:
            return raw
        alpha = float((self.state or {}).get("base_alpha") or 0.8)
        return math.sqrt(max(0.0, raw * raw - (alpha * base_value) ** 2))

    def point_value(self, machine, pinfo, now):
        """Live overall RMS (max over ISO axes) of one point, or None when stale/offline."""
        ps = ((self.state or {}).get("points") or {}).get(pinfo["id"]) or {}
        fast = ps.get("fast") or {}
        t = parse_ts(fast.get("ts"))
        if not ps.get("online", True) or t is None or now - t > STALE_S:
            return None
        best = None
        for a in (pinfo.get("iso_axes") or ["x", "y", "z"]):
            v = ((fast.get("axes") or {}).get(a) or {}).get("vrms_mm_s")
            v = self.corrected_axis_value(machine, pinfo, a, now, v)
            if v is not None and (best is None or v > best):
                best = v
        return best

    def select(self, i):
        self.sel = i
        self.render()

    def brightness(self, step):
        try:
            mx = int(open(os.path.join(BACKLIGHT, "max_brightness")).read())
            cur = int(open(os.path.join(BACKLIGHT, "brightness")).read())
            with open(os.path.join(BACKLIGHT, "brightness"), "w") as f:
                f.write(str(max(20, min(mx, cur + step))))
        except (OSError, ValueError):
            pass

    def tick(self):
        self.h_clock.setText(datetime.now().strftime("%H:%M:%S"))

    def stable_zone(self, pid, v, lim):
        """Zone with 5 % hysteresis so the panel does not flicker at a boundary."""
        z = zone_of(v, lim)
        old = self.zone_hold.get(pid)
        if old and z and old != z:
            bounds = {"A": (0, lim["ab"]), "B": (lim["ab"], lim["bc"]), "C": (lim["bc"], lim["cd"]), "D": (lim["cd"], 1e9)}[old]
            if bounds[0] * 0.95 <= v < bounds[1] * 1.05:
                z = old
        self.zone_hold[pid] = z
        return z

    def pill(self, w, text, color):
        """Status cell: dark field with a coloured left edge, not a coloured blob."""
        w.setText(text)
        w.setStyleSheet("color:%s;background:%s;border:1px solid %s;border-left:4px solid %s;padding:3px 6px;"
                        % (C["text"], C["bg"], C["border"], color))

    def render(self):
        st = self.state
        if st is None:
            self.pill(self.pill_server, "MÁY CHỦ: CHỜ", C["none"])
            self.pill(self.pill_sensor, "CẢM BIẾN: --", C["none"])
            self.z_text.setText("Đang chờ edge-agent...")
            return
        pts = self.points()
        if not pts:
            self.h_machine.setText("Chưa cấu hình máy / điểm đo")
            return
        self.sel = min(self.sel, len(pts) - 1)
        now0 = parse_ts(st.get("now")) or time.time()
        if self.btns:
            zones = []
            for mm, pi in pts:
                v = self.point_value(mm, pi, now0)
                if pi.get("role", "bearing") != "bearing":
                    zones.append(None)
                else:
                    zones.append(zone_of(v, mm.get("limits") or {"ab": 3.5, "bc": 7.1, "cd": 11.0}) if v is not None else None)
            self.paint_buttons(zones)
        m, pinfo = pts[self.sel]
        pid = pinfo["id"]
        base = pinfo.get("role", "bearing") != "bearing"   # foundation sensor: no ISO zone applies
        self.cmp_btn.setVisible(len(pts) > 1)
        self.z_scale.setVisible(not base)   # the A/B/C/D scale means nothing for a foundation sensor
        ps = (st.get("points") or {}).get(pid) or {}
        lim = m.get("limits") or {"ab": 3.5, "bc": 7.1, "cd": 11.0}
        now = parse_ts(st.get("now")) or time.time()
        gw = st.get("gateway") or {}

        # The point buttons identify the sensor; keeping only the machine name here prevents header overlap.
        self.h_machine.setText(m.get("name") or m["id"])
        if self.err:
            self.pill(self.pill_server, "EDGE-AGENT: LỖI", C["bad"])
        elif gw.get("mqtt_connected"):
            self.pill(self.pill_server, "MÁY CHỦ: KẾT NỐI", C["ok"])
        else:
            self.pill(self.pill_server, "MÁY CHỦ: MẤT", C["warn"])

        fast = ps.get("fast") or {}
        fast_t = parse_ts(fast.get("ts"))
        fresh = fast_t is not None and now - fast_t <= STALE_S
        online = ps.get("online", True)
        if not online:
            self.pill(self.pill_sensor, "CẢM BIẾN: MẤT", C["bad"])
        elif fresh:
            self.pill(self.pill_sensor, "CẢM BIẾN: TỐT", C["ok"])
        else:
            self.pill(self.pill_sensor, "CẢM BIẾN: CHỜ", C["warn"])

        roles = dict(DEFAULT_ROLES)
        roles.update(pinfo.get("axes_map") or {})
        iso_axes = pinfo.get("iso_axes") or ["x", "y", "z"]
        axes = sorted(("x", "y", "z"), key=lambda a: ROLE_ORDER.index(roles.get(a)) if roles.get(a) in ROLE_ORDER else 9)
        cap = ps.get("capture") or {}
        cap_axes = cap.get("axes") or {}
        ind = ps.get("indicators") or {}
        fast_axes = fast.get("axes") or {}

        # Per-axis value: live fast RMS, else last capture.
        vals = {}
        for a in ("x", "y", "z"):
            # A stale number is not shown as if it were live.
            raw = (fast_axes.get(a) or {}).get("vrms_mm_s") if fresh else None
            vals[a] = self.corrected_axis_value(m, pinfo, a, now, raw)
        # The ISO verdict always follows the worst RMS across every configured ISO axis.
        main = main_axis(pinfo)
        overall = None
        overall_axis = None
        for a in iso_axes:
            if vals.get(a) is not None and (overall is None or vals[a] > overall):
                overall = vals[a]
                overall_axis = a
        cap_txt = "RMS lớn nhất | %s" % ("BASE" if pinfo.get("role", "bearing") != "bearing" else "ISO 20816-3")
        if overall_axis:
            cap_txt = "%s (%s) | %s" % (ROLE_LABEL.get(roles.get(overall_axis), overall_axis), overall_axis.upper(),
                                          "BASE" if pinfo.get("role", "bearing") != "bearing" else "ISO 20816-3")
        self.z_caption.setText(cap_txt.upper())

        # Overall card.
        if overall is None:
            self.z_letter.setText("--")
            self.zone_card.accent(C["none"], "top")
            self.z_letter.setStyleSheet("color:%s;background:transparent;border:none;" % C["none"])
            if not online:
                self.z_text.setText("MẤT TÍN HIỆU CẢM BIẾN")
                last = parse_ts(ps.get("last_ok"))
                self.z_value.setText("")
                when = ("Đo được lần cuối " + ago(now - last)) if last else "Chưa đọc được từ khi gateway khởi động"
                self.z_hint.setText(when + ".\nKiểm tra nguồn 24 V và dây A/B RS485.")
            else:
                self.z_text.setText("Đang chờ dữ liệu rung")
                self.z_value.setText("")
                self.z_hint.setText("")
            self.z_scale.set(None, lim)
        elif base:
            # No zone letter for the foundation sensor: the number itself is the reading.
            self.z_letter.setText(fmt(overall))
            self.zone_card.accent(C["none"], "top")
            self.z_letter.setStyleSheet("color:%s;background:transparent;border:none;" % C["text"])
            self.z_text.setText("Không phân vùng ISO")
            self.z_value.setText("mm/s RMS")
            self.z_hint.setText("RMS %s, 10-1000 Hz" % (
                ROLE_LABEL.get(roles.get(overall_axis), overall_axis or "").lower()))
            self.z_scale.set(None, lim)
        else:
            z = self.stable_zone(pid, overall, lim)
            self.z_letter.setText(z)
            self.zone_card.accent(C[z], "top")
            self.z_letter.setStyleSheet("color:%s;background:transparent;border:none;" % C[z])
            self.z_text.setText(ZONE_TEXT[z])
            self.z_value.setText("%s mm/s" % fmt(overall))
            name = ROLE_LABEL.get(roles.get(overall_axis), overall_axis or "").lower()
            self.z_hint.setText("RMS lớn nhất: %s, 10-1000 Hz\nnhóm %s, nền %s" % (
                name, m.get("iso_group") or "--", {"rigid": "cứng", "flexible": "mềm"}.get(m.get("foundation"), "--")))
            self.z_scale.set(overall, lim)

        # Axis cards.
        peaks = ind.get("vel_peak_mm_s") or {}
        for card, a in zip(self.axis_cards, axes):
            role = roles.get(a)
            fa = fast_axes.get(a) or {}
            v = vals.get(a)
            z = None if base else zone_of(v, lim)
            sub = "VX đỉnh %s | Kurt %s" % (fmt(peaks.get(a), 1), fmt(fa.get("kurtosis") if fresh else None, 1))
            card.set("%s (%s)" % (ROLE_LABEL.get(role, role or ""), a.upper()), C[a], v, z, a in iso_axes and not base, sub)

        # Info.
        sp = cap.get("speed_hz")
        self.info["speed"].setText("%s vg/ph (%s Hz)" % (fmt(sp * 60, 0), fmt(sp, 1)) if sp else "--")
        t = ind.get("temp_c")
        ind_fresh = (parse_ts(ind.get("ts")) or 0) >= now - STALE_S
        self.info["temp"].setText("%s °C" % fmt(t, 1) if t is not None and ind_fresh else "--")
        if cap:
            self.info["run"].setText("Đang chạy" if cap.get("running") else "Dừng")
            self.info["cap"].setText(ago(now - parse_ts(cap.get("ts"))) if parse_ts(cap.get("ts")) else "--")
        else:
            self.info["run"].setText("--")
            self.info["cap"].setText("chưa có")

        # Trend.
        hist = ps.get("history") or []
        for a in ("x", "y", "z"):
            xs, ys = [], []
            for s in hist:
                v = (s.get("axes") or {}).get(a)
                if v is None:
                    continue
                dx = (s["t"] / 1000.0 - now) / 60.0
                if dx >= -TREND_MIN:
                    xs.append(dx)
                    ys.append(v)
            self.trend_lines[a].setData(xs, ys)
        for ln, k in zip(self.limit_lines, ("ab", "bc", "cd")):
            ln.setValue(lim[k])
        top = max([lim["bc"] * 1.2] + [v for s in hist for v in (s.get("axes") or {}).values()])
        self.trend.setYRange(0, min(top * 1.1, lim["cd"] * 2.5), padding=0)

        # Orders 1X..5X from the last capture.
        for b in self.bars:
            self.orders.removeItem(b)
        self.bars = []
        width = 0.26
        omax = 0.0
        for k, a in enumerate(axes):
            ords = (cap_axes.get(a) or {}).get("orders") or {}
            ys = [ords.get(str(i)) or 0.0 for i in range(1, 6)]
            omax = max([omax] + ys)
            bar = pg.BarGraphItem(x=[i + 1 + (k - 1) * width for i in range(5)], height=ys, width=width * 0.9,
                                  brush=QColor(C[a]), pen=pg.mkPen(None))
            self.orders.addItem(bar)
            self.bars.append(bar)
        self.orders.setYRange(0, max(1.0, omax * 1.15), padding=0)
        if cap:
            self.ord_title.setText(("Thành phần 1X-5X, mm/s RMS | %s" % ago(now - (parse_ts(cap.get("ts")) or now))).upper())

        # Alarms.
        evs = [e for e in st.get("active_events") or [] if not e.get("point_id") or e.get("point_id") == pid
               or e.get("machine_id") == m["id"]]
        rows = []
        for e in evs[:4]:
            t = parse_ts(e.get("ts"))
            hhmm = datetime.fromtimestamp(t).strftime("%H:%M") if t else ""
            rows.append(("%s  [%s]  %s" % (hhmm, SEV_TEXT.get(e.get("severity"), e.get("severity")), e.get("message") or e.get("rule")),
                         SEV_COLOR.get(e.get("severity"), C["muted"])))
        if not rows:
            rows = [("Không có cảnh báo", C["ok"])]
        for i, r in enumerate(self.alarm_rows):
            text, color = rows[i] if i < len(rows) else ("", C["text"])
            r.setText(text if len(text) <= 58 else text[:57] + "...")
            r.setStyleSheet("color:%s;background:transparent;border:none;" % color)

        upd = datetime.fromtimestamp(self.last_ok).strftime("%H:%M:%S") if self.last_ok else "--"
        self.f_left.setText("Gateway %s | %s | IP %s | chờ gửi %s | cập nhật %s%s" % (
            gw.get("id", "--"), gw.get("version", "--"), self.ip, gw.get("outbox_pending", "--"), upd,
            "  |  KHÔNG ĐỌC ĐƯỢC EDGE-AGENT" if self.err else ""))


STEP_COLOR = {"ok": C["ok"], "fail": C["bad"], "wait": C["warn"], "skip": C["none"]}
STEP_ICON = {"ok": "ĐẠT", "fail": "LỖI", "wait": "CHỜ", "skip": "--"}
AUTO_ENTER_S = 4      # seconds with every step OK before the dashboard opens by itself


class NetPage(QWidget):
    """First screen after power-up: step-by-step network status."""

    def __init__(self, panel, show_dashboard):
        super().__init__()
        self.panel, self.show_dashboard = panel, show_dashboard
        self.probe = netpage.NetProbe()
        self.ok_since = None
        self.auto = True       # cleared after the first automatic or manual entry
        # A child page of QStackedWidget only paints its stylesheet background with this flag.
        self.setObjectName("netpage")
        self.setAttribute(Qt.WA_StyledBackground, True)
        self.setStyleSheet("#netpage{background:%s;}" % C["bg"])
        root = QVBoxLayout(self)
        root.setContentsMargins(14, 10, 14, 8)
        root.setSpacing(8)
        head = QHBoxLayout()
        title = label("KẾT NỐI MẠNG", 15, C["text"], True)
        title.setMinimumHeight(34)  # stacked Vietnamese diacritics (Ế, Ố) need the extra height
        head.addWidget(title, 1)
        self.clock = label("", 14, C["text"], True, Qt.AlignRight | Qt.AlignVCenter)
        fixw(self.clock, 110)
        head.addWidget(self.clock)
        root.addLayout(head)

        body = QHBoxLayout()
        body.setSpacing(10)
        root.addLayout(body, 1)
        steps_card = Card()
        sl = QVBoxLayout(steps_card)
        sl.setContentsMargins(16, 10, 16, 10)
        sl.setSpacing(4)
        self.rows = []
        for _ in range(6):
            row = QHBoxLayout()
            icon = label("", 9, C["none"], True, Qt.AlignCenter)
            fixw(icon, 64)
            icon.setFixedHeight(26)
            col = QVBoxLayout()
            col.setSpacing(0)
            title = label("", 13, C["text"], True)
            detail = label("", 10, C["muted"])
            hint = label("", 10, C["warn"])
            for w in (title, detail, hint):
                col.addWidget(w)
            row.addWidget(icon)
            row.addLayout(col, 1)
            sl.addLayout(row)
            self.rows.append((icon, title, detail, hint))
        sl.addStretch(1)
        body.addWidget(steps_card, 3)

        info = Card()
        il = QVBoxLayout(info)
        il.setContentsMargins(14, 10, 14, 10)
        il.setSpacing(3)
        il.addWidget(caption("Thông tin gateway"))
        self.info = {}
        for k, t in (("gw", "Gateway"), ("ip", "Địa chỉ IP"), ("mac", "MAC (cổng LAN)"),
                     ("router", "Router"), ("server", "Máy chủ")):
            il.addWidget(label(t, 9, C["muted"]))
            v = label("--", 13, C["text"], True)
            il.addWidget(v)
            self.info[k] = v
        il.addStretch(1)
        body.addWidget(info, 2)

        foot = QHBoxLayout()
        self.banner = label("", 13, C["text"], True)
        foot.addWidget(self.banner, 1)
        self.enter = flat_button("VÀO GIÁM SÁT", 190, 40, bg=C["accent"], fg="#ffffff", size=11)
        self.enter.clicked.connect(self.go)
        foot.addWidget(self.enter)
        root.addLayout(foot)

        self.timer = QTimer(self)
        self.timer.timeout.connect(self.refresh)
        self.timer.start(1000)
        self.refresh()

    def go(self):
        self.auto = False
        self.show_dashboard()

    def refresh(self):
        self.clock.setText(datetime.now().strftime("%H:%M:%S"))
        st = self.panel.state or {}
        gw = st.get("gateway") or {}
        mqtt_ok = bool(gw.get("mqtt_connected")) and not self.panel.err
        clock_ok = time.gmtime().tm_year >= 2026
        snap = self.probe.snap
        items = netpage.steps(snap, mqtt_ok, clock_ok)
        for i, (icon, title, detail, hint) in enumerate(self.rows):
            if i >= len(items):
                for w in (icon, title, detail, hint):
                    w.setText("")
                continue
            t, state, d, h = items[i]
            color = STEP_COLOR[state]
            icon.setText(STEP_ICON[state])
            icon.setStyleSheet("color:%s;background:%s;border:1px solid %s;border-left:4px solid %s;"
                               % (C["text"], C["bg"], C["border"], color))
            title.setText(t)
            detail.setText(d)
            hint.setText(h if state in ("fail", "wait") else "")
        self.info["gw"].setText(gw.get("id") or "--")
        if snap:
            self.info["ip"].setText(snap["ip"] or "chưa có")
            self.info["mac"].setText(snap["mac"] or "--")
            self.info["router"].setText(snap["router"] or "--")
            self.info["server"].setText(snap["server"])
        state = netpage.overall(items) if snap else "wait"
        if state == "ok":
            self.ok_since = self.ok_since or time.time()
            left = max(0, AUTO_ENTER_S - int(time.time() - self.ok_since))
            if self.auto:
                self.banner.setText("ĐÃ KẾT NỐI  |  tự vào giám sát sau %d giây" % left)
                if left == 0:
                    self.go()
            else:
                self.banner.setText("ĐÃ KẾT NỐI")
            self.banner.setStyleSheet("color:%s;background:transparent;border:none;" % C["ok"])
        else:
            self.ok_since = None
            self.banner.setText("CHƯA KẾT NỐI ĐỦ" if state == "fail" else "ĐANG KẾT NỐI...")
            self.banner.setStyleSheet("color:%s;background:transparent;border:none;"
                                      % (C["bad"] if state == "fail" else C["warn"]))


class ComparePage(QWidget):
    """Same-direction RMS of every sensor side by side; base / bearing ratio when both exist."""

    ROLES = (("radial_h", "Horizontal (H)"), ("radial_v", "Vertical (V)"), ("axial", "Axial (A)"))

    def __init__(self, panel, back):
        super().__init__()
        self.panel = panel
        self.setObjectName("cmppage")
        self.setAttribute(Qt.WA_StyledBackground, True)
        self.setStyleSheet("#cmppage{background:%s;}" % C["bg"])
        root = QVBoxLayout(self)
        root.setContentsMargins(14, 10, 14, 8)
        root.setSpacing(8)
        head = QHBoxLayout()
        title = label("SENSOR COMPARISON  |  RMS VELOCITY, MM/S", 15, C["text"], True)
        title.setMinimumHeight(34)
        head.addWidget(title, 1)
        self.clock = label("", 14, C["text"], True, Qt.AlignRight | Qt.AlignVCenter)
        fixw(self.clock, 110)
        head.addWidget(self.clock)
        root.addLayout(head)
        card = Card()
        self.grid = QGridLayout(card)
        self.grid.setContentsMargins(16, 12, 16, 12)
        self.grid.setHorizontalSpacing(10)
        self.grid.setVerticalSpacing(6)
        root.addWidget(card, 1)
        self.note = label("", 11, C["muted"])
        self.note.setWordWrap(True)
        self.note.setMinimumHeight(40)
        foot = QHBoxLayout()
        foot.addWidget(self.note, 1)
        foot.addWidget(flat_button("VỀ GIÁM SÁT", 170, 40, bg=C["accent"], fg="#ffffff", size=11))
        foot.itemAt(1).widget().clicked.connect(back)
        root.addLayout(foot)
        self.sig = None
        self.cells = {}
        self.timer = QTimer(self)
        self.timer.timeout.connect(self.refresh)
        self.timer.start(1000)

    def _rebuild(self, pts):
        while self.grid.count():
            w = self.grid.takeAt(0).widget()
            if w:
                w.deleteLater()
        self.cells = {}
        has_ratio = any(p.get("role") == "base" for _, p in pts) and any(p.get("role", "bearing") == "bearing" for _, p in pts)
        cols = ["MEASUREMENT\nAXIS"] + [pos_label(i, p) for i, (_, p) in enumerate(pts)] + (["BASE /\nBEARING RATIO", "BEARING-\nCORRECTED RMS"] if has_ratio else [])
        for c, text in enumerate(cols):
            lb = label(text, 10, C["muted"], True, Qt.AlignLeft | Qt.AlignVCenter if c == 0 else Qt.AlignRight | Qt.AlignVCenter)
            lb.setMinimumHeight(42)
            self.grid.addWidget(lb, 0, c)
            if 0 < c <= len(pts):
                p = pts[c - 1][1]
                sub = label("BASE" if p.get("role") == "base" else "BEARING", 9, C["muted"], False, Qt.AlignRight | Qt.AlignVCenter)
                self.grid.addWidget(sub, 1, c)
        for r, (_, name) in enumerate(self.ROLES):
            self.grid.addWidget(label(name.upper(), 15, C["text"], True), r + 2, 0)
            for c in range(1, len(cols)):
                lb = label("--", 28, C["text"], True, Qt.AlignRight | Qt.AlignVCenter)
                self.grid.addWidget(lb, r + 2, c)
                self.cells[(r, c)] = lb
        for r in range(len(self.ROLES)):
            self.grid.setRowStretch(r + 2, 1)   # spread the rows over the card
        self.has_ratio = has_ratio

    def refresh(self):
        self.clock.setText(datetime.now().strftime("%H:%M:%S"))
        pts = self.panel.points()
        if len(pts) < 2:
            return
        sig = tuple((p["id"], p.get("role")) for _, p in pts)
        if sig != self.sig:
            self.sig = sig
            self._rebuild(pts)
        now = parse_ts((self.panel.state or {}).get("now")) or time.time()
        bearing = next((i for i, (_, p) in enumerate(pts) if p.get("role", "bearing") == "bearing"), None)
        base = next((i for i, (_, p) in enumerate(pts) if p.get("role") == "base"), None)
        for r, (role, _) in enumerate(self.ROLES):
            vals = [self.panel.role_value(p, role, now) for _, p in pts]
            for i, v in enumerate(vals):
                self.cells[(r, i + 1)].setText(fmt(v))
            if self.has_ratio:
                b, d = vals[bearing], vals[base]
                ratio = d / b * 100 if b is not None and d is not None and b > 0.05 else None
                lb = self.cells[(r, len(pts) + 1)]
                lb.setText("%s %%" % fmt(ratio, 0) if ratio is not None else "--")
                lb.setStyleSheet("color:%s;background:transparent;border:none;" % (C["C"] if ratio and ratio > 50 else C["text"]))
                # Bearing-corrected vibration after removing the BASE contribution.
                alpha = float((self.panel.state or {}).get("base_alpha") or 0.8)
                own = None if b is None or d is None else math.sqrt(max(0.0, b * b - (alpha * d) ** 2))
                self.cells[(r, len(pts) + 2)].setText(fmt(own))
        alpha = float((self.panel.state or {}).get("base_alpha") or 0.8)
        self.note.setText("BEARING-CORRECTED RMS = √(DE² - (α × BASE)²)  ·  α = %s" % fmt(alpha, 1)
                          if self.has_ratio else "")


class SplashPage(QWidget):
    """Short branded start screen before the network status page."""

    def __init__(self):
        super().__init__()
        self.setStyleSheet("background:%s;" % C["bg"])
        layout = QVBoxLayout(self)
        layout.setContentsMargins(60, 42, 60, 42)
        layout.addStretch(2)

        logo = QLabel()
        logo.setAlignment(Qt.AlignCenter)
        path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "assets", "selink-logo.png")
        pixmap = QPixmap(path)
        if pixmap.isNull():
            logo.setText("SELINK")
            logo.setFont(font(52, True))
            logo.setStyleSheet("color:#2fa84f;")
        else:
            logo.setPixmap(pixmap.scaled(700, 300, Qt.KeepAspectRatio, Qt.SmoothTransformation))
        layout.addWidget(logo)

        title = QLabel("SMART MOTOR")
        title.setAlignment(Qt.AlignCenter)
        title.setFont(font(19, True))
        title.setStyleSheet("color:%s; letter-spacing:2px; padding-top:12px;" % C["text"])
        layout.addWidget(title)
        subtitle = QLabel("GIÁM SÁT RUNG ĐỘNG THIẾT BỊ")
        subtitle.setAlignment(Qt.AlignCenter)
        subtitle.setFont(font(10, True))
        subtitle.setStyleSheet("color:%s; letter-spacing:1px; padding-top:5px;" % C["muted"])
        layout.addWidget(subtitle)
        layout.addStretch(3)


class Main(QStackedWidget):
    """Shows a brief splash screen, then network status; dashboard opens when online or touched."""

    def __init__(self):
        super().__init__()
        self.splash = SplashPage()
        self.panel = Panel()
        self.addWidget(self.splash)
        self.addWidget(self.panel)
        self.net = NetPage(self.panel, self.show_dashboard)
        self.addWidget(self.net)
        self.compare = ComparePage(self.panel, self.show_dashboard)
        self.addWidget(self.compare)
        self.panel.on_net = self.show_net
        self.panel.on_compare = lambda: self.setCurrentWidget(self.compare)
        self.setCurrentWidget(self.splash)
        QTimer.singleShot(2200, self.show_net)

    def show_dashboard(self):
        self.setCurrentWidget(self.panel)

    def show_net(self):
        self.net.auto = False
        self.setCurrentWidget(self.net)


def main():
    os.environ.setdefault("QT_QPA_PLATFORM", "linuxfb:fb=/dev/fb0")
    app = QApplication(sys.argv)
    w = Main()
    w.setFixedSize(1024, 600)
    w.showFullScreen()
    ip_timer = QTimer()
    ip_timer.timeout.connect(lambda: setattr(w.panel, "ip", local_ip()))
    ip_timer.start(30000)
    sys.exit(app.exec_())


if __name__ == "__main__":
    main()
