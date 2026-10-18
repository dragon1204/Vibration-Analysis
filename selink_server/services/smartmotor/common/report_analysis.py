"""Assessment logic for the periodic machine report.

Pure functions over plain dicts (captures, events, machine, points) so the report can be
built and checked without a database. Every statement written into the report is derived
here from measured data and the ISO 20816-3 limits of the machine; rules that cannot be
decided from the data (e.g. 2X vs 2×line frequency with coarse resolution) are reported
as limitations instead of conclusions.
"""
from __future__ import annotations

import math
import re
from collections import defaultdict
from datetime import datetime, timedelta, timezone
from statistics import mean, median

from .iso import ISOLimits

ROLE_VI = {"radial_h": "ngang", "radial_v": "đứng", "axial": "dọc trục"}
DEFAULT_ROLES = {"x": "radial_h", "y": "axial", "z": "radial_v"}
ZONE_TEXT = {"A": "Tốt", "B": "Chấp nhận được", "C": "Cảnh báo – cần lên kế hoạch xử lý", "D": "Nguy hiểm – có thể gây hư hỏng"}
SEV_VI = {"info": "Thông tin", "watch": "Theo dõi", "warning": "Cảnh báo", "danger": "Nguy hiểm", "alarm": "Báo động"}
SEV_RANK = {"info": 0, "watch": 1, "warning": 2, "alarm": 3, "danger": 3}
VN = timezone(timedelta(hours=7))


def period_bounds(period_type: str, period: str | None = None, frm: datetime | None = None,
                  to: datetime | None = None) -> tuple[datetime, datetime, str]:
    """[start, end) of a report period on Vietnam calendar days, and its label.

    month: period "YYYY-MM" · quarter: "YYYY-Qn" · custom: frm/to (end exclusive, max 366 days)."""
    if period_type == "month":
        m = re.fullmatch(r"(\d{4})-(\d{2})", period or "")
        if not m or not 1 <= int(m.group(2)) <= 12:
            raise ValueError("period phải có dạng YYYY-MM")
        y, mo = int(m.group(1)), int(m.group(2))
        start = datetime(y, mo, 1, tzinfo=VN)
        end = datetime(y + (mo == 12), 1 if mo == 12 else mo + 1, 1, tzinfo=VN)
        return start, end, f"{y}-{mo:02d}"
    if period_type == "quarter":
        m = re.fullmatch(r"(\d{4})-Q([1-4])", period or "")
        if not m:
            raise ValueError("period phải có dạng YYYY-Qn (n = 1..4)")
        y, q = int(m.group(1)), int(m.group(2))
        start = datetime(y, 3 * (q - 1) + 1, 1, tzinfo=VN)
        end = datetime(y + (q == 4), 1 if q == 4 else 3 * q + 1, 1, tzinfo=VN)
        return start, end, f"{y}-Q{q}"
    if period_type == "custom":
        if not frm or not to:
            raise ValueError("custom cần from và to")
        frm, to = _ts(frm), _ts(to)
        if to <= frm:
            raise ValueError("to phải sau from")
        if to - frm > timedelta(days=366):
            raise ValueError("Khoảng tùy chọn tối đa 366 ngày")
        return frm, to, f"{frm.astimezone(VN):%Y-%m-%d}..{(to - timedelta(seconds=1)).astimezone(VN):%Y-%m-%d}"
    raise ValueError("period_type phải là month, quarter hoặc custom")


def jsonable(o):
    """JSON-safe copy: datetimes as ISO 8601, tuples as lists."""
    if isinstance(o, datetime):
        return o.isoformat()
    if isinstance(o, dict):
        return {str(k): jsonable(v) for k, v in o.items()}
    if isinstance(o, (list, tuple)):
        return [jsonable(v) for v in o]
    if isinstance(o, float) and (math.isnan(o) or math.isinf(o)):
        return None
    return o


def _ts(v) -> datetime:
    if isinstance(v, datetime):
        return v if v.tzinfo else v.replace(tzinfo=timezone.utc)
    s = str(v).replace("Z", "+00:00")
    if re.search(r"[+-]\d\d$", s):
        s += ":00"
    return datetime.fromisoformat(s)


