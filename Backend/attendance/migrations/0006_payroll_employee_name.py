from django.db import migrations, models
from django.db.models import OuterRef, Subquery


def populate_employee_names(apps, schema_editor):
    account = apps.get_model("attendance", "PayrollEmployeeAccount")
    earning = apps.get_model("attendance", "FinalizedPayrollEarning")
    database = schema_editor.connection.alias
    latest = earning.objects.using(database).filter(employee_id=OuterRef("pk")).order_by("-work_through", "-pk")
    account.objects.using(database).filter(employee_name="").filter(
        pk__in=earning.objects.using(database).values("employee_id"),
    ).update(employee_name=Subquery(latest.values("employee_name")[:1]))


class Migration(migrations.Migration):
    dependencies = [("attendance", "0005_payroll_ledger")]

    operations = [
        migrations.AddField(
            model_name="payrollemployeeaccount", name="employee_name",
            field=models.CharField(blank=True, default="", max_length=255),
        ),
        migrations.RunPython(populate_employee_names, migrations.RunPython.noop),
    ]
