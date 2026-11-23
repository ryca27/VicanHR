"""Identity rules shared by the importer and the initial cutoff backfill."""
import hashlib
import json
import re


def normalized(value):
    return " ".join(str(value or "").upper().split())


def scope_key(branch, period):
    period = re.sub(r"\s*([-–—,])\s*", lambda m: "," if m[1] == "," else "-", normalized(period))
    return hashlib.sha256(json.dumps([normalized(branch), period]).encode()).hexdigest()


def merge_rows(existing, incoming):
    result = list(existing)
    by_name = {}
    for i, row in enumerate(result):
        by_name.setdefault(normalized(row["EMPLOYEE NAME"]), []).append(i)
    seen = set()
    for row in incoming:
        name = normalized(row["EMPLOYEE NAME"])
        number = normalized(row["EMPLOYEE NO."])
        candidates = by_name.get(name, [])
        matches = [i for i in candidates if normalized(result[i]["EMPLOYEE NO."]) == number]
        if len(matches) > 1 or (name, number) in seen:
            raise ValueError("Duplicate employee name and number. Check the workbook before uploading.")
        seen.add((name, number))
        if matches:
            result[matches[0]] = row
        elif candidates and (number in ("", "#N/A", "N/A") or any(
                normalized(result[i]["EMPLOYEE NO."]) in ("", "#N/A", "N/A") for i in candidates)):
            if len(candidates) != 1 or sum(normalized(r["EMPLOYEE NAME"]) == name for r in incoming) != 1:
                raise ValueError("Multiple employees share a name. Supply distinct employee numbers.")
            result[candidates[0]] = row
        else:
            by_name.setdefault(name, []).append(len(result))
            result.append(row)
    return result
