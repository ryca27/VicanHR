"""Finalized earnings and loan-payment matching for payroll drafts."""
from datetime import date
from decimal import Decimal

from django.db import transaction
from django.db.models import Sum

from .merge import normalized
from .models import FinalizedPayroll, FinalizedPayrollEarning, PayrollDraft, PayrollEmployeeAccount, PayrollLoan, PayrollLoanPayment
from .statutory import ZERO


def lock_employees(employee_ids):
    for employee_id in sorted(set(employee_ids)):
        PayrollEmployeeAccount.objects.get_or_create(employee_id=employee_id)
        PayrollEmployeeAccount.objects.select_for_update().get(employee_id=employee_id)


def remaining_balance(loan):
    paid = loan.payments.aggregate(total=Sum("amount"))["total"] or ZERO
    return loan.principal - paid


def plan_loan_deductions(employee_ids, period_end):
    plan = {employee_id: {"columns": set(), "loans": {}} for employee_id in employee_ids}
    for loan in PayrollLoan.objects.filter(employee_id__in=employee_ids).prefetch_related("payments").order_by("pk"):
        entry = plan[loan.employee_id]
        if loan.starts_on > period_end:
            continue
        if loan.register_column:
            entry["columns"].add(loan.register_column)
        total_paid = ZERO
        paid_this_month = ZERO
        for payment in loan.payments.all():
            total_paid += payment.amount
            if (payment.payment_date.year, payment.payment_date.month) == (period_end.year, period_end.month):
                paid_this_month += payment.amount
        due = max(ZERO, min(loan.principal - total_paid, loan.monthly_installment - paid_this_month))
        if due:
            entry["loans"][f"loan:{loan.pk}"] = str(due)
    return {
        employee_id: {"columns": sorted(entry["columns"]), "loans": entry["loans"]}
        for employee_id, entry in plan.items()
    }


def snapshot_earnings(rows, period_start, period_end):
    earnings = []
    for row in rows:
        if not row.get("employeeId") or not row.get("workFrom") or not row.get("workThrough"):
            raise ValueError("Finalization requires a dated detachment row with a stable employee ID for every employee.")
        work_from, work_through = date.fromisoformat(row["workFrom"]), date.fromisoformat(row["workThrough"])
        if not period_start <= work_from <= work_through <= period_end:
            raise ValueError("All assignment work dates must fall within the payroll period.")
        if work_from.year != work_through.year or work_from <= date(work_from.year, 10, 31) < work_through:
            raise ValueError("Split any assignment crossing October 31 or December 31 into dated register rows.")
        basic = Decimal(row["earnings"]["F"])
        if basic < 0:
            raise ValueError("Basic pay cannot be negative in a finalized payroll.")
        earnings.append((normalized(row["employeeId"]), row["employeeName"], work_from, work_through, basic))
    return earnings


@transaction.atomic
def finalize_payroll(draft_id, user):
    draft = PayrollDraft.objects.select_for_update().get(pk=draft_id)
    previous = FinalizedPayroll.objects.filter(draft=draft).first()
    if previous is not None:
        return previous, False
    window = draft.results.get("payrollPeriodDates")
    if window is None:
        raise ValueError("Create a dated draft before finalizing payroll.")
    start, end = date.fromisoformat(window["start"]), date.fromisoformat(window["end"])
    rows = draft.results["employees"]
    earnings = snapshot_earnings(rows, start, end)
    if any(Decimal(row["netPay"]) < 0 for row in rows):
        raise ValueError("Resolve negative take-home pay before finalizing.")
    employee_ids = {row[0] for row in earnings}
    lock_employees(employee_ids)
    if FinalizedPayrollEarning.objects.filter(employee_id__in=employee_ids, payroll__period_end__gte=start).exists():
        raise ValueError("An employee already has finalized payroll in an overlapping or later period.")
    if plan_loan_deductions(employee_ids, end) != draft.results["loanPlan"]:
        raise ValueError("Loan balances or terms changed. Regenerate the draft before finalizing.")

    final = FinalizedPayroll.objects.create(draft=draft, period_start=start, period_end=end,
                                            snapshot=draft.results, finalized_by=user)
    FinalizedPayrollEarning.objects.bulk_create([
        FinalizedPayrollEarning(payroll=final, employee_id=key, employee_name=name, work_from=work_from,
                                work_through=work_through, basic_pay=basic)
        for key, name, work_from, work_through, basic in earnings
    ])
    for employee_id, name in {key: name for key, name, *_ in earnings}.items():
        PayrollEmployeeAccount.objects.filter(pk=employee_id).exclude(employee_name=name).update(employee_name=name)
    payments = {}
    for row in rows:
        for key, value in row["allocatedExpenses"].items():
            if key.startswith("loan:"):
                loan_id = int(key.split(":")[1])
                payments[loan_id] = payments.get(loan_id, ZERO) + Decimal(value)
    PayrollLoanPayment.objects.bulk_create([
        PayrollLoanPayment(loan_id=loan_id, payroll=final, amount=amount, payment_date=end, recorded_by=user)
        for loan_id, amount in payments.items() if amount > 0
    ])
    return final, True
