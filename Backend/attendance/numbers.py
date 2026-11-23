"""Normalize numeric spreadsheet cells using VicanHR's decimal conventions."""
import re
from decimal import Decimal


_NUMBER = re.compile(
    r"(?P<sign>[+-]?)\s*(?P<prefix>PHP|₱)?\s*(?P<inner_sign>[+-]?)"
    r"(?P<digits>(?:[0-9]+|[0-9]{1,3}(?:,[0-9]{3})+|[0-9]{1,3}(?: [0-9]{3})+)"
    r"(?:\.[0-9]*)?|\.[0-9]+)(?P<exponent>[eE][+-]?[0-9]+)?"
    r"\s*(?P<suffix>PHP|₱)?",
    re.IGNORECASE | re.ASCII,
)


def spreadsheet_number(value):
    """Return a Decimal or None for a blank. Reject ambiguous formatting."""
    if value is None:
        return None
    text = str(value).strip().replace("−", "-").replace("\u00a0", " ").replace("\u202f", " ")
    if not text:
        return None
    accounting_negative = text.startswith("(") and text.endswith(")")
    if accounting_negative:
        text = text[1:-1].strip()
    match = _NUMBER.fullmatch(text)
    if match is None:
        raise ValueError("Expected a number with a decimal point and optional thousands separators.")
    sign, prefix, inner_sign, digits, exponent, suffix = match.groups()
    if (prefix and suffix) or (inner_sign and (sign or not prefix)) or (
        accounting_negative and (sign or inner_sign)
    ):
        raise ValueError("Conflicting currency markers or signs.")
    normalized = digits.replace(",", "").replace(" ", "") + (exponent or "")
    signed = "-" + normalized if accounting_negative or (sign or inner_sign) == "-" else normalized
    return Decimal(signed)
