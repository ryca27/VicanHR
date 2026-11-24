"""Reproduce the SMCO register arithmetic using approved workbook inputs."""
from decimal import Decimal, InvalidOperation, ROUND_HALF_UP

from openpyxl.utils.cell import column_index_from_string

from .detachments import allocate_expenses, order_by_site_hours, prorate_contribution
from .merge import normalized
from .numbers import spreadsheet_number
from .statutory import ZERO, calculate_statutory

DEDUCTION_TABS = {
    "SSS LOAN": {"SALARY": "AJ", "CALAMITY": "AK"},
    "CASH BOND": {"AMOUNT": "AL"},
    "BENLIFE INSURANCE": {"AMOUNT": "AM"},
    "GROUP INSURANCE": {"AMOUNT": "AO"},
    "PARAPHERNALIA": {"AMOUNT": "AQ"},
    "SOGCC": {"1": "BC", "2": "BD"},
}
DEDUCTION_COLUMNS = "AF AH AJ AK AM AL AN AO AP AQ AR AS AW AT BB AU AV BA AX AY AZ BD BC".split()
EARNING_COLUMNS = "F G J M P S U W X Y Z AA AB".split()
RECONCILIATION_FIELDS = ("grossPay", "totalDeductions", "netPay")


def amount(value):
    try:
        number = spreadsheet_number(value)
    except (ValueError, InvalidOperation) as exc:
        raise ValueError("An expected payroll amount or hour value is invalid.") from exc
    return Decimal(0) if number is None else number


def money(value):
    rounded = value.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
    return str(rounded if rounded else abs(rounded))


def reconciliation_differences(employee):
    return {
        field: money(amount(employee[field]) - amount(employee["registerAmounts"][field]))
        for field in RECONCILIATION_FIELDS
    }


def reconciliation_summary(employees):
    calculated = {field: Decimal("0.00") for field in RECONCILIATION_FIELDS}
    register = calculated.copy()
    rows_with_differences = 0
    unmatched_deductions = 0
    for employee in employees:
        for field in RECONCILIATION_FIELDS:
            calculated[field] += amount(employee[field])
            register[field] += amount(employee["registerAmounts"][field])
        rows_with_differences += any(
            amount(employee["differences"][field]) != 0 for field in RECONCILIATION_FIELDS
        )
        unmatched_deductions += not employee["deductionsMatched"]

    return {
        "employeeCount": len(employees),
        "rowsWithDifferences": rows_with_differences,
        "rowsWithoutDeductionMatch": unmatched_deductions,
        "calculatedTotals": {field: money(total) for field, total in calculated.items()},
        "registerTotals": {field: money(total) for field, total in register.items()},
        "totalDifferences": {field: money(calculated[field] - register[field])
                             for field in RECONCILIATION_FIELDS},
    }


def deductions_by_name(workbook):
    result = {}
    sheets = {normalized(sheet.title): sheet for sheet in workbook.worksheets}
    for tab, mapping in DEDUCTION_TABS.items():
        if tab not in sheets:
            raise ValueError(f"Missing deduction worksheet: {tab}.")
        rows = sheets[tab].values
        headers = [normalized(value) for value in next(rows, ())]
        if not {"EMPLOYEE NAME", *mapping}.issubset(headers):
            raise ValueError(f"Unexpected headers in deduction worksheet: {tab}.")
        seen = set()
        for row in rows:
            name = normalized(row[headers.index("EMPLOYEE NAME")])
            if not name or name == "TOTAL":
                continue
            if name in seen:
                raise ValueError(f"Duplicate employee in deduction worksheet: {tab}.")
            seen.add(name)
            result.setdefault(name, {}).update({
                column: amount(row[headers.index(header)]) for header, column in mapping.items()
            })
    return result


