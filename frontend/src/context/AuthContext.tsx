import React, { createContext, useCallback, useContext, useMemo, useState } from 'react'
import { adminLogin, type AdminUser, type AdminRole } from '@/api/adminAPI'

export type AuthContextType = {
  loading: boolean
  token: string | null
  refreshToken: string | null
  user: AdminUser | null
  role: AdminRole | null
  isSuperAdmin: boolean
  isSurveyDesigner: boolean
  canEditSurvey: boolean
  canManageUsers: boolean
  login: (username: string, password: string) => Promise<void>
  logout: () => void
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [loading, setLoading] = useState(false)
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('eeu_admin_token'))
  const [refreshToken, setRefreshToken] = useState<string | null>(() => localStorage.getItem('eeu_admin_refresh_token'))
  const [user, setUser] = useState<AdminUser | null>(() => {
    const raw = localStorage.getItem('eeu_admin_user')
    if (!raw) return null
    try {
      return JSON.parse(raw) as AdminUser
    } catch {
      return null
    }
  })

  const login = useCallback(async (username: string, password: string) => {
    setLoading(true)
    try {
      const { access, refresh, user } = await adminLogin(username, password)
      localStorage.setItem('eeu_admin_token', access)
      if (refresh) {
        localStorage.setItem('eeu_admin_refresh_token', refresh)
        setRefreshToken(refresh)
      }
      localStorage.setItem('eeu_admin_user', JSON.stringify(user))
      setToken(access)
      setUser(user)
    } finally {
      setLoading(false)
    }
  }, [])

  const logout = useCallback(() => {
    localStorage.removeItem('eeu_admin_token')
    localStorage.removeItem('eeu_admin_refresh_token')
    localStorage.removeItem('eeu_admin_user')
    setToken(null)
    setRefreshToken(null)
    setUser(null)
  }, [])

  const role: AdminRole | null = user?.role ?? null
  const isSuperAdmin = role === 'super_admin'
  const isSurveyDesigner = role === 'survey_designer'
  const canEditSurvey = role === 'super_admin' || role === 'survey_designer'
  const canManageUsers = isSuperAdmin

  const value = useMemo(
    () => ({
      loading,
      token,
      refreshToken,
      user,
      role,
      isSuperAdmin,
      isSurveyDesigner,
      canEditSurvey,
      canManageUsers,
      login,
      logout,
    }),
    [
      loading,
      token,
      refreshToken,
      user,
      role,
      isSuperAdmin,
      isSurveyDesigner,
      canEditSurvey,
      canManageUsers,
      login,
      logout,
    ],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextType {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
