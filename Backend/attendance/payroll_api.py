import json
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
from .detachments import DetachmentInputs
from .merge import normalized
from .models import FinalizedPayroll, PayrollDraft
from .payroll_ledger import plan_loan_deductions, snapshot_earnings
from .payroll_ledger_api import PayrollPeriod
from .statutory import StatutoryInputs
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
        issues = [{
            "code": "statutory_tax_review", "reason": warning,
            "action": "Verify the applicable wage order and employee classification before approval.",
        } for warning in employee.get("statutory", {}).get("warnings", [])]
        if employee.get("unallocatedExpenses"):
            issues.append({
                "code": "unallocated_expenses",
                "reason": "Some expenses exceed the available take-home pay across detachments.",
                "action": "Review the remaining expenses before approving this draft.",
                "fields": list(employee["unallocatedExpenses"]),
            })
        if amount(employee["netPay"]) < 0:
            issues.append({
                "code": "negative_net_pay",
                "reason": "Net pay is negative. Deductions exceed gross pay.",
                "action": "Verify gross pay and deductions before approving.",
                "fields": ["netPay"],
            })
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
    finalized = FinalizedPayroll.objects.filter(draft=draft).values("id", "finalized_at").first()
    return Response({
        "isFinalized": finalized is not None,
        **({"finalizedPayrollId": finalized["id"], "finalizedAt": finalized["finalized_at"]} if finalized else {}),
        "draftId": draft.pk, "period": draft.period,
        "registerFilename": draft.register_filename,
        "deductionsFilename": draft.deductions_filename, **draft.results,
        "employees": employees,
        "summary": reconciliation_summary(employees),
    }, status=status)


@api_view(["GET", "POST"])
@parser_classes([MultiPartParser])
@permission_classes([CanImportAttendance])
def create_payroll_draft(request):
    if request.method == "GET":
        drafts = PayrollDraft.objects.order_by("-created_at", "-pk").values(
            "id", "period", "created_at", "finalization__id",
        )
        return Response([{
            "draftId": draft["id"], "period": draft["period"], "createdAt": draft["created_at"],
            "isFinalized": draft["finalization__id"] is not None,
        } for draft in drafts])
    register = request.FILES.get("register")
    deductions = request.FILES.get("deductions")
    if register is None or deductions is None:
        return Response({"detail": "Upload both the payroll register and deductions workbook."}, status=400)
    inputs = {}
    for field, serializer in (("statutoryInputs", StatutoryInputs), ("detachmentInputs", DetachmentInputs),
                              ("payrollPeriodDates", PayrollPeriod)):
        raw = request.data.get(field)
        if raw is None:
            continue
        try:
            decoded = json.loads(raw)
        except (TypeError, ValueError):
            return Response({"detail": f"{field} must be a JSON object."}, status=400)
        validator = serializer(data=decoded)
        if not validator.is_valid():
            return Response({"detail": f"Check {field}.", field: validator.errors}, status=400)
        inputs[field] = validator.validated_data
    statutory = inputs.get("statutoryInputs")
    detachments = inputs.get("detachmentInputs")
    window = inputs.get("payrollPeriodDates")
    loans = None
    if window:
        if not detachments:
            return Response({"detail": "Dated payroll requires detachmentInputs with employee IDs and work dates."}, status=400)
        loans = plan_loan_deductions({normalized(row["employeeId"]) for row in detachments["rows"]}, window["end"])
    try:
        register_data, deduction_data = map(workbook_bytes, (register, deductions))
        fingerprint = sha256(sha256(register_data).digest() + sha256(deduction_data).digest()).hexdigest()
        if inputs:
            canonical = json.dumps({"inputs": inputs, "loanPlan": loans}, sort_keys=True, default=str).encode()
            fingerprint = sha256(f"payroll-rules-2025-2026-v6:{fingerprint}:".encode() + canonical).hexdigest()
        with ExitStack() as stack:
            books = []
            for data in (register_data, deduction_data):
                book = load_workbook(BytesIO(data), read_only=True, data_only=True)
                stack.callback(book.close)
                books.append(book)
            period, results = calculate_register(
                *books, statutory=statutory, detachments=detachments, loan_plan=loans,
            )
            if window:
                snapshot_earnings(results["employees"], window["start"], window["end"])
                results["payrollPeriodDates"] = {key: value.isoformat() for key, value in window.items()}
                results["loanPlan"] = loans
            if statutory:
                results["statutorySchedule"] = {
                    key: str(statutory[key]) for key in
                    ("payDate", "contributionMonth", "payFrequency", "contributionShareThroughCutoff")
                }
                results["statutorySchedule"]["taxExemptEmployeeTypes"] = statutory["taxExemptEmployeeTypes"]
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