def _pct(values: list[float], q: float) -> float | None:
    if not values:
        return None
    s = sorted(values)
    k = (len(s) - 1) * q
    lo, hi = math.floor(k), math.ceil(k)
    return s[lo] + (s[hi] - s[lo]) * (k - lo)


def _num(v) -> float | None:
    try:
        f = float(v)
    except (TypeError, ValueError):
        return None
    return None if math.isnan(f) else f


def axis_label(point: dict, axis: str) -> str:
    role = (point.get("axes_map") or DEFAULT_ROLES).get(axis, DEFAULT_ROLES.get(axis))
    return f"{axis.upper()} ({ROLE_VI.get(role, role or '?')})"


def _roles(point: dict) -> tuple[list[str], list[str]]:
    amap = point.get("axes_map") or DEFAULT_ROLES
    radial = [a for a, r in amap.items() if str(r).startswith("radial")]
    axial = [a for a, r in amap.items() if r == "axial"]
    return sorted(radial), sorted(axial)


def humanize_event(message: str, point: dict | None) -> str:
    """'Vượt ngưỡng baseline z.orders.2' → 'Thành phần 2X – trục Z (đứng) vượt ngưỡng nền'."""
    m = re.search(r"baseline\s+(?:([xyz])\.)?([a-z_]+)(?:\.([\d.]+))?", message or "")
    if not m:
        return message or ""
    axis, feat, order = m.group(1), m.group(2), m.group(3)
    names = {"orders": f"Thành phần {order}X" if order else "Thành phần bậc", "kurtosis": "Kurtosis (xung va đập)",
             "crest": "Hệ số đỉnh", "iso_vrms_mm_s": "Rung RMS ISO", "acc_rms_g": "Gia tốc RMS"}
    where = f" – trục {axis_label(point or {}, axis)}" if axis else ""
    return f"{names.get(feat, feat)}{where} vượt ngưỡng nền học được"


