"""
URL configuration for config project.

The `urlpatterns` list routes URLs to views. For more information please see:
    https://docs.djangoproject.com/en/6.1/topics/http/urls/
Examples:
Function views
    1. Add an import:  from my_app import views
    2. Add a URL to urlpatterns:  path('', views.home, name='home')
Class-based views
    1. Add an import:  from other_app.views import Home
    2. Add a URL to urlpatterns:  path('', Home.as_view(), name='home')
Including another URLconf
    1. Import the include() function: from django.urls import include, path
    2. Add a URL to urlpatterns:  path('blog/', include('blog.urls'))
"""
from django.conf import settings
from django.contrib import admin
from django.contrib.staticfiles.urls import staticfiles_urlpatterns
from django.contrib.auth.views import LoginView
from attendance.api import attendance, attendance_detail, preview_workbook
from attendance.payroll_api import create_payroll_draft, payroll_draft
from attendance.payroll_ledger_api import (
    expense_employee_detail, expense_employees, finalize_payroll_draft, payroll_loan_payment, payroll_loans, thirteenth_month_pay,
)
from .login import csrf, session_login
from attendance.views import upload_summary
from django.urls import path, include
from drf_spectacular.views import (
    SpectacularAPIView,
    SpectacularSwaggerView,
    SpectacularRedocView,
)

urlpatterns = [
    path("api/payroll/drafts/", create_payroll_draft),
    path("api/payroll/drafts/<int:pk>/", payroll_draft),
    path("api/payroll/drafts/<int:pk>/finalize/", finalize_payroll_draft),
    path("api/payroll/loans/", payroll_loans),
    path("api/payroll/expense-employees/", expense_employees),
    path("api/payroll/expense-employees/detail/", expense_employee_detail),
    path("api/payroll/loans/<int:pk>/payments/", payroll_loan_payment),
    path("api/payroll/thirteenth-month/<int:year>/", thirteenth_month_pay),
    path("api/auth/csrf/", csrf),
    path("api/auth/login/", session_login),
    path("api/attendance/preview/", preview_workbook),
    path("api/attendance/<int:pk>/", attendance_detail),
    path("api/attendance/", attendance),
    path("attendance/login/", LoginView.as_view(template_name="attendance/login.html",
                                               next_page="attendance-upload"), name="attendance-login"),
    path("attendance/upload/", upload_summary, name="attendance-upload"),
    path('admin/', admin.site.urls),
    path('api/', include('todo.urls')),
    path(
        "api/schema/",
        SpectacularAPIView.as_view(),
        name="schema",
    ),

    # Interactive Swagger UI
    path(
        "api/docs/",
        SpectacularSwaggerView.as_view(
            url_name="schema"
        ),
        name="swagger-ui",
    ),

    # Alternative API documentation
    path(
        "api/redoc/",
        SpectacularRedocView.as_view(
            url_name="schema"
        ),
        name="redoc",
    ),
]


if settings.DEBUG:
    urlpatterns += staticfiles_urlpatterns()
