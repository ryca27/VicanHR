"""Philippine private-sector payroll draft rules, verified for 2025–2026."""
from datetime import date
from decimal import Decimal, ROUND_HALF_UP

from rest_framework import serializers


ZERO = Decimal(0)
CENT = Decimal("0.01")
EMPLOYEE_TYPES = ("security_guard", "staff", "driver", "other")
RATES = tuple(map(Decimal, ("0.15", "0.20", "0.25", "0.30", "0.35")))
# RR 11-2018 Annex E and the TRAIN annual table, effective from 2023.
TAX_TABLES = {
    "semi_monthly": ((10417, "0"), (16667, "937.50"), (33333, "4270.70"),
                     (83333, "16770.70"), (333333, "91770.70")),
    "monthly": ((20833, "0"), (33333, "1875.00"), (66667, "8541.80"),
                (166667, "33541.80"), (666667, "183541.80")),
    "annual": ((250000, "0"), (400000, "22500"), (800000, "102500"),
               (2000000, "402500"), (8000000, "2202500")),
}


def rounded(amount):
    return amount.quantize(CENT, rounding=ROUND_HALF_UP)


def tax_for_band(regular, supplementary, frequency):
    for (threshold, base), rate in reversed(tuple(zip(TAX_TABLES[frequency], RATES))):
        if regular >= threshold:
            return Decimal(base) + (regular + supplementary - threshold) * rate
    return ZERO


