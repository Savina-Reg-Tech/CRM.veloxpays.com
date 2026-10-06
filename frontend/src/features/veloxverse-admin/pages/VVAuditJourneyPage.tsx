import { Link, useParams } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import Spinner from '@/components/ui/Spinner'
import { cn } from '@/lib/utils'
import { useVVAuditJourney, useVVAuditMeta } from '../hooks/useVVAudit'
import { formatDurationMs, outcomeMeta, serviceLabel } from '../audit'
import {
  AuditEmpty,
  AuditErrorState,
  AuditPageShell,
  AuditTime,
  CopyId,
  CustomerCell,
  Field,
  MaskedNote,
} from '../components/audit/AuditUI'
import { EventTimeline } from '../components/audit/EventTimeline'
import { EventDrawer } from '../components/audit/EventDrawer'

const AUDIT = '/dashboard/veloxverse/audit-logs'

export function OutcomeBadge({ outcome, className }: { outcome: string; className?: string }) {
  const m = outcomeMeta(outcome)
  return <span className={cn('inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset', m.className, className)}>{m.label}</span>
}

/** One booking attempt end-to-end: search → checkout → payment → supplier → result (§7.4). */
export default function VVAuditJourneyPage() {
  const { journeyId } = useParams<{ journeyId: string }>()
  const { data, isLoading, error, refetch } = useVVAuditJourney(journeyId)
  const meta = useVVAuditMeta()
  const retentionDays = meta.data?.retentionDays ?? 5

  return (
    <AuditPageShell
      title={<span className="flex flex-wrap items-center gap-2">Journey {data && <OutcomeBadge outcome={data.outcome} />}</span>}
      subtitle={<CopyId value={journeyId} />}
      tabs={false}
      actions={
        <Link to={AUDIT} className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-900">
          <ArrowLeft className="h-4 w-4" /> Audit logs
        </Link>
      }
    >
      {isLoading ? (
        <div className="flex justify-center py-16"><Spinner size="md" label="Loading journey…" /></div>
      ) : error || !data ? (
        <Card><AuditErrorState error={error} onRetry={() => void refetch()} retentionDays={retentionDays} /></Card>
      ) : data.events.length === 0 ? (
        <Card><AuditEmpty title="No events for this journey" text={`Detailed logs are kept ${retentionDays} days — this journey is older, or the id is wrong.`} /></Card>
      ) : (
        <>
          <Card className="space-y-4">
            <MaskedNote />
            <div className="grid grid-cols-2 gap-x-6 gap-y-3 md:grid-cols-4">
              <Field label="Customer"><CustomerCell customer={data.customer} anonId={data.events.find((e) => e.anonId)?.anonId} /></Field>
              <Field label="Services">{data.services.map(serviceLabel).join(', ')}</Field>
              <Field label="Outcome"><OutcomeBadge outcome={data.outcome} /></Field>
              <Field label="Errors"><span className={data.errors ? 'font-semibold text-red-600' : 'text-emerald-600'}>{data.errors}</span></Field>
              <Field label="Started"><AuditTime iso={data.startedAt} /></Field>
              <Field label="Ended"><AuditTime iso={data.endedAt} /></Field>
              <Field label="Duration">{formatDurationMs(data.durationMs)}</Field>
              <Field label="Events">{data.events.length}</Field>
            </div>
            {data.payments.length > 0 && (
              <div>
                <p className="text-[11px] uppercase tracking-wide text-gray-400">Payments</p>
                <ul className="mt-1 flex flex-wrap gap-x-4 gap-y-1">
                  {data.payments.map((p) => (
                    <li key={p}><CopyId value={p} to={`${AUDIT}/bookings/payment/${p}`} /></li>
                  ))}
                </ul>
              </div>
            )}
          </Card>
          <Card>
            <h2 className="mb-3 text-sm font-semibold text-gray-900">Timeline</h2>
            <EventTimeline events={data.events} groupByPhase />
          </Card>
        </>
      )}
      <EventDrawer />
    </AuditPageShell>
  )
}
