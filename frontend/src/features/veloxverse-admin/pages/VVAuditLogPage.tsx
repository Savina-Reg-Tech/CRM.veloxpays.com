import { useMemo, useState, type FormEvent, type ReactNode } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { AlertOctagon, Download, Search, X } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import Spinner from '@/components/ui/Spinner'
import { useToast } from '@/app/providers/ToastProvider'
import { useVVAuditEvents, useVVAuditExport, useVVAuditMeta } from '../hooks/useVVAudit'
import { vvAuditService } from '../vvAdminService'
import {
  auditErrorText,
  routeSearch,
  type AuditSearchTarget,
  eventTypeLabel,
  fromLocalInput,
  humanize,
  lastHours,
  serviceLabel,
  supplierLabel,
  toLocalInput,
  stepLabel,
  REFUND_ATTENTION_STEPS,
} from '../audit'
import type { AuditEventFilters } from '../auditTypes'
import {
  AuditEmpty,
  AuditErrorState,
  AuditPageShell,
  DebouncedInput,
  MaskedNote,
  MultiSelect,
  selectClass,
  useAuditViewer,
  useCustomerHref,
} from '../components/audit/AuditUI'
import { EventTable } from '../components/audit/EventTable'
import { EventDrawer } from '../components/audit/EventDrawer'
import { apiTimelineHref } from '../components/vv-audit/ApiBits'
import { BottomSheet } from '../components/vv-audit/BottomSheet'
import { FiltersButton, OverflowMenu } from '../components/vv-audit/ApiLogFilters'
import { useIsTablet } from '../components/vv-audit/useMediaQuery'

const AUDIT = '/dashboard/veloxverse/audit-logs'
const LIST_KEYS = ['service', 'severity', 'eventType', 'status', 'supplier', 'step'] as const
const TEXT_KEYS = ['email', 'referenceId', 'requestId', 'journeyId', 'userId', 'anonId', 'errorCode'] as const

const RANGES = [
  { key: '1h', label: 'Last hour', hours: 1 },
  { key: '24h', label: 'Last 24 h', hours: 24 },
  { key: '3d', label: 'Last 3 days', hours: 72 },
  { key: 'all', label: 'Everything kept', hours: 0 },
] as const

function splitList(v: string | null): string[] {
  return v ? v.split(',').filter(Boolean) : []
}

