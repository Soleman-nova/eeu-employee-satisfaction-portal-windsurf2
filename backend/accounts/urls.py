from django.urls import path, include
from rest_framework_simplejwt.views import TokenRefreshView
from .views import (
    AdminLoginView,
    DashboardView,
    AdminResponsesListView,
    AdminResponsesExportExcelView,
    AdminResponsesExportPdfView,
    ChangePasswordView,
    AdminUserListCreateView,
    AdminUserDetailView,
    AdminUserResetPasswordView,
)
from surveys.admin_views import AdminSurveyListCreateView

urlpatterns = [
    path('login/', AdminLoginView.as_view(), name='admin-login'),
    path('token/refresh/', TokenRefreshView.as_view(), name='admin-token-refresh'),
    path('dashboard/', DashboardView.as_view(), name='admin-dashboard'),
    path('change-password/', ChangePasswordView.as_view(), name='admin-change-password'),
    path('users/', AdminUserListCreateView.as_view(), name='admin-users-list-create'),
    path('users/<int:pk>/', AdminUserDetailView.as_view(), name='admin-users-detail'),
    path('users/<int:pk>/reset-password/', AdminUserResetPasswordView.as_view(), name='admin-users-reset-password'),
    path('surveys/', include('surveys.admin_urls')),
    path('responses/', AdminResponsesListView.as_view(), name='admin-responses-list'),
    path('responses/export.xlsx', AdminResponsesExportExcelView.as_view(), name='admin-responses-export-excel'),
    path('responses/export.pdf', AdminResponsesExportPdfView.as_view(), name='admin-responses-export-pdf'),
    # Spec aliases
    path('survey/create/', AdminSurveyListCreateView.as_view(), name='admin-survey-create-alias'),
    path('survey/responses/', AdminResponsesListView.as_view(), name='admin-survey-responses-alias'),
]
