import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [("attendance", "0003_payrolldraft")]

    operations = [
        migrations.CreateModel(
            name="AttendanceAdjustment",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("source_scope", models.CharField(max_length=64)),
                ("cutoff", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="adjustments",
                                             to="attendance.attendancecutoff")),
                ("upload", models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, to="attendance.attendancesummary")),
            ],
            options={"constraints": [models.UniqueConstraint(
                fields=("cutoff", "source_scope"), name="unique_attendance_adjustment_period",
            )]},
        ),
    ]