export default function VVAuditLogPage() {
  const [params, setParams] = useSearchParams()
  const navigate = useNavigate()
  const { showToast } = useToast()
  const { isAdmin } = useAuditViewer()
  const customerHref = useCustomerHref()
  const meta = useVVAuditMeta()
  const exportMut = useVVAuditExport()
  const [search, setSearch] = useState('')
  const [resolving, setResolving] = useState(false)
  // A UUID can be a journey/event/payment/customer id or an API-log ref — let the user pick.
  const [uuidChoice, setUuidChoice] = useState<string | null>(null)
  const [filtersOpen, setFiltersOpen] = useState(false)
  const isTablet = useIsTablet()
  // Default range is fixed once on mount so the query key doesn't change every render.
  const [defaultRange] = useState(() => lastHours(24))
  const retentionDays = meta.data?.retentionDays ?? 5

  const patch = (next: Record<string, string | undefined>) =>
    setParams(
      (prev) => {
        const p = new URLSearchParams(prev)
        for (const [k, v] of Object.entries(next)) {
          if (v) p.set(k, v)
          else p.delete(k)
        }
        return p
      },
      { replace: true }
    )

  const filters: AuditEventFilters = useMemo(() => {
    const f: AuditEventFilters = {}
    for (const k of LIST_KEYS) {
      const v = splitList(params.get(k))
      if (v.length) f[k] = v
    }
    for (const k of TEXT_KEYS) {
      const v = params.get(k)
      if (v) f[k] = v
    }
    const http = Number(params.get('httpStatus'))
    if (http >= 100 && http <= 599) f.httpStatus = http
    const range = params.get('range')
    if (range === 'all') {
      // no bounds — VeloxVerse only keeps `retentionDays` anyway
    } else if (params.get('from') || params.get('to')) {
      f.from = params.get('from') ?? undefined
      f.to = params.get('to') ?? undefined
    } else {
      f.from = defaultRange.from
      f.to = defaultRange.to
    }
    if (params.get('staff') === '1') f.eventType = [...(f.eventType ?? []), 'admin_access']
    return f
  }, [params, defaultRange])

  const query = useVVAuditEvents(filters)
  const pages = query.data?.pages ?? []
  const events = pages.flatMap((p) => p.events)
  // VeloxVerse only fills `critical` on the first page — keep page 1's value while paging.
  const critical = pages[0]?.critical ?? { count: 0, latest: [] }

  const activeChips: Array<{ key: string; label: string }> = []
  for (const k of LIST_KEYS) {
    for (const v of splitList(params.get(k))) {
      const fmt = k === 'service' ? serviceLabel : k === 'supplier' ? supplierLabel : k === 'eventType' ? eventTypeLabel : k === 'step' ? stepLabel : humanize
      activeChips.push({ key: `${k}:${v}`, label: `${humanize(k)}: ${fmt(v)}` })
    }
  }
  for (const k of [...TEXT_KEYS, 'httpStatus'] as const) {
    const v = params.get(k)
    if (v) activeChips.push({ key: `${k}:`, label: `${humanize(k.replace(/([A-Z])/g, ' $1').toLowerCase())}: ${v}` })
  }
  const removeChip = (key: string) => {
    const [k, v] = key.split(':')
    if (!v) return patch({ [k]: undefined })
    patch({ [k]: splitList(params.get(k)).filter((x) => x !== v).join(',') || undefined })
  }
  const clearAll = () => setParams(new URLSearchParams(), { replace: true })
  const refundAttentionOn =
    [...splitList(params.get('step'))].sort().join(',') === [...REFUND_ATTENTION_STEPS].sort().join(',')

  // ── Global search box (handoff §4.3 + API logs §4.0) ──
  // A UUID can be a journey, an event, a payment or a customer — try each in that order.
  const resolveUuid = async (id: string) => {
    setUuidChoice(null)
    setResolving(true)
    try {
      const journey = await vvAuditService.journey(id).catch(() => null)
      if (journey?.events.length) return navigate(`${AUDIT}/journeys/${id}`)
      const event = await vvAuditService.event(id).catch(() => null)
      if (event) return patch({ event: id })
      const trail = await vvAuditService.bookingTrail('payment', id).catch(() => null)
      if (trail?.events.length) return navigate(`${AUDIT}/bookings/payment/${id}`)
      const timeline = await vvAuditService.timeline('user', id, {}, { limit: 1 }).catch(() => null)
      if (timeline?.events.length) return navigate(customerHref(id))
      patch({ referenceId: id, range: 'all', from: undefined, to: undefined })
    } finally {
      setResolving(false)
    }
  }

  const runAuditSearch = (target: AuditSearchTarget) => {
    switch (target.kind) {
      case 'empty':
        return
      case 'trace':
        return navigate(`${AUDIT}/trace/${target.requestId}`)
      case 'browserCrash':
        return patch({ errorCode: target.errorCode, range: 'all', from: undefined, to: undefined })
      case 'email':
        return patch({ email: target.email })
      case 'reference':
        return patch({ referenceId: target.referenceId, range: 'all', from: undefined, to: undefined })
      case 'uuid':
        return void resolveUuid(target.id)
    }
  }

  const runSearch = (e: FormEvent) => {
    e.preventDefault()
    const target = routeSearch(search)
    setUuidChoice(null)
    switch (target.kind) {
      case 'empty':
        return
      case 'apiRequest':
        return navigate(apiTimelineHref({ requestId: target.requestId }))
      case 'apiRef':
        return navigate(apiTimelineHref({ ref: target.ref }))
      case 'uuid':
        return setUuidChoice(target.id)
      case 'audit':
        return runAuditSearch(target.target)
    }
  }

  const doExport = async () => {
    try {
      const res = await exportMut.mutateAsync(filters)
      showToast({
        type: 'success',
        title: 'Export downloaded',
        message: res.truncated
          ? `Only the newest 10,000 rows were exported — narrow the filters to get the rest. (${res.filename})`
          : `${res.rows.toLocaleString()} rows · ${res.filename}`,
      })
    } catch (err) {
      showToast({ type: 'error', title: 'Export failed', message: auditErrorText(err) })
    }
  }

  const rangeKey = params.get('range') ?? (params.get('from') || params.get('to') ? 'custom' : '24h')
  const minLocal = toLocalInput(new Date(Date.now() - retentionDays * 86_400_000).toISOString())
  const pickRange = (key: string) => {
    if (key === '24h') return patch({ range: undefined, from: undefined, to: undefined })
    if (key === 'all') return patch({ range: 'all', from: undefined, to: undefined })
    if (key === 'custom') return patch({ range: undefined, from: params.get('from') ?? defaultRange.from, to: params.get('to') ?? defaultRange.to })
    const r = RANGES.find((x) => x.key === key)
    if (r) patch({ range: undefined, ...lastHours(r.hours) })
  }

  const dateInputs = (
    <span className="flex min-w-0 flex-wrap items-center gap-1.5 text-xs text-gray-500">
      <input
        type="datetime-local"
        aria-label="From"
        min={minLocal}
        value={toLocalInput(params.get('from') ?? (rangeKey === '24h' ? defaultRange.from : undefined))}
        onChange={(e) => patch({ range: undefined, from: fromLocalInput(e.target.value) })}
        className="h-11 min-w-0 flex-1 rounded-md border border-gray-300 px-2 text-base md:h-8 md:flex-none md:text-xs"
      />
      to
      <input
        type="datetime-local"
        aria-label="To"
        min={minLocal}
        value={toLocalInput(params.get('to') ?? (rangeKey === '24h' ? defaultRange.to : undefined))}
        onChange={(e) => patch({ range: undefined, to: fromLocalInput(e.target.value) })}
        className="h-11 min-w-0 flex-1 rounded-md border border-gray-300 px-2 text-base md:h-8 md:flex-none md:text-xs"
      />
    </span>
  )

  const filterFields: ReactNode = (
    <>
      <div className="grid grid-cols-1 gap-2 md:grid-cols-4 xl:grid-cols-8">
        <MultiSelect label="Service" options={meta.data?.services ?? []} value={splitList(params.get('service'))} onChange={(v) => patch({ service: v.join(',') || undefined })} format={serviceLabel} />
        <MultiSelect label="Severity" options={meta.data?.severities.map((s) => s.value) ?? []} value={splitList(params.get('severity'))} onChange={(v) => patch({ severity: v.join(',') || undefined })} />
        <MultiSelect label="Event type" options={(meta.data?.eventTypes ?? []).filter((t) => t !== 'admin_access')} value={splitList(params.get('eventType'))} onChange={(v) => patch({ eventType: v.join(',') || undefined })} format={eventTypeLabel} />
        <MultiSelect label="Status" options={['success', 'failure', 'warning', 'info']} value={splitList(params.get('status'))} onChange={(v) => patch({ status: v.join(',') || undefined })} />
        <MultiSelect label="Supplier" options={meta.data?.suppliers ?? []} value={splitList(params.get('supplier'))} onChange={(v) => patch({ supplier: v.join(',') || undefined })} format={supplierLabel} />
        <MultiSelect label="Step" options={meta.data?.steps ?? []} value={splitList(params.get('step'))} onChange={(v) => patch({ step: v.join(',') || undefined })} format={stepLabel} searchable />
        <DebouncedInput value={params.get('httpStatus') ?? ''} onChange={(v) => patch({ httpStatus: /^\d{3}$/.test(v) ? v : undefined })} placeholder="HTTP status" type="number" />
        <DebouncedInput value={params.get('errorCode') ?? ''} onChange={(v) => patch({ errorCode: v || undefined })} placeholder="Error code" />
      </div>
      <DebouncedInput value={params.get('email') ?? ''} onChange={(v) => patch({ email: v || undefined })} placeholder="Customer email (exact)" type="email" className="md:max-w-sm" />
    </>
  )

  return (
    <AuditPageShell
      title={
        <span className="flex flex-wrap items-center gap-2">
          VeloxVerse Audit Logs
          {critical.count > 0 && (
            <span className="inline-flex items-center gap-1 rounded-full bg-red-600 px-2.5 py-0.5 text-xs font-semibold text-white">
              <AlertOctagon className="h-3.5 w-3.5" /> {critical.count} critical
            </span>
          )}
        </span>
      }
      subtitle={`What every customer and guest did, and every error they hit. Detailed logs: last ${retentionDays} days.`}
      actions={
        isAdmin && (
          <Button variant="outline" size="sm" onClick={() => void doExport()} loading={exportMut.isPending} className="hidden md:inline-flex">
            <Download className="h-4 w-4" /> Export CSV
          </Button>
        )
      }
    >
      {/* Search + range */}
      <Card padding="sm" className="space-y-3">
        <form onSubmit={runSearch} className="flex flex-col gap-2 sm:flex-row">
          <div className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              value={search}
              onChange={(e) => {
                setSearch(e.target.value)
                setUuidChoice(null)
              }}
              placeholder="Support reference, customer email, journey / payment / event id, order no. (TRF-…, N00131)…"
              aria-label="Search audit log"
              className="h-11 w-full rounded-lg border border-gray-300 bg-white pl-9 pr-3 text-base focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100 sm:h-10 sm:text-sm"
            />
          </div>
          <Button type="submit" loading={resolving} disabled={!search.trim()} className="min-h-11 sm:min-h-10">
            Find
          </Button>
        </form>

        {uuidChoice && (
          <div role="group" aria-label="Where to look" className="flex flex-col gap-2 rounded-lg bg-indigo-50/60 p-3 ring-1 ring-indigo-100 sm:flex-row sm:items-center">
            <p className="min-w-0 flex-1 text-sm text-gray-700">
              <span className="break-all font-mono text-xs text-gray-900">{uuidChoice}</span> — look it up in:
            </p>
            <div className="flex gap-2">
              <Button type="button" variant="outline" className="min-h-11 flex-1 sm:min-h-9 sm:flex-none" loading={resolving} onClick={() => void resolveUuid(uuidChoice)}>
                Journey events
              </Button>
              <Button type="button" variant="outline" className="min-h-11 flex-1 sm:min-h-9 sm:flex-none" onClick={() => navigate(apiTimelineHref({ ref: uuidChoice }))}>
                API timeline
              </Button>
            </div>
          </div>
        )}

        {/* Phones: range select + Filters (sheet) + ⋯ (export). */}
        <div className="flex items-center gap-2 md:hidden">
          <select aria-label="Date range" value={rangeKey} onChange={(e) => pickRange(e.target.value)} className={`${selectClass} h-11 min-w-0 flex-1`}>
            {RANGES.map((r) => (
              <option key={r.key} value={r.key}>{r.label}</option>
            ))}
            <option value="custom">Custom range</option>
          </select>
          <FiltersButton count={activeChips.length} expanded={filtersOpen} onClick={() => setFiltersOpen(true)} />
          {isAdmin && (
            <OverflowMenu
              items={[{ key: 'export', label: <><Download className="h-4 w-4" /> {exportMut.isPending ? 'Exporting…' : 'Export CSV'}</>, onSelect: () => void doExport(), disabled: exportMut.isPending }]}
            />
          )}
        </div>
        {rangeKey === 'custom' && <div className="md:hidden">{dateInputs}</div>}

        <div className="flex flex-wrap items-center gap-2">
          <div className="hidden flex-wrap items-center gap-2 md:flex">
            {RANGES.map((r) => (
              <button
                key={r.key}
                type="button"
                onClick={() => pickRange(r.key)}
                className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                  rangeKey === r.key ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {r.label}
              </button>
            ))}
            {dateInputs}
          </div>
          {/* Saved filter: the steps where money has to be checked by a person. */}
          <button
            type="button"
            onClick={() => patch({ step: refundAttentionOn ? undefined : REFUND_ATTENTION_STEPS.join(',') })}
            aria-pressed={refundAttentionOn}
            title="Failed refunds, charges refunded after checkout closed, and charges for the wrong amount — check these in the Mint portal"
            className={`inline-flex min-h-11 items-center gap-1 rounded-full px-3 py-1 text-xs font-medium transition md:min-h-0 ${
              refundAttentionOn ? 'bg-red-600 text-white' : 'bg-red-50 text-red-700 ring-1 ring-red-200 hover:bg-red-100'
            }`}
          >
            <AlertOctagon className="h-3.5 w-3.5" />
            Refunds needing attention
          </button>
          <label className="inline-flex min-h-11 items-center gap-2 text-xs text-gray-600 md:ml-auto md:min-h-0">
            <input
              type="checkbox"
              checked={params.get('staff') === '1'}
              onChange={(e) => patch({ staff: e.target.checked ? '1' : undefined })}
              className="rounded border-gray-300 text-indigo-600"
            />
            Show staff access
          </label>
        </div>

        {/* Filters: inline from md, bottom sheet on phones. */}
        {isTablet && filterFields}

        {activeChips.length > 0 && (
          <div className="-mx-1 flex flex-nowrap items-center gap-1.5 overflow-x-auto px-1 [scrollbar-width:none] md:flex-wrap md:overflow-visible [&::-webkit-scrollbar]:hidden">
            {activeChips.map((c) => (
              <span key={c.key} className="inline-flex max-w-[80vw] shrink-0 items-center gap-1 rounded-full bg-indigo-50 py-1 pl-2.5 pr-1 text-xs text-indigo-700 ring-1 ring-indigo-100 md:max-w-full md:pr-2.5">
                <span className="min-w-0 truncate md:whitespace-normal md:break-all">{c.label}</span>
                <button
                  type="button"
                  onClick={() => removeChip(c.key)}
                  aria-label={`Remove ${c.label}`}
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full hover:text-indigo-900 md:h-auto md:w-auto"
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
            <button type="button" onClick={clearAll} className="min-h-11 shrink-0 px-1 text-xs text-gray-500 underline hover:text-gray-800 md:min-h-0">Clear all</button>
          </div>
        )}
        <MaskedNote />
      </Card>

      <BottomSheet
        open={filtersOpen && !isTablet}
        onClose={() => setFiltersOpen(false)}
        title="Filters"
        footer={
          <div className="flex gap-2">
            <Button type="button" variant="outline" className="min-h-11 flex-1" onClick={clearAll}>
              Clear all
            </Button>
            <Button type="button" className="min-h-11 flex-1" onClick={() => setFiltersOpen(false)}>
              Apply
            </Button>
          </div>
        }
      >
        <div className="space-y-3">
          <div className="space-y-1">
            <p className="text-xs font-medium text-gray-600">Date range</p>
            {dateInputs}
          </div>
          {filterFields}
        </div>
      </BottomSheet>

      {/* Pinned critical */}
      {critical.latest.length > 0 && (
        <Card padding="none" className="overflow-hidden border-red-200">
          <div className="flex items-center gap-2 border-b border-red-100 bg-red-50 px-4 py-2.5">
            <AlertOctagon className="h-4 w-4 shrink-0 text-red-600" />
            <h2 className="text-sm font-semibold text-red-800">
              Critical — {critical.count} in this range{critical.count > critical.latest.length ? ` (latest ${critical.latest.length})` : ''}
            </h2>
          </div>
          <EventTable events={critical.latest} highlightCritical />
        </Card>
      )}

      <Card padding="none">
        {query.isLoading ? (
          <div className="flex justify-center py-16"><Spinner size="md" label="Loading events…" /></div>
        ) : query.isError ? (
          <AuditErrorState error={query.error} onRetry={() => void query.refetch()} retentionDays={retentionDays} />
        ) : events.length === 0 ? (
          <AuditEmpty
            title="No events in this range"
            text={`Detailed logs older than ${retentionDays} days are deleted — see Daily trends for older data.`}
          />
        ) : (
          <>
            <EventTable events={events} highlightCritical />
            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-gray-100 px-4 py-3 text-xs text-gray-500">
              <span>{events.length.toLocaleString()} events shown</span>
              {query.hasNextPage ? (
                <Button variant="outline" size="sm" onClick={() => void query.fetchNextPage()} loading={query.isFetchingNextPage}>
                  Load more
                </Button>
              ) : (
                <span>End of results</span>
              )}
            </div>
          </>
        )}
      </Card>

      <EventDrawer />
    </AuditPageShell>
  )
}
