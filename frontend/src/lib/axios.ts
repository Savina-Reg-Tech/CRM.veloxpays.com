import axios from 'axios'
import { useAuthStore } from '@/store/authStore'
import { API_BASE_URL } from '@/lib/apiConfig'

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: { 'Content-Type': 'application/json' },
  // Send / receive the httpOnly auth cookie on every request.
  withCredentials: true,
})

// Request logger — purely for dev observability.
api.interceptors.request.use((config) => {
  const method = (config.method ?? 'get').toUpperCase()
  console.info(`[API] ${method} ${config.baseURL ?? ''}${config.url ?? ''} -> pending`)
  return config
})

// Global response handler:
//   • Success: log status
//   • 401 anywhere except /auth/login or /auth/me: clear in-memory user and
//     bounce to /login. /auth/me intentionally tolerates 401 because it is
//     also used as a "is my session still valid?" probe on app mount.
api.interceptors.response.use(
  (res) => {
    const method = (res.config.method ?? 'get').toUpperCase()
    console.info(`[API] ${method} ${res.config.url ?? ''} -> ${res.status}`)
    return res
  },
  (error) => {
    const status = error.response?.status ?? 'NETWORK_ERROR'
    const method = (error.config?.method ?? 'get').toUpperCase()
    const url: string = error.config?.url ?? ''
    console.error(`[API] ${method} ${url} -> ${status}`, error.response?.data ?? error.message)

    const isLoginRequest = typeof url === 'string' && url.includes('/auth/login')
    const isMeRequest = typeof url === 'string' && url.includes('/auth/me')
    const isVvAdminRequest = typeof url === 'string' && url.includes('/vv-admin')

    // VeloxVerse proxy errors must not clear the CRM session — only real CRM
    // auth failures (/auth/* and other CRM routes) should bounce to /login.
    if (error.response?.status === 401 && !isLoginRequest && !isMeRequest && !isVvAdminRequest) {
      useAuthStore.getState().clearAuth()
      if (typeof window !== 'undefined' && window.location.pathname !== '/login') {
        window.location.href = '/login'
      }
    }
    return Promise.reject(error)
  }
)

export default api
