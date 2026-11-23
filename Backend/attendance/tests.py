from pathlib import Path

from django.contrib.auth.models import Group, User
from django.test import TestCase
from rest_framework.test import APIClient

from .models import PayrollDraft

SAMPLES = Path(__file__).resolve().parents[2] / "Files"
ZERO_TOTALS = {"grossPay": "0.00", "totalDeductions": "0.00", "netPay": "0.00"}


class PayrollReconciliationTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username="finance-reviewer")
        self.user.groups.add(Group.objects.create(name="finance"))
        self.client = APIClient()
        self.client.force_login(self.user)

    def test_saved_draft_reports_offsetting_differences_and_missing_deductions(self):
        employees = [
            {
                **ZERO_TOTALS,
                "grossPay": gross,
                "registerAmounts": {**ZERO_TOTALS, "grossPay": "1.00"},
                "differences": ZERO_TOTALS,
                "deductionsMatched": matched,
            }
            for gross, matched in [
                ("1.01", True),
                ("0.99", False),
            ]
        ]
        draft = PayrollDraft.objects.create(
            fingerprint="saved-before-summary",
            period="Example period",
            results={"employees": employees, "warnings": ["Review workbook inputs."]},
            created_by=self.user,
        )

        response = self.client.get(f"/api/payroll/drafts/{draft.pk}/")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            [row["differences"]["grossPay"] for row in response.json()["employees"]],
            ["0.01", "-0.01"],
        )
        issues = response.json()["employees"][1]["issues"]
        self.assertEqual([issue["code"] for issue in issues], [
            "register_difference", "deductions_match_missing",
        ])
        self.assertEqual(issues[0]["fields"], ["grossPay"])
        self.assertTrue(all(issue["reason"] and issue["action"] for issue in issues))
        self.assertEqual(response.json()["summary"], {
            "employeeCount": 2,
            "rowsWithDifferences": 2,
            "rowsWithoutDeductionMatch": 1,
            "calculatedTotals": {**ZERO_TOTALS, "grossPay": "2.00"},
            "registerTotals": {**ZERO_TOTALS, "grossPay": "2.00"},
            "totalDifferences": ZERO_TOTALS,
        })

    def test_negative_net_pay_is_flagged_even_when_register_matches(self):
        amounts = {"grossPay": "695.00", "totalDeductions": "950.00", "netPay": "-255.00"}
        draft = PayrollDraft.objects.create(
            fingerprint="negative-net-pay-demo",
            period="Example period",
            results={"employees": [
                {**amounts, "registerAmounts": amounts, "deductionsMatched": True},
                {**ZERO_TOTALS, "registerAmounts": ZERO_TOTALS, "deductionsMatched": True},
            ]},
            created_by=self.user,
        )
        response = self.client.get(f"/api/payroll/drafts/{draft.pk}/")
        self.assertEqual(response.status_code, 200)
        negative, zero = response.json()["employees"]
        self.assertEqual([issue["code"] for issue in negative["issues"]], ["negative_net_pay"])
        self.assertEqual(zero["issues"], [])

    def test_smco_sample_reports_two_net_pay_rounding_differences(self):
        register_path = SAMPLES / "SMCO NOVA 1 PAYROLL 0901152026.xlsx"
        deductions_path = SAMPLES / "DEDUCTIONS 0901152026.xlsx"
        if not register_path.is_file() or not deductions_path.is_file():
            self.skipTest("The SMCO sample workbooks are unavailable.")

        with register_path.open("rb") as register, deductions_path.open("rb") as deductions:
            response = self.client.post("/api/payroll/drafts/", {
                "register": register, "deductions": deductions,
            }, format="multipart")

        self.assertEqual(response.status_code, 201)
        result = response.json()
        self.assertEqual(result["summary"]["employeeCount"], 16)
        self.assertEqual(result["summary"]["rowsWithDifferences"], 2)
        self.assertEqual(result["summary"]["rowsWithoutDeductionMatch"], 0)
        self.assertEqual(result["summary"]["totalDifferences"], {**ZERO_TOTALS, "netPay": "0.02"})
        differing_rows = []
        for employee in result["employees"]:
            if employee["differences"] != ZERO_TOTALS:
                differing_rows.append(employee["registerRow"])
                self.assertEqual(employee["differences"], {**ZERO_TOTALS, "netPay": "0.01"})
        self.assertEqual(differing_rows, [11, 21])
        saved = self.client.get(f"/api/payroll/drafts/{result['draftId']}/")
        self.assertEqual(saved.status_code, 200)
        self.assertEqual(saved.json(), result)