def calculate_register(register, deduction_book, statutory=None, detachments=None, loan_plan=None):
    sheet = register.active
    by_name = deductions_by_name(deduction_book)
    rows = iter(sheet.values)
    header = [next(rows, ()) for _ in range(7)]
    if len(header[5]) < 58 or normalized(header[5][2]) != "EMPLOYEE NAME" or normalized(header[5][57]) != "PAY":
        raise ValueError("Expected the SMCO payroll register layout.")
    period = next((str(value).strip() for value in header[2]
                   if value and "PAYROLL PERIOD" not in normalized(value)), "")
    if not period:
        raise ValueError("Missing payroll period.")

    profiles = {profile["registerRow"]: profile for profile in statutory["employees"]} if statutory else {}
    assignments = {row["registerRow"]: row for row in detachments["rows"]} if detachments else {}
    rows_by_employee = {}
    employees = []
    seen = set()
    for row_number, row in enumerate(rows, start=8):
        name = normalized(row[2])
        if not name or name in ("TOTAL", "GRAND TOTAL"):
            continue
        if not str(row[1]).isdigit():
            continue
        if not detachments and name in seen:
            raise ValueError(f"Duplicate employee on payroll row {row_number}.")
        seen.add(name)

        def cell(column):
            return row[column_index_from_string(column) - 1]

        def value(column):
            return amount(cell(column))

        required = ("D", "E", "AC", "BE", "BF") if statutory else ("D", "E", "AF", "AG", "AC", "BE", "BF")
        for column in required:
            if cell(column) is None or not str(cell(column)).strip():
                raise ValueError(f"Missing required payroll value at {column}{row_number}.")

        earnings = {column: value(column) for column in EARNING_COLUMNS}
        earnings.update(F=value("D") / 8 * value("E"), J=value("H") * value("I"),
                        M=value("K") * value("L"), P=value("N") * value("O"),
                        S=value("Q") * value("R"), U=value("E") * value("T"))
        deductions = {column: value(column) for column in DEDUCTION_COLUMNS}
        deductions["AH"] = earnings["F"] * Decimal("0.025")
        overrides = by_name.get(name)
        if overrides is not None and not detachments:
            deductions.update(overrides)
        entry = {
            "employeeName": str(row[2]).strip(),
            "registerRow": row_number,
            "deductionsMatched": overrides is not None,
            "earnings": earnings,
            "deductions": deductions,
            "dailyRate": value("D"),
            "sssEmployerShare": value("AG") if not statutory else ZERO,
            "registerAmounts": {field: value(col) for field, col in
                                (("grossPay", "AC"), ("totalDeductions", "BE"), ("netPay", "BF"))},
        }
        if detachments:
            meta = assignments.pop(row_number, None)
            if meta is None or normalized(meta["employeeName"]) != name:
                raise ValueError(f"Supply a matching detachment assignment for register row {row_number}.")
            if meta["approvedDailyRate"] != entry["dailyRate"]:
                raise ValueError(f"Register row {row_number}: the daily rate differs from the approved assignment rate.")
            entry["meta"] = meta
            rows_by_employee.setdefault(normalized(meta["employeeId"]), []).append(entry)
        else:
            if statutory:
                apply_statutory(statutory, profiles, [entry])
            employees.append(render_employee(entry))
    if assignments:
        raise ValueError(f"Detachment assignments include rows outside the payroll register: {', '.join(map(str, sorted(assignments)))}.")
    allocation_summaries = []
    for entries in rows_by_employee.values():
        entries = order_by_site_hours(entries)
        primary = entries[0]
        if len({normalized(entry["employeeName"]) for entry in entries}) != 1:
            raise ValueError(f"Conflicting register names for employee ID {primary['meta']['employeeId']}.")
        if statutory:
            apply_statutory(statutory, profiles, entries)
        employee_key = normalized(primary["meta"]["employeeId"])
        expenses, unallocated = allocate_expenses(
            entries, by_name.get(normalized(primary["employeeName"]), {}),
            (loan_plan or {}).get(employee_key),
        )
        for entry in entries:
            meta = entry.pop("meta")
            entry.update(employeeId=meta["employeeId"], detachment=meta["detachment"],
                         workedHours=str(meta["workedHours"]),
                         workFrom=meta["workFrom"].isoformat(), workThrough=meta["workThrough"].isoformat(),
                         allocatedExpenses={key: money(value) for key, value in expenses[entry["registerRow"]].items()})
            if entry is primary and unallocated:
                entry["unallocatedExpenses"] = {key: money(value) for key, value in unallocated.items()}
            employees.append(render_employee(entry))
        allocation_summaries.append({
            "employeeId": primary["employeeId"],
            "primaryDetachment": primary["detachment"],
            "unallocatedExpenses": {key: money(value) for key, value in unallocated.items()},
        })
    employees.sort(key=lambda item: item["registerRow"])
    if profiles:
        raise ValueError(f"Statutory profiles include rows outside the payroll register: {', '.join(map(str, sorted(profiles)))}.")
    if not employees:
        raise ValueError("The payroll register has no employee rows.")
    return period, {
        "employees": employees,
        **({"expenseAllocations": allocation_summaries} if detachments else {}),
        "warnings": [
            ("Statutory amounts use the provided approved monthly bases and wage-order information."
             if statutory else "SSS shares use the saved register amounts because SSSTABLE is an external workbook reference."),
            "The workbook's rates and deductions are used for this draft. Verify workbook inputs before approval.",
        ],
    }



