from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from django.shortcuts import get_object_or_404

from .models import Survey
from .serializers import (
    SurveyCreateUpdateSerializer,
    SurveyDetailSerializer,
)


def _get_user_role(user) -> str:
    """Normalize the role used across the admin portal.

    Some deployments use Django's default User model without a persisted `role` field.
    In that case we infer role based on is_superuser/is_staff.
    """
    raw_role = getattr(user, "role", None)
    if raw_role in ("super_admin", "survey_designer", "viewer"):
        return raw_role
    if getattr(user, "is_superuser", False):
        return "super_admin"
    if getattr(user, "is_staff", False):
        return "survey_designer"
    return "viewer"


def _can_edit_surveys(user) -> bool:
    """Return True if the given user is allowed to manage surveys.

    We allow the explicit roles super_admin and survey_designer, and fall back
    to the historical is_staff flag for backwards compatibility.
    """
    role = _get_user_role(user)
    return role in ("super_admin", "survey_designer")


def _can_view_surveys(user) -> bool:
    """Return True if the given user is allowed to view surveys in the admin portal."""
    role = _get_user_role(user)
    return role in ("super_admin", "survey_designer", "viewer")


class AdminSurveyListCreateView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        if not _can_view_surveys(request.user):
            return Response({"detail": "Forbidden"}, status=status.HTTP_403_FORBIDDEN)
        qs = Survey.objects.order_by('-created_at').prefetch_related('sections', 'sections__questions', 'questions')
        data = SurveyDetailSerializer(qs, many=True).data
        return Response(data)

    def post(self, request):
        if not _can_edit_surveys(request.user):
            return Response({"detail": "Forbidden"}, status=status.HTTP_403_FORBIDDEN)
        serializer = SurveyCreateUpdateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        survey = serializer.save()
        return Response(SurveyDetailSerializer(survey).data, status=status.HTTP_201_CREATED)


class AdminSurveyDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def get_object(self, pk):
        return get_object_or_404(Survey, pk=pk)

    def get(self, request, pk: int):
        if not _can_edit_surveys(request.user):
            return Response({"detail": "Forbidden"}, status=status.HTTP_403_FORBIDDEN)
        survey = self.get_object(pk)
        return Response(SurveyDetailSerializer(survey).data)

    def patch(self, request, pk: int):
        if not _can_edit_surveys(request.user):
            return Response({"detail": "Forbidden"}, status=status.HTTP_403_FORBIDDEN)
        survey = self.get_object(pk)
        serializer = SurveyCreateUpdateSerializer(survey, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        survey = serializer.save()
        return Response(SurveyDetailSerializer(survey).data)

    def delete(self, request, pk: int):
        if not _can_edit_surveys(request.user):
            return Response({"detail": "Forbidden"}, status=status.HTTP_403_FORBIDDEN)
        survey = self.get_object(pk)
        survey.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class AdminSurveyActivateView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, pk: int):
        if not _can_edit_surveys(request.user):
            return Response({"detail": "Forbidden"}, status=status.HTTP_403_FORBIDDEN)
        # Deactivate others and activate this one
        survey = get_object_or_404(Survey, pk=pk)
        if not survey.is_active:
            Survey.objects.filter(is_active=True).update(is_active=False)
            survey.is_active = True
            survey.save(update_fields=['is_active'])
        return Response({"ok": True})
