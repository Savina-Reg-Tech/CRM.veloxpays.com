import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { User } from '@/types'
import { queryClient } from '@/lib/queryClient'

/**
 * Auth state for the SPA.
 *
 * The actual session token now lives in an httpOnly cookie set by the
 * backend on login (see authController.AUTH_COOKIE_NAME). JavaScript can
 * neither read nor write that cookie, so the token is no longer exposed
 * to XSS attacks. We only persist the user *profile* here so that the
 * UI can render the right chrome (name, role, sidebar) on hard reload
 * without an extra round-trip; AuthProvider re-validates the session via
 * GET /api/auth/me on mount and clears the user if the cookie has expired.
 *
 * Ending a session also empties the react-query cache (see clearAuth).
 */
export interface AuthState {
  user: User | null
  setUser: (user: User | null) => void
  clearAuth: () => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      setUser: (user) => {
        // A different person signing in on this browser must not see the previous one's
        // cached data. (Refreshing the SAME user's profile, e.g. /auth/me on load, keeps it.)
        const previous = get().user
        if (previous && previous.id !== user?.id) queryClient.clear()
        set({ user })
      },
      // Every way a session ends goes through here — Sign out, an expired session (the 401
      // handler in lib/axios.ts), a failed /auth/me — so this is where cached data is dropped.
      clearAuth: () => {
        queryClient.clear()
        set({ user: null })
      },
    }),
    { name: 'crm-auth' }
  )
)
