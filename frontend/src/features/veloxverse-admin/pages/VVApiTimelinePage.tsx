// API timeline (handoff §4.3): the whole story behind one ref (booking / payment / supplier id),
// request id or journey id — every API call, supplier call, webhook and journey event, oldest
// first. Everything lives in the URL (?ref= | ?requestId= | ?journeyId=, &from=&to=), so deep
// links work cold. With no from/to VeloxVerse returns the whole retention window.
import { useEffect, useState, type FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { AlertTriangle, ArrowLeft, ChevronDown, Search } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import Spinner from '@/components/ui/Spinner'
import { cn } from '@/lib/utils'
import { fromLocalInput, routeSearch, toLocalInput } from '../audit'
import type { ApiTimelineParams, ApiTimelineResponse } from '../auditTypes'
import { useApiLogTimeline, useVVAuditMeta } from '../hooks/useVVAudit'
import { AuditEmpty, AuditErrorState, AuditPageShell, CustomerCell, MaskedNote, selectClass } from '../components/audit/AuditUI'
import { EventDrawer } from '../components/audit/EventDrawer'
import { ApiLogDrawer } from '../components/vv-audit/ApiLogDrawer'
import { ApiTimeline } from '../components/vv-audit/ApiTimeline'
import { API_LOGS_PATH, CopyButton, apiTimelineHref } from '../components/vv-audit/ApiBits'

type Target = { kind: 'ref' | 'requestId' | 'journeyId'; value: string }

/** Exactly one target goes to VeloxVerse (ref wins, then request, then journey). */
function readTarget(params: URLSearchParams): Target | null {
  for (const kind of ['ref', 'requestId', 'journeyId'] as const) {
    const v = params.get(kind)?.trim()
    if (v) return { kind, value: v }
  }
  return null
}

const TARGET_NOUN: Record<Target['kind'], string> = { ref: '', requestId: 'request ', journeyId: 'journey ' }

function Counts({ counts }: { counts: ApiTimelineResponse['counts'] }) {
  const tile = 'flex min-w-0 flex-col rounded-lg border border-gray-200 bg-white px-3 py-2'
  return (
    <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
      <div className={tile}>
        <span className="text-lg font-semibold tabular-nums text-gray-900">{counts.apiLogs.toLocaleString()}</span>
        <span className="text-xs text-gray-500">API calls</span>
      </div>
      <div className={tile}>
        <span className="text-lg font-semibold tabular-nums text-gray-900">{counts.auditEvents.toLocaleString()}</span>
        <span className="text-xs text-gray-500">journey events</span>
      </div>
      <div className={cn(tile, counts.failures > 0 && 'border-red-200 bg-red-50')}>
        <span className={cn('text-lg font-semibold tabular-nums', counts.failures > 0 ? 'text-red-800' : 'text-gray-900')}>
          {counts.failures.toLocaleString()}
        </span>
        <span className={cn('text-xs', counts.failures > 0 ? 'text-red-800' : 'text-gray-500')}>failures</span>
      </div>
      <div className={cn(tile, counts.needsAttention > 0 && 'border-violet-300 bg-violet-50')}>
        <span className={cn('flex items-center gap-1 text-lg font-semibold tabular-nums', counts.needsAttention > 0 ? 'text-violet-800' : 'text-gray-900')}>
          {counts.needsAttention > 0 && <AlertTriangle className="h-4 w-4" aria-hidden="true" />}
          {counts.needsAttention.toLocaleString()}
        </span>
        <span className={cn('text-xs', counts.needsAttention > 0 ? 'font-semibold text-violet-800' : 'text-gray-500')}>
          {counts.needsAttention === 1 ? 'needs attention' : 'need attention'}
        </span>
      </div>
    </div>
  )
}

/** "Requests in this story: N" — copyable ids, each linking to its own request timeline. */
function Requests({ ids, current }: { ids: string[]; current: Target }) {
  const many = ids.length > 3
  const [open, setOpen] = useState(!many)
  if (!ids.length) return null
  return (
    <div className="min-w-0">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        disabled={!many}
        className="inline-flex min-h-11 items-center gap-1.5 text-sm font-medium text-gray-700 enabled:hover:text-gray-900 disabled:cursor-default"
      >
        Requests in this story: {ids.length}
        {many && <ChevronDown className={cn('h-4 w-4 text-gray-400 motion-safe:transition-transform', open && 'rotate-180')} aria-hidden="true" />}
      </button>
      {open && (
        <ul className="flex flex-wrap gap-x-3 gap-y-0">
          {ids.map((id) => (
            <li key={id} className="flex min-w-0 max-w-full items-center">
              {current.kind === 'requestId' && current.value === id ? (
                <span className="break-all font-mono text-xs text-gray-900">{id}</span>
              ) : (
                <Link to={apiTimelineHref({ requestId: id })} className="break-all font-mono text-xs text-indigo-600 hover:text-indigo-800" title={`Timeline for request ${id}`}>
                  {id}
                </Link>
              )}
              <CopyButton value={id} what="Request id" />
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function DateRange({ from, to, onApply }: { from?: string; to?: string; onApply: (from?: string, to?: string) => void }) {
  const [draftFrom, setDraftFrom] = useState(toLocalInput(from))
  const [draftTo, setDraftTo] = useState(toLocalInput(to))
  useEffect(() => setDraftFrom(toLocalInput(from)), [from])
  useEffect(() => setDraftTo(toLocalInput(to)), [to])
  const changed = draftFrom !== toLocalInput(from) || draftTo !== toLocalInput(to)
  return (
    <form
      className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-end"
      onSubmit={(e) => {
        e.preventDefault()
        onApply(fromLocalInput(draftFrom), fromLocalInput(draftTo))
      }}
    >
      <label className="flex min-w-0 flex-col gap-1 text-xs text-gray-500 sm:w-56">
        From
        <input type="datetime-local" value={draftFrom} onChange={(e) => setDraftFrom(e.target.value)} className={cn(selectClass, 'h-11 sm:h-10')} />
      </label>
      <label className="flex min-w-0 flex-col gap-1 text-xs text-gray-500 sm:w-56">
        To
        <input type="datetime-local" value={draftTo} onChange={(e) => setDraftTo(e.target.value)} className={cn(selectClass, 'h-11 sm:h-10')} />
      </label>
      <div className="flex gap-2">
        <Button type="submit" variant="outline" disabled={!changed} className="min-h-11 flex-1 sm:min-h-10 sm:flex-none">
          Apply
        </Button>
        {(from || to) && (
          <Button type="button" variant="ghost" onClick={() => onApply(undefined, undefined)} className="min-h-11 flex-1 sm:min-h-10 sm:flex-none">
            Whole retention
          </Button>
        )}
      </div>
    </form>
  )
}

/** No target yet: explain what can be traced and offer a search box. */
function PickTarget() {
  const [, setParams] = useSearchParams()
  const [q, setQ] = useState('')
  const submit = (e: FormEvent) => {
    e.preventDefault()
    const value = q.trim().replace(/^ref(erence)?:\s*/i, '')
    if (!value) return
    const t = routeSearch(value)
    setParams(t.kind === 'apiRequest' ? { requestId: t.requestId } : { ref: value })
  }
  return (
    <Card>
      <AuditEmpty
        title="What should we trace?"
        text="Enter a booking or order number (LNG-…, TRF-…), a visit or payment id, a DragonPass order id, a Mint purchase or refund reference, or a request id (the “Ref:” a customer quotes). The timeline shows every API call, supplier call, webhook and journey event behind it."
      />
      <form onSubmit={submit} className="mx-auto flex max-w-xl flex-col gap-2 pb-6 sm:flex-row">
        <label className="sr-only" htmlFor="api-timeline-search">Reference to trace</label>
        <input
          id="api-timeline-search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Booking no., payment id, DragonPass order, Mint ref, request id…"
          className={cn(selectClass, 'h-11 flex-1')}
        />
        <Button type="submit" disabled={!q.trim()} className="min-h-11">
          <Search className="h-4 w-4" /> Show timeline
        </Button>
      </form>
    </Card>
  )
}

export default function VVApiTimelinePage() {
  const [params, setParams] = useSearchParams()
  const target = readTarget(params)
  const from = params.get('from') || undefined
  const to = params.get('to') || undefined
  const query: ApiTimelineParams = target ? { [target.kind]: target.value, from, to } : {}
  const { data, isLoading, isFetching, error, refetch } = useApiLogTimeline(query)
  const meta = useVVAuditMeta()
  const retentionDays = meta.data?.apiLogs?.retentionDays ?? 7

  const setRange = (nextFrom?: string, nextTo?: string) =>
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        if (nextFrom) next.set('from', nextFrom)
        else next.delete('from')
        if (nextTo) next.set('to', nextTo)
        else next.delete('to')
        return next
      },
      { replace: true }
    )

  const back = (
    <Link to={API_LOGS_PATH} className="inline-flex min-h-11 items-center gap-1 text-sm text-gray-500 hover:text-gray-900">
      <ArrowLeft className="h-4 w-4" /> API Logs
    </Link>
  )

  if (!target) {
    return (
      <AuditPageShell title="API timeline" subtitle="Every request, supplier call and webhook behind a booking, payment or request." actions={back} tabs={false}>
        <PickTarget />
        <ApiLogDrawer />
        <EventDrawer />
      </AuditPageShell>
    )
  }

  return (
    <AuditPageShell
      title={
        <span>
          Timeline for {TARGET_NOUN[target.kind]}
          <span className="break-all font-mono text-lg">{target.value}</span>
        </span>
      }
      subtitle="Oldest first. Tap a call for its details, or a journey event for the audit record."
      actions={back}
      tabs={false}
    >
      <Card className="space-y-4">
        <MaskedNote />
        {data?.customer && (
          <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-sm">
            <span className="text-gray-500">Customer</span>
            <span className="min-w-0 max-w-full">
              <CustomerCell customer={data.customer} />
            </span>
          </div>
        )}
        {data && <Counts counts={data.counts} />}
        <DateRange from={from} to={to} onApply={setRange} />
        {!from && !to && <p className="text-xs text-gray-500">Showing the whole retention window (the last {retentionDays} days).</p>}
        {data && <Requests ids={data.requests} current={target} />}
        {data?.truncated && (
          <p role="status" className="flex items-start gap-2 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900 ring-1 ring-amber-200">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            Showing the first 1,000 calls — narrow the date range.
          </p>
        )}
      </Card>

      <Card padding="sm" className="relative min-w-0">
        {isFetching && !isLoading && (
          <span className="absolute right-3 top-3 text-xs text-gray-400" aria-live="polite">Updating…</span>
        )}
        {isLoading ? (
          <div className="flex justify-center py-16"><Spinner size="md" label="Loading timeline…" /></div>
        ) : error || !data ? (
          <AuditErrorState error={error} onRetry={() => void refetch()} retentionDays={retentionDays} />
        ) : data.items.length === 0 ? (
          <AuditEmpty
            title="Nothing found"
            text={
              from || to
                ? `Nothing found for '${target.value}' in this date range. Try the whole retention window.`
                : `Nothing found for '${target.value}' in the last ${retentionDays} days — logs older than that are deleted.`
            }
          />
        ) : (
          <ApiTimeline data={data} />
        )}
      </Card>

      <ApiLogDrawer />
      <EventDrawer />
    </AuditPageShell>
  )
}
