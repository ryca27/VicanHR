from django.contrib.auth.models import Group, Permission, User
from django.core.management.base import BaseCommand
from django.db import transaction


class Command(BaseCommand):
    help = "Create four application roles and three local sample users."

    @transaction.atomic
    def handle(self, *args, **options):
        roles = {}
        permission = Permission.objects.get(content_type__app_label="attendance",
                                            codename="add_attendancesummary")
        for name in ("admin", "hr", "finance", "operations"):
            roles[name], _ = Group.objects.get_or_create(name=name)
            if name in ("admin", "finance"):
                roles[name].permissions.add(permission)
            else:
                roles[name].permissions.remove(permission)
        for name, role in (("rctabernilla", "finance"), ("kteruel", "admin"), ("leviernes", "hr")):
            user, created = User.objects.get_or_create(username=name)
            if created:
                user.set_unusable_password()
                user.save(update_fields=["password"])
            user.groups.remove(*(group for key, group in roles.items() if key != role))
            user.groups.add(roles[role])
            self.stdout.write(f"{name}: {role}")
