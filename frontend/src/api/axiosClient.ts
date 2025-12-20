import axios from 'axios'

const baseURL = import.meta.env.VITE_API_BASE_URL?.replace(/\/$/, '') || 'http://localhost:8000'

const axiosClient = axios.create({
  baseURL,
  withCredentials: false,
  headers: { 'Content-Type': 'application/json' }
})

let refreshInFlight: Promise<string> | null = null

async function refreshAccessToken(): Promise<string> {
  if (refreshInFlight) return refreshInFlight

  const refresh = localStorage.getItem('eeu_admin_refresh_token')
  if (!refresh) throw new Error('Missing refresh token')

  refreshInFlight = (async () => {
    const res = await axios.post(
      `${baseURL}/api/admin/token/refresh/`,
      { refresh },
      { headers: { 'Content-Type': 'application/json' } },
    )
    const nextAccess = res.data?.access as string | undefined
    if (!nextAccess) throw new Error('Refresh did not return access token')
    localStorage.setItem('eeu_admin_token', nextAccess)
    return nextAccess
  })()

  try {
    return await refreshInFlight
  } finally {
    refreshInFlight = null
  }
}

axiosClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('eeu_admin_token')
  if (token) {
    // set both property and index form for maximum compatibility
    (config.headers as any).Authorization = `Bearer ${token}`
    ;(config.headers as any)['Authorization'] = `Bearer ${token}`
  }
  return config
})

axiosClient.interceptors.response.use(
  (resp) => resp,
  async (error) => {
    const status = error?.response?.status
    const originalRequest = error?.config

    if (status === 401 && originalRequest && !originalRequest.__isRetryRequest) {
      try {
        const nextAccess = await refreshAccessToken()
        originalRequest.__isRetryRequest = true
        originalRequest.headers = originalRequest.headers || {}
        originalRequest.headers.Authorization = `Bearer ${nextAccess}`
        originalRequest.headers['Authorization'] = `Bearer ${nextAccess}`
        return axiosClient.request(originalRequest)
      } catch {
        // fall through to logout/redirect below
      }
    }

    if (status === 401) {
      // clear token and redirect to login
      try {
        localStorage.removeItem('eeu_admin_token')
        localStorage.removeItem('eeu_admin_refresh_token')
      } catch {}
      if (typeof window !== 'undefined') {
        const current = window.location.pathname + window.location.search
        if (!current.includes('/admin/login')) {
          window.location.replace('/admin/login')
        }
      }
    }

    return Promise.reject(error)
  }
)

export default axiosClient