def analyze(machine: dict, points: list[dict], captures: list[dict], events: list[dict], lim: ISOLimits,
            start: datetime, end: datetime, health: dict | None = None) -> dict:
    as_of = min(end, datetime.now(timezone.utc))
    period_days = max((as_of - start).total_seconds() / 86400, 1e-9)
    poles = int(machine.get("poles") or 0)
    line_hz = float(machine.get("line_freq_hz") or 50)
    rated_hz = float(machine.get("rated_speed_rpm") or 0) / 60
    pts = {p["id"]: p for p in points}
    by_point: dict[str, list[dict]] = defaultdict(list)
    for c in captures:
        if c.get("axes"):
            by_point[c["point_id"]].append(c)

    out_points = []
    for pid, caps in sorted(by_point.items()):
        point = pts.get(pid, {"id": pid})
        radial, axial = _roles(point)
        iso_axes = [a for a in (point.get("iso_axes") or radial or ["x", "y", "z"])]
        caps.sort(key=lambda c: _ts(c["ts"]))
        # Overall value per capture uses the *current* axis mapping and limits (stored zones may be stale).
        overall, times = [], []
        for c in caps:
            vals = [_num((c["axes"].get(a) or {}).get("iso_vrms_mm_s")) for a in iso_axes]
            vals = [v for v in vals if v is not None]
            if vals:
                overall.append(max(vals))
                times.append(_ts(c["ts"]))
        if not overall:
            continue
        zone_share = {z: 0 for z in "ABCD"}
        for v in overall:
            zone_share[lim.zone(v)] += 1
        n = len(overall)
        p95 = _pct(overall, 0.95)
        stats = {"n": n, "mean": mean(overall), "p50": median(overall), "p95": p95, "max": max(overall),
                 "zone_p95": lim.zone(p95), "zone_max": lim.zone(max(overall)),
                 "zone_share": {z: zone_share[z] / n for z in "ABCD"}}

        # Daily means (Vietnam calendar days) for trend and chart.
        daily: dict[str, list[float]] = defaultdict(list)
        for t, v in zip(times, overall):
            daily[t.astimezone(VN).strftime("%Y-%m-%d")].append(v)
        days = sorted(daily)
        series = [(d, mean(daily[d])) for d in days]
        trend = None
        if len(series) >= 3:
            xs = list(range(len(series)))
            ys = [v for _, v in series]
            # x in calendar days, not index, so gaps do not distort the slope
            d0 = datetime.strptime(days[0], "%Y-%m-%d")
            xs = [(datetime.strptime(d, "%Y-%m-%d") - d0).days for d in days]
            mx, my = mean(xs), mean(ys)
            sxx = sum((x - mx) ** 2 for x in xs)
            slope = sum((x - mx) * (y - my) for x, y in zip(xs, ys)) / sxx if sxx else 0.0
            ss_tot = sum((y - my) ** 2 for y in ys)
            ss_res = sum((y - (my + slope * (x - mx))) ** 2 for x, y in zip(xs, ys))
            trend = {"slope_per_day": slope, "pct_per_30d": slope * 30 / my * 100 if my else 0.0,
                     "r2": 1 - ss_res / ss_tot if ss_tot else 0.0, "first": ys[0], "last": ys[-1], "days": len(series)}

        # Per-axis spectral picture (means over the period).
        axes = {}
        for a in ("x", "y", "z"):
            rows = [c["axes"].get(a) for c in caps if c["axes"].get(a)]
            if not rows:
                continue
            def m_of(key, sub=None):
                vals = [_num((r.get(key) or {}).get(sub)) if sub else _num(r.get(key)) for r in rows]
                vals = [v for v in vals if v is not None]
                return (mean(vals), _pct(vals, 0.95)) if vals else (None, None)
            orders = {o: m_of("orders", o)[0] for o in ("0.5", "1", "1.5", "2", "3", "4", "5", "6")}
            axes[a] = {"label": axis_label(point, a), "iso": m_of("iso_vrms_mm_s")[0], "orders": orders,
                       "line2x": m_of("line_2x_mm_s")[0], "kurt": m_of("kurtosis"), "crest": m_of("crest"),
                       "acc_rms": m_of("acc_rms_g")[0]}

        speeds = [_num(c.get("speed_hz")) for c in caps]
        speeds = [s for s in speeds if s]
        dfs = [_num(c.get("df_hz")) for c in caps]
        dfs = [d for d in dfs if d]
        speed = {"median": median(speeds), "min": min(speeds), "max": max(speeds)} if speeds else None
        df = median(dfs) if dfs else None

        gaps = [(b - a).total_seconds() / 3600 for a, b in zip(times, times[1:])]
        coverage = {"first": times[0], "last": times[-1], "days_with_data": len(days),
                    "longest_gap_h": max(gaps) if gaps else 0.0, "period_days": period_days}

        findings, recs, limits = _diagnose(point, axes, radial, axial, stats, trend, speed, df, poles, line_hz,
                                           rated_hz, lim)
        out_points.append({"id": pid, "name": point.get("name") or pid, "stats": stats, "series": series,
                           "trend": trend, "axes": axes, "speed": speed, "df": df, "coverage": coverage,
                           "iso_axes": iso_axes, "findings": findings, "recommendations": recs, "limits": limits})

    ev = _events(events, pts)
    worst = max((p["stats"]["zone_p95"] for p in out_points), default=None)
    return {"points": out_points, "events": ev, "zone_overall": worst, "health": health, "as_of": as_of,
            "period_complete": as_of >= end,
            "summary": _summary(machine, out_points, ev, worst, lim)}


