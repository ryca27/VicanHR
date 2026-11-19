from django.contrib.auth.decorators import login_required
from django.core.exceptions import PermissionDenied
from django.shortcuts import render
from django.views.decorators.http import require_http_methods

from .permissions import can_submit_attendance
from .importer import import_summary


@login_required(login_url="attendance-login")
@require_http_methods(["GET", "POST"])
def upload_summary(request):
    if not can_submit_attendance(request.user):
        raise PermissionDenied
    context = {}
    if request.method == "POST":
        try:
            if "file" not in request.FILES:
                raise ValueError("Choose a summary workbook.")
            cutoff, action = import_summary(request.FILES["file"])
            context.update(summary=cutoff.latest_upload, action=action, count=len(cutoff.employees))
        except ValueError as exc:
            context["error"] = str(exc)
    return render(request, "attendance/upload.html", context, status=400 if "error" in context else 200)
