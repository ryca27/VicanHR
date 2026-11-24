from datetime import date
from decimal import Decimal

from django.core.paginator import Paginator
from django.db import transaction
from django.db.models import Max, OuterRef, Prefetch, Q, Subquery, Sum
from django.shortcuts import get_object_or_404
from rest_framework import serializers
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response

from .api import CanImportAttendance
from .merge import normalized
from .models import (FinalizedPayroll, FinalizedPayrollEarning, PayrollDraft, PayrollEmployeeAccount,
                     PayrollLoan, PayrollLoanPayment)
from .payroll import money
from .payroll_ledger import finalize_payroll, lock_employees, remaining_balance
from .statutory import ZERO, money_field, rounded


class PayrollPeriod(serializers.Serializer):
    start = serializers.DateField()
    end = serializers.DateField()

    def validate(self, attrs):
        if attrs["start"] > attrs["end"]:
            raise serializers.ValidationError("The payroll start date must be on or before its end date.")
        return attrs


class LoanInput(serializers.Serializer):
    employeeId = serializers.CharField(max_length=80)
    employeeName = serializers.CharField(max_length=255, required=False)
    reference = serializers.CharField(max_length=100)
    label = serializers.CharField(max_length=120)
    principal = money_field(positive=True)
    monthlyInstallment = money_field(positive=True)
    startsOn = serializers.DateField()
    registerColumn = serializers.ChoiceField(choices=("", "AJ", "AK"), default="")


class PaymentInput(serializers.Serializer):
    reference = serializers.CharField(max_length=100)
    paymentDate = serializers.DateField()
    amount = money_field(positive=True)


def payment_payload(payment):
    return {"paymentId": payment.pk, "finalizedPayrollId": payment.payroll_id,
            "reference": payment.reference, "paymentDate": payment.payment_date.isoformat(),
            "amount": money(payment.amount)}


def loan_payload(loan):
    payments = list(loan.payments.all())
    balance = loan.principal - sum((payment.amount for payment in payments), ZERO)
    return {"loanId": loan.pk, "employeeId": loan.employee_id, "employeeName": loan.employee.employee_name,
            "reference": loan.reference, "label": loan.label, "principal": money(loan.principal),
            "monthlyInstallment": money(loan.monthly_installment), "startsOn": loan.starts_on.isoformat(),
            "registerColumn": loan.register_column, "remainingBalance": money(balance),
            "status": "paid" if balance == 0 else "open",
            "payments": [payment_payload(payment) for payment in sorted(payments, key=lambda p: (p.payment_date, p.pk))]}


def filter_employee_name(queryset, name, field):
    for word in " ".join((name or "").replace(",", " ").split()).split()[:12]:
        queryset = queryset.filter(**{f"{field}__icontains": word})
    return queryset


def loans_with_payments():
    return PayrollLoan.objects.select_related("employee").prefetch_related("payments").order_by("pk")


@api_view(["GET", "POST"])
@permission_classes([CanImportAttendance])
def payroll_loans(request):
    if request.method == "GET":
        loans = loans_with_payments().order_by("employee_id", "pk")
        loans = filter_employee_name(loans, request.query_params.get("employeeName"), "employee__employee_name")
        if request.query_params.get("employeeId"):
            loans = loans.filter(employee_id=normalized(request.query_params["employeeId"]))
        return Response([loan_payload(loan) for loan in loans])
    form = LoanInput(data=request.data)
    form.is_valid(raise_exception=True)
    data = form.validated_data
    employee = normalized(data["employeeId"])
    defaults = dict(label=data["label"], principal=data["principal"], monthly_installment=data["monthlyInstallment"],
                    starts_on=data["startsOn"], register_column=data["registerColumn"])
    with transaction.atomic():
        lock_employees([employee])
        account = PayrollEmployeeAccount.objects.get(pk=employee)
        name = data.get("employeeName")
        if name and account.employee_name and normalized(name) != normalized(account.employee_name):
            return Response({"detail": "Employee name does not match the existing employee ID."}, status=409)
        loan, created = PayrollLoan.objects.get_or_create(
            employee_id=employee, reference=data["reference"], defaults=defaults,
        )
        if not created and any(getattr(loan, key) != value for key, value in defaults.items()):
            return Response({"detail": "This employee already has a different loan using that reference."}, status=409)
        if name and not account.employee_name:
            account.employee_name = name
            account.save(update_fields=["employee_name"])
        loan.employee = account
        return Response(loan_payload(loan), status=201 if created else 200)


EXPENSE_LABELS = {
    "AJ": "SSS salary loan", "AK": "SSS calamity loan", "AL": "Cash bond", "AM": "Benlife insurance",
    "AN": "Getwell insurance", "AO": "Group insurance", "AP": "Uniform paraphernalia",
    "AQ": "Paraphernalia", "AR": "Training", "AV": "Other deduction 1", "AW": "Other deduction 2",
    "AX": "SSS condonation", "AY": "Family support", "AZ": "Training school", "BA": "License",
    "BB": "SOGCC investment", "BC": "SOGCC-1 credit cooperative", "BD": "SOGCC-2 credit cooperative",
}


