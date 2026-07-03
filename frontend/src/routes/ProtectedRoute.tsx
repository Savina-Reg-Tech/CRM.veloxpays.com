import { Navigate, Outlet } from 'react-router-dom'
import { useAuthStore } from '@/store/authStore'

/**
 * Gate every authenticated route on the presence of a hydrated user profile.
 * The session cookie itself is httpOnly and invisible to JS — AuthProvider
 * is responsible for confirming the cookie is still valid via /auth/me on
 * mount and clearing the user if it isn't.
 */
export default function ProtectedRoute() {
  const user = useAuthStore((s) => s.user)
  return user ? <Outlet /> : <Navigate to="/login" replace />
}
