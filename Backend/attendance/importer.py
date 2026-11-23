import csv
import re
from decimal import Decimal, InvalidOperation
from hashlib import sha256
from io import BytesIO, StringIO
from zipfile import ZipFile, BadZipFile
from xml.etree.ElementTree import ParseError

from openpyxl import load_workbook
from openpyxl.utils.exceptions import InvalidFileException

from django.db import transaction

from .merge import merge_rows, normalized, scope_key
from .models import AttendanceAdjustment, AttendanceCutoff, AttendanceSummary
from .numbers import spreadsheet_number


def normalize(value):
    return " ".join(str(value or "").upper().split())


HOURS = {
    "regularHours": "TOTAL REG HRS",
    "overtimeHours": "TOTAL OT HRS",
    "nightDifferentialHours": "TOTAL ND HRS",
    "wdoHours": "TOTAL WDO",
    "btrHours": "BTR HRS",
    "legalHolidayHours": "TOTAL LH",
    "legalHolidayOtHours": "TOTAL LH OT",
    "specialHolidayHours": "TOTAL SH",
    "specialHolidayOtHours": "TOTAL SH OT",
}
REQUIRED = ("EMPLOYEE NO.", "EMPLOYEE NAME", *HOURS.values())
TOTAL_LABELS = ("TOTAL", "GRAND TOTAL")
MISSING_IDS = ("", "#N/A", "N/A")


def read_summary(upload):
    if upload.size > 20 * 1024**2:
        raise ValueError("Upload a file no larger than 20 MiB.")
    data = upload.read()
    if upload.name.lower().endswith(".csv"):
        try:
            encoding = "utf-16" if data.startswith((b"\xff\xfe", b"\xfe\xff")) else "utf-8-sig"
            rows = list(csv.reader(StringIO(data.decode(encoding), newline=""), strict=True))
        except (UnicodeError, csv.Error) as exc:
            raise ValueError("Upload a valid UTF-8 or UTF-16 Summary CSV.") from exc
        if sum(map(len, rows)) > 500000:
            raise ValueError("SUMMARY exceeds the supported worksheet size.")
        return data, rows
    if not upload.name.lower().endswith(".xlsx"):
        raise ValueError("Choose a Summary CSV or Excel .xlsx workbook.")
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


def text(value):
    return "" if value is None else str(value).strip()


def parse_hours(value, number, header):
    try:
        hours = spreadsheet_number(value)
        if hours is None:
            return None
        converted = float(hours)
    except (ValueError, InvalidOperation, OverflowError) as exc:
        raise ValueError(f"Row {number}: invalid {header}. Check the number format or recalculate Excel formulas.") from exc
    if hours < 0 or not 0 <= converted < float("inf") or Decimal(str(converted)) != hours:
        raise ValueError(f"Row {number}: {header} cannot be stored accurately as nonnegative hours.")
    return hours