def apply_statutory(config, profiles, entries):
    primary = entries[0]
    row_number = primary["registerRow"]
    profile = profiles.pop(row_number, None)
    if profile is None or normalized(profile["employeeName"]) != normalized(primary["employeeName"]):
        raise ValueError(f"Supply a matching statutory profile for register row {row_number}.")
    if len(entries) > 1 and any(
        normalized(entry["meta"].get("wageOrder")) != normalized(profile["wageOrder"])
        or entry["meta"].get("minimumDailyWage") != profile["minimumDailyWage"] for entry in entries
    ):
        raise ValueError(f"Register row {row_number}: grouped statutory payroll requires one verified wage order and minimum rate across the assignments.")
    try:
        # Compute once on combined compensation. Use the highest approved daily rate
        # when testing the supplied wage order. All assignments must share its coverage.
        statutory = calculate_statutory(
            config, profile, max(entry["dailyRate"] for entry in entries),
            sum(entry["earnings"]["F"] for entry in entries),
            sum(entry["earnings"]["J"] for entry in entries),
        )
    except ValueError as exc:
        raise ValueError(f"Register row {row_number}: {exc}") from exc
    contributions = statutory["employeeContributions"]
    sss = amount(contributions["sss"])
    pagibig = amount(contributions["pagibig"])
    employer_sss = amount(statutory["monthlyContributions"]["sss"]["employer"])
    try:
        sss_shares = prorate_contribution(sss, entries, "sssRemuneration") if len(entries) > 1 else [sss]
        fund_shares = prorate_contribution(pagibig, entries, "pagibigFundSalary") if len(entries) > 1 else [pagibig]
        employer_shares = (prorate_contribution(employer_sss, entries, "sssRemuneration")
                           if len(entries) > 1 else [employer_sss])
    except ValueError as exc:
        raise ValueError(f"Register row {row_number}: {exc}") from exc
    for entry, sss_share, fund_share, employer_share in zip(entries, sss_shares, fund_shares, employer_shares):
        philhealth = amount(contributions["philhealth"]) if entry is primary else ZERO
        withholding = amount(statutory["withholdingTax"]) if entry is primary else ZERO
        entry["deductions"].update(AF=sss_share, AH=philhealth, AU=fund_share, withholdingTax=withholding)
        entry["sssEmployerShare"] = employer_share
        if len(entries) > 1:
            entry["statutoryAllocation"] = {
                "sss": money(sss_share), "philhealth": money(philhealth),
                "pagibig": money(fund_share), "withholdingTax": money(withholding),
            }
    primary["statutory"] = statutory


def render_employee(entry):
    earnings, deductions = entry["earnings"], entry["deductions"]
    gross, deducted = sum(earnings.values()), sum(deductions.values())
    result = {key: value for key, value in entry.items()
              if key not in ("dailyRate", "earnings", "deductions", "registerAmounts", "sssEmployerShare")}
    result.update(
        earnings={key: money(value) for key, value in earnings.items()},
        deductions={key: money(value) for key, value in deductions.items()},
        sssEmployerShare=money(entry["sssEmployerShare"]),
        grossPay=money(gross), totalDeductions=money(deducted), netPay=money(gross - deducted),
        registerAmounts={key: money(value) for key, value in entry["registerAmounts"].items()},
    )
    result["differences"] = reconciliation_differences(result)
    return result
