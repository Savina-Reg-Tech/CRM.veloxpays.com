import type { BadgeVariant } from '@/components/ui/Badge'
import type { VVUserRole } from './types'

/**
 * Which account controls to SHOW on the VeloxVerse users screens.
 *
 * This is for a clean screen only. VeloxVerse is the authority and refuses anything not allowed:
 * only a super admin can change a role or switch a staff account on/off, nobody can change their
 * own role or status, and the last active super admin can't be demoted or deactivated.
 */
export const VV_STAFF_ROLES: VVUserRole[] = ['SUPER_ADMIN', 'ADMIN', 'SUPPORT']
/** Roles a super admin can assign from the CRM. */
export const VV_ASSIGNABLE_ROLES: VVUserRole[] = ['USER', 'SUPPORT', 'ADMIN', 'SUPER_ADMIN']

export const isVVStaffRole = (role: string | null | undefined): boolean => VV_STAFF_ROLES.includes(role as VVUserRole)

const ROLE_LABEL: Record<string, string> = {
  SUPER_ADMIN: 'Super admin',
  ADMIN: 'Admin',
  SUPPORT: 'Support',
  USER: 'Registered',
  GUEST: 'Guest',
}

export const vvRoleLabel = (role: string | null | undefined): string => (role ? ROLE_LABEL[role] ?? role : '—')

export function vvRoleBadgeVariant(role: string | null | undefined): BadgeVariant {
  if (role === 'SUPER_ADMIN') return 'danger'
  if (role === 'ADMIN' || role === 'SUPPORT') return 'info'
  if (role === 'GUEST') return 'warning'
  return 'neutral'
}

export interface VVUserControls {
  /** The logged-in CRM user's own VeloxVerse account (matched by email). */
  isSelf: boolean
  canChangeRole: boolean
  canToggleStatus: boolean
}

export function vvUserControls(input: {
  crmRole: string | null | undefined
  crmEmail: string | null | undefined
  target: { email?: string | null; role?: string | null }
}): VVUserControls {
  const crmEmail = input.crmEmail?.trim().toLowerCase() ?? ''
  const isSelf = crmEmail !== '' && crmEmail === (input.target.email?.trim().toLowerCase() ?? '')
  const isSuperAdmin = input.crmRole === 'super_admin'
  const isAdmin = input.crmRole === 'admin'
  return {
    isSelf,
    canChangeRole: isSuperAdmin && !isSelf,
    canToggleStatus: !isSelf && (isVVStaffRole(input.target.role) ? isSuperAdmin : isSuperAdmin || isAdmin),
  }
}

export const roleChangeConfirmation = (name: string, from: string, to: string) =>
  `Change ${name}'s role from ${vvRoleLabel(from)} to ${vvRoleLabel(to)}? They will be signed out of VeloxVerse.`

export const deactivateConfirmation = (name: string) => `Deactivate ${name}? They will be signed out of VeloxVerse.`

// ── Account status: Active / Blocked / Inactive ─────────────────────────────

export type VVAccountStatus = 'active' | 'blocked' | 'inactive'

/**
 * "Blocked by an admin" and "inactive" are different things. A guest is also inactive when it
 * was never verified or has been idle for 30 days — and comes back by itself at the next login.
 * A block is recorded separately (`isBlocked` / `blockedAt`) and only an admin can lift it.
 *
 *   isActive  isBlocked
 *   true      false      → Active
 *   false     true       → Blocked   (with the date)
 *   false     false      → Inactive
 *
 * A missing `isBlocked` (older VeloxVerse) counts as false.
 */
export function vvAccountStatus(user: { isActive?: boolean; isBlocked?: boolean; blockedAt?: string | null }): {
  status: VVAccountStatus
  label: string
  variant: BadgeVariant
  /** Hover text — only for Blocked. */
  tooltip?: string
} {
  if (user.isBlocked === true) {
    const date = formatBlockedDate(user.blockedAt)
    return {
      status: 'blocked',
      label: 'Blocked',
      variant: 'danger',
      tooltip: date ? `Blocked on ${date}. Only an admin can unblock.` : 'Blocked. Only an admin can unblock.',
    }
  }
  return user.isActive
    ? { status: 'active', label: 'Active', variant: 'success' }
    : { status: 'inactive', label: 'Inactive', variant: 'neutral' }
}

export function formatBlockedDate(iso: string | null | undefined): string | null {
  if (!iso) return null
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
}

/** The button: Unblock when an admin blocked the account, Block otherwise — including on an
 * Inactive guest, since blocking an idle guest is how an admin stops it coming back. */
export const vvBlockAction = (user: { isBlocked?: boolean }): 'block' | 'unblock' => (user.isBlocked === true ? 'unblock' : 'block')

export const blockConfirmation = (name: string) =>
  `Block ${name}? They will be signed out of VeloxVerse and can't log in again until an admin unblocks them.`
