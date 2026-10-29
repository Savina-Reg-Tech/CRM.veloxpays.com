import { matchPath } from 'react-router-dom'
import type { UserRole } from '@/types'

// ─────────────────────────────────────────────────────────────────────────────
// Which roles may open which page. Router.tsx's <RoleGuard>s read their roles from
// ROUTE_ROLES, and canAccess() answers the same question for UI that links to pages
// (Quick Guide, welcome tour). routeAccess.test.ts keeps this map, the router and the
// pre-refactor baseline (routeRoles.baseline.json) identical.
// ─────────────────────────────────────────────────────────────────────────────

export const ROUTE_ROLES = {
  /** Super admin / admin only: CRM admin pages, Form Builder, VeloxVerse admin. */
  admin: ['super_admin', 'admin'],
  /** VeloxVerse customer-journey audit log (read-only). Support staff get these and nothing else on VeloxVerse. */
  auditRead: ['super_admin', 'admin', 'support'],
  /** User management for creator roles. */
  staffManagement: ['super_admin', 'admin', 'employee'],
  /** Customers and approvals: every role except support. */
  customers: ['super_admin', 'admin', 'employee', 'agent', 'affiliate'],
  /** Verification dashboard / My Profile for users who must complete KYC. */
  selfVerification: ['employee', 'agent', 'affiliate'],
} as const satisfies Record<string, readonly UserRole[]>

/** Every role-guarded route path (as written in Router.tsx), grouped by who may open it. */
const GUARDED_PATHS: Record<keyof typeof ROUTE_ROLES, readonly string[]> = {
  admin: [
    '/dashboard/admin',
    '/dashboard/settings',
    '/dashboard/verification-review',
    '/dashboard/forms',
    '/dashboard/forms/builder/:id',
    '/dashboard/forms/submissions/:id',
    '/dashboard/forms/analytics/:id',
    '/dashboard/forms/leads',
    '/dashboard/forms/spam',
    '/dashboard/forms/blocked-domains',
    '/dashboard/veloxverse/analytics',
    '/dashboard/veloxverse/esim-orders',
    '/dashboard/veloxverse/esim-orders/:orderNo',
    '/dashboard/veloxverse/lounge',
    '/dashboard/veloxverse/lounge-bookings/:visitId',
    '/dashboard/veloxverse/transfers',
    '/dashboard/veloxverse/pickdrop/emails',
    '/dashboard/veloxverse/pickdrop/emails/unmatched',
    '/dashboard/veloxverse/pickdrop/emails/history',
    '/dashboard/veloxverse/pickdrop/emails/inbox',
    '/dashboard/veloxverse/pickdrop/emails/drafts/:id',
    '/dashboard/veloxverse/settings/email-templates',
    '/dashboard/veloxverse/settings/email-templates/:key',
    '/dashboard/veloxverse/country-availability',
    '/dashboard/veloxverse/promo-codes',
    '/dashboard/veloxverse/promo-codes/:id',
    '/dashboard/veloxverse/pricing',
    '/dashboard/veloxverse/payments',
    '/dashboard/veloxverse/refunds',
    '/dashboard/veloxverse/reconciliation',
    '/dashboard/veloxverse/system-health',
    '/dashboard/veloxverse/users',
    '/dashboard/veloxverse/users/:id',
    '/dashboard/veloxverse/support',
    '/dashboard/veloxverse/support/:ticketId',
    '/dashboard/veloxverse/points',
    '/dashboard/veloxverse/refer-earn',
    '/dashboard/veloxverse/refer-earn/:id',
    '/dashboard/veloxverse/club',
    '/dashboard/veloxverse/audit-logs/settings',
  ],
  auditRead: [
    '/dashboard/veloxverse/audit-logs',
    '/dashboard/veloxverse/audit-logs/api',
    '/dashboard/veloxverse/audit-logs/api/timeline',
    '/dashboard/veloxverse/audit-logs/api-health',
    '/dashboard/veloxverse/audit-logs/trace/:requestId',
    '/dashboard/veloxverse/audit-logs/journeys/:journeyId',
    '/dashboard/veloxverse/audit-logs/customers/:userId',
    '/dashboard/veloxverse/audit-logs/guests/:anonId',
    '/dashboard/veloxverse/audit-logs/bookings/:referenceType/:referenceId',
    '/dashboard/veloxverse/audit-logs/stuck',
    '/dashboard/veloxverse/audit-logs/errors',
    '/dashboard/veloxverse/audit-logs/trends',
    '/dashboard/veloxverse/audit-logs/alerts',
  ],
  staffManagement: [
    '/dashboard/employees',
  ],
  customers: [
    '/dashboard/customers',
    '/dashboard/approvals',
  ],
  selfVerification: [
    '/dashboard/verification',
    '/dashboard/me',
  ],
}

/** Route path → roles allowed on it. Paths without an entry have no RoleGuard. */
export const ROUTE_ACCESS: Readonly<Record<string, readonly UserRole[]>> = Object.fromEntries(
  (Object.keys(GUARDED_PATHS) as (keyof typeof ROUTE_ROLES)[]).flatMap((group) =>
    GUARDED_PATHS[group].map((path) => [path, ROUTE_ROLES[group]] as const),
  ),
)

/**
 * Can `role` open `to` (a pathname, optionally with ?query / #hash)? Only role-guarded pages
 * count: an unknown or unguarded path returns false, so callers never link somewhere the
 * router would bounce them from.
 */
export function canAccess(role: UserRole | undefined | null, to: string): boolean {
  if (!role) return false
  const pathname = to.split(/[?#]/)[0]
  for (const [pattern, roles] of Object.entries(ROUTE_ACCESS)) {
    if (matchPath(pattern, pathname)) return roles.includes(role)
  }
  return false
}
