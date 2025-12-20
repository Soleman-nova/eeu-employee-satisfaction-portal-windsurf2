import React, { useEffect, useMemo, useState } from 'react'
import {
  AdminRole,
  AdminUser,
  createAdminUser,
  deleteAdminUser,
  listAdminUsers,
  resetAdminUserPassword,
  updateAdminUser,
} from '@/api/adminAPI'
import { useAuth } from '@/context/AuthContext'
import { useI18n } from '@/context/I18nContext'

export default function UserManagementPage() {
  const { user: currentUser } = useAuth()
  const { t } = useI18n()
  const [users, setUsers] = useState<AdminUser[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [creating, setCreating] = useState(false)
  const [newUsername, setNewUsername] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [newRole, setNewRole] = useState<AdminRole>('viewer')

  const [editingId, setEditingId] = useState<number | null>(null)
  const [editUsername, setEditUsername] = useState('')
  const [editRole, setEditRole] = useState<AdminRole>('viewer')

  const [resetId, setResetId] = useState<number | null>(null)
  const [resetPassword, setResetPassword] = useState('')

  const isSelf = useMemo(
    () => (id: number) => (currentUser ? currentUser.id === id : false),
    [currentUser],
  )

  const loadUsers = async () =>
    {
      setLoading(true)
      setError(null)
      try {
        const res = await listAdminUsers()
        setUsers(res.results)
      } catch (e: any) {
        const detail = e?.response?.data?.detail || e?.message || t('users.error.load_failed')
        setError(detail)
      } finally {
        setLoading(false)
      }
    }

  useEffect(() => {
    loadUsers()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    if (!newUsername || !newPassword) {
      setError(t('users.error.required_user_pass'))
      return
    }
    try {
      await createAdminUser({ username: newUsername, password: newPassword, role: newRole })
      setNewUsername('')
      setNewPassword('')
      setNewRole('viewer')
      setCreating(false)
      await loadUsers()
    } catch (e: any) {
      const detail = e?.response?.data?.detail || e?.message || t('users.error.create_failed')
      setError(detail)
    }
  }

  const startEdit = (u: AdminUser) => {
    setEditingId(u.id)
    setEditUsername(u.username)
    setEditRole(u.role)
  }

  const handleEditSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (editingId == null) return
    setError(null)
    try {
      await updateAdminUser(editingId, { username: editUsername, role: editRole })
      setEditingId(null)
      await loadUsers()
    } catch (e: any) {
      const detail = e?.response?.data?.detail || e?.message || t('users.error.update_failed')
      setError(detail)
    }
  }

  const handleDelete = async (id: number) => {
    if (isSelf(id)) {
      setError(t('users.error.self_delete'))
      return
    }
    if (!window.confirm(t('users.confirm.delete'))) return
    setError(null)
    try {
      await deleteAdminUser(id)
      await loadUsers()
    } catch (e: any) {
      const detail = e?.response?.data?.detail || e?.message || t('users.error.delete_failed')
      setError(detail)
    }
  }

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault()
    if (resetId == null) return
    setError(null)
    if (!resetPassword) {
      setError(t('users.error.required_new_password'))
      return
    }
    try {
      await resetAdminUserPassword(resetId, resetPassword)
      setResetPassword('')
      setResetId(null)
    } catch (e: any) {
      const detail = e?.response?.data?.detail || e?.message || t('users.error.reset_failed')
      setError(detail)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-semibold">{t('users.title')}</h2>
        <button
          type="button"
          onClick={() => setCreating(v => !v)}
          className="px-3 py-1 rounded text-sm font-medium text-white"
          style={{ backgroundColor: '#006400' }}
        >
          {creating ? t('users.cancel') : t('users.new_user')}
        </button>
      </div>

      {error && (
        <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">{error}</div>
      )}

      {creating && (
        <form onSubmit={handleCreate} className="space-y-3 border rounded p-4 bg-white">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className="block text-sm font-medium mb-1">{t('users.username')}</label>
              <input
                className="w-full border rounded px-2 py-1 text-sm"
                value={newUsername}
                onChange={e => setNewUsername(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">{t('users.password')}</label>
              <input
                type="password"
                className="w-full border rounded px-2 py-1 text-sm"
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">{t('users.role')}</label>
              <select
                className="w-full border rounded px-2 py-1 text-sm"
                value={newRole}
                onChange={e => setNewRole(e.target.value as AdminRole)}
              >
                <option value="super_admin">Super Admin</option>
                <option value="survey_designer">Survey Designer</option>
                <option value="viewer">Viewer</option>
              </select>
            </div>
          </div>
          <div className="flex justify-end">
            <button
              type="submit"
              className="px-3 py-1 rounded text-sm font-medium text-white"
              style={{ backgroundColor: '#006400' }}
            >
              {t('users.create_user')}
            </button>
          </div>
        </form>
      )}

      <div className="border rounded bg-white overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-3 py-2 text-left font-medium text-gray-700">{t('users.id')}</th>
              <th className="px-3 py-2 text-left font-medium text-gray-700">{t('users.username')}</th>
              <th className="px-3 py-2 text-left font-medium text-gray-700">{t('users.role')}</th>
              <th className="px-3 py-2 text-left font-medium text-gray-700">{t('users.actions')}</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td className="px-3 py-3 text-center text-gray-500" colSpan={4}>
                  {t('users.loading')}
                </td>
              </tr>
            ) : users.length === 0 ? (
              <tr>
                <td className="px-3 py-3 text-center text-gray-500" colSpan={4}>
                  {t('users.empty')}
                </td>
              </tr>
            ) : (
              users.map(u => (
                <tr key={u.id} className="border-t">
                  <td className="px-3 py-2 align-middle">{u.id}</td>
                  <td className="px-3 py-2 align-middle">
                    {editingId === u.id ? (
                      <input
                        className="w-full border rounded px-2 py-1 text-sm"
                        value={editUsername}
                        onChange={e => setEditUsername(e.target.value)}
                      />
                    ) : (
                      u.username
                    )}
                  </td>
                  <td className="px-3 py-2 align-middle">
                    {editingId === u.id ? (
                      <select
                        className="w-full border rounded px-2 py-1 text-sm"
                        value={editRole}
                        onChange={e => setEditRole(e.target.value as AdminRole)}
                      >
                        <option value="super_admin">Super Admin</option>
                        <option value="survey_designer">Survey Designer</option>
                        <option value="viewer">Viewer</option>
                      </select>
                    ) : (
                      <span className="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-700">
                        {u.role}
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2 align-middle space-x-2">
                    {editingId === u.id ? (
                      <>
                        <button
                          type="button"
                          onClick={handleEditSave}
                          className="px-2 py-1 text-xs rounded bg-emerald-600 text-white"
                        >
                          Save
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingId(null)}
                          className="px-2 py-1 text-xs rounded bg-gray-200 text-gray-800"
                        >
                          {t('users.cancel')}
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          type="button"
                          onClick={() => startEdit(u)}
                          className="px-2 py-1 text-xs rounded bg-gray-200 text-gray-800"
                        >
                          {t('users.edit')}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setResetId(u.id)
                            setResetPassword('')
                          }}
                          className="px-2 py-1 text-xs rounded bg-blue-600 text-white"
                        >
                          {t('users.reset_password')}
                        </button>
                        {!isSelf(u.id) && (
                          <button
                            type="button"
                            onClick={() => handleDelete(u.id)}
                            className="px-2 py-1 text-xs rounded bg-red-600 text-white"
                          >
                            {t('users.delete')}
                          </button>
                        )}
                      </>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {resetId !== null && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-30">
          <div className="bg-white rounded shadow-lg p-4 w-full max-w-sm space-y-3">
            <h3 className="text-lg font-semibold">{t('users.reset_modal_title')}</h3>
            <form onSubmit={handleResetPassword} className="space-y-3">
              <div>
                <label className="block text-sm font-medium mb-1">{t('users.reset_modal_new_password')}</label>
                <input
                  type="password"
                  className="w-full border rounded px-2 py-1 text-sm"
                  value={resetPassword}
                  onChange={e => setResetPassword(e.target.value)}
                />
              </div>
              <div className="flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => {
                    setResetId(null)
                    setResetPassword('')
                  }}
                  className="px-3 py-1 rounded text-sm bg-gray-200 text-gray-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-3 py-1 rounded text-sm text-white"
                  style={{ backgroundColor: '#006400' }}
                >
                  {t('users.reset_modal_reset')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