def monthly_contributions(sss_pay, philhealth_salary, pagibig_pay):
    # SSS Circular 2024-006. Compensation bands are centered on P500 MSC steps.
    credit = min(35000, max(5000, ((sss_pay + 250) // 500) * 500))
    # PhilHealth is based on fixed monthly basic salary, without overtime.
    health_share = rounded(min(100000, max(10000, philhealth_salary)) * Decimal("0.025"))
    fund_salary = min(10000, pagibig_pay)
    fund_employee_rate = Decimal("0.01") if pagibig_pay <= 1500 else Decimal("0.02")
    return {
        "sss": {"employee": rounded(credit * Decimal("0.05")), "employer": rounded(credit * Decimal("0.10"))},
        "philhealth": {"employee": health_share, "employer": health_share},
        "pagibig": {"employee": rounded(fund_salary * fund_employee_rate),
                    "employer": rounded(fund_salary * Decimal("0.02"))},
        "employeesCompensation": {"employee": rounded(ZERO), "employer": rounded(Decimal(30 if credit >= 15000 else 10))},
    }


def money_field(*, positive=False, **kwargs):
    return serializers.DecimalField(max_digits=12, decimal_places=2, min_value=CENT if positive else ZERO, **kwargs)


class PriorContributions(serializers.Serializer):
    sss = money_field()
    philhealth = money_field()
    pagibig = money_field()


class WithholdingHistory(serializers.Serializer):
    taxablePay = money_field()
    taxWithheld = money_field()
    periodsIncludingCurrent = serializers.IntegerField(min_value=1, max_value=24, required=False)


class StatutoryEmployee(serializers.Serializer):
    registerRow = serializers.IntegerField(min_value=8)
    employeeName = serializers.CharField(max_length=255)
    employeeType = serializers.ChoiceField(EMPLOYEE_TYPES)
    # Compare the approved wage rates on the same daily basis, not cutoff earnings.
    minimumDailyWage = money_field(positive=True)
    wageOrder = serializers.CharField(max_length=120)
    minimumWageEarnerConfirmed = serializers.BooleanField()
    otherTaxTreatment = serializers.ChoiceField(("standard", "minimum_wage"), required=False)
    sssMonthlyRemuneration = money_field(positive=True)
    philhealthMonthlyBasicSalary = money_field(positive=True)
    pagibigMonthlyFundSalary = money_field(positive=True)
    alreadyDeducted = PriorContributions()
    otherTaxableRegularPay = money_field()
    otherTaxableSupplementaryPay = money_field()
    withholdingMethod = serializers.ChoiceField(("periodic", "cumulative", "annual"))
    withholdingHistory = WithholdingHistory(required=False)

    def validate(self, attrs):
        if attrs["employeeType"] != "other" and "otherTaxTreatment" in attrs:
            raise serializers.ValidationError("Other tax treatment applies only to the Other employee type.")
        return attrs


class StatutoryInputs(serializers.Serializer):
    payDate = serializers.DateField()
    contributionMonth = serializers.DateField()
    payFrequency = serializers.ChoiceField(("semi_monthly", "monthly"))
    contributionShareThroughCutoff = serializers.ChoiceField(("0", "0.5", "1"))
    taxExemptEmployeeTypes = serializers.ListField(
        child=serializers.ChoiceField(EMPLOYEE_TYPES), default=lambda: ["security_guard"], max_length=4,
    )
    employees = StatutoryEmployee(many=True, allow_empty=False, max_length=5000)

    def validate(self, attrs):
        if any(not date(2025, 1, 1) <= attrs[key] < date(2027, 1, 1)
               for key in ("payDate", "contributionMonth")):
            raise serializers.ValidationError("Statutory draft dates must use the verified 2025–2026 schedules.")
        if attrs["contributionMonth"].day != 1:
            raise serializers.ValidationError("Use the first day of the contribution month.")
        if attrs["payFrequency"] == "monthly" and attrs["contributionShareThroughCutoff"] != "1":
            raise serializers.ValidationError("A monthly payroll uses the full monthly contribution.")
        rows = [employee["registerRow"] for employee in attrs["employees"]]
        if len(rows) != len(set(rows)):
            raise serializers.ValidationError("Supply one statutory profile per register row.")
        attrs["taxExemptEmployeeTypes"] = sorted(set(attrs["taxExemptEmployeeTypes"]))
        attrs["employees"].sort(key=lambda employee: employee["registerRow"])
        return attrs


def bir_withholding(config, profile, daily_rate, basic_pay, overtime_pay, mandatory):
    employee_type = profile["employeeType"]
    at_minimum = daily_rate <= profile["minimumDailyWage"]
    confirmed_mwe = profile["minimumWageEarnerConfirmed"]
    if confirmed_mwe and not at_minimum:
        raise ValueError("The confirmed minimum-wage treatment conflicts with the daily rate and wage order.")
    if employee_type == "other":
        if "otherTaxTreatment" not in profile:
            raise ValueError("Payroll must specify the BIR comparison treatment for Other employees.")
        minimum_wage = profile["otherTaxTreatment"] == "minimum_wage"
        if minimum_wage != confirmed_mwe:
            raise ValueError("Confirm minimum-wage eligibility before applying the selected Other tax treatment.")
    else:
        if at_minimum and not confirmed_mwe:
            raise ValueError("Confirm minimum-wage eligibility under the applicable wage order before calculating.")
        minimum_wage = at_minimum and confirmed_mwe

    taxable_regular = profile["otherTaxableRegularPay"] + (ZERO if minimum_wage else basic_pay)
    taxable_supplementary = profile["otherTaxableSupplementaryPay"] + (ZERO if minimum_wage else overtime_pay)
    regular_net = max(ZERO, taxable_regular - mandatory)
    supplementary_net = max(ZERO, taxable_supplementary - max(ZERO, mandatory - taxable_regular))
    taxable = regular_net + supplementary_net
    method = profile["withholdingMethod"]
    frequency = config["payFrequency"]
    if method == "periodic":
        if supplementary_net and (regular_net <= TAX_TABLES[frequency][0][0] or supplementary_net >= regular_net):
            raise ValueError("This compensation requires the BIR cumulative method and approved prior payroll totals.")
        withholding = rounded(tax_for_band(regular_net, supplementary_net, frequency))
    else:
        history = profile.get("withholdingHistory")
        if history is None:
            raise ValueError("Supply approved prior taxable pay and withholding for this tax method.")
        ytd = history["taxablePay"] + taxable
        if method == "cumulative":
            periods = history.get("periodsIncludingCurrent")
            if periods is None:
                raise ValueError("Supply the number of payroll periods for cumulative withholding.")
            if periods > (12 if frequency == "monthly" else 24):
                raise ValueError("The period count exceeds the selected payroll frequency.")
            withholding = max(ZERO, rounded(rounded(tax_for_band(ytd / periods, ZERO, frequency)) * periods
                                            - history["taxWithheld"]))
        else:
            withholding = rounded(tax_for_band(ytd, ZERO, "annual") - history["taxWithheld"])

    return {
        "taxTreatment": "minimum_wage" if minimum_wage else "standard",
        "taxableCompensation": str(rounded(taxable)),
        "withholdingTax": str(withholding),
    }


def calculate_statutory(config, profile, daily_rate, basic_pay, overtime_pay):
    monthly = monthly_contributions(profile["sssMonthlyRemuneration"], profile["philhealthMonthlyBasicSalary"],
                                    profile["pagibigMonthlyFundSalary"])
    share = Decimal(config["contributionShareThroughCutoff"])
    employee_deductions = {}
    for key, already in profile["alreadyDeducted"].items():
        due = rounded(monthly[key]["employee"] * share)
        if already > due:
            raise ValueError(f"{key}: already deducted exceeds the contribution due through this cutoff.")
        employee_deductions[key] = due - already

    mandatory = sum(employee_deductions.values(), ZERO)
    employee_type = profile["employeeType"]
    type_exempt = employee_type in config["taxExemptEmployeeTypes"]
    warnings = []
    reference = None
    try:
        reference = bir_withholding(config, profile, daily_rate, basic_pay, overtime_pay, mandatory)
    except ValueError as exc:
        if not type_exempt:
            raise
        warnings.append(f"BIR comparison unavailable: {exc}")

    if type_exempt:
        if reference is None or reference["taxTreatment"] != "minimum_wage" or Decimal(reference["withholdingTax"]):
            warnings.append("Employee-type exemption set withholding to zero in this draft. Verify the BIR treatment before approval.")
        applied = {"taxTreatment": "employee_type_exempt", "taxableCompensation": "0.00",
                   "withholdingTax": "0.00"}
    else:
        applied = reference
        if employee_type == "security_guard" and reference["taxTreatment"] != "minimum_wage":
            warnings.append("Security guard did not qualify as a minimum-wage earner under the supplied wage order.")

    return {
        "employeeType": employee_type,
        **applied,
        "taxTreatmentSource": "employee_type" if type_exempt else "bir",
        "birComparison": reference,
        "wageOrder": profile["wageOrder"],
        "withholdingMethod": profile["withholdingMethod"],
        "employeeContributions": {key: str(value) for key, value in employee_deductions.items()},
        "monthlyContributions": {key: {party: str(value) for party, value in shares.items()}
                                 for key, shares in monthly.items()},
        "warnings": warnings,
    }
