import axios from 'axios'
import { useAuthStore } from '@/store/authStore'
import { API_BASE_URL } from '@/lib/apiConfig'
import { BRIDGE_REJECTED_CODE, useBridgeStatusStore } from '@/store/bridgeStatusStore'

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: { 'Content-Type': 'application/json' },
  // Send / receive the httpOnly auth cookie on every request.
  withCredentials: true,
})

// Request / response logging is for local development only — in production it would put every
// URL and error body (customer data included) in the browser console.
const DEBUG = import.meta.env.DEV

api.interceptors.request.use((config) => {
  if (DEBUG) {
    const method = (config.method ?? 'get').toUpperCase()
    console.info(`[API] ${method} ${config.baseURL ?? ''}${config.url ?? ''} -> pending`)
  }
  return config
})

// Global response handler:
//   • Success: log status
//   • 401 anywhere except /auth/login or /auth/me: clear in-memory user and
//     bounce to /login. /auth/me intentionally tolerates 401 because it is
//     also used as a "is my session still valid?" probe on app mount.
api.interceptors.response.use(
  (res) => {
    if (DEBUG) {
      const method = (res.config.method ?? 'get').toUpperCase()
      console.info(`[API] ${method} ${res.config.url ?? ''} -> ${res.status}`)
    }
    // VeloxVerse answered through the bridge — the connection is fine (again).
    if ((res.config.url ?? '').includes('/vv-admin')) useBridgeStatusStore.getState().clear()
    return res
  },
  (error) => {
    const status = error.response?.status ?? 'NETWORK_ERROR'
    const method = (error.config?.method ?? 'get').toUpperCase()
    const url: string = error.config?.url ?? ''
    if (DEBUG) console.error(`[API] ${method} ${url} -> ${status}`, error.response?.data ?? error.message)

    // VeloxVerse refused the CRM's own connection (after the backend re-signed and retried once).
    // Not this user's fault and not something retrying fixes — say so on screen.
    if (error.response?.status === 502 && error.response?.data?.code === BRIDGE_REJECTED_CODE) {
      useBridgeStatusStore
        .getState()
        .setRejected(error.response.data.message || 'VeloxVerse rejected the CRM connection — contact the administrator')
    }

    const isLoginRequest = typeof url === 'string' && url.includes('/auth/login')
    const isMeRequest = typeof url === 'string' && url.includes('/auth/me')

    // A 401 always means the CRM session itself is gone — including on /vv-admin: the CRM
    // checks its own session before proxying, and reports anything VeloxVerse rejects as a 502
    // (see backend veloxverseProxy.js), never as a 401. So VeloxVerse pages are not exempt:
    // exempting them left an expired session looking like empty tables instead of the login page.
    if (error.response?.status === 401 && !isLoginRequest && !isMeRequest) {
      useAuthStore.getState().clearAuth()
      if (typeof window !== 'undefined' && window.location.pathname !== '/login') {
        window.location.href = '/login'
      }
    }
    return Promise.reject(error)
  }
)

export default api
