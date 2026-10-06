import { Link } from 'react-router-dom'
import { ArrowRight, History } from 'lucide-react'
import Spinner from '@/components/ui/Spinner'
import { useVVAuditBookingTrail, useVVAuditEvents, useVVAuditMeta } from '../../hooks/useVVAudit'
import { AuditEmpty, AuditErrorState, CopyId } from './AuditUI'
import { EventTimeline } from './EventTimeline'

const AUDIT = '/dashboard/veloxverse/audit-logs'

/**
 * Compact "Audit trail" for an existing booking page (§7.6): the events about this booking plus
 * every journey they belong to, so the whole checkout → payment → supplier story shows. Pages that
 * render this must also render <EventDrawer /> for row clicks.
 */
export function BookingAuditTrail({ referenceType, referenceId }: { referenceType: string; referenceId: string | null | undefined }) {
  const { data, isLoading, error, refetch } = useVVAuditBookingTrail(referenceType, referenceId)
  const meta = useVVAuditMeta()
  if (!referenceId) return null
  if (isLoading) return <div className="flex justify-center py-6"><Spinner size="sm" label="Loading audit trail…" /></div>
  if (error || !data) return <AuditErrorState error={error} onRetry={() => void refetch()} retentionDays={meta.data?.retentionDays} />
  if (data.events.length === 0) {
    return (
      <AuditEmpty
        icon={History}
        title="No audit events for this booking"
        text={`Detailed logs are kept ${meta.data?.retentionDays ?? 5} days — older bookings have no trail.`}
      />
    )
  }
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-500">
        <span>{data.events.length} events</span>
        {data.journeys.map((j) => (
          <span key={j} className="inline-flex items-center gap-1">
            Journey <CopyId value={j} short to={`${AUDIT}/journeys/${j}`} />
          </span>
        ))}
        <Link
          to={`${AUDIT}/bookings/${encodeURIComponent(referenceType)}/${encodeURIComponent(referenceId)}`}
          className="ml-auto inline-flex items-center gap-1 font-medium text-indigo-600 hover:text-indigo-800"
        >
          Open full trail <ArrowRight className="h-3 w-3" />
        </Link>
      </div>
      <EventTimeline events={data.events} />
    </div>
  )
}

/** Events that mention a reference id (e.g. a support ticket's case id), newest first. */
export function ReferenceEvents({ referenceId }: { referenceId: string | null | undefined }) {
  const query = useVVAuditEvents({ referenceId: referenceId ?? undefined }, { enabled: Boolean(referenceId), limit: 50 })
  const meta = useVVAuditMeta()
  if (!referenceId) return null
  if (query.isLoading) return <div className="flex justify-center py-6"><Spinner size="sm" label="Loading audit trail…" /></div>
  if (query.isError) return <AuditErrorState error={query.error} onRetry={() => void query.refetch()} retentionDays={meta.data?.retentionDays} />
  const events = (query.data?.pages ?? []).flatMap((p) => p.events)
  if (!events.length) {
    return <AuditEmpty icon={History} title="No audit events" text={`Detailed logs are kept ${meta.data?.retentionDays ?? 5} days.`} />
  }
  return <EventTimeline events={[...events].reverse()} />
}
