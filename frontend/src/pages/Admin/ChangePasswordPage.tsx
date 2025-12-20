import React, { useState } from 'react'
import { changePassword } from '@/api/adminAPI'
import { useI18n } from '@/context/I18nContext'

export default function ChangePasswordPage() {
  const { t } = useI18n()
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSuccess(null)

    if (!currentPassword || !newPassword || !confirmPassword) {
      setError(t('change_password.error.required_fields'))
      return
    }
    if (newPassword !== confirmPassword) {
      setError(t('change_password.error.mismatch'))
      return
    }

    // Minimal strength checks (mirrors backend): length and basic complexity
    if (newPassword.length < 8) {
      setError(t('change_password.error.too_short'))
      return
    }
    if (newPassword.match(/^\d+$/) || newPassword.match(/^[A-Za-z]+$/)) {
      setError(t('change_password.error.weak'))
      return
    }

    setLoading(true)
    try {
      const res = await changePassword(currentPassword, newPassword)
      const backendMsg: string | undefined = res.detail

      // Map known backend messages to localized variants when possible
      if (backendMsg === 'Current password is incorrect') {
        setError(t('change_password.error.current_incorrect'))
        setLoading(false)
        return
      }
      if (backendMsg === 'New password must be at least 8 characters long.') {
        setError(t('change_password.error.too_short'))
        setLoading(false)
        return
      }
      if (backendMsg === 'New password must contain both letters and numbers.') {
        setError(t('change_password.error.weak'))
        setLoading(false)
        return
      }

      setSuccess(backendMsg || t('change_password.success'))
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
    } catch (e: any) {
      const detail = e?.response?.data?.detail || e?.message
      if (detail === 'Current password is incorrect') {
        setError(t('change_password.error.current_incorrect'))
      } else if (detail === 'New password must be at least 8 characters long.') {
        setError(t('change_password.error.too_short'))
      } else if (detail === 'New password must contain both letters and numbers.') {
        setError(t('change_password.error.weak'))
      } else if (typeof detail === 'string' && detail.length > 0) {
        setError(detail)
      } else {
        setError(t('change_password.error.generic'))
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-md mx-auto space-y-4">
      <h2 className="text-2xl font-semibold">{t('change_password.title')}</h2>
      <p className="text-sm text-gray-600">{t('change_password.subtitle')}</p>

      {error && <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">{error}</div>}
      {success && <div className="text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded px-3 py-2">{success}</div>}

      <form onSubmit={onSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">{t('change_password.current')}</label>
          <input
            type="password"
            value={currentPassword}
            onChange={e => setCurrentPassword(e.target.value)}
            className="w-full border rounded px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">{t('change_password.new')}</label>
          <input
            type="password"
            value={newPassword}
            onChange={e => setNewPassword(e.target.value)}
            className="w-full border rounded px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">{t('change_password.confirm')}</label>
          <input
            type="password"
            value={confirmPassword}
            onChange={e => setConfirmPassword(e.target.value)}
            className="w-full border rounded px-3 py-2 text-sm"
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="px-4 py-2 rounded-md text-sm font-semibold text-white"
          style={{ backgroundColor: '#006400' }}
        >
          {loading ? t('change_password.changing') : t('change_password.submit')}
        </button>
      </form>
    </div>
  )
}
