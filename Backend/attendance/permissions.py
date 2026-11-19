SUBMISSION_ROLES = ("admin", "finance")


def can_submit_attendance(user):
    return (user.is_authenticated and user.is_active
            and user.groups.filter(name__in=SUBMISSION_ROLES).exists())
