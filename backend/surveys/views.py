from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.permissions import AllowAny
from django.utils import timezone
from django.db import transaction
import hashlib

from .models import Survey, SurveyAttempt
from .serializers import SurveySerializer, SubmitSurveySerializer
from utils.ad_utils import get_employee_identifier, is_admin_user


def _get_client_ip(request) -> str:
    try:
        xff = request.META.get("HTTP_X_FORWARDED_FOR")
        if xff:
            # X-Forwarded-For can be a list: client, proxy1, proxy2
            return str(xff).split(",")[0].strip()
    except Exception:
        pass
    return str(request.META.get("REMOTE_ADDR") or "").strip()


def _is_admin_bypass(request) -> bool:
    employee_identifier = get_employee_identifier(request)
    return bool(is_admin_user(employee_identifier, request=request))


def _fingerprint_hash(request, fingerprint: str) -> str:
    # Tie the fingerprint to the client IP on the backend so we never need to send the IP to the frontend.
    ip = _get_client_ip(request)
    raw = f"{fingerprint}|{ip}".encode("utf-8", errors="ignore")
    return hashlib.sha256(raw).hexdigest()


class ActiveSurveyView(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        survey = (
            Survey.objects.filter(is_active=True)
            .order_by("-created_at")
            .prefetch_related("sections", "sections__questions", "questions")
            .first()
        )
        if not survey:
            return Response(None, status=status.HTTP_200_OK)

        # NOTE: We no longer enforce the legacy one-response-per-employee restriction here.
        # Public attempt limiting is handled via fingerprint/IP based endpoints, with full admin bypass.
        has_responded = False

        survey_data = SurveySerializer(survey).data
        survey_data['has_responded'] = has_responded
        survey_data['client_ip'] = _get_client_ip(request)
        survey_data['admin_bypass'] = _is_admin_bypass(request)
        
        return Response(survey_data)


class SubmitSurveyView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        # Employee identifier is still stored for analytics/auditing, but we no longer block on it.
        employee_identifier = get_employee_identifier(request)
        admin_bypass = _is_admin_bypass(request)
        
        serializer = SubmitSurveySerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        # Save with employee identifier (for tracking, but admins can bypass restriction)
        response = serializer.save(employee_identifier=employee_identifier, _admin_bypass=admin_bypass)
        
        return Response({"ok": True}, status=status.HTTP_201_CREATED)


class CheckAttemptsView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        # Completely exempt admin roles from any tracking/limits.
        if _is_admin_bypass(request):
            return Response({"allowed": True, "unlimited": True}, status=status.HTTP_200_OK)

        fingerprint = (request.data.get("fingerprint") or "").strip()
        if not fingerprint:
            # If the client can't generate a fingerprint, allow and let frontend fallback to localStorage.
            return Response({"allowed": True, "unlimited": False, "fallback": True}, status=status.HTTP_200_OK)

        fp_hash = _fingerprint_hash(request, fingerprint)
        attempt = SurveyAttempt.objects.filter(fingerprint_hash=fp_hash).first()
        attempts = int(getattr(attempt, "attempts", 0) or 0)
        return Response({"allowed": attempts < 2, "unlimited": False}, status=status.HTTP_200_OK)


class IncrementAttemptView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        # Completely exempt admin roles from any tracking/limits.
        if _is_admin_bypass(request):
            return Response({"ok": True, "ignored": True}, status=status.HTTP_200_OK)

        fingerprint = (request.data.get("fingerprint") or "").strip()
        if not fingerprint:
            return Response({"ok": True, "fallback": True}, status=status.HTTP_200_OK)

        fp_hash = _fingerprint_hash(request, fingerprint)
        now = timezone.now()

        with transaction.atomic():
            obj, _created = SurveyAttempt.objects.select_for_update().get_or_create(
                fingerprint_hash=fp_hash,
                defaults={"attempts": 0, "last_submitted": None},
            )
            obj.attempts = int(obj.attempts or 0) + 1
            obj.last_submitted = now
            obj.save(update_fields=["attempts", "last_submitted"])

        return Response({"ok": True}, status=status.HTTP_200_OK)
