from decimal import Decimal

from rest_framework import serializers

from .merge import normalized
from .statutory import CENT, ZERO, money_field, rounded


# Mandatory contributions stay separate from the expense allocation.
EXPENSE_COLUMNS = "AJ AK AL AM AN AO AP AQ AR AW BB AV BA AX AY AZ BD BC".split()


class DetachmentRow(serializers.Serializer):
    registerRow = serializers.IntegerField(min_value=8)
    employeeId = serializers.CharField(max_length=80)
    employeeName = serializers.CharField(max_length=255)
    detachment = serializers.CharField(max_length=160)
    workedHours = money_field()
    workFrom = serializers.DateField()
    workThrough = serializers.DateField()
    basicPayEffectiveFrom = serializers.DateField()
    basicPayEffectiveThrough = serializers.DateField(allow_null=True, required=False)
    approvedDailyRate = money_field(positive=True)
    wageOrder = serializers.CharField(max_length=120, required=False)
    minimumDailyWage = money_field(positive=True, required=False)
    sssRemuneration = money_field(required=False)
    pagibigFundSalary = money_field(required=False)

    def validate(self, attrs):
        start, end = attrs["workFrom"], attrs["workThrough"]
        rate_end = attrs.get("basicPayEffectiveThrough")
        if start > end or attrs["basicPayEffectiveFrom"] > start or (rate_end and end > rate_end):
            raise serializers.ValidationError("Work dates must be in order and covered by the approved basic-pay dates.")
        return attrs


class DetachmentInputs(serializers.Serializer):
    rows = DetachmentRow(many=True, allow_empty=False, max_length=5000)

    def validate_rows(self, rows):
        if len({row["registerRow"] for row in rows}) != len(rows):
            raise serializers.ValidationError("Supply one detachment entry per register row.")
        names = {}
        for row in rows:
            name = normalized(row["employeeName"])
            employee_id = normalized(row["employeeId"])
            if names.setdefault(name, employee_id) != employee_id:
                raise serializers.ValidationError("Employees with the same register name must be resolved before allocation.")
        return sorted(rows, key=lambda row: row["registerRow"])


def order_by_site_hours(entries):
    """Rank detachments on approved worked hours; use source row as the tie breaker."""
    sites = {}
    for entry in entries:
        sites.setdefault(normalized(entry["meta"]["detachment"]), []).append(entry)
    ranked = sorted(sites.values(), key=lambda group: (
        -sum(entry["meta"]["workedHours"] for entry in group), group[0]["registerRow"],
    ))
    return [entry for site in ranked for entry in site]


def prorate_contribution(total, entries, field):
    """Split a rounded monthly deduction among register rows without losing a cent."""
    bases = [entry["meta"].get(field) for entry in entries]
    if any(basis is None for basis in bases):
        raise ValueError(f"Supply {field} for every detachment row in this statutory payroll.")
    weights = [int(basis / CENT) for basis in bases]
    weight_total = sum(weights)
    if not weight_total:
        if total:
            raise ValueError(f"Supply a positive {field} total to allocate this contribution.")
        return [ZERO] * len(entries)
    cents = int(total / CENT)
    shares, remainders = map(list, zip(*(divmod(cents * weight, weight_total) for weight in weights)))
    # Where fractions tie, the earlier row in detachment priority gets the cent.
    priority = sorted(range(len(entries)), key=lambda index: -remainders[index])
    for index in priority[:cents - sum(shares)]:
        shares[index] += 1
    return [share * CENT for share in shares]


def allocate_expenses(entries, overrides, loan_plan=None):
    """Apply approved expenses in register-column order without using more than available pay."""
    expenses = {}
    for field in EXPENSE_COLUMNS:
        total = ZERO
        for entry in entries:
            total += rounded(entry["deductions"].pop(field, None) or ZERO)
        expenses[field] = rounded(overrides.get(field, total) or ZERO)

    if loan_plan:
        for field in loan_plan["columns"]:
            expenses[field] = ZERO
        expenses.update({key: Decimal(value) for key, value in loan_plan["loans"].items()})

    multiple_sites = len({normalized(entry["meta"]["detachment"]) for entry in entries}) > 1
    capacities = {}
    for entry in entries:
        row = entry["registerRow"]
        capacity = rounded(sum(entry["earnings"].values()) - sum(entry["deductions"].values()))
        capacities[row] = max(ZERO, capacity)

    allocations = {entry["registerRow"]: {} for entry in entries}
    unallocated = {}
    primary = entries[0]["registerRow"]
    for field, charge in expenses.items():
        if charge < 0:
            allocations[primary][field] = charge
            capacities[primary] -= charge

    for field, charge in expenses.items():
        if charge <= 0:
            continue
        for entry in entries:
            row = entry["registerRow"]
            portion = min(charge, capacities[row]) if multiple_sites or field.startswith("loan:") else charge
            if portion:
                allocations[row][field] = portion
                capacities[row] -= portion
                charge -= portion
            if not charge:
                break
        if charge:
            unallocated[field] = charge

    for entry in entries:
        assigned = allocations[entry["registerRow"]]
        entry["deductions"].update({field: assigned.get(field, ZERO) for field in expenses})
    return allocations, unallocated
