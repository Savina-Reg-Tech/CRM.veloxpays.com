import { Navigate } from 'react-router-dom'
import { useAuthStore } from '@/store/authStore'
import { getRoleHome } from '@/config/roles'
import { roleRequiresVerification } from '@/config/verificationDocs'

export default function DashboardRedirect() {
  const user = useAuthStore((s) => s.user)

  // Unverified verification-role users go straight to the Verification Dashboard.
  if (user && roleRequiresVerification(user.role) && user.account_status !== 'active') {
    return <Navigate to="/dashboard/verification" replace />
  }

  return <Navigate to={getRoleHome(user?.role)} replace />
}
