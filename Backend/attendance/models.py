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
