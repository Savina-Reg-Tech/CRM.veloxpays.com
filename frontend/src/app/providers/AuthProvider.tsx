import { useEffect, useRef, type ReactNode } from 'react'
import { useAuthStore } from '@/store/authStore'
import { authService } from '@/features/auth/authService'

/**
 * AuthProvider re-validates the persisted session on every full app load.
 *
 * - If the store has a hydrated user but the httpOnly cookie has expired
 *   or was revoked, GET /auth/me returns 401 → we clear the local user so
 *   ProtectedRoute bounces to /login.
 * - If the cookie is still valid we refresh the in-memory user profile
 *   with the latest server-side copy (catches role / name changes made
 *   from another browser).
 * - Network errors are intentionally left alone: a transient outage
 *   should not log a user out.
 */
interface Props {
  children: ReactNode
}

export default function AuthProvider({ children }: Props) {
  const user = useAuthStore((s) => s.user)
  const setUser = useAuthStore((s) => s.setUser)
  const clearAuth = useAuthStore((s) => s.clearAuth)
  const hasValidatedRef = useRef(false)

  useEffect(() => {
    if (hasValidatedRef.current) return
    if (!user) return
    hasValidatedRef.current = true

    let cancelled = false
    authService
      .getMe()
      .then((fresh) => {
        if (!cancelled) setUser(fresh)
      })
      .catch((err) => {
        if (cancelled) return
        const status = (err as { response?: { status?: number } })?.response?.status
        if (status === 401) {
          clearAuth()
        }
        // any other error (network, 5xx) → leave the user signed in; the
        // next real API call will reveal the truth via the global 401 handler.
      })
    return () => {
      cancelled = true
    }
  }, [user, setUser, clearAuth])

  return <>{children}</>
}
