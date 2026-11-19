from contextlib import ExitStack
from hashlib import sha256
from io import BytesIO
from zipfile import ZipFile, BadZipFile
from xml.etree.ElementTree import ParseError

from django.shortcuts import get_object_or_404
from openpyxl import load_workbook
from openpyxl.utils.exceptions import InvalidFileException
from rest_framework.decorators import api_view, parser_classes, permission_classes
from rest_framework.parsers import MultiPartParser
from rest_framework.response import Response

from .api import CanImportAttendance
from .models import PayrollDraft
from .payroll import amount, calculate_register, reconciliation_differences, reconciliation_summary


def workbook_bytes(upload):
    if upload.size > 20 * 1024**2:
        raise ValueError("Each workbook must be at most 20 MiB.")
    data = upload.read()
    with ZipFile(BytesIO(data)) as archive:
        if sum(file.file_size for file in archive.infolist()) > 100 * 1024**2:
            raise ValueError("Workbook exceeds the expanded size limit.")
    return data


def draft_response(draft, status=200):
    employees = []
    for employee in draft.results["employees"]:
        differences = reconciliation_differences(employee)
        issues = []
        affected_fields = [field for field, value in differences.items() if amount(value)]
        if affected_fields:
            issues.append({
                "code": "register_difference",
                "reason": "Calculated pay differs from the payroll register.",
                "action": "Compare the calculated and register amounts and review the source values before approving.",
                "fields": affected_fields,
            })
        if not employee["deductionsMatched"]:
            issues.append({
                "code": "deductions_match_missing",
                "reason": "No matching employee entry was found in the deductions workbook.",
                "action": "Check the workbook name and confirm whether the register deductions should be used.",
            })
        employees.append({**employee, "differences": differences, "issues": issues})
    return Response({
        "draftId": draft.pk, "period": draft.period,
        "registerFilename": draft.register_filename,
        "deductionsFilename": draft.deductions_filename, **draft.results,
        "employees": employees,
        "summary": reconciliation_summary(employees),
    }, status=status)


@api_view(["POST"])
@parser_classes([MultiPartParser])
@permission_classes([CanImportAttendance])
def create_payroll_draft(request):
    register = request.FILES.get("register")
    deductions = request.FILES.get("deductions")
    if register is None or deductions is None:
        return Response({"detail": "Upload both the payroll register and deductions workbook."}, status=400)
    try:
        register_data, deduction_data = map(workbook_bytes, (register, deductions))
        fingerprint = sha256(sha256(register_data).digest() + sha256(deduction_data).digest()).hexdigest()
        with ExitStack() as stack:
            books = []
            for data in (register_data, deduction_data):
                book = load_workbook(BytesIO(data), read_only=True, data_only=True)
                stack.callback(book.close)
                books.append(book)
            period, results = calculate_register(*books)
    except (BadZipFile, InvalidFileException, ParseError, KeyError, IndexError, OSError):
        return Response({"detail": "Could not read the workbook layout. Use the SMCO .xlsx templates."}, status=400)
    except ValueError as exc:
        return Response({"detail": str(exc)}, status=400)

    draft, created = PayrollDraft.objects.get_or_create(fingerprint=fingerprint, defaults={
        "period": period, "results": results, "created_by": request.user,
        "register_filename": register.name, "deductions_filename": deductions.name,
    })
    return draft_response(draft, 201 if created else 200)


@api_view(["GET"])
@permission_classes([CanImportAttendance])
def payroll_draft(request, pk):
    return draft_response(get_object_or_404(PayrollDraft, pk=pk))
