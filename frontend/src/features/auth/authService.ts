import api from '@/lib/axios'
import type { ApiResponse, AuthResponse, User } from '@/types'

export const authService = {
  /**
   * Sign in with email + password. On success the backend sets the auth
   * cookie; only the user profile is returned in the body.
   */
  login: async (email: string, password: string): Promise<AuthResponse> => {
    const res = await api.post<ApiResponse<AuthResponse>>('/auth/login', {
      email,
      password,
    })
    return res.data.data
  },

  /**
   * Tell the backend to clear the auth cookie. Always resolves — even a
   * network error shouldn't block local logout.
   */
  logout: async (): Promise<void> => {
    try {
      await api.post('/auth/logout')
    } catch {
      // Intentionally swallowed: the user wants out either way.
    }
  },

  /**
   * Probe whether the session cookie is still valid; returns the user
   * profile if it is, throws (typically 401) if it isn't.
   */
  getMe: async (): Promise<User> => {
    const res = await api.get<ApiResponse<User>>('/auth/me')
    return res.data.data
  },
}
