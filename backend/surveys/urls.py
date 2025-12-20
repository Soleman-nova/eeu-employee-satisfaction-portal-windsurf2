from django.urls import path
from .views import ActiveSurveyView, SubmitSurveyView

urlpatterns = [
    path('survey/active/', ActiveSurveyView.as_view(), name='survey-active'),
    path('survey/submit/', SubmitSurveyView.as_view(), name='survey-submit'),
]
