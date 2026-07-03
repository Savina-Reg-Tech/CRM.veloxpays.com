import type { BadgeVariant } from '@/components/ui/Badge'
import type { ActivityDirection, ActivityType } from './types'

/**
 * Maps a status string (any service) to a CRM Badge variant.
 * Shared across all VeloxVerse admin pages.
 */
export function statusBadgeVariant(status: string): BadgeVariant {
  const s = status.toUpperCase()
  if (['ACTIVE', 'COMPLETED', 'PUBLISHED', 'RESOLVED'].includes(s)) return 'success'
  if (['PENDING', 'DRAFT', 'OPEN', 'CONFIRMED'].includes(s)) return 'warning'
  if (['CANCELLED', 'FAILED', 'ARCHIVED', 'CLOSED', 'EXPIRED', 'REFUNDED'].includes(s)) return 'danger'
  if (['IN_PROGRESS', 'APPROVED', 'SUSPENDED'].includes(s)) return 'info'
  return 'neutral'
}

/** Format a dollar float (e.g. analytics revenue, eSIM cost) as $X.XX */
export function formatUsd(value: number): string {
  return `$${(value ?? 0).toFixed(2)}`
}

/** Badge colors for recent-activity type labels (independent of amount sign). */
export const ACTIVITY_TYPE_BADGE_CLASS: Record<ActivityType, string> = {
  ESIM: 'bg-blue-50 text-blue-700 ring-blue-200',
  LOUNGE: 'bg-violet-50 text-violet-700 ring-violet-200',
  BENEFIT: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  TRANSFER: 'bg-amber-50 text-amber-700 ring-amber-200',
  REFUND: 'bg-red-50 text-red-700 ring-red-200',
}

/** Resolve credit/debit from API `direction`, with fallback for older payloads. */
export function activityDirection(item: {
  direction?: ActivityDirection
  type: ActivityType
}): ActivityDirection {
  return item.direction ?? (item.type === 'REFUND' ? 'debit' : 'credit')
}

/** Format a recent-activity amount with +/- sign from direction only. */
export function formatActivityAmount(amountUsd: number, direction: ActivityDirection): string {
  const sign = direction === 'credit' ? '+' : '−'
  return `${sign}$${(amountUsd ?? 0).toFixed(2)}`
}

/** Format integer cents (e.g. lounge cost, transfer amount) as $X.XX */
export function formatCents(cents: number): string {
  return `$${((cents ?? 0) / 100).toFixed(2)}`
}

/** Format an ISO date string to a readable local date/time. */
export function formatDate(iso?: string): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (isNaN(d.getTime())) return iso
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
}

/** Format an ISO date string to a readable local date + time. */
export function formatDateTime(iso?: string): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (isNaN(d.getTime())) return iso
  return d.toLocaleString(undefined, {
    year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

/** Relative time label — "2m ago", "3h ago", "5d ago", etc. */
export function timeAgo(iso?: string): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (isNaN(d.getTime())) return iso
  const secs = Math.max(0, Math.floor((Date.now() - d.getTime()) / 1000))
  if (secs < 60) return 'just now'
  const mins = Math.floor(secs / 60)
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  if (days < 30) return `${days}d ago`
  return formatDate(iso)
}

/** Extract 1-2 letter initials from a name string. */
export function getInitials(name?: string | null): string {
  if (!name) return '?'
  const parts = name.trim().split(/\s+/)
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
  return (parts[0][0] ?? '?').toUpperCase()
}
