from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.permissions import AllowAny

from .models import Survey
from .serializers import SurveySerializer, SubmitSurveySerializer
from utils.ad_utils import get_employee_identifier, has_employee_responded, is_admin_user


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
        
        # Check if employee has already responded (only for non-admin users)
        employee_identifier = get_employee_identifier(request)
        admin_bypass = bool(is_admin_user(employee_identifier, request=request))
        has_responded = False
        
        if employee_identifier and not admin_bypass:
            has_responded = has_employee_responded(survey.id, employee_identifier)
        
        survey_data = SurveySerializer(survey).data
        survey_data['has_responded'] = has_responded
        
        return Response(survey_data)


class SubmitSurveyView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        # Get employee identifier before processing
        employee_identifier = get_employee_identifier(request)
        admin_bypass = bool(is_admin_user(employee_identifier, request=request))
        
        # Only enforce one-response restriction for non-admin users
        survey_id = request.data.get('survey')
        if (survey_id and employee_identifier and 
            not admin_bypass and 
            has_employee_responded(survey_id, employee_identifier)):
            return Response(
                {"detail": "You have already submitted this survey. Only one response per employee is allowed."},
                status=status.HTTP_403_FORBIDDEN
            )
        
        serializer = SubmitSurveySerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        # Save with employee identifier (for tracking, but admins can bypass restriction)
        response = serializer.save(employee_identifier=employee_identifier, _admin_bypass=admin_bypass)
        
        return Response({"ok": True}, status=status.HTTP_201_CREATED)
