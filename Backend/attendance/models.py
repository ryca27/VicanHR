from django.db import models


class AttendanceSummary(models.Model):
    fingerprint = models.CharField(max_length=64, unique=True)
    filename = models.CharField(max_length=255)
    agency = models.TextField()
    branch = models.TextField()
    address = models.TextField()
    period = models.TextField()
    # Preserve worksheet positions, multiline headers, detail columns and totals.
    cells = models.JSONField()
    employees = models.JSONField()
    imported_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.branch} — {self.period}"


class AttendanceCutoff(models.Model):
    scope = models.CharField(max_length=64, unique=True)
    latest_upload = models.ForeignKey(AttendanceSummary, on_delete=models.PROTECT)
    employees = models.JSONField()


class PayrollDraft(models.Model):
    fingerprint = models.CharField(max_length=64, unique=True)
    period = models.CharField(max_length=120)
    register_filename = models.CharField(max_length=255)
    deductions_filename = models.CharField(max_length=255)
    results = models.JSONField()
    created_by = models.ForeignKey("auth.User", on_delete=models.PROTECT)
    created_at = models.DateTimeField(auto_now_add=True)


class AttendanceAdjustment(models.Model):
    cutoff = models.ForeignKey(AttendanceCutoff, on_delete=models.CASCADE, related_name="adjustments")
    source_scope = models.CharField(max_length=64)
    upload = models.ForeignKey(AttendanceSummary, on_delete=models.PROTECT)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["cutoff", "source_scope"], name="unique_attendance_adjustment_period"),
        ]


class PayrollEmployeeAccount(models.Model):
    employee_id = models.CharField(max_length=80, primary_key=True)
    employee_name = models.CharField(max_length=255, blank=True, default="")


class FinalizedPayroll(models.Model):
    draft = models.OneToOneField(PayrollDraft, on_delete=models.PROTECT, related_name="finalization")
    period_start = models.DateField()
    period_end = models.DateField()
    snapshot = models.JSONField()
    finalized_by = models.ForeignKey("auth.User", on_delete=models.PROTECT)
    finalized_at = models.DateTimeField(auto_now_add=True)


class FinalizedPayrollEarning(models.Model):
    payroll = models.ForeignKey(FinalizedPayroll, on_delete=models.PROTECT, related_name="basic_earnings")
    employee = models.ForeignKey(PayrollEmployeeAccount, on_delete=models.PROTECT)
    employee_name = models.CharField(max_length=255)
    work_from = models.DateField()
    work_through = models.DateField(db_index=True)
    basic_pay = models.DecimalField(max_digits=14, decimal_places=2)


class PayrollLoan(models.Model):
    employee = models.ForeignKey(PayrollEmployeeAccount, on_delete=models.PROTECT, related_name="loans")
    reference = models.CharField(max_length=100)
    label = models.CharField(max_length=120)
    principal = models.DecimalField(max_digits=12, decimal_places=2)
    monthly_installment = models.DecimalField(max_digits=12, decimal_places=2)
    starts_on = models.DateField()
    register_column = models.CharField(max_length=2, blank=True, default="")

    class Meta:
        constraints = [models.UniqueConstraint(fields=["employee", "reference"], name="unique_employee_loan_reference")]


class PayrollLoanPayment(models.Model):
    loan = models.ForeignKey(PayrollLoan, on_delete=models.PROTECT, related_name="payments")
    payroll = models.ForeignKey(FinalizedPayroll, null=True, on_delete=models.PROTECT, related_name="loan_payments")
    reference = models.CharField(max_length=100, blank=True, default="")
    payment_date = models.DateField()
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    recorded_by = models.ForeignKey("auth.User", on_delete=models.PROTECT)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["loan", "payroll"], name="unique_payroll_loan_payment"),
            models.UniqueConstraint(fields=["loan", "reference"], condition=models.Q(payroll__isnull=True),
                                    name="unique_external_loan_payment"),
        ]
