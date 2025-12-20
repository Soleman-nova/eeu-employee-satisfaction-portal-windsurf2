import React, { useState } from 'react'
import { useAuth } from '@/context/AuthContext'
import { useNavigate } from 'react-router-dom'
import { useI18n } from '@/context/I18nContext'

export default function LoginPage() {
  const { login, loading } = useAuth()
  const navigate = useNavigate()
  const { t } = useI18n()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      await login(username, password)
      navigate('/admin/dashboard', { replace: true })
    } catch (e: any) {
      setError(e?.message || 'Login failed')
    }
  }

  return (
    <div className="relative eeu-dark min-h-[calc(100vh-64px)] overflow-hidden">
      <div className="absolute inset-0 grid-overlay"></div>

      <div className="steam"></div>
      <div className="steam delay"></div>
      <div className="steam delay2"></div>

      <div className="relative mx-auto max-w-6xl px-6 pt-16 pb-10">
        <div className="flex flex-col items-center text-center space-y-6">
          <h1 className="text-2xl md:text-3xl lg:text-4xl font-extrabold tracking-wide text-white" style={{textShadow: '0 0 6px rgba(255,215,0,0.45)'}}>
            {t('login.title')}
          </h1>
          <p className="text-sm text-[#FFD166]">{t('login.subtitle')}</p>
        </div>

        <div className="mt-10 mx-auto max-w-xl">
          <div className="glass-card neon-border pulse rounded-2xl p-6 md:p-8">
            {error && <div className="mb-4 text-red-400 text-sm">{error}</div>}

            <form onSubmit={onSubmit} className="space-y-6">
              <div className="float-label">
                <input
                  id="admin-id"
                  placeholder=" "
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  aria-label={t('login.username')}
                  className="w-full bg-transparent border-b border-cyan-400/40 text-white placeholder-transparent px-3 pt-5 pb-2 focus:border-cyan-300 focus:outline-none focus:ring-2 focus:ring-cyan-300 underline-glow"
                />
                <label htmlFor="admin-id">
                  {t('login.username')}
                </label>
              </div>

              <div className="float-label relative">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder=" "
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  aria-label={t('login.password')}
                  className="w-full bg-transparent border-b border-cyan-400/40 text-white placeholder-transparent px-3 pt-5 pb-2 focus:border-cyan-300 focus:outline-none focus:ring-2 focus:ring-cyan-300 underline-glow"
                />
                <label htmlFor="password">
                  {t('login.password')}
                </label>
                <button
                  type="button"
                  aria-label="Toggle password visibility"
                  onClick={() => setShowPassword(v => !v)}
                  className="absolute right-2 top-3.5 p-2 text-cyan-200/80 hover:text-cyan-100"
                >
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M1.5 12s3.5-7 10.5-7 10.5 7 10.5 7-3.5 7-10.5 7S1.5 12 1.5 12Z" stroke="#00D1FF" strokeWidth="1.5"/>
                    {showPassword ? (
                      <circle cx="12" cy="12" r="3.25" fill="#00D1FF"/>
                    ) : (
                      <circle cx="12" cy="12" r="2.25" stroke="#00D1FF" strokeWidth="1.5"/>
                    )}
                  </svg>
                </button>
              </div>

              <div className="flex items-center justify-between text-xs">
                <span className="text-[rgba(229,246,255,.7)]">{t('login.secure')}</span>
                <a href="#" className="text-[#FFD166] hover:underline">{t('login.forgot')}</a>
              </div>

              <button
                disabled={loading}
                className="relative w-full rounded-full py-3 font-semibold tracking-widest text-[#0A1F3D] bg-[#00D1FF] hover:bg-[#4DE6FF] transition-colors shadow-[0_0_25px_rgba(0,209,255,.4)] overflow-hidden focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-cyan-300"
              >
                <span className="relative z-10">{loading ? t('login.authenticating') : t('login.submit')}</span>
                <span className="absolute inset-0 opacity-0 hover:opacity-100 transition-opacity" style={{background: 'radial-gradient(600px 200px at 50% -60%, rgba(255,255,255,.25), rgba(0,0,0,0))'}}></span>
              </button>
            </form>
          </div>

          <div className="flex items-center justify-center gap-3 mt-8 text-[rgba(229,246,255,.8)]">
            <img src="/eeu_logo.png" alt="EEU logo" className="w-15 h-15 md:w-32 md:h-20 drop-shadow-sm" />
            <span className="text-xs">© 2025 Ethiopian Electric Utility</span>
          </div>
        </div>
      </div>
    </div>
  )
}
