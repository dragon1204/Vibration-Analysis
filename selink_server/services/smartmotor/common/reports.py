"""PDF generation (monthly machine report, accuracy test protocol – spec 6.4, 9.3)."""
from __future__ import annotations

import io
from datetime import datetime

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet
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


def monthly_report(machine: dict, period: str, zone_rows: list[list], event_rows: list[list],
                   recommendations: list[str]) -> bytes:
    buf = io.BytesIO()
    ss = _styles()
    doc = SimpleDocTemplate(buf, pagesize=A4, leftMargin=15 * mm, rightMargin=15 * mm)
    story = [Paragraph(f"Báo cáo tình trạng động cơ – {machine.get('name')}", ss["Title"]),
             Paragraph(f"Kỳ báo cáo: {period} · Mã máy: {machine.get('id')} · Công suất {machine.get('rated_power_kw')} kW",
                       ss["Normal"]), Spacer(1, 6 * mm),
             Paragraph("1. Mức rung theo ISO 20816-3", ss["Heading2"]),
             _table([["Điểm đo", "RMS TB (mm/s)", "RMS max (mm/s)", "Vùng xấu nhất", "Số capture"]] + zone_rows),
             Spacer(1, 4 * mm), Paragraph("2. Sự kiện cảnh báo", ss["Heading2"]),
             _table([["Thời điểm", "Mức", "Điểm đo", "Nội dung", "Trạng thái"]] + (event_rows or [["–", "", "", "Không có", ""]]),
                    widths=[30 * mm, 18 * mm, 28 * mm, 80 * mm, 22 * mm]),
             Spacer(1, 4 * mm), Paragraph("3. Khuyến nghị", ss["Heading2"])]
    for r in recommendations or ["Tiếp tục giám sát định kỳ."]:
        story.append(Paragraph("• " + r, ss["Normal"]))
    story += [Spacer(1, 6 * mm), Paragraph(f"Tạo lúc {datetime.now():%d/%m/%Y %H:%M} – Smart Motor (Selink)", ss["Normal"])]
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