def _diagnose(point, axes, radial, axial, stats, trend, speed, df, poles, line_hz, rated_hz, lim):
    findings: list[tuple[str, str, str]] = []   # (level ok|watch|warn, full text, short label for the summary)
    recs: list[tuple[int, str]] = []       # (priority 1..3, text)
    limits: list[str] = []
    o = lambda a, k: (axes.get(a) or {}).get("orders", {}).get(k) or 0.0
    iso = lambda a: (axes.get(a) or {}).get("iso") or 0.0

    # 1. ISO severity of the period (P95 of radial overall values, i.e. the sustained level).
    z = stats["zone_p95"]
    share_cd = stats["zone_share"]["C"] + stats["zone_share"]["D"]
    if z in ("A", "B"):
        findings.append(("ok", f"Mức rung duy trì (P95 = {stats['p95']:.2f} mm/s) ở vùng {z} – {ZONE_TEXT[z].lower()}.", ""))
    else:
        findings.append(("warn", f"Mức rung duy trì (P95 = {stats['p95']:.2f} mm/s) ở vùng {z} – {ZONE_TEXT[z].lower()}.",
                         f"mức duy trì ở vùng {z}"))
        recs.append((1 if z == "D" else 2, "Lên kế hoạch kiểm tra cơ khí trong lần dừng máy gần nhất; không để vận hành kéo dài ở vùng "
                     f"{z} (ISO 20816-3)."))
    if share_cd > 0 and z in ("A", "B"):
        findings.append(("watch", f"{share_cd * 100:.1f}% số lần đo vượt ngưỡng B/C ({lim.bc} mm/s), lớn nhất {stats['max']:.2f} mm/s: "
                         "các đỉnh ngắn hạn, chưa phải mức duy trì.", f"{share_cd * 100:.1f}% số lần đo vào vùng C/D"))
    margin = (lim.bc - stats["p95"]) / lim.bc * 100
    if z == "B" and margin < 15:
        findings.append(("watch", f"Mức duy trì chỉ cách ngưỡng vùng C {margin:.0f}% – dư địa nhỏ.", "sát ngưỡng vùng C"))

    # 2. Trend: judged only with enough calendar days, otherwise reported as insufficient.
    if trend and trend["days"] >= 14:
        p = trend["pct_per_30d"]
        if p > 10 and trend["r2"] >= 0.3:
            findings.append(("warn", f"Rung có xu hướng tăng {p:+.0f}%/30 ngày (R² = {trend['r2']:.2f}, {trend['days']} ngày).",
                             "rung đang tăng dần"))
            recs.append((2, "Theo dõi sát xu hướng tăng; so sánh lại sau mỗi lần thay đổi vận hành hoặc bảo trì."))
        elif p < -10 and trend["r2"] >= 0.3:
            findings.append(("ok", f"Rung có xu hướng giảm {p:+.0f}%/30 ngày (R² = {trend['r2']:.2f}).", ""))
        else:
            findings.append(("ok", f"Không thấy xu hướng tăng rõ rệt ({p:+.0f}%/30 ngày, R² = {trend['r2']:.2f}).", ""))
    else:
        days = trend["days"] if trend else 0
        findings.append(("watch", f"Mới có dữ liệu {days} ngày – chưa đủ để đánh giá xu hướng (cần ít nhất 14 ngày).", ""))

    # 3. Spectral signatures (orders in mm/s RMS).
    r1 = max(radial, key=lambda a: o(a, "1"), default=None)
    r1v = o(r1, "1") if r1 else 0.0
    if r1 and r1v >= 1.0 and iso(r1) and (r1v / iso(r1)) ** 2 >= 0.5:
        findings.append(("watch", f"1X hướng kính trội ({axes[r1]['label']}: {r1v:.2f} mm/s, ≈{(r1v / iso(r1)) ** 2 * 100:.0f}% năng lượng) "
                         "– dấu hiệu mất cân bằng hoặc lệch tâm rotor.", "nghi mất cân bằng (1X hướng kính trội)"))
        recs.append((2, "Kiểm tra cân bằng rotor/cánh bơm (bám bẩn, mòn cánh); cân bằng động nếu cần."))
    for a in axial:
        a1 = o(a, "1")
        if a1 >= 1.0 and r1v and a1 >= 0.5 * r1v:
            findings.append(("watch", f"1X dọc trục cao ({axes[a]['label']}: {a1:.2f} mm/s, {a1 / r1v * 100:.0f}% của 1X hướng kính) "
                             "– dấu hiệu lệch trục góc hoặc trục cong.", "nghi lệch trục góc (1X dọc trục cao)"))
            recs.append((2, "Kiểm tra căn chỉnh đồng tâm động cơ – bơm (laser/đồng hồ so) và tình trạng khớp nối."))
            break
    near_line = poles == 2 and speed and df and abs(2 * speed["median"] - 2 * line_hz) < 2 * df
    for a in radial:
        a1, a2 = o(a, "1"), o(a, "2")
        if a2 >= 1.0 and a2 >= a1:
            txt = (f"2X hướng kính lớn hơn 1X ({axes[a]['label']}: 2X {a2:.2f} so với 1X {a1:.2f} mm/s) – dấu hiệu lệch trục song song"
                   " hoặc lỏng chân đế")
            if near_line:
                txt += f"; tuy nhiên 2X ({2 * speed['median']:.1f} Hz) trùng vùng 2×tần số lưới ({2 * line_hz:.0f} Hz) nên chưa loại trừ nguồn điện từ"
            findings.append(("watch", txt + ".", "2X hướng kính lớn (nghi lệch trục song song)"))
            recs.append((2, "Kiểm tra soft foot (nới từng bu-lông chân đế, đo lại) và căn chỉnh song song."))
    for a in axes:
        a1 = o(a, "1")
        harm = math.sqrt(sum(o(a, k) ** 2 for k in ("3", "4", "5", "6")))
        sub = o(a, "0.5")
        if a1 >= 1.0 and (harm >= 0.5 * a1 or sub >= 0.2 * a1):
            findings.append(("warn", f"Nhiều hài bậc cao/á hài trên {axes[a]['label']} (3X–6X tổng {harm:.2f}, 0,5X {sub:.2f} mm/s) "
                             "– dấu hiệu lỏng cơ khí.", "dấu hiệu lỏng cơ khí"))
            recs.append((1, "Kiểm tra lỏng cơ khí: bu-lông nền, nắp ổ, khe hở ổ đỡ."))
            break
    else:
        findings.append(("ok", "Các hài 3X–6X và á hài 0,5X nhỏ – không thấy dấu hiệu lỏng cơ khí.", ""))
    kurt_p95 = max(((ax["kurt"][1] or 0) for ax in axes.values()), default=0)
    crest_p95 = max(((ax["crest"][1] or 0) for ax in axes.values()), default=0)
    if kurt_p95 > 4 or crest_p95 > 5:
        findings.append(("warn", f"Có xung va đập (kurtosis P95 {kurt_p95:.1f}, hệ số đỉnh P95 {crest_p95:.1f}) – nghi khuyết tật ổ lăn "
                         "hoặc va chạm; cần phổ bao hình để xác nhận.", "có xung va đập (nghi ổ lăn)"))
        recs.append((1, "Kiểm tra ổ lăn: bôi trơn, nhiệt độ ổ, phổ bao hình (envelope)."))
    else:
        findings.append(("ok", f"Không thấy xung va đập (kurtosis P95 {kurt_p95:.1f}, hệ số đỉnh P95 {crest_p95:.1f}) – "
                         "chưa có dấu hiệu hỏng ổ lăn.", ""))

    # 4. Limitations that bound the conclusions.
    if near_line:
        limits.append(f"Độ phân giải phổ {df:.1f} Hz không tách được 2X ({2 * speed['median']:.1f} Hz) khỏi 2×tần số lưới "
                      f"({2 * line_hz:.0f} Hz). Cần phép đo phân giải cao (≈0,5 Hz) hoặc thử cắt điện để phân biệt cơ khí/điện từ.")
    if speed and rated_hz and abs(speed["median"] - rated_hz) / rated_hz > 0.03:
        limits.append(f"Tốc độ đo được {speed['median'] * 60:.0f} v/ph khác tốc độ định mức trong hồ sơ ({rated_hz * 60:.0f} v/ph) "
                      f"{(speed['median'] - rated_hz) / rated_hz * 100:+.1f}% – nên kiểm tra lại nhãn máy.")
    if not axial:
        limits.append("Không có trục đo dọc trục – không đánh giá được lệch trục góc.")
    limits.append("Chỉ có một điểm đo trên máy – chưa so sánh được ổ trước/ổ sau và đế, nên chưa định vị được nguồn rung.")
    return findings, sorted(set(recs)), limits


