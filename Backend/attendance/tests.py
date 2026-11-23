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


class PhilippineStatutoryPayrollTests(TestCase):
    def setUp(self):
        user = User.objects.create_user(username="statutory-reviewer")
        user.groups.add(Group.objects.create(name="finance"))
        self.client = APIClient()
        self.client.force_login(user)

    def inputs(self, employee_type="staff", **overrides):
        return {
            "payDate": "2026-11-30", "contributionMonth": "2026-11-01",
            "payFrequency": "semi_monthly", "contributionShareThroughCutoff": "1",
            "employees": [{
                "registerRow": 8, "employeeName": "Fictional, Employee", "employeeType": employee_type,
                "minimumDailyWage": "755.00", "wageOrder": "NCR-28",
                "minimumWageEarnerConfirmed": False, "sssMonthlyRemuneration": "34400.00",
                "philhealthMonthlyBasicSalary": "30000.00", "pagibigMonthlyFundSalary": "30000.00",
                "alreadyDeducted": {"sss": "0", "philhealth": "0", "pagibig": "0"},
                "otherTaxableRegularPay": "0", "otherTaxableSupplementaryPay": "0",
                "withholdingMethod": "periodic", **overrides,
            }],
        }

    def upload(self, inputs, daily_rate=1500, hours=112, ot_hours=10, detachment_inputs=None, expense=None,
               payroll_period=None):
        import json
        from io import BytesIO

        from django.core.files.uploadedfile import SimpleUploadedFile
        from openpyxl import Workbook

        from .payroll import DEDUCTION_TABS

        register = Workbook()
        sheet = register.active
        sheet["C3"] = f"{payroll_period['start']} to {payroll_period['end']}" if payroll_period else "November 16-30, 2026"
        sheet["C6"] = "EMPLOYEE NAME"
        sheet["BF6"] = "PAY"
        for col, value in {
            "B": 1, "C": "Fictional, Employee", "D": daily_rate, "E": hours,
            "H": ot_hours, "I": 200, "AF": 999, "AG": 999, "AH": 999,
            "AU": 999, "AC": 23000, "BE": 0, "BF": 23000,
        }.items():
            sheet[f"{col}8"] = value
        if detachment_inputs:
            for col, value in {
                "B": 2, "C": "Fictional, Employee", "D": 800, "E": 48,
                "AF": 999, "AG": 999, "AH": 999, "AU": 999, "AC": 4800, "BE": 0, "BF": 4800,
            }.items():
                sheet[f"{col}9"] = value
            sheet["AR8"] = expense
        deductions = Workbook()
        deductions.remove(deductions.active)
        for tab, headers in DEDUCTION_TABS.items():
            deductions.create_sheet(tab).append(["EMPLOYEE NAME", *headers])

        def file(workbook, name):
            buffer = BytesIO()
            workbook.save(buffer)
            return SimpleUploadedFile(name, buffer.getvalue())

        return self.client.post("/api/payroll/drafts/", {
            "register": file(register, "register.xlsx"), "deductions": file(deductions, "deductions.xlsx"),
            "statutoryInputs": json.dumps(inputs),
            **({"detachmentInputs": json.dumps(detachment_inputs)} if detachment_inputs else {}),
            **({"payrollPeriodDates": json.dumps(payroll_period)} if payroll_period else {}),
        }, format="multipart")

    def test_standard_draft_replaces_register_contributions_and_includes_overtime_in_tax(self):
        payload = self.inputs()
        response = self.upload(payload)
        self.assertEqual(response.status_code, 201, response.json())
        employee = response.json()["employees"][0]
        details = employee["statutory"]
        self.assertEqual(details["employeeContributions"], {"sss": "1725.00", "philhealth": "750.00", "pagibig": "200.00"})
        self.assertEqual(details["monthlyContributions"]["employeesCompensation"]["employer"], "30.00")
        self.assertEqual(details["taxableCompensation"], "20325.00")
        self.assertEqual(details["withholdingTax"], "1669.10")
        self.assertEqual(employee["totalDeductions"], "4344.10")
        self.assertEqual(employee["netPay"], "18655.90")
        self.assertEqual(self.upload(payload).status_code, 200)
        payload["employees"][0]["alreadyDeducted"]["sss"] = "800.00"
        changed = self.upload(payload)
        self.assertEqual(changed.status_code, 201)
        self.assertEqual(changed.json()["employees"][0]["statutory"]["employeeContributions"]["sss"], "925.00")

    def test_confirmed_minimum_wage_treatment_for_guards_staff_and_drivers(self):
        for employee_type in ("security_guard", "staff", "driver"):
            with self.subTest(employee_type=employee_type):
                payload = self.inputs(employee_type, minimumWageEarnerConfirmed=True)
                payload["taxExemptEmployeeTypes"] = []
                response = self.upload(payload, daily_rate=755)
                self.assertEqual(response.status_code, 201, response.json())
                statutory = response.json()["employees"][0]["statutory"]
                self.assertEqual(statutory["taxTreatment"], "minimum_wage")
                self.assertEqual(statutory["withholdingTax"], "0.00")
        payload = self.inputs("security_guard")
        payload["taxExemptEmployeeTypes"] = []
        above_minimum = self.upload(payload)
        self.assertEqual(above_minimum.status_code, 201, above_minimum.json())
        self.assertIn("statutory_tax_review", [issue["code"] for issue in above_minimum.json()["employees"][0]["issues"]])
        self.assertEqual(self.upload(self.inputs("staff"), daily_rate=755).status_code, 400)
        self.assertEqual(self.upload(self.inputs("other")).status_code, 400)

    def test_marked_employee_type_overrides_bir_withholding_but_keeps_contributions(self):
        for employee_type in ("security_guard", "driver", "other"):
            with self.subTest(employee_type=employee_type):
                treatment = {"otherTaxTreatment": "standard"} if employee_type == "other" else {}
                payload = self.inputs(employee_type, **treatment)
                if employee_type != "security_guard":
                    payload["taxExemptEmployeeTypes"] = [employee_type]
                response = self.upload(payload)
                self.assertEqual(response.status_code, 201, response.json())
                result = response.json()["employees"][0]
                statutory = result["statutory"]
                self.assertEqual(statutory["taxTreatment"], "employee_type_exempt")
                self.assertEqual(statutory["withholdingTax"], "0.00")
                self.assertEqual(statutory["birComparison"]["withholdingTax"], "1669.10")
                self.assertEqual(result["totalDeductions"], "2675.00")
                self.assertEqual(result["netPay"], "20325.00")
                self.assertIn("statutory_tax_review", [issue["code"] for issue in result["issues"]])

        no_history = self.upload(self.inputs("security_guard", withholdingMethod="cumulative"))
        self.assertEqual(no_history.status_code, 201, no_history.json())
        statutory = no_history.json()["employees"][0]["statutory"]
        self.assertIsNone(statutory["birComparison"])
        self.assertEqual(statutory["withholdingTax"], "0.00")

    def test_cumulative_method_and_contribution_thresholds(self):
        from decimal import Decimal
        from .statutory import monthly_contributions

        below = monthly_contributions(Decimal("14749.99"), Decimal("9000"), Decimal("1500"))
        above = monthly_contributions(Decimal("14750"), Decimal("120000"), Decimal("1500.01"))
        self.assertEqual(below["sss"]["employee"], Decimal("725"))
        self.assertEqual(above["sss"]["employee"], Decimal("750"))
        self.assertEqual(below["employeesCompensation"]["employer"], Decimal("10"))
        self.assertEqual(above["employeesCompensation"]["employer"], Decimal("30"))
        self.assertEqual(below["philhealth"]["employee"], Decimal("250"))
        self.assertEqual(above["philhealth"]["employee"], Decimal("2500"))
        self.assertEqual(below["pagibig"]["employee"], Decimal("15"))
        self.assertEqual(above["pagibig"]["employee"], Decimal("30"))
        response = self.upload(self.inputs(), hours=64)
        self.assertEqual(response.status_code, 400)
        self.assertIn("cumulative method", response.json()["detail"])
        response = self.upload(self.inputs(
            withholdingMethod="cumulative",
            withholdingHistory={"taxablePay": "18675", "taxWithheld": "100", "periodsIncludingCurrent": 2},
        ), hours=64)
        self.assertEqual(response.status_code, 201, response.json())
        self.assertEqual(response.json()["employees"][0]["statutory"]["withholdingTax"], "1274.90")

    def test_multiple_detachments_collect_statutorily_once_and_spill_expenses(self):
        rows = {"rows": [{
            "registerRow": row, "employeeId": "GUARD-01", "employeeName": "Fictional, Employee",
            "detachment": site, "workedHours": hours, "workFrom": "2026-11-16", "workThrough": "2026-11-30",
            "basicPayEffectiveFrom": "2026-10-01", "basicPayEffectiveThrough": None,
            "approvedDailyRate": "800.00", "wageOrder": "NCR-28", "minimumDailyWage": "755.00",
            "sssRemuneration": pay, "pagibigFundSalary": pay,
        } for row, site, hours, pay in [(8, "North", "80", "8000"), (9, "South", "48", "4800")]]}
        inputs = self.inputs("security_guard")
        response = self.upload(inputs, daily_rate=800, hours=80, ot_hours=0, detachment_inputs=rows, expense=6500)
        self.assertEqual(response.status_code, 201, response.json())
        north, south = response.json()["employees"]
        self.assertEqual(north["detachment"], "North")
        self.assertEqual(north["statutoryAllocation"], {
            "sss": "1078.13", "philhealth": "750.00", "pagibig": "125.00", "withholdingTax": "0.00",
        })
        self.assertEqual(south["statutoryAllocation"], {
            "sss": "646.87", "philhealth": "0.00", "pagibig": "75.00", "withholdingTax": "0.00",
        })
        self.assertEqual((north["grossPay"], south["grossPay"]), ("8000.00", "4800.00"))
        self.assertEqual(north["allocatedExpenses"], {"AR": "6046.87"})
        self.assertEqual(north["netPay"], "0.00")
        self.assertEqual(south["allocatedExpenses"], {"AR": "453.13"})
        self.assertEqual(south["netPay"], "3625.00")
        self.assertNotIn("statutory", south)
        self.assertEqual(response.json()["expenseAllocations"][0]["unallocatedExpenses"], {})

        blank = self.upload(inputs, daily_rate=800, hours=80, ot_hours=0, detachment_inputs=rows)
        self.assertEqual(blank.status_code, 201, blank.json())
        for employee in blank.json()["employees"]:
            self.assertEqual(employee["deductions"]["AR"], "0.00")
            self.assertEqual(employee["allocatedExpenses"], {})
        self.assertEqual(blank.json()["summary"]["calculatedTotals"]["netPay"], "10125.00")

        excess = self.upload(inputs, daily_rate=800, hours=80, ot_hours=0, detachment_inputs=rows, expense=12000)
        self.assertEqual(excess.status_code, 201, excess.json())
        primary = excess.json()["employees"][0]
        self.assertEqual(primary["unallocatedExpenses"], {"AR": "1875.00"})
        self.assertIn("unallocated_expenses", [issue["code"] for issue in primary["issues"]])

        rows["rows"][1]["basicPayEffectiveThrough"] = "2026-11-20"
        self.assertEqual(self.upload(inputs, daily_rate=800, hours=80, ot_hours=0,
                                     detachment_inputs=rows, expense=6500).status_code, 400)

    def create_loan(self, reference, principal, installment, column=""):
        response = self.client.post("/api/payroll/loans/", {
            "employeeId": "GUARD-01", "reference": reference, "label": reference,
            "principal": principal, "monthlyInstallment": installment,
            "startsOn": "2026-10-01", "registerColumn": column,
        }, format="json")
        self.assertEqual(response.status_code, 201, response.json())
        return response.json()["loanId"]

    def dated_draft(self, start, end):
        rows = {"rows": [{
            "registerRow": row, "employeeId": "GUARD-01", "employeeName": "Fictional, Employee",
            "detachment": site, "workedHours": hours, "workFrom": start, "workThrough": end,
            "basicPayEffectiveFrom": "2026-09-01", "approvedDailyRate": "800.00",
            "wageOrder": "NCR-28", "minimumDailyWage": "755.00",
            "sssRemuneration": pay, "pagibigFundSalary": pay,
        } for row, site, hours, pay in [(8, "North", "80", "8000"), (9, "South", "48", "4800")]]}
        inputs = self.inputs("security_guard")
        inputs["payDate"] = end
        inputs["contributionMonth"] = f"{end[:7]}-01"
        return self.upload(inputs, daily_rate=800, hours=80, ot_hours=10,
                           detachment_inputs=rows, payroll_period={"start": start, "end": end})

    def test_finalization_tracks_multiple_loans_and_thirteenth_month_basic_pay(self):
        first = self.create_loan("Salary loan", "500.00", "300.00", "AJ")
        second = self.create_loan("Emergency loan", "900.00", "400.00")
        october = self.dated_draft("2026-10-16", "2026-10-31")
        self.assertEqual(october.status_code, 201, october.json())
        oct_id = october.json()["draftId"]
        self.assertEqual(self.client.get("/api/payroll/thirteenth-month/2026/").json()["employees"], [])
        finalized = self.client.post(f"/api/payroll/drafts/{oct_id}/finalize/")
        self.assertEqual(finalized.status_code, 201, finalized.json())
        self.assertEqual([(p["loanId"], p["amount"]) for p in finalized.json()["loanPayments"]],
                         [(first, "300.00"), (second, "400.00")])
        self.assertEqual(self.client.post(f"/api/payroll/drafts/{oct_id}/finalize/").status_code, 200)
        self.assertTrue(self.client.get(f"/api/payroll/drafts/{oct_id}/").json()["isFinalized"])
        listed = self.client.get("/api/payroll/drafts/").json()
        self.assertEqual(listed[0]["draftId"], oct_id)
        self.assertTrue(listed[0]["isFinalized"])
        self.assertNotIn("employees", listed[0])

        november = self.dated_draft("2026-11-01", "2026-11-15")
        self.assertEqual(november.status_code, 201, november.json())
        nov_id = november.json()["draftId"]
        finalized = self.client.post(f"/api/payroll/drafts/{nov_id}/finalize/")
        self.assertEqual(finalized.status_code, 201, finalized.json())
        self.assertEqual([(p["loanId"], p["amount"]) for p in finalized.json()["loanPayments"]],
                         [(first, "200.00"), (second, "400.00")])
        later_november = self.dated_draft("2026-11-16", "2026-11-30").json()
        self.assertEqual(later_november["loanPlan"]["GUARD-01"]["loans"], {})
        overview = self.client.get("/api/payroll/expense-employees/?employeeName=employee+fictional").json()
        self.assertEqual(overview["count"], 1)
        self.assertEqual(overview["employees"], [{
            "employeeId": "GUARD-01", "employeeName": "Fictional, Employee",
            "loanTypes": ["Salary loan", "Emergency loan"], "loanCount": 2, "remainingBalance": "100.00",
        }])
        self.assertEqual(self.client.get(
            "/api/payroll/expense-employees/?employeeId=missing&employeeName=fictional",
        ).json()["count"], 0)
        detail = self.client.get("/api/payroll/expense-employees/detail/?employeeId=guard-01").json()
        self.assertEqual(detail["employeeName"], "Fictional, Employee")
        self.assertEqual([len(loan["payments"]) for loan in detail["loans"]], [2, 2])
        self.assertEqual(len(detail["expenses"]), 4)
        self.assertTrue(all(item["label"] in ("Salary loan", "Emergency loan") for item in detail["expenses"]))
        self.assertEqual(self.client.get("/api/payroll/expense-employees/detail/?employeeId=missing").status_code, 404)

        december = self.dated_draft("2026-12-01", "2026-12-15").json()
        self.assertEqual(december["loanPlan"]["GUARD-01"]["loans"], {f"loan:{second}": "100.00"})
        loans = self.client.get("/api/payroll/loans/?employeeId=GUARD-01").json()
        self.assertEqual([(loan["status"], loan["remainingBalance"]) for loan in loans],
                         [("paid", "0.00"), ("open", "100.00")])

        report = self.client.get("/api/payroll/thirteenth-month/2026/").json()
        self.assertEqual(report["operationalCutoff"], "2026-10-31")
        self.assertEqual(self.client.get("/api/payroll/thirteenth-month/2026/?employeeId=missing").json()["employees"], [])
        filtered = self.client.get("/api/payroll/thirteenth-month/2026/?employeeId=guard-01").json()
        self.assertEqual(filtered["employees"], report["employees"])
        employee, = report["employees"]
        self.assertEqual(employee["basicPayThroughOctober"], "12800.00")
        self.assertEqual(employee["basicPayCalendarYear"], "25600.00")
        self.assertEqual(employee["octoberEstimate"], "1066.67")
        self.assertEqual(employee["calendarYearAccrued"], "2133.33")
        self.assertEqual(employee["novemberDecemberAccrual"], "1066.66")

        payment = {"reference": "Receipt-01", "paymentDate": "2026-12-02", "amount": "100.00"}
        path = f"/api/payroll/loans/{second}/payments/"
        self.assertEqual(self.client.post(path, payment, format="json").status_code, 201)
        self.assertEqual(self.client.post(path, payment, format="json").status_code, 200)
        self.assertEqual(self.client.post(f"/api/payroll/drafts/{december['draftId']}/finalize/").status_code, 409)
        refreshed = self.dated_draft("2026-12-01", "2026-12-15").json()
        self.assertEqual(refreshed["loanPlan"]["GUARD-01"]["loans"], {})

    def test_dated_draft_requires_split_at_october_end(self):
        response = self.dated_draft("2026-10-25", "2026-11-05")
        self.assertEqual(response.status_code, 400)
        self.assertIn("Split", response.json()["detail"])
