import { Link, useParams } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { AuditPageShell } from '../components/audit/AuditUI'
import { CustomerActivity } from '../components/audit/CustomerActivity'
import { EventDrawer } from '../components/audit/EventDrawer'

/** Anonymous guest browsing, by browser id. Once the guest logs in, these rows move to their
 * customer timeline (step `history_linked`). */
export default function VVAuditGuestPage() {
  const { anonId } = useParams<{ anonId: string }>()
  return (
    <AuditPageShell
      title="Guest activity"
      subtitle="Anonymous browsing from one browser, before (or without) logging in."
      tabs={false}
      actions={
        <Link to="/dashboard/veloxverse/audit-logs" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-900">
          <ArrowLeft className="h-4 w-4" /> Audit logs
        </Link>
      }
    >
      <Card><CustomerActivity kind="guest" id={anonId} /></Card>
      <EventDrawer />
    </AuditPageShell>
  )
}
