import type { UserRole } from '@/types'

// ─────────────────────────────────────────────────────────────────────────────
// Single source of truth for role-driven UI behaviour.
//
// Before this file existed, adding a new role meant touching:
//   - DashboardRedirect.tsx        (where does the user land?)
//   - Router.tsx                   (which routes can they hit?)
//   - sidebarConfig.ts             (which nav items show up?)
//   - CreateEmployeeModal.tsx      (which roles can they create?)
//
// Now: add the role to `UserRole`, then add one entry per map below.
// Route guards in Router.tsx still live with the routes (they're a *route*
// concern, not a *role* concern), but everything else funnels through here.
// ─────────────────────────────────────────────────────────────────────────────

/** Canonical, ordered list of all roles. */
export const ALL_ROLES: readonly UserRole[] = [
  'super_admin',
  'admin',
  'employee',
  'agent',
  'affiliate',
] as const

/**
 * Default landing route per role. Used by `<DashboardRedirect />` when a
 * user hits `/dashboard` directly.
 */
export const ROLE_HOMES: Record<UserRole, string> = {
  super_admin: '/dashboard/admin',
  admin: '/dashboard/admin',
  employee: '/dashboard/me',
  agent: '/dashboard/me',
  affiliate: '/dashboard/me',
}

/**
 * For each role, the list of roles they're allowed to create. Empty array
 * means "no creation permission". Used by `<CreateEmployeeModal />` to
 * populate the role dropdown and by the backend `userService.createUser`
 * which holds the authoritative copy of these rules.
 */
export const ROLE_CREATION_RIGHTS: Record<UserRole, UserRole[]> = {
  super_admin: ['super_admin', 'admin', 'employee', 'agent', 'affiliate'],
  admin: ['employee', 'agent', 'affiliate'],
  employee: ['agent', 'affiliate'],
  agent: [],
  affiliate: [],
}

/** Super Admin / Admin see org-wide approval queues (matches backend approvalRbac). */
export const APPROVAL_MODERATOR_ROLES: readonly UserRole[] = ['super_admin', 'admin'] as const

export function canViewApprovalQueues(role: UserRole | undefined | null): boolean {
  return !!role && APPROVAL_MODERATOR_ROLES.includes(role)
}

/** Velox eSIM platform customers (matches backend VELOX_ESIM_VIEW_ROLES). */
export const VELOX_ESIM_VIEW_ROLES: readonly UserRole[] = ['super_admin', 'admin'] as const

export function canViewVeloxEsim(role: UserRole | undefined | null): boolean {
  return !!role && VELOX_ESIM_VIEW_ROLES.includes(role)
}

/** VeloxVerse platform customers (users + guests) — same roles as VV admin. */
export const VELOXVERSE_VIEW_ROLES: readonly UserRole[] = ['super_admin', 'admin'] as const

export function canViewVeloxVerse(role: UserRole | undefined | null): boolean {
  return !!role && VELOXVERSE_VIEW_ROLES.includes(role)
}

/** Convenience helper used in a few render paths. */
export function getRoleHome(role: UserRole | undefined | null): string {
  if (!role) return '/login'
  return ROLE_HOMES[role] ?? '/login'
}