class AttendanceSourceCheckTests(TestCase):
    def setUp(self):
        user = User.objects.create_user(username="attendance-reviewer")
        user.groups.add(Group.objects.create(name="finance"))
        self.client = APIClient()
        self.client.force_login(user)

    def csv_upload(self, path, rows, total=None, *, period="September 1-15, 2026", **fields):
        import csv
        from io import StringIO

        from django.core.files.uploadedfile import SimpleUploadedFile

        from .importer import REQUIRED

        content = StringIO()
        writer = csv.writer(content)
        writer.writerows([["Branch:", "Example"], ["Period:", period]])
        writer.writerow(["", *REQUIRED])
        writer.writerows(rows)
        if total is not None:
            writer.writerow(["", "", "TOTAL", total, *([0] * 8)])
        file = SimpleUploadedFile("summary.csv", content.getvalue().encode("utf-8-sig"))
        return self.client.post(path, {"file": file, **fields}, format="multipart")

    def test_preview_and_save_preserve_all_named_rows_and_warn_about_rounding(self):
        rows = [
            ["1", "001", "Last, First", "₱1,000.25", *([0] * 8)],
            ["", "", "Employee without ID", "8.00", *([0] * 8)],
        ]
        preview = self.csv_upload("/api/attendance/preview/", rows, "PHP 1,008.24")
        self.assertEqual(preview.status_code, 200, preview.json())
        self.assertEqual(preview.json()["totalEmployees"], 2)
        self.assertEqual(len(preview.json()["warnings"]), 2)
        saved = self.csv_upload("/api/attendance/", rows, "PHP 1,008.24")
        self.assertEqual(saved.status_code, 201, saved.json())
        self.assertEqual(saved.json()["warnings"], preview.json()["warnings"])
        cutoff_id = saved.json()["cutoffId"]
        detail = self.client.get(f"/api/attendance/{cutoff_id}/").json()
        self.assertEqual(
            [(row["employeeNo"], row["employeeName"], row["regularHours"]) for row in detail["employees"]],
            [("001", "Last, First", 1000.25), (None, "Employee without ID", 8.0)],
        )
        retry = self.csv_upload("/api/attendance/", rows, "PHP 1,008.24")
        self.assertEqual(retry.status_code, 200)
        self.assertEqual(retry.json()["cutoffId"], cutoff_id)

    def test_incomplete_rows_and_material_totals_mismatches_block_save(self):
        from .models import AttendanceSummary

        valid = ["1", "001", "Employee", 8, *([0] * 8)]
        for rows, total, message in [
            ([["1", "001", "Employee", "1,25", *([0] * 8)]], None, "invalid TOTAL REG HRS"),
            ([["1", "001", "Employee", "(₱8)", *([0] * 8)]], None, "nonnegative hours"),
            ([valid], 9, "source total"),
            ([valid, ["2", "", "", 1, *([0] * 8)]], None, "employee name is missing"),
            ([valid, valid], None, "ambiguous or duplicate"),
            ([["1", "001", "Employee", "", *([0] * 8)]], None, "missing TOTAL REG HRS"),
        ]:
            with self.subTest(message=message):
                response = self.csv_upload("/api/attendance/", rows, total)
                self.assertEqual(response.status_code, 400)
                self.assertIn(message, response.json()["detail"])
                self.assertFalse(AttendanceSummary.objects.exists())

    def test_smco_excel_preview_and_save_transfer_the_same_employee_hours(self):
        sample = SAMPLES / "SMCO NOVA 1 DTR 0901152026.xlsx"
        if not sample.is_file():
            self.skipTest("The SMCO sample DTR is unavailable.")
        with sample.open("rb") as file:
            preview = self.client.post("/api/attendance/preview/", {"file": file}, format="multipart")
        self.assertEqual(preview.status_code, 200, preview.json().get("detail"))
        self.assertEqual(preview.json()["totalEmployees"], 16)
        with sample.open("rb") as file:
            saved = self.client.post("/api/attendance/", {"file": file}, format="multipart")
        self.assertEqual(saved.status_code, 201, saved.json())
        cutoff_id = saved.json()["cutoffId"]
        detail = self.client.get(f"/api/attendance/{cutoff_id}/").json()
        self.assertEqual(
            [{k: v for k, v in row.items() if k != "detachment"} for row in detail["employees"]],
            preview.json()["employees"],
        )

    def test_payroll_normalizes_formatted_values_without_changing_sign(self):
        from decimal import Decimal
        from .payroll import amount

        cases = {
            " PHP 1,234.50 ": Decimal("1234.50"),
            "(₱1,234.50)": Decimal("-1234.50"),
            "₱−1\u202f234.50": Decimal("-1234.50"),
            "1,234.50 PHP": Decimal("1234.50"),
            ".50": Decimal("0.50"),
            12.5: Decimal("12.5"),
        }
        for raw, expected in cases.items():
            with self.subTest(raw=raw):
                self.assertEqual(amount(raw), expected)
        for raw in ("1,25", "1.234,50", "80%", "$50", "PHP ₱50", "12 hours", "NaN"):
            with self.subTest(raw=raw), self.assertRaises(ValueError):
                amount(raw)

    def test_adjustment_applies_to_selected_cutoff_and_replaces_same_source_period(self):
        def row(hours, name="Employee"):
            return ["1", "001", name, hours, *([0] * 8)]

        path = "/api/attendance/"
        base = self.csv_upload(path, [row(8)], 8)
        self.assertEqual(base.status_code, 201)
        cutoff_id = base.json()["cutoffId"]
        fields = {"type": "attendance_adjustment", "cutoffId": cutoff_id}
        period = "August 16-31, 2026"
        same_period = self.csv_upload(path, [row(3)], 3, **fields)
        self.assertEqual(same_period.status_code, 400)
        unmatched = self.csv_upload(path, [row(3, "Someone Else")], 3, period=period, **fields)
        self.assertEqual(unmatched.status_code, 400)

        for hours, expected_status in [(3, 201), (3, 200), (2, 200)]:
            response = self.csv_upload(path, [row(hours)], hours, period=period, **fields)
            self.assertEqual(response.status_code, expected_status, response.json())
            self.assertEqual(response.json()["cutoffId"], cutoff_id)
            detail = self.client.get(f"{path}{cutoff_id}/").json()
            self.assertEqual(detail["employees"][0]["regularHours"], 8 + hours)
            self.assertEqual(detail["period"], "September 1-15, 2026")
            self.assertEqual(detail["employees"][0]["adjustmentPeriods"], [period])
            self.assertEqual(detail["employees"][0]["adjustmentHours"], {"regularHours": hours})
            self.assertEqual(detail["adjustments"], [{"period": period, "filename": "summary.csv"}])
        revision = self.csv_upload(path, [row(10)], 10)
        self.assertEqual(revision.status_code, 200, revision.json())
        self.assertEqual(self.client.get(f"{path}{cutoff_id}/").json()["employees"][0]["regularHours"], 12)
        self.assertEqual(len(self.client.get(path).json()), 1)
