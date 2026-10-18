"""PDF generation (monthly machine report, accuracy test protocol – spec 6.4, 9.3)."""
from __future__ import annotations

import io
import math
import re
from datetime import datetime, timedelta

from reportlab.graphics.charts.lineplots import LinePlot
from reportlab.graphics.shapes import Drawing, Line, String
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

_FONT = "Helvetica"
for path in ("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", "C:/Windows/Fonts/arial.ttf"):
    try:
        pdfmetrics.registerFont(TTFont("VN", path))
        _FONT = "VN"
        break
    except Exception:
        continue


def _styles():
    ss = getSampleStyleSheet()
    for k in ("Title", "Heading2", "Normal"):
        ss[k].fontName = _FONT
    return ss


def _table(rows: list[list], widths=None) -> Table:
    t = Table(rows, colWidths=widths, repeatRows=1)
    t.setStyle(TableStyle([
        ("FONTNAME", (0, 0), (-1, -1), _FONT), ("FONTSIZE", (0, 0), (-1, -1), 8),
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#E8EEF5")),
        ("GRID", (0, 0), (-1, -1), 0.3, colors.grey), ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
    ]))
    return t


_ZONE_BG = {"A": "#E6F6EE", "B": "#EEF7E6", "C": "#FFF4D6", "D": "#FDE7E7"}
# Only glyphs present in Arial/DejaVu: the colour carries the level, the word makes it readable in print.
_LEVEL_MARK = {"ok": "● Tốt:", "watch": "● Lưu ý:", "warn": "● Cảnh báo:"}
_LEVEL_COLOR = {"ok": "#17895d", "watch": "#ad7100", "warn": "#c4383e"}


def _f(v, d=2, unit=""):
    """Vietnamese decimal comma; '–' for missing values."""
    return "–" if v is None else f"{v:.{d}f}{unit}".replace(".", ",")


