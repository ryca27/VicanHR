import hashlib
import json
import math

from django.shortcuts import get_object_or_404
from .models import AttendanceCutoff
from rest_framework import serializers
from rest_framework.decorators import api_view, parser_classes, permission_classes
from rest_framework.parsers import JSONParser, MultiPartParser
from rest_framework.permissions import BasePermission
from rest_framework.response import Response

from .permissions import can_submit_attendance
from .importer import read_summary, save_attendance
from .merge import normalized


HOURS = {
    "regularHours": "TOTAL REG HRS",
    "overtimeHours": "TOTAL OT HRS",
    "nightDifferentialHours": "TOTAL ND HRS",
    "wdoHours": "TOTAL WDO",
    "btrHours": "BTR HRS",
    "legalHolidayHours": "TOTAL LH",
    "legalHolidayOtHours": "TOTAL LH OT",
    "specialHolidayHours": "TOTAL SH",
    "specialHolidayOtHours": "TOTAL SH OT",
}


class HoursField(serializers.FloatField):
    def to_internal_value(self, data):
        if type(data) not in (int, float):
            self.fail("invalid")
        number = super().to_internal_value(data)
        if not math.isfinite(number):
            self.fail("invalid")
        return number


class EmployeeSerializer(serializers.Serializer):
    employeeNo = serializers.CharField(required=False, allow_null=True, default=None)
    employeeName = serializers.CharField()
    detachment = serializers.CharField(allow_null=True)

    def get_fields(self):
        fields = super().get_fields()
        fields.update({name: HoursField(allow_null=True) for name in HOURS})
        return fields


class AttendanceSerializer(serializers.Serializer):
    period = serializers.CharField()
    detachment = serializers.CharField()
    employees = EmployeeSerializer(many=True, allow_empty=False)

    def validate(self, attrs):
        for index, employee in enumerate(attrs["employees"]):
            branch = employee["detachment"]
            if branch and normalized(branch) != normalized(attrs["detachment"]):
                raise serializers.ValidationError({"employees": f"Row {index + 1} has a different detachment."})
        return attrs


class CanImportAttendance(BasePermission):
    def has_permission(self, request, view):
        return can_submit_attendance(request.user)


@api_view(["GET", "POST"])
@parser_classes([JSONParser])
@permission_classes([CanImportAttendance])
def attendance(request):
    if request.method == "GET":
        cutoffs = AttendanceCutoff.objects.select_related("latest_upload").defer(
            "employees", "latest_upload__employees", "latest_upload__cells"
        ).order_by("-latest_upload__imported_at")
        return Response([{"cutoffId": c.pk, "period": c.latest_upload.period,
                          "detachment": c.latest_upload.branch} for c in cutoffs])
    serializer = AttendanceSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    payload = serializer.validated_data
    employees = [{
        "EMPLOYEE NO.": item["employeeNo"], "EMPLOYEE NAME": item["employeeName"],
        "detachment": item["detachment"],
        **{header: item[field] for field, header in HOURS.items()},
    } for item in payload["employees"]]
    fingerprint = hashlib.sha256(json.dumps(payload, sort_keys=True).encode()).hexdigest()
    try:
        cutoff, action = save_attendance(fingerprint, dict(
            filename="attendance.json", branch=payload["detachment"], period=payload["period"],
            employees=employees, agency="", address="", cells=[],
        ))
    except ValueError as exc:
        raise serializers.ValidationError({"employees": str(exc)}) from exc
    return Response({"cutoffId": cutoff.pk, "status": action, "employeeCount": len(cutoff.employees)},
                    status=201 if action == "Saved" else 200)

@api_view(["GET"])
@permission_classes([CanImportAttendance])
def attendance_detail(request, pk):
    cutoff = get_object_or_404(AttendanceCutoff.objects.select_related("latest_upload").defer(
        "latest_upload__employees", "latest_upload__cells"), pk=pk)
    employees = [{
        "employeeNo": row.get("EMPLOYEE NO."), "employeeName": row["EMPLOYEE NAME"],
        "detachment": row.get("detachment") or cutoff.latest_upload.branch,
        **{field: float(row[header]) if row.get(header) is not None else None
           for field, header in HOURS.items()},
    } for row in cutoff.employees]
    return Response({"cutoffId": cutoff.pk, "period": cutoff.latest_upload.period,
                     "detachment": cutoff.latest_upload.branch, "employees": employees})

@api_view(["POST"])
@parser_classes([MultiPartParser])
@permission_classes([CanImportAttendance])
def preview_workbook(request):
    workbook = request.FILES.get("file")
    if workbook is None:
        return Response({"detail": "Select an Excel workbook."}, status=400)
    try:
        _, rows = read_summary(workbook)
    except ValueError as exc:
        return Response({"detail": str(exc)}, status=400)
    return Response({"rows": [["" if cell is None else str(cell) for cell in row] for row in rows]})
