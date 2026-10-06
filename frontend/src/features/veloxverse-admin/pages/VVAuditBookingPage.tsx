import { Link, useParams } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { humanize } from '../audit'
import { AuditPageShell, CopyId, MaskedNote } from '../components/audit/AuditUI'
import { BookingAuditTrail } from '../components/audit/BookingAuditTrail'
import { EventDrawer } from '../components/audit/EventDrawer'

/** A booking's / payment's full audit trail (GET /bookings/:referenceType/:referenceId). */
export default function VVAuditBookingPage() {
  const { referenceType, referenceId } = useParams<{ referenceType: string; referenceId: string }>()
  return (
    <AuditPageShell
      title={`${humanize(referenceType)} audit trail`}
      subtitle={<CopyId value={referenceId} />}
      tabs={false}
      actions={
        <Link to="/dashboard/veloxverse/audit-logs" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-900">
          <ArrowLeft className="h-4 w-4" /> Audit logs
        </Link>
      }
    >
      <Card className="space-y-3">
        <MaskedNote />
        {referenceType && <BookingAuditTrail referenceType={referenceType} referenceId={referenceId} />}
      </Card>
      <EventDrawer />
    </AuditPageShell>
  )
}
