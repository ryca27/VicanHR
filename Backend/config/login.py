from django.contrib.auth import authenticate, login
from django.middleware.csrf import get_token
from django.views.decorators.csrf import csrf_protect
from rest_framework import serializers
from rest_framework.decorators import api_view, authentication_classes, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response


class Credentials(serializers.Serializer):
    username = serializers.CharField()
    password = serializers.CharField(trim_whitespace=False, write_only=True)
    rememberMe = serializers.BooleanField(default=False)


@api_view(["GET"])
@authentication_classes([])
@permission_classes([AllowAny])
def csrf(request):
    return Response({"csrfToken": get_token(request)})


@api_view(["POST"])
@authentication_classes([])
@permission_classes([AllowAny])
def login_api(request):
    credentials = Credentials(data=request.data)
    credentials.is_valid(raise_exception=True)
    data = credentials.validated_data
    user = authenticate(request, username=data["username"], password=data["password"])
    if user is None:
        return Response({"detail": "Invalid username or password."}, status=401)
    login(request, user)
    request.session.set_expiry(None if data["rememberMe"] else 0)
    return Response({"username": user.username, "roles": list(user.groups.values_list("name", flat=True)),
                     "csrfToken": get_token(request)})


@csrf_protect
def session_login(request):
    return login_api(request)
