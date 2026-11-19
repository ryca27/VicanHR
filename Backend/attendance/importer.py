from hashlib import sha256
from io import BytesIO
from zipfile import ZipFile, BadZipFile
from xml.etree.ElementTree import ParseError

from openpyxl import load_workbook
from openpyxl.utils.exceptions import InvalidFileException

from django.db import transaction

from .merge import merge_rows, scope_key
from .models import AttendanceCutoff, AttendanceSummary


def normalize(value):
    return " ".join(str(value or "").upper().split())


def read_summary(upload):
    if upload.size > 20 * 1024**2:
        raise ValueError("Upload a workbook smaller than 20 MiB.")
    data = upload.read()
    try:
        with ZipFile(BytesIO(data)) as archive:
            if sum(item.file_size for item in archive.infolist()) > 100 * 1024**2:
                raise ValueError("Workbook exceeds the expanded size limit.")
        book = load_workbook(BytesIO(data), read_only=True, data_only=True)
        try:
            sheet = next((s for s in book.worksheets if normalize(s.title) == "SUMMARY"), None)
            if sheet is None:
                found = ", ".join(book.sheetnames) or "(none)"
                raise ValueError(f"Choose the DTR workbook with a Summary tab. Tabs found: {found}.")
            if (sheet.max_row or 0) * (sheet.max_column or 0) > 500000:
                raise ValueError("SUMMARY exceeds the supported worksheet size.")
            rows = list(sheet.values)
        finally:
            book.close()
    except (BadZipFile, KeyError, ParseError, InvalidFileException, OSError) as exc:
        raise ValueError("Upload a valid Excel .xlsx workbook.") from exc

    return data, rows


def import_summary(upload):
    data, rows = read_summary(upload)
    metadata = {}
    required = ("EMPLOYEE NO.", "EMPLOYEE NAME", "TOTAL REG HRS", "TOTAL OT HRS",
                "TOTAL ND HRS", "TOTAL WDO", "BTR HRS", "TOTAL LH", "TOTAL LH OT",
                "TOTAL SH", "TOTAL SH OT")
    for index, row in enumerate(rows):
        headers = [normalize(cell) for cell in row]
        if all(name in headers for name in required):
            break
        for pos, cell in enumerate(headers[:-1]):
            if cell.endswith(":"):
                metadata[cell[:-1]] = next((v for v in row[pos+1:] if v is not None), "")
    else:
        raise ValueError("Missing attendance columns in SUMMARY.")
    if not metadata.get("BRANCH") or not metadata.get("PERIOD"):
        raise ValueError("Missing branch or cutoff period.")
    positions = [headers.index(name) for name in required]
    employees = []
    for number, row in enumerate(rows[index+1:], index+2):
        values = [row[pos] for pos in positions]
        if normalize(values[1]) in ("TOTAL", "GRAND TOTAL"):
            break
        if not normalize(values[1]):
            continue
        if any(v is None or normalize(v).startswith("#") for v in values[2:]):
            raise ValueError(f"Missing or invalid hours on row {number}. Recalculate and save the workbook.")
        try:
            for value in values[2:]:
                float(value)
        except (ValueError, TypeError) as exc:
            raise ValueError(f"Invalid hours on row {number}.") from exc
        employees.append(dict(zip(required, values), worksheet_row=number))
    if not employees:
        raise ValueError("SUMMARY has no employee rows.")
    return save_attendance(sha256(data).hexdigest(), dict(
        filename=upload.name, branch=metadata["BRANCH"], period=metadata["PERIOD"],
        address=metadata.get("ADDRESS", ""), agency=metadata.get("NAME OF AGENCY", ""),
        employees=employees, cells=[[v if isinstance(v, (type(None), str, int, float))
                                    else str(v) for v in row] for row in rows],
    ))


def save_attendance(fingerprint, defaults):
    with transaction.atomic():
        upload_record, created = AttendanceSummary.objects.get_or_create(
            fingerprint=fingerprint, defaults=defaults,
        )
        cutoff, first = AttendanceCutoff.objects.select_for_update().get_or_create(
            scope=scope_key(upload_record.branch, upload_record.period),
            defaults={"latest_upload": upload_record, "employees": []},
        )
        if created or first:
            cutoff.employees = merge_rows(cutoff.employees, upload_record.employees)
            cutoff.latest_upload = upload_record
            cutoff.save(update_fields=["employees", "latest_upload"])
        return cutoff, "Updated" if created and not first else "Saved" if first else "Already imported"
