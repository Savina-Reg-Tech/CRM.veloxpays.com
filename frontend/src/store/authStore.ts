import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { User } from '@/types'

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
 */
export interface AuthState {
  user: User | null
  setUser: (user: User | null) => void
  clearAuth: () => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      setUser: (user) => set({ user }),
      clearAuth: () => set({ user: null }),
    }),
    { name: 'crm-auth' }
  )
)