def _trend_chart(series: list, lim, width=180 * mm, height=58 * mm):
    """Daily mean of the radial ISO RMS with the ISO zone limits drawn as dashed lines."""
    d = Drawing(width, height)
    if len(series) < 2:
        d.add(String(10, height / 2, "Chưa đủ dữ liệu để vẽ xu hướng", fontName=_FONT, fontSize=8))
        return d
    lp = LinePlot()
    lp.x, lp.y, lp.width, lp.height = 28, 18, width - 64, height - 32
    ymax = max(lim.cd * 1.08, max(v for _, v in series) * 1.15)
    lp.data = [[(i, v) for i, (_, v) in enumerate(series)]]
    lp.lines[0].strokeColor = colors.HexColor("#1d4ed8")
    lp.lines[0].strokeWidth = 1.4
    lp.xValueAxis.valueMin, lp.xValueAxis.valueMax = 0, len(series) - 1
    step = max(1, len(series) // 8)
    lp.xValueAxis.valueSteps = list(range(0, len(series), step))
    lp.xValueAxis.labelTextFormat = lambda i: (f"{series[int(i)][0][8:10]}/{series[int(i)][0][5:7]}"
                                               if 0 <= int(i) < len(series) else "")
    lp.yValueAxis.valueMin, lp.yValueAxis.valueMax = 0, ymax
    for ax in (lp.xValueAxis, lp.yValueAxis):
        ax.labels.fontName = _FONT
        ax.labels.fontSize = 7
    d.add(lp)
    for v, col, name in ((lim.ab, "#20a56f", "A/B"), (lim.bc, "#f1a20d", "B/C"), (lim.cd, "#df474c", "C/D")):
        y = lp.y + lp.height * v / ymax
        d.add(Line(lp.x, y, lp.x + lp.width, y, strokeColor=colors.HexColor(col), strokeDashArray=[3, 2], strokeWidth=0.8))
        d.add(String(lp.x + lp.width + 3, y - 2, f"{name} {_f(v, 1)}", fontName=_FONT, fontSize=6.5,
                     fillColor=colors.HexColor(col)))
    d.add(String(lp.x, height - 9, "RMS ISO trung bình theo ngày (mm/s) – trục hướng kính lớn nhất", fontName=_FONT, fontSize=7))
    return d


def monthly_report(machine: dict, period: str, start: datetime, end: datetime, lim, analysis: dict) -> bytes:
    """Periodic machine condition report rendered from report_analysis.analyze()."""
    from .report_analysis import SEV_VI, VN, ZONE_TEXT
    buf = io.BytesIO()
    ss = _styles()
    small = ParagraphStyle("small", parent=ss["Normal"], fontSize=8, leading=10.5)
    body = ParagraphStyle("body", parent=ss["Normal"], fontSize=9.5, leading=13)
    h3 = ParagraphStyle("h3", parent=ss["Heading2"], fontSize=11, spaceBefore=6, spaceAfter=3)
    doc = SimpleDocTemplate(buf, pagesize=A4, leftMargin=15 * mm, rightMargin=15 * mm, topMargin=14 * mm,
                            bottomMargin=14 * mm, title=f"Báo cáo {machine.get('name')} {period}")

    def P(text, style=body):
        # Vietnamese decimal comma everywhere in running text ("5.77" -> "5,77").
        return Paragraph(re.sub(r"(?<=\d)\.(?=\d)", ",", str(text)), style)

    def loc(t):
        return t.astimezone(VN).strftime("%d/%m/%Y %H:%M")

    last_day = (end - timedelta(seconds=1)).astimezone(VN)
    story = [Paragraph(f"Báo cáo tình trạng động cơ – {machine.get('name')}", ss["Title"]),
             P(f"Kỳ báo cáo: <b>{period}</b> ({start.astimezone(VN):%d/%m/%Y} – {last_day:%d/%m/%Y}) · Mã máy: {machine.get('id')} · "
               f"{machine.get('rated_power_kw') or '–'} kW · {machine.get('rated_speed_rpm') or '–'} v/ph định mức · "
               f"{machine.get('poles') or '–'} cực"),
             P(f"Tiêu chuẩn: ISO 20816-3, nhóm {machine.get('iso_group') or '–'}, nền "
               f"{'mềm' if machine.get('foundation') == 'flexible' else 'cứng'} – ngưỡng A/B {_f(lim.ab, 1)} · B/C {_f(lim.bc, 1)} · "
               f"C/D {_f(lim.cd, 1)} mm/s RMS, dải 10–1000 Hz."), Spacer(1, 4 * mm)]

    zone = analysis.get("zone_overall")
    box = Table([[P("<b>1. Tóm tắt đánh giá</b>")]] + [[P(line)] for line in analysis.get("summary", [])], colWidths=[180 * mm])
    box.setStyle(TableStyle([("BACKGROUND", (0, 0), (-1, -1), colors.HexColor(_ZONE_BG.get(zone, "#F2F4F7"))),
                             ("BOX", (0, 0), (-1, -1), 0.6, colors.HexColor("#c9d3e0")),
                             ("LEFTPADDING", (0, 0), (-1, -1), 8), ("TOPPADDING", (0, 0), (-1, -1), 3)]))
    story += [box, Spacer(1, 4 * mm)]

    for pt in analysis.get("points", []):
        s, cov = pt["stats"], pt["coverage"]
        story.append(Paragraph(f"2. Điểm đo {pt['name']} ({pt['id']})", ss["Heading2"]))
        story.append(P(f"Dữ liệu: {s['n']} lần đo ISO từ {loc(cov['first'])} đến {loc(cov['last'])}; có dữ liệu "
                       f"{cov['days_with_data']}/{math.ceil(cov['period_days'])} ngày"
                       f"{'' if analysis.get('period_complete', True) else ' (tính đến ' + loc(analysis['as_of']) + ', kỳ chưa kết thúc)'}"
                       f"; gián đoạn dài nhất "
                       f"{_f(cov['longest_gap_h'], 1)} giờ. Giá trị đánh giá là RMS lớn nhất của các trục hướng kính "
                       f"({', '.join(a.upper() for a in pt['iso_axes'])}).", small))
        story.append(Paragraph("2.1 Mức rung và phân bố vùng ISO", h3))
        zs = s["zone_share"]
        story += [_table([["Trung bình", "Trung vị", "P95 (mức duy trì)", "Lớn nhất", "Vùng đánh giá (P95)", "Vùng lớn nhất"],
                          [_f(s["mean"]), _f(s["p50"]), _f(s["p95"]), _f(s["max"]),
                           P(f"<b>{s['zone_p95']}</b> – {ZONE_TEXT[s['zone_p95']]}", small), s["zone_max"]]],
                         widths=[22 * mm, 20 * mm, 28 * mm, 20 * mm, 56 * mm, 34 * mm]), Spacer(1, 2 * mm)]
        zt = _table([["Vùng", "A", "B", "C", "D"], ["Tỉ lệ số lần đo"] + [_f(zs[z] * 100, 1, "%") for z in "ABCD"]],
                    widths=[40 * mm, 35 * mm, 35 * mm, 35 * mm, 35 * mm])
        zt.setStyle(TableStyle([("BACKGROUND", (i + 1, 0), (i + 1, 0), colors.HexColor(_ZONE_BG[z])) for i, z in enumerate("ABCD")]))
        story += [zt, Spacer(1, 3 * mm)]

        story.append(Paragraph("2.2 Xu hướng", h3))
        story.append(_trend_chart(pt["series"], lim))
        tr = pt.get("trend")
        if tr:
            story.append(P(f"Độ dốc {_f(tr['slope_per_day'], 3)} mm/s mỗi ngày ({_f(tr['pct_per_30d'], 1)}% mỗi 30 ngày, "
                           f"R² = {_f(tr['r2'])}); ngày đầu {_f(tr['first'])} → ngày cuối {_f(tr['last'])} mm/s.", small))

        story.append(Paragraph("2.3 Thành phần phổ theo bậc (mm/s RMS, trung bình kỳ)", h3))
        sp = pt.get("speed")
        if sp:
            story.append(P(f"Tốc độ quay đo từ phổ: trung vị {_f(sp['median'])} Hz ({sp['median'] * 60:.0f} v/ph), dao động "
                           f"{_f(sp['min'])}–{_f(sp['max'])} Hz; độ phân giải phổ {_f(pt.get('df'))} Hz.", small))
        rows = [["Trục", "RMS ISO", "0,5X", "1X", "2X", "3X", "4X", "5X", "6X", "Kurt. P95", "Crest P95"]]
        for _a, ax in sorted(pt["axes"].items()):
            o = ax["orders"]
            rows.append([ax["label"], _f(ax["iso"])] + [_f(o.get(k)) for k in ("0.5", "1", "2", "3", "4", "5", "6")]
                        + [_f(ax["kurt"][1], 1), _f(ax["crest"][1], 1)])
        story += [_table(rows, widths=[27 * mm, 16 * mm] + [13 * mm] * 7 + [19 * mm, 17 * mm]), Spacer(1, 3 * mm)]

        story.append(Paragraph("2.4 Nhận định", h3))
        for lvl, text, _short in pt["findings"]:
            story.append(P(f'<font color="{_LEVEL_COLOR[lvl]}">{_LEVEL_MARK[lvl]}</font> {text}'))
        story.append(Spacer(1, 2 * mm))

    ev = analysis.get("events") or {}
    story.append(Paragraph("3. Cảnh báo và sự kiện", ss["Heading2"]))
    if ev.get("total"):
        sev = ", ".join(f"{SEV_VI.get(k, k)} {v}" for k, v in sorted(ev["by_severity"].items(), key=lambda kv: -kv[1]))
        story.append(P(f"Tổng {ev['total']} sự kiện ({sev}); {ev['active']} chưa kết thúc. Gom theo nội dung:"))
        rows = [["Mức cao nhất", "Nội dung", "Số lần", "Lần đầu", "Lần cuối", "Còn mở"]]
        for g in ev["groups"][:15]:
            label = g["text"] + (f" – lớn nhất {_f(g['max_value'])} mm/s" if g.get("max_value") is not None and g["rule"] == "iso_zone" else "")
            rows.append([SEV_VI.get(g["worst"], g["worst"]), P(label, small), g["count"], loc(g["first"]), loc(g["last"]),
                         g["active"]])
        story.append(_table(rows, widths=[22 * mm, 76 * mm, 14 * mm, 27 * mm, 27 * mm, 14 * mm]))
        if len(ev["groups"]) > 15:
            story.append(P(f"… và {len(ev['groups']) - 15} nhóm khác.", small))
    else:
        story.append(P("Không có sự kiện trong kỳ."))

    story.append(Paragraph("4. Khuyến nghị", ss["Heading2"]))
    recs = sorted({tuple(r) for pt in analysis.get("points", []) for r in pt["recommendations"]})
    prio = {1: "Ưu tiên cao", 2: "Ưu tiên trung bình", 3: "Theo dõi"}
    if recs:
        story.append(_table([["Mức", "Việc cần làm"]] + [[prio.get(p, str(p)), P(t, small)] for p, t in recs],
                            widths=[32 * mm, 148 * mm]))
    else:
        story.append(P("Tiếp tục giám sát định kỳ; chưa cần can thiệp."))
    h = analysis.get("health") or {}
    if h.get("rul_days") is not None:
        story.append(P(f"Ước lượng thời gian tới ngưỡng cảnh báo (RUL, có điều kiện, chưa chứng nhận): {_f(h['rul_days'], 0)} ngày "
                       f"({_f(h.get('rul_lo_days'), 0)}–{_f(h.get('rul_hi_days'), 0)}).", small))

    story.append(Paragraph("5. Giới hạn của đánh giá", ss["Heading2"]))
    for t in sorted({t for pt in analysis.get("points", []) for t in pt["limits"]}) or ["Không có."]:
        story.append(P("• " + t, small))
    story.append(P("Nhận định nguyên nhân dựa trên dấu hiệu phổ điển hình; cần xác nhận tại hiện trường (căn chỉnh, cân bằng, "
                   "kiểm tra bu-lông) trước khi sửa chữa.", small))
    story += [Spacer(1, 3 * mm), P(f"Tạo lúc {datetime.now(VN):%d/%m/%Y %H:%M} – Smart Motor (Selink)", small)]
    doc.build(story)
    return buf.getvalue()


def accuracy_report(point: dict, tests: list[dict], summary: list[dict]) -> bytes:
    """Biên bản kiểm chứng sai số < 5% (spec 9.2–9.3)."""
    buf = io.BytesIO()
    ss = _styles()
    doc = SimpleDocTemplate(buf, pagesize=A4, leftMargin=15 * mm, rightMargin=15 * mm)
    ref_dev = {t.get("reference_device") for t in tests if t.get("reference_device")}
    certs = {t.get("reference_cert") for t in tests if t.get("reference_cert")}
    rows = [["Thời điểm", "Tải", "Đại lượng", "Trục", "f (Hz)", "Chuẩn", "Cảm biến", "e (%)"]]
    for t in tests:
        rows.append([str(t.get("ts"))[:16], t.get("load_state") or "", t.get("quantity") or "", t.get("axis") or "",
                     f"{t['freq_hz']:.1f}" if t.get("freq_hz") else "", f"{t.get('ref_value', 0):.3f}",
                     f"{t.get('dut_value', 0):.3f}", f"{t.get('error_pct', 0):.2f}"])
    srow = [["Đại lượng", "Tải", "n", "mean(e) %", "P95(e) %", "Kết luận"]]
    for s in summary:
        srow.append([s["quantity"], s.get("load_state") or "", s["n"], f"{s['mean_pct']:.2f}", f"{s['p95_pct']:.2f}",
                     "ĐẠT" if s["pass"] else "KHÔNG ĐẠT"])
    story = [Paragraph("BIÊN BẢN KIỂM CHỨNG SAI SỐ ĐO RUNG", ss["Title"]),
             Paragraph(f"Điểm đo: {point.get('id')} – {point.get('name') or ''} · Cảm biến {point.get('sensor_model') or 'WTVB05'}",
                       ss["Normal"]),
             Paragraph(f"Thiết bị chuẩn: {', '.join(ref_dev) or '…'} · Giấy hiệu chuẩn: {', '.join(certs) or '…'}", ss["Normal"]),
             Paragraph("Tiêu chí: mean(e) ≤ 5% và P95(e) ≤ 8%; tần số đỉnh ≤ 1 bin; nhiệt độ ≤ 2 °C.", ss["Normal"]),
             Spacer(1, 4 * mm), Paragraph("Tổng hợp", ss["Heading2"]), _table(srow), Spacer(1, 4 * mm),
             Paragraph("Số liệu chi tiết", ss["Heading2"]), _table(rows), Spacer(1, 12 * mm),
             _table([["Đại diện HEM", "Đại diện Selink", "Người đo"], ["\n\n\n", "\n\n\n", "\n\n\n"]],
                    widths=[60 * mm, 60 * mm, 60 * mm])]
    doc.build(story)
    return buf.getvalue()