def _events(events: list[dict], pts: dict) -> dict:
    groups: dict[tuple, dict] = {}
    active = 0
    for e in events:
        point = pts.get(e.get("point_id")) or {}
        text = humanize_event(e.get("message") or "", point) if e.get("rule") == "baseline" else (e.get("message") or "")
        key_text = text
        zm = re.search(r"vùng ([A-D])", text)
        if e.get("rule") == "iso_zone" and zm:
            key_text = text = f"Rung RMS ISO ở vùng {zm.group(1)} (ISO 20816-3)"
        elif e.get("rule") == "trend_rate":
            key_text = text = "Rung tăng nhanh bất thường (xu hướng 7 ngày)"
        key = (e.get("rule") or e.get("type") or "", key_text)
        g = groups.setdefault(key, {"rule": key[0], "text": text, "count": 0, "first": _ts(e["ts"]), "last": _ts(e["ts"]),
                                    "worst": e.get("severity") or "info", "active": 0, "max_value": None})
        v = _num(e.get("value"))
        if v is not None and (g["max_value"] is None or v > g["max_value"]):
            g["max_value"] = v
        g["count"] += 1
        g["last"] = max(g["last"], _ts(e["ts"]))
        if SEV_RANK.get(e.get("severity"), 0) > SEV_RANK.get(g["worst"], 0):
            g["worst"] = e.get("severity")
        if not e.get("cleared_at") and e.get("state") not in ("resolved", "closed"):
            g["active"] += 1
            active += 1
    rows = sorted(groups.values(), key=lambda g: (-SEV_RANK.get(g["worst"], 0), -g["count"]))
    by_sev = defaultdict(int)
    for e in events:
        by_sev[e.get("severity") or "info"] += 1
    latest = sorted(events, key=lambda e: _ts(e["ts"]), reverse=True)[:15]
    return {"total": len(events), "active": active, "by_severity": dict(by_sev), "groups": rows, "latest": latest}


