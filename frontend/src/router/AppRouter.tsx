import React from 'react'
import { Route, Routes, Navigate, Link, Outlet } from 'react-router-dom'
import LandingPage from '@/pages/Public/LandingPage'
import SurveyPage from '@/pages/Public/SurveyPage'
import ThankYouPage from '@/pages/Public/ThankYouPage'
import LoginPage from '@/pages/Admin/LoginPage'
import DashboardPage from '@/pages/Admin/DashboardPage'
import ManageSurveysPage from '@/pages/Admin/ManageSurveysPage'
import ResponsesPage from '@/pages/Admin/ResponsesPage'
import UserManagementPage from '@/pages/Admin/UserManagementPage'
import ChangePasswordPage from '@/pages/Admin/ChangePasswordPage'
import Navbar from '@/components/Navbar'
import { useAuth } from '@/context/AuthContext'

function RequireAuth() {
  const { token } = useAuth()
  if (!token) return <Navigate to="/admin/login" replace />
  return <Outlet />
}

function RequireSuperAdmin() {
  const { token, isSuperAdmin } = useAuth()
  if (!token) return <Navigate to="/admin/login" replace />
  if (!isSuperAdmin) return <Navigate to="/admin/dashboard" replace />
  return <Outlet />
}

function RequireSurveyDesignerOrAdmin() {
  const { token, isSuperAdmin, isSurveyDesigner } = useAuth()
  if (!token) return <Navigate to="/admin/login" replace />
  if (!isSuperAdmin && !isSurveyDesigner) return <Navigate to="/admin/dashboard" replace />
  return <Outlet />
}

export default function AppRouter() {
  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <div className="container mx-auto px-4 py-6 flex-1 w-full">
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/survey" element={<SurveyPage />} />
          <Route path="/survey/preview/:id" element={<SurveyPage />} />
          <Route path="/thank-you" element={<ThankYouPage />} />

          <Route path="/admin/login" element={<LoginPage />} />
          <Route path="/admin" element={<Navigate to="/admin/dashboard" replace />} />

          <Route element={<RequireAuth />}>
            <Route path="/admin/dashboard" element={<DashboardPage />} />
            <Route path="/admin/responses" element={<ResponsesPage />} />
            <Route path="/admin/change-password" element={<ChangePasswordPage />} />

            <Route element={<RequireSurveyDesignerOrAdmin />}>
              <Route path="/admin/manage-surveys" element={<ManageSurveysPage />} />
            </Route>

            <Route element={<RequireSuperAdmin />}>
              <Route path="/admin/users" element={<UserManagementPage />} />
            </Route>
          </Route>

          <Route path="*" element={<div className="p-6">Not Found. <Link to="/" className="text-blue-600 underline">Go home</Link></div>} />
        </Routes>
      </div>
    </div>
  )
}
