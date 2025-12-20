from django.urls import path
from .admin_views import (
    AdminSurveyListCreateView,
    AdminSurveyDetailView,
    AdminSurveyActivateView,
)

urlpatterns = [
    path('', AdminSurveyListCreateView.as_view(), name='admin-survey-list-create'),
    path('<int:pk>/', AdminSurveyDetailView.as_view(), name='admin-survey-detail'),
    path('<int:pk>/activate/', AdminSurveyActivateView.as_view(), name='admin-survey-activate'),
]
