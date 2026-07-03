import { Navigate, Outlet } from 'react-router-dom'
import { useAuthStore } from '@/store/authStore'
import type { UserRole } from '@/types'

interface Props {
  allowedRoles: UserRole[]
}

export default function RoleGuard({ allowedRoles }: Props) {
  const role = useAuthStore((s) => s.user?.role)
  return role && allowedRoles.includes(role) ? (
    <Outlet />
  ) : (
    <Navigate to="/dashboard" replace />
  )
}
