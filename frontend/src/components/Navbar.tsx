import React, { useEffect, useRef, useState } from 'react'
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom'
import { useI18n } from '@/context/I18nContext'
import { useAuth } from '@/context/AuthContext'
import {
  ArrowRightOnRectangleIcon,
  ChevronDownIcon,
  Cog6ToothIcon,
  HomeIcon,
  LanguageIcon,
  PresentationChartBarIcon,
  ShieldCheckIcon,
  ClipboardDocumentCheckIcon,
} from '@heroicons/react/24/outline'

export default function Navbar() {
  const { t, lang, setLang } = useI18n()
  const { user, role, isSuperAdmin, logout, token } = useAuth()
  const [open, setOpen] = useState(false)
  const userMenuRef = useRef<HTMLDivElement | null>(null)
  const navigate = useNavigate()
  const location = useLocation()

  useEffect(() => {
    if (!open) return

    const onPointerDown = (e: MouseEvent | TouchEvent) => {
      const el = userMenuRef.current
      const target = e.target as Node | null
      if (!el || !target) return
      if (!el.contains(target)) setOpen(false)
    }

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }

    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('touchstart', onPointerDown)
    document.addEventListener('keydown', onKeyDown)

    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('touchstart', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  const navClass = ({ isActive }: { isActive: boolean }) =>
    isActive ? 'text-brand font-semibold' : 'text-gray-600 hover:text-brand'

  const navItemClass = ({ isActive }: { isActive: boolean }) =>
    `${navClass({ isActive })} inline-flex items-center gap-1.5`

  const displayName = user?.full_name || user?.username
  const roleLabel =
    role === 'super_admin' ? 'Super Admin' : role === 'survey_designer' ? 'Survey Designer' : role === 'viewer' ? 'Viewer' : ''

  const isSurveyRoute = location.pathname === '/survey' || location.pathname.startsWith('/survey/')

  return (
    <header className="border-b bg-white">
      <div className="container mx-auto px-4 py-3 flex items-center justify-between">
        <Link to="/" className="text-lg font-bold text-brand" aria-label="EEU Portal">EEU Portal</Link>
        <nav className="flex items-center gap-4 text-sm">
          <NavLink to="/" className={navItemClass}>
            <HomeIcon className="h-4 w-4" />
            <span>{t('nav.home')}</span>
          </NavLink>
          <NavLink to="/survey" className={navItemClass}>
            <ClipboardDocumentCheckIcon className="h-4 w-4" />
            <span>{t('nav.survey')}</span>
          </NavLink>
          {token && (
            <NavLink to="/admin/dashboard" className={navItemClass}>
              <PresentationChartBarIcon className="h-4 w-4" />
              <span>{t('dashboard.title')}</span>
            </NavLink>
          )}
          {!token && (
            <NavLink to="/admin/login" className={navItemClass}>
              <Cog6ToothIcon className="h-4 w-4" />
              <span>{t('nav.admin')}</span>
            </NavLink>
          )}

          {!isSurveyRoute && (
            <button
              aria-label="Toggle language"
              onClick={() => setLang(lang === 'en' ? 'am' : 'en')}
              className="ml-2 px-2 py-1 rounded border text-xs hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand inline-flex items-center gap-1.5"
            >
              <LanguageIcon className="h-4 w-4" />
              <span>{t('nav.toggle_lang')}</span>
            </button>
          )}

          {token && (
            <div ref={userMenuRef} className="relative ml-3">
              <button
                type="button"
                onClick={() => setOpen(o => !o)}
                className="flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs text-gray-700 hover:bg-gray-50"
              >
                <span className="h-6 w-6 rounded-full bg-brand text-white flex items-center justify-center text-[10px] font-semibold">
                  {displayName?.[0]?.toUpperCase() ?? 'A'}
                </span>
                <span className="flex flex-col items-start">
                  <span className="font-semibold text-xs leading-tight max-w-[120px] truncate">{displayName}</span>
                  {roleLabel && (
                    <span
                      className={`mt-0.5 inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${
                        role === 'super_admin'
                          ? 'bg-emerald-100 text-emerald-700'
                          : role === 'survey_designer'
                          ? 'bg-orange-100 text-orange-700'
                          : 'bg-gray-100 text-gray-600'
                      }`}
                    >
                      {roleLabel}
                    </span>
                  )}
                </span>
                <ChevronDownIcon className="h-4 w-4 text-gray-500" />
              </button>
              {open && (
                <div className="absolute right-0 mt-2 w-44 rounded-md border bg-white shadow-lg text-xs z-30">
                  <button
                    type="button"
                    onClick={() => {
                      setOpen(false)
                      navigate('/admin/change-password')
                    }}
                    className="w-full text-left px-3 py-2 hover:bg-gray-50 inline-flex items-center gap-2"
                  >
                    <Cog6ToothIcon className="h-4 w-4 text-gray-600" />
                    {t('change_password.title')}
                  </button>
                  {isSuperAdmin && (
                    <button
                      type="button"
                      onClick={() => {
                        setOpen(false)
                        navigate('/admin/users')
                      }}
                      className="w-full text-left px-3 py-2 hover:bg-gray-50 inline-flex items-center gap-2"
                    >
                      <ShieldCheckIcon className="h-4 w-4 text-gray-600" />
                      {t('users.title')}
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      setOpen(false)
                      logout()
                      navigate('/admin/login')
                    }}
                    className="w-full text-left px-3 py-2 text-red-600 hover:bg-red-50 inline-flex items-center gap-2"
                  >
                    <ArrowRightOnRectangleIcon className="h-4 w-4" />
                    Logout
                  </button>
                </div>
              )}
            </div>
          )}
        </nav>
      </div>
    </header>
  )
}
