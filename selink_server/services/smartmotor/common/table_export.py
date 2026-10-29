"""Tabular exports as CSV or Excel.

CSV cannot carry column widths or cell formats, so Excel shows narrow date columns as "########"
and re-formats times as mm:ss.0. The .xlsx variant writes real date and time cells with explicit
formats, sized columns and a frozen header row.
"""
from __future__ import annotations

import csv
import io
from datetime import datetime

from fastapi.responses import Response

DATE_HEADERS = {"Ngày", "Date"}
TIME_HEADERS = {"Giờ (GMT+7)", "Time"}
DATETIME_HEADERS = {"Chip Time()"}


class Rows:
    """csv.writer-like collector, so the export code is shared by both formats."""

    def __init__(self):
        self.rows: list[list] = []

    def writerow(self, row) -> None:
        self.rows.append(list(row))


def _csv(rows: list[list]) -> bytes:
    out = io.StringIO(newline="")
    w = csv.writer(out, lineterminator="\r\n")
    w.writerows(rows)
    return ("﻿" + out.getvalue()).encode("utf-8")


def _cell(header: str, value):
    if value in ("", None):
        return None
    try:
        if header in DATE_HEADERS:
            return datetime.strptime(value, "%Y-%m-%d")
        if header in TIME_HEADERS:
            return datetime.strptime("1899-12-31 " + value.replace(",", "."), "%Y-%m-%d %H:%M:%S.%f")
        if header in DATETIME_HEADERS:
            return datetime.strptime(value, "%Y-%m-%dT%H:%M:%S.%f")
    except (TypeError, ValueError):
        return value
    return value


def _xlsx(rows: list[list], sheet: str) -> bytes:
    import xlsxwriter

    buf = io.BytesIO()
    wb = xlsxwriter.Workbook(buf, {"in_memory": True, "constant_memory": True, "default_date_format": "yyyy-mm-dd"})
    ws = wb.add_worksheet(sheet[:31])
    head = wb.add_format({"bold": True, "text_wrap": True, "valign": "top", "bg_color": "#EEF2F7", "border": 1})
    fmt = {"date": wb.add_format({"num_format": "yyyy-mm-dd"}), "time": wb.add_format({"num_format": "hh:mm:ss.000"}),
           "datetime": wb.add_format({"num_format": "yyyy-mm-dd hh:mm:ss.000"})}
    header = [str(h) for h in rows[0]] if rows else []
    kinds = ["date" if h in DATE_HEADERS else "time" if h in TIME_HEADERS else "datetime" if h in DATETIME_HEADERS else None
             for h in header]
    for c, h in enumerate(header):
        width = 12 if kinds[c] == "date" else 14 if kinds[c] == "time" else 23 if kinds[c] == "datetime" else min(30, max(10, len(h) * 0.55))
        ws.set_column(c, c, width)
        ws.write(0, c, h, head)
    ws.set_row(0, 48)
    ws.freeze_panes(1, 0)
    for r, row in enumerate(rows[1:], start=1):
        for c, value in enumerate(row):
            v = _cell(header[c], value) if c < len(header) else value
            if isinstance(v, datetime):
                ws.write_datetime(r, c, v, fmt[kinds[c]])
            elif v is None:
                continue
            else:
                ws.write(r, c, v)
    wb.close()
    return buf.getvalue()


def response(rows: list[list], filename: str, fmt: str, headers: dict | None = None) -> Response:
    """filename without extension; fmt "csv" | "xlsx"."""
    if fmt == "xlsx":
        body, media, ext = _xlsx(rows, filename), "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "xlsx"
    else:
        body, media, ext = _csv(rows), "text/csv; charset=utf-8", "csv"
    return Response(body, media_type=media, headers={
        "Content-Disposition": f'attachment; filename="{filename}.{ext}"', "Cache-Control": "no-store", **(headers or {})})