def check_summary(upload):
    data, rows = read_summary(upload)
    metadata = {}
    for index, row in enumerate(rows):
        headers = [normalize(cell) for cell in row]
        if "EMPLOYEE NAME" in headers and ("EMPLOYEE NO." in headers or "TOTAL REG HRS" in headers):
            for header in REQUIRED:
                count = headers.count(header)
                if count != 1:
                    problem = "missing" if count == 0 else "duplicated"
                    raise ValueError(f"Row {index + 1}: {problem} required column {header}.")
            break
        for pos, cell in enumerate(headers):
            label = cell.rstrip(":")
            if label in ("BRANCH", "PERIOD", "ADDRESS", "NAME OF AGENCY"):
                value = next((text(v) for v in row[pos+1:] if text(v)), "")
                if value and label in metadata and normalized(value) != normalized(metadata[label]):
                    raise ValueError(f"Conflicting {label} values in SUMMARY.")
                if value:
                    metadata[label] = value
    else:
        raise ValueError("Missing attendance columns in SUMMARY.")
    if not metadata.get("BRANCH") or not metadata.get("PERIOD"):
        raise ValueError("Missing branch or cutoff period.")

    positions = {header: headers.index(header) for header in REQUIRED}
    employees, warnings = [], []
    totals = dict.fromkeys(HOURS.values(), Decimal(0))
    control_totals = {}
    identities = {}
    footer = False
    for number, row in enumerate(rows[index+1:], index+2):
        values = {header: row[pos] if pos < len(row) else None for header, pos in positions.items()}
        name = text(values["EMPLOYEE NAME"])
        employee_no = text(values["EMPLOYEE NO."])
        label = normalize(name or employee_no or (row[0] if row else None))
        if label in TOTAL_LABELS:
            if footer:
                raise ValueError(f"Row {number}: duplicate SUMMARY total.")
            control_totals = {header: parse_hours(values[header], number, header) for header in totals}
            footer = True
            continue

        # Footer labels and unused template rows can have blank names and zero-filled hours.
        if footer and not re.fullmatch(r"[0-9]+", text(row[0] if row else None)):
            has_payload = normalize(employee_no) not in MISSING_IDS or any(text(values[h]) for h in totals)
            if not has_payload:
                continue
        hours = {header: parse_hours(values[header], number, header) for header in totals}
        if not name:
            if normalize(employee_no) not in MISSING_IDS or any(hours.values()):
                raise ValueError(f"Row {number}: employee name is missing but the row contains an ID or hours.")
            continue
        if footer:
            raise ValueError(f"Row {number}: employee row found after the SUMMARY total.")
        if name.startswith("#"):
            raise ValueError(f"Row {number}: invalid employee name. Check the source and recalculate Excel formulas.")
        if normalize(employee_no) in MISSING_IDS:
            employee_no = None
            warnings.append(f"Row {number}: employee number is missing. The cutoff will match by name.")
        elif employee_no.startswith("#"):
            raise ValueError(f"Row {number}: invalid employee number.")
        name_key, number_key = normalized(name), normalized(employee_no)
        numbers = identities.setdefault(name_key, set())
        if number_key in numbers or (numbers and (not number_key or "" in numbers)):
            raise ValueError(f"Row {number}: ambiguous or duplicate employee. Check the name and number.")
        numbers.add(number_key)
        missing_hours = [header for header, value in hours.items() if value is None]
        if missing_hours:
            raise ValueError(f"Row {number}: missing {', '.join(missing_hours)}. Fill in zeros where applicable and recalculate and save Excel formulas.")
        for header, value in hours.items():
            totals[header] += value
        employees.append({
            "EMPLOYEE NO.": employee_no, "EMPLOYEE NAME": name, "worksheet_row": number,
            **{header: float(value) for header, value in hours.items()},
        })
    if not employees:
        raise ValueError("SUMMARY has no employee rows.")

    unchecked_totals = []
    for header, total in totals.items():
        declared = control_totals.get(header)
        if declared is None:
            unchecked_totals.append(header)
            continue
        difference = abs(total - declared)
        if difference > Decimal("0.01") + Decimal("0.00000001"):
            raise ValueError(f"{header}: employee rows sum to {total}, but the source total is {declared}.")
        if difference > Decimal("0.00000001"):
            warnings.append(f"{header}: employee rows sum to {total}, while the source total is {declared}. Check rounding.")
    if unchecked_totals:
        warnings.append(f"No source total to verify for: {', '.join(unchecked_totals)}.")

    defaults = dict(
        filename=upload.name, branch=metadata["BRANCH"], period=metadata["PERIOD"],
        address=metadata.get("ADDRESS", ""), agency=metadata.get("NAME OF AGENCY", ""),
        employees=employees, cells=[[v if isinstance(v, (type(None), str, int, float))
                                    else str(v) for v in row] for row in rows],
    )
    return sha256(data).hexdigest(), defaults, warnings


def import_summary(upload):
    fingerprint, defaults, warnings = check_summary(upload)
    cutoff, action = save_attendance(fingerprint, defaults, verify_source=True)
    return cutoff, action, warnings