def _summary(machine, points, ev, worst, lim) -> list[str]:
    if not points:
        return ["Không có dữ liệu rung trong kỳ."]
    lines = []
    verdict = {"A": "TỐT", "B": "CHẤP NHẬN ĐƯỢC – tiếp tục vận hành, theo dõi định kỳ",
               "C": "CẦN LÊN KẾ HOẠCH XỬ LÝ", "D": "NGUY HIỂM – cần xử lý sớm"}.get(worst, "chưa xác định")
    lines.append(f"Đánh giá chung: {verdict} (vùng {worst} theo ISO 20816-3, ngưỡng A/B {lim.ab} · B/C {lim.bc} · C/D {lim.cd} mm/s).")
    for p in points:
        s = p["stats"]
        lines.append(f"{p['name']}: RMS trung bình {s['mean']:.2f} mm/s, P95 {s['p95']:.2f}, lớn nhất {s['max']:.2f} mm/s; "
                     f"{s['zone_share']['A'] * 100 + s['zone_share']['B'] * 100:.1f}% thời gian ở vùng A/B.")
        short = [sh for lvl, _t, sh in p["findings"] if lvl in ("watch", "warn") and sh]
        if short:
            lines.append("Dấu hiệu chính: " + "; ".join(short) + ".")
        if p["recommendations"]:
            lines.append("Việc nên làm trước: " + p["recommendations"][0][1])
    lines.append(f"Sự kiện: {ev['total']} cảnh báo trong kỳ, {ev['active']} chưa kết thúc.")
    return [re.sub(r"(?<=\d)\.(?=\d)", ",", line) for line in lines]  # Vietnamese decimal comma
