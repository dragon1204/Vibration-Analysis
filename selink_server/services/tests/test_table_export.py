import io
import zipfile

from smartmotor.common import table_export as te


def test_csv_and_xlsx_share_rows():
    rows = [["Ngày", "Giờ (GMT+7)", "Thiết bị", "DE Vận tốc (mm/s)", "Chip Time()"],
            ["2026-10-29", "07:59:22,800", "t153-01", 2.087, "2026-10-29T07:59:22.800"],
            ["2026-10-29", "07:59:23,100", "t153-01", "", "2026-10-29T07:59:23.100"]]
    csv = te.response(rows, "f", "csv")
    assert csv.body.startswith("\ufeff".encode()) and b"07:59:22,800" in csv.body
    assert 'filename="f.csv"' in csv.headers["content-disposition"]
    xl = te.response(rows, "f", "xlsx")
    assert 'filename="f.xlsx"' in xl.headers["content-disposition"]
    z = zipfile.ZipFile(io.BytesIO(xl.body))
    sheet = z.read("xl/worksheets/sheet1.xml").decode()
    styles = z.read("xl/styles.xml").decode()
    assert "hh:mm:ss.000" in styles and "yyyy-mm-dd" in styles and "<pane" in sheet   # formatted cells, frozen header


def test_time_cells_parse():
    assert te._cell("Giờ (GMT+7)", "07:59:22,800").microsecond == 800000
    assert te._cell("Ngày", "2026-10-29").day == 29
    assert te._cell("Thiết bị", "t153-01") == "t153-01"