def adjusted_employees(employees, adjustments):
    rows = [row.copy() for row in employees]
    by_name = {}
    for index, row in enumerate(rows):
        by_name.setdefault(normalized(row["EMPLOYEE NAME"]), []).append(index)
    for period, upload in adjustments:
        matched = set()
        for adjustment in upload:
            candidates = by_name.get(normalized(adjustment["EMPLOYEE NAME"]), [])
            number = normalized(adjustment.get("EMPLOYEE NO."))
            exact = [i for i in candidates if normalized(rows[i].get("EMPLOYEE NO.")) == number]
            if len(exact) == 1:
                index = exact[0]
            elif len(candidates) == 1 and (number in MISSING_IDS or
                    normalized(rows[candidates[0]].get("EMPLOYEE NO.")) in MISSING_IDS):
                index = candidates[0]
            else:
                raise ValueError(f"Adjustment row {adjustment['worksheet_row']}: no unique matching employee in the selected cutoff.")
            if index in matched:
                raise ValueError(f"Adjustment row {adjustment['worksheet_row']}: employee already matched in this adjustment.")
            matched.add(index)
            rows[index].setdefault("adjustmentPeriods", []).append(period)
            deltas = rows[index].setdefault("adjustmentHours", {})
            for field, header in HOURS.items():
                base = rows[index].get(header)
                if base is None and adjustment[header]:
                    raise ValueError(f"Adjustment row {adjustment['worksheet_row']}: fill in the selected cutoff's missing {header} first.")
                if adjustment[header]:
                    added = Decimal(str(adjustment[header]))
                    deltas[field] = float(Decimal(str(deltas.get(field, 0))) + added)
                    rows[index][header] = float(Decimal(str(base)) + added)
    return rows


def import_adjustment(cutoff_id, upload):
    fingerprint, defaults, warnings = check_summary(upload)
    with transaction.atomic():
        cutoff = AttendanceCutoff.objects.select_for_update().get(pk=cutoff_id)
        base = cutoff.latest_upload
        if normalized(defaults["branch"]) != normalized(base.branch):
            raise ValueError("The adjustment branch must match the selected cutoff.")
        source_scope = scope_key(defaults["branch"], defaults["period"])
        if source_scope == cutoff.scope:
            raise ValueError("The adjustment must have a different source period from the selected cutoff.")
        adjusted_employees(cutoff.employees, [(defaults["period"], defaults["employees"])])
        source, _ = AttendanceSummary.objects.get_or_create(
            fingerprint=sha256(f"attendance-adjustment:{fingerprint}".encode()).hexdigest(),
            defaults=defaults,
        )
        existing = cutoff.adjustments.filter(source_scope=source_scope).first()
        if existing and existing.upload_id == source.pk:
            action = "Already imported"
        else:
            AttendanceAdjustment.objects.update_or_create(
                cutoff=cutoff, source_scope=source_scope, defaults={"upload": source},
            )
            action = "Adjustment updated" if existing else "Adjustment saved"
        return cutoff, action, warnings


def save_attendance(fingerprint, defaults, *, verify_source=False):
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
            if verify_source:
                merged = {(normalized(row["EMPLOYEE NAME"]), normalized(row["EMPLOYEE NO."])): row
                          for row in cutoff.employees}
                for row in defaults["employees"]:
                    key = (normalized(row["EMPLOYEE NAME"]), normalized(row["EMPLOYEE NO."]))
                    if merged.get(key) != row:
                        raise ValueError(f"Row {row['worksheet_row']}: data did not carry through to the cutoff.")
            adjusted_employees(cutoff.employees, (
                (adjustment.upload.period, adjustment.upload.employees)
                for adjustment in cutoff.adjustments.select_related("upload")
            ))
            cutoff.latest_upload = upload_record
            cutoff.save(update_fields=["employees", "latest_upload"])
        return cutoff, "Updated" if created and not first else "Saved" if first else "Already imported"
