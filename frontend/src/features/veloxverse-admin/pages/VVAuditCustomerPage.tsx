import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, ExternalLink } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { useVVAuditTimeline } from '../hooks/useVVAudit'
import { AuditPageShell, CopyId, GuestBadge, useAuditViewer } from '../components/audit/AuditUI'
import { CustomerActivity } from '../components/audit/CustomerActivity'
import { EventDrawer } from '../components/audit/EventDrawer'

/**
 * A customer's audit timeline on its own page. Support staff land here (they can't open the
 * full VV User page — that reads admin-only VeloxVerse endpoints); admins get a link through to
 * the full customer profile as well.
 */
export default function VVAuditCustomerPage() {
  const { userId } = useParams<{ userId: string }>()
  const { isAdmin } = useAuditViewer()
  // Shares its cache with <CustomerActivity /> below (same key) — only used for the header.
  const timeline = useVVAuditTimeline('user', userId, {})
  const customer = timeline.data?.pages[0]?.customer ?? null

  return (
    <AuditPageShell
      title={
        <span className="flex flex-wrap items-center gap-2">
          {customer?.email ?? customer?.name ?? 'Customer activity'}
          {customer?.role === 'GUEST' && <GuestBadge />}
        </span>
      }
      subtitle={
        <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
          {customer?.name && <span>{customer.name}</span>}
          <CopyId value={userId} />
        </span>
      }
      tabs={false}
      actions={
        <>
          {isAdmin && userId && (
            <Link to={`/dashboard/veloxverse/users/${userId}`} className="inline-flex items-center gap-1 text-sm font-medium text-indigo-600 hover:text-indigo-800">
              Full customer profile <ExternalLink className="h-3.5 w-3.5" />
            </Link>
          )}
          <Link to="/dashboard/veloxverse/audit-logs" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-900">
            <ArrowLeft className="h-4 w-4" /> Audit logs
          </Link>
        </>
      }
    >
      <Card><CustomerActivity kind="user" id={userId} /></Card>
      <EventDrawer />
    </AuditPageShell>
  )
}
