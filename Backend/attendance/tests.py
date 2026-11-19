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
