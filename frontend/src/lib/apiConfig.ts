const DEFAULT_API_URL = 'http://localhost:5001/api'

/**
 * CRM backend API base URL.
 * Set VITE_API_URL at Vite build time (Docker build-arg / CI env).
 * Do not use VITE_API_BASE_URL — it is not wired into the Docker build.
 */
export const API_BASE_URL =
  (import.meta.env.VITE_API_URL as string | undefined)?.trim() || DEFAULT_API_URL

/** Public form endpoints (no auth) — e.g. /embed/:id and form submissions */
export const PUBLIC_API_BASE_URL = API_BASE_URL.replace(/\/api\/?$/, '/public')
