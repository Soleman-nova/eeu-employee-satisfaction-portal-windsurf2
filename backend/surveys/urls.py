from django.urls import path
from .views import ActiveSurveyView, SubmitSurveyView, CheckAttemptsView, IncrementAttemptView

urlpatterns = [
    path('survey/active/', ActiveSurveyView.as_view(), name='survey-active'),
    path('survey/submit/', SubmitSurveyView.as_view(), name='survey-submit'),
    path('check-attempts/', CheckAttemptsView.as_view(), name='check-attempts'),
    path('increment-attempt/', IncrementAttemptView.as_view(), name='increment-attempt'),
]
