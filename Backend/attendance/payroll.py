"""Reproduce the SMCO register arithmetic using approved workbook inputs."""
from decimal import Decimal, InvalidOperation, ROUND_HALF_UP

from openpyxl.utils.cell import column_index_from_string

from .merge import normalized
from .numbers import spreadsheet_number

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


def calculate_register(register, deduction_book):
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

    employees = []
    seen = set()
    for row_number, row in enumerate(rows, start=8):
        name = normalized(row[2])
        if not name or name in ("TOTAL", "GRAND TOTAL"):
            continue
        if not str(row[1]).isdigit():
            continue
        if name in seen:
            raise ValueError(f"Duplicate employee on payroll row {row_number}.")
        seen.add(name)

        def cell(column):
            return row[column_index_from_string(column) - 1]

        def value(column):
            return amount(cell(column))

        for column in ("D", "E", "AF", "AG", "AC", "BE", "BF"):
            if cell(column) is None or not str(cell(column)).strip():
                raise ValueError(f"Missing required payroll value at {column}{row_number}.")

        earnings = {column: value(column) for column in EARNING_COLUMNS}
        earnings.update(F=value("D") / 8 * value("E"), J=value("H") * value("I"),
                        M=value("K") * value("L"), P=value("N") * value("O"),
                        S=value("Q") * value("R"), U=value("E") * value("T"))
        deductions = {column: value(column) for column in DEDUCTION_COLUMNS}
        deductions["AH"] = earnings["F"] * Decimal("0.025")
        overrides = by_name.get(name)
        if overrides is not None:
            deductions.update(overrides)
        gross = sum(earnings.values())
        deducted = sum(deductions.values())
        net = gross - deducted
        calculated = {"grossPay": gross, "totalDeductions": deducted, "netPay": net}
        register_values = {"grossPay": value("AC"), "totalDeductions": value("BE"), "netPay": value("BF")}
        employee = {
            "employeeName": str(row[2]).strip(),
            "registerRow": row_number,
            "deductionsMatched": overrides is not None,
            "earnings": {key: money(val) for key, val in earnings.items()},
            "deductions": {key: money(val) for key, val in deductions.items()},
            "sssEmployerShare": money(value("AG")),
            **{key: money(val) for key, val in calculated.items()},
            "registerAmounts": {key: money(val) for key, val in register_values.items()},
        }
        employee["differences"] = reconciliation_differences(employee)
        employees.append(employee)
    if not employees:
        raise ValueError("The payroll register has no employee rows.")
    return period, {
        "employees": employees,
        "warnings": [
            "SSS shares use the saved register amounts because SSSTABLE is an external workbook reference.",
            "The workbook's rates and deductions are used for this draft. Verify workbook inputs before approval.",
        ],
    }
