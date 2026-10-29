import { ROLE_HOMES } from '@/config/roles'
import { roleRequiresVerification } from '@/config/verificationDocs'
import type { User, UserRole } from '@/types'

/** Bump after a redesign to offer the tour again to everyone whose saved version is older. */
export const CURRENT_TOUR_VERSION = 1

/**
 * Which roles get the welcome tour automatically (on their home page). Everyone can still
 * replay it from the Quick Guide. Agent / affiliate: off until the client confirms.
 */
export const AUTO_TOUR_ROLES: Record<UserRole, boolean> = {
  super_admin: true,
  admin: true,
  employee: true,
  support: true,
  agent: false,
  affiliate: false,
}

type TourFields = Pick<User, 'role' | 'account_status' | 'tour_status' | 'tour_version'>

/**
 * Should the tour start by itself? `me` must be the fresh GET /auth/me copy (the persisted
 * profile can be stale). Never for staff marked 'not_offered', never while an account still owes
 * verification, and only on the user's own home page.
 */
export function shouldOfferTour(me: TourFields | null | undefined, pathname: string): boolean {
  if (!me || !AUTO_TOUR_ROLES[me.role]) return false
  if (roleRequiresVerification(me.role) && me.account_status !== 'active') return false
  if (pathname !== ROLE_HOMES[me.role]) return false
  if (me.tour_status === undefined) return false // not from /auth/me — don't guess
  if (me.tour_status === null) return true
  if (me.tour_status === 'not_offered') return false
  return (me.tour_version ?? 0) < CURRENT_TOUR_VERSION
}