@api_view(["GET"])
@permission_classes([CanImportAttendance])
def expense_employees(request):
    loan_totals = PayrollLoan.objects.annotate(paid=Sum("payments__amount")).order_by("pk")
    employees = PayrollEmployeeAccount.objects.order_by("employee_name", "employee_id").prefetch_related(
        Prefetch("loans", queryset=loan_totals),
    )
    employee_id = normalized(request.query_params.get("employeeId"))
    if employee_id:
        employees = employees.filter(pk=employee_id)
    employees = filter_employee_name(employees, request.query_params.get("employeeName"), "employee_name")
    page = Paginator(employees, 25).get_page(request.query_params.get("page", 1))
    results = []
    for employee in page:
        loans = list(employee.loans.all())
        balance = sum((loan.principal - (loan.paid or ZERO) for loan in loans), ZERO)
        results.append({
            "employeeId": employee.pk, "employeeName": employee.employee_name,
            "loanTypes": list(dict.fromkeys(loan.label for loan in loans)),
            "loanCount": len(loans), "remainingBalance": money(balance),
        })
    return Response({
        "employees": results, "count": page.paginator.count, "page": page.number, "pages": page.paginator.num_pages,
    })


@api_view(["GET"])
@permission_classes([CanImportAttendance])
def expense_employee_detail(request):
    employee = get_object_or_404(PayrollEmployeeAccount, pk=normalized(request.query_params.get("employeeId")))
    loans = list(loans_with_payments().filter(employee=employee))
    loan_labels = {f"loan:{loan.pk}": loan.label for loan in loans}
    payrolls = FinalizedPayroll.objects.filter(basic_earnings__employee=employee).distinct().order_by("-period_end", "-pk")
    expenses = []
    for payroll in payrolls.only("draft", "period_end", "snapshot"):
        for row in payroll.snapshot.get("employees", []):
            if normalized(row.get("employeeId")) != employee.pk:
                continue
            for code, amount in row.get("allocatedExpenses", {}).items():
                if not Decimal(amount):
                    continue
                expenses.append({
                    "finalizedPayrollId": payroll.pk, "draftId": payroll.draft_id,
                    "date": payroll.period_end.isoformat(), "detachment": row.get("detachment"),
                    "registerRow": row["registerRow"], "code": code, "amount": amount,
                    "label": loan_labels.get(code, EXPENSE_LABELS.get(code, code)),
                })
    return Response({
        "employeeId": employee.pk, "employeeName": employee.employee_name,
        "loans": [loan_payload(loan) for loan in loans], "expenses": expenses,
    })


@api_view(["POST"])
@permission_classes([CanImportAttendance])
def payroll_loan_payment(request, pk):
    loan = get_object_or_404(PayrollLoan, pk=pk)
    form = PaymentInput(data=request.data)
    form.is_valid(raise_exception=True)
    data = form.validated_data
    with transaction.atomic():
        lock_employees([loan.employee_id])
        payment = loan.payments.filter(payroll__isnull=True, reference=data["reference"]).first()
        if payment:
            if payment.amount != data["amount"] or payment.payment_date != data["paymentDate"]:
                return Response({"detail": "This payment reference already records a different payment."}, status=409)
            return Response(loan_payload(loan))
        if data["paymentDate"] < loan.starts_on or data["amount"] > remaining_balance(loan):
            return Response({"detail": "Payment date and amount must fall within the loan's term and remaining balance."}, status=400)
        loan.payments.create(reference=data["reference"], payment_date=data["paymentDate"],
                             amount=data["amount"], recorded_by=request.user)
        return Response(loan_payload(loan), status=201)


@api_view(["POST"])
@permission_classes([CanImportAttendance])
def finalize_payroll_draft(request, pk):
    try:
        final, created = finalize_payroll(pk, request.user)
    except PayrollDraft.DoesNotExist:
        return Response({"detail": "Payroll draft not found."}, status=404)
    except ValueError as exc:
        return Response({"detail": str(exc)}, status=409)
    return Response({
        "finalizedPayrollId": final.pk, "draftId": final.draft_id,
        "periodStart": final.period_start.isoformat(), "periodEnd": final.period_end.isoformat(),
        "finalizedAt": final.finalized_at.isoformat(),
        "loanPayments": [payment_payload(payment) | {"loanId": payment.loan_id}
                         for payment in final.loan_payments.order_by("loan_id")],
    }, status=201 if created else 200)


@api_view(["GET"])
@permission_classes([CanImportAttendance])
def thirteenth_month_pay(request, year):
    if not 1900 <= year <= 9999:
        return Response({"detail": "Choose a valid calendar year."}, status=400)
    start, october_end, year_end = date(year, 1, 1), date(year, 10, 31), date(year, 12, 31)
    rows = FinalizedPayrollEarning.objects.filter(work_through__range=(start, year_end))
    employee_id = normalized(request.query_params.get("employeeId"))
    if employee_id:
        rows = rows.filter(employee_id=employee_id)
    latest_name = rows.filter(employee_id=OuterRef("employee_id")).order_by("-work_through", "-pk")
    result = []
    for row in rows.values("employee_id").annotate(
        basic_through_october=Sum("basic_pay", filter=Q(work_through__lte=october_end)),
        basic_for_year=Sum("basic_pay"),
        latest_work=Max("work_through"),
    ).annotate(employee_name=Subquery(latest_name.values("employee_name")[:1])).order_by("employee_id"):
        october = row["basic_through_october"] or ZERO
        total = row["basic_for_year"]
        october_pay, year_pay = rounded(october / Decimal(12)), rounded(total / Decimal(12))
        result.append({
            "employeeId": row["employee_id"], "employeeName": row["employee_name"],
            "basicPayThroughOctober": money(october), "basicPayCalendarYear": money(total),
            "octoberEstimate": money(october_pay), "calendarYearAccrued": money(year_pay),
            "novemberDecemberAccrual": money(year_pay - october_pay),
            "latestFinalizedWorkDate": row["latest_work"].isoformat(),
        })
    return Response({"year": year, "operationalCutoff": october_end.isoformat(),
                     "calendarYearEnd": year_end.isoformat(), "employees": result,
                     "note": "Based on finalized basic pay only. Confirm eligibility and any amounts already paid before release."})
