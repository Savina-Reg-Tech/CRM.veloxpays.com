import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuthStore } from '@/store/authStore'
import { roleRequiresVerification } from '@/config/verificationDocs'

const VERIFICATION_PATH = '/dashboard/verification'

/**
 * Per spec: verification-role users (employee/agent/affiliate) can log in
 * immediately but are confined to the Verification Dashboard until their
 * account is activated. Admins / super-admins are never gated.
 */
export default function VerificationGate() {
  const user = useAuthStore((s) => s.user)
  const location = useLocation()

  const gated =
    !!user &&
    roleRequiresVerification(user.role) &&
    user.account_status !== 'active'

  if (gated && !location.pathname.startsWith(VERIFICATION_PATH)) {
    return <Navigate to={VERIFICATION_PATH} replace />
  }

  return <Outlet />
}
