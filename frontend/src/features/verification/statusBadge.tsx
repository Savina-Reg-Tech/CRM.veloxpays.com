import Badge, { type BadgeVariant } from '@/components/ui/Badge'
import type { DocumentStatus, VerificationStatus } from '@/types'

const DOC_STATUS: Record<DocumentStatus | 'not_uploaded', { variant: BadgeVariant; label: string }> = {
  not_uploaded: { variant: 'neutral', label: 'Not uploaded' },
  pending: { variant: 'warning', label: 'Pending' },
  in_review: { variant: 'info', label: 'Under Review' },
  approved: { variant: 'success', label: 'Approved' },
  rejected: { variant: 'danger', label: 'Rejected' },
}

const VERIFICATION_STATUS: Record<VerificationStatus, { variant: BadgeVariant; label: string }> = {
  pending: { variant: 'warning', label: 'Pending' },
  under_review: { variant: 'info', label: 'Under Review' },
  approved: { variant: 'success', label: 'Approved' },
  rejected: { variant: 'danger', label: 'Rejected' },
  activated: { variant: 'success', label: 'Activated' },
  suspended: { variant: 'neutral', label: 'Suspended' },
  expired: { variant: 'danger', label: 'Expired' },
}

export function DocStatusBadge({ status }: { status: DocumentStatus | 'not_uploaded' }) {
  const s = DOC_STATUS[status] ?? DOC_STATUS.not_uploaded
  return <Badge variant={s.variant} dot>{s.label}</Badge>
}

export function VerificationStatusBadge({ status }: { status: VerificationStatus }) {
  const s = VERIFICATION_STATUS[status] ?? VERIFICATION_STATUS.pending
  return <Badge variant={s.variant} dot>{s.label}</Badge>
}
