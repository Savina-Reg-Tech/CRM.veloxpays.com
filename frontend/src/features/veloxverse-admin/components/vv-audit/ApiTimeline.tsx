// The API timeline (handoff §4.3 / §5.7): one vertical, oldest-first story of every API call and
// journey event behind a booking, request or journey — day separators, "80 min later" gap markers
// and one card per request. Lists carry no bodies; API-log items open the ?log=<id> drawer and
// journey events the existing ?event=<id> drawer, so the host page mounts <ApiLogDrawer /> and
// <EventDrawer /> exactly once.
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { AlertTriangle, ArrowRight, ChevronDown, History as HistoryIcon, MoreHorizontal } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import Spinner from '@/components/ui/Spinner'
import { cn } from '@/lib/utils'
import {
  SEVERITY_COLOUR,
  apiCallText,
  formatAuditTime,
  formatClockTime,
  groupTimeline,
  humanize,
  stepLabel,
  utcTitle,
  type ApiTimelineGroup,
} from '../../audit'
import type { ApiLogSummary, ApiTimelineAuditEvent, ApiTimelineItem, ApiTimelineResponse, Severity } from '../../auditTypes'
import { useApiLogTimeline, useVVAuditMeta } from '../../hooks/useVVAudit'
import { useOpenEvent } from '../audit/EventTable'
import { AuditEmpty, AuditErrorState } from '../audit/AuditUI'
import { DirectionIcon, DurationText, FlagIcons, OutcomeBadge, StatusCodeBadge, apiTimelineHref, useOpenApiLog } from './ApiBits'

/** Items rendered before "Show more" (§7.5). */
export const TIMELINE_PAGE_SIZE = 200
/** A request group with more items than this starts collapsed (§7.9)… */
export const GROUP_COLLAPSE_OVER = 20
/** …showing this many before "N more calls — expand". */
const GROUP_COLLAPSED_SHOW = 10

export const UNKNOWN_HINT = 'Outcome unknown — check before retrying'
const TIMEOUT_HINT = 'No answer in time — this was a read, safe to retry'

// Static class sets: the full layout from md, or (compact, booking pages with side columns) the
// phone layout up to lg. Tailwind needs whole class names, so both sets are spelled out.
const LAYOUT = {
  full: {
    row: 'md:grid md:grid-cols-[88px_minmax(0,1fr)]',
    timeCol: 'hidden md:block',
    timeInCard: 'md:hidden',
    rail: 'pl-3 md:pl-4',
    nest: 'pl-3 md:pl-6',
  },
  compact: {
    row: 'lg:grid lg:grid-cols-[88px_minmax(0,1fr)]',
    timeCol: 'hidden lg:block',
    timeInCard: 'lg:hidden',
    rail: 'pl-3 lg:pl-4',
    nest: 'pl-3 lg:pl-6',
  },
} as const
type Layout = (typeof LAYOUT)[keyof typeof LAYOUT]

function Clock({ iso, className }: { iso: string; className?: string }) {
  return (
    <time dateTime={iso} title={`${formatAuditTime(iso)} · ${utcTitle(iso) ?? ''}`} className={cn('shrink-0 whitespace-nowrap tabular-nums', className)}>
      {formatClockTime(iso)}
    </time>
  )
}

function attentionHint(log: Pick<ApiLogSummary, 'needsAttention' | 'outcome'>): string | null {
  if (!log.needsAttention) return null
  return log.outcome === 'timeout' ? TIMEOUT_HINT : UNKNOWN_HINT
}

function AttentionHint({ text }: { text: string }) {
  return (
    <p className="flex items-start gap-1 text-xs font-medium text-violet-800">
      <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      {text}
    </p>
  )
}

function errorLine(log: Pick<ApiLogSummary, 'errorCode' | 'errorMessage'>): string | null {
  const parts = [log.errorCode, log.errorMessage].filter(Boolean)
  return parts.length ? parts.join(': ') : null
}

/** Badges after the call text: status, outcome, duration, flags. */
function LogBadges({ log, withStatus = true }: { log: ApiLogSummary; withStatus?: boolean }) {
  return (
    <span className="flex flex-wrap items-center gap-1.5">
      {withStatus && <StatusCodeBadge code={log.statusCode} />}
      <OutcomeBadge outcome={log.outcome} />
      <DurationText ms={log.durationMs} className="text-xs" />
      <FlagIcons log={log} />
    </span>
  )
}

function ApiLogItemRow({ log }: { log: ApiLogSummary }) {
  const openLog = useOpenApiLog()
  const call = apiCallText(log)
  const err = errorLine(log)
  const hint = attentionHint(log)
  return (
    <button
      type="button"
      onClick={() => openLog(log.id)}
      className={cn(
        'flex min-h-11 w-full flex-col gap-1 rounded-lg px-2 py-2 text-left hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500',
        log.needsAttention && 'border-l-4 border-violet-500 bg-violet-50/50 hover:bg-violet-50'
      )}
    >
      <span className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
        <span className="flex min-w-0 flex-1 basis-48 items-center gap-1.5 text-sm text-gray-900">
          <Clock iso={log.createdAt} className="text-xs text-gray-500" />
          <DirectionIcon direction={log.direction} />
          <span className="min-w-0 truncate font-mono text-xs" title={call}>{call}</span>
        </span>
        <LogBadges log={log} />
      </span>
      {err && <span className="block truncate text-xs text-red-700" title={err}>{err}</span>}
      {hint && <AttentionHint text={hint} />}
    </button>
  )
}

function JourneyEventRow({ event }: { event: ApiTimelineAuditEvent }) {
  const openEvent = useOpenEvent()
  const colour = SEVERITY_COLOUR[event.severity as Severity] ?? SEVERITY_COLOUR.info
  const failed = event.status === 'failure'
  return (
    <button
      type="button"
      onClick={() => openEvent(event.id)}
      className="flex min-h-11 w-full flex-wrap items-center gap-x-1.5 gap-y-0.5 rounded-lg px-2 py-1.5 text-left text-xs text-gray-500 hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
    >
      <Clock iso={event.createdAt} />
      <span aria-hidden="true" className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: colour }} />
      <span className="min-w-0 break-words">
        Journey: <span className="font-medium text-gray-700">{stepLabel(event.step)}</span>
      </span>
      <span className={cn(failed && 'font-medium text-red-700')}>· {humanize(event.status)}</span>
      <span>({event.severity})</span>
      {event.errorCode && <span className="min-w-0 truncate font-mono" title={event.errorMessage ?? undefined}>· {event.errorCode}</span>}
    </button>
  )
}

function TimelineItemRow({ item }: { item: ApiTimelineItem }) {
  return item.kind === 'api_log' ? <ApiLogItemRow log={item.log} /> : <JourneyEventRow event={item.event} />
}

/** The item `groupTitle()` named the card after (first inbound / webhook call; else the first
 * call when the group is not a job run). It is shown as the card header, not repeated below. */
function headItem(group: ApiTimelineGroup): ApiTimelineItem | null {
  const head = group.items.find((i) => i.kind === 'api_log' && (i.log.direction === 'inbound' || i.log.direction === 'webhook'))
  if (head) return head
  const isJob = group.items.some((i) => i.kind === 'api_log' && i.log.jobName) || !!group.requestId?.startsWith('job-')
  if (isJob) return null
  return group.items[0].kind === 'api_log' ? group.items[0] : null
}

function itemKey(item: ApiTimelineItem): string {
  return item.kind === 'api_log' ? `l-${item.log.id}` : `e-${item.event.id}`
}

function GroupCard({ group, layout }: { group: ApiTimelineGroup; layout: Layout }) {
  const openLog = useOpenApiLog()
  const [expanded, setExpanded] = useState(false)
  const head = headItem(group)
  const headLog = head?.kind === 'api_log' ? head.log : null
  const children = head ? group.items.filter((i) => i !== head) : group.items
  const collapsed = !expanded && children.length > GROUP_COLLAPSE_OVER
  const shown = collapsed ? children.slice(0, GROUP_COLLAPSED_SHOW) : children
  const hidden = children.length - shown.length
  const firstAt = group.items[0].at
  const headErr = headLog ? errorLine(headLog) : null
  const headHint = headLog ? attentionHint(headLog) : null

  const titleBlock = (
    <>
      <span className={cn('text-xs text-gray-500', layout.timeInCard)}>
        <Clock iso={firstAt} />
      </span>
      <span className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
        <span className="flex min-w-0 flex-1 basis-48 items-center gap-1.5">
          {headLog && <DirectionIcon direction={headLog.direction} />}
          <span className="min-w-0 wrap-anywhere text-sm font-semibold text-gray-900">{group.title}</span>
        </span>
        {headLog && <LogBadges log={headLog} withStatus={false} />}
        {group.needsAttention && (
          <span className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full bg-violet-50 px-2 py-0.5 text-[11px] font-semibold text-violet-800 ring-1 ring-inset ring-violet-200">
            <AlertTriangle className="h-3 w-3" aria-hidden="true" /> Needs attention
          </span>
        )}
      </span>
      {headErr && <span className="block truncate text-xs text-red-700" title={headErr}>{headErr}</span>}
      {headHint && <AttentionHint text={headHint} />}
    </>
  )

  return (
    <article
      className={cn(
        'min-w-0 rounded-xl border bg-white p-2 shadow-sm',
        group.needsAttention ? 'border-violet-300 border-l-4 border-l-violet-500' : 'border-gray-200'
      )}
    >
      {headLog ? (
        <button
          type="button"
          onClick={() => openLog(headLog.id)}
          className="flex min-h-11 w-full flex-col gap-1 rounded-lg px-2 py-1.5 text-left hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
        >
          {titleBlock}
        </button>
      ) : (
        <div className="flex flex-col gap-1 px-2 py-1.5">{titleBlock}</div>
      )}
      {shown.length > 0 && (
        <ul className={cn('mt-1 space-y-0.5 border-l border-gray-100', layout.nest)}>
          {shown.map((item) => (
            <li key={itemKey(item)}>
              <TimelineItemRow item={item} />
            </li>
          ))}
          {hidden > 0 && (
            <li>
              <button
                type="button"
                onClick={() => setExpanded(true)}
                className="inline-flex min-h-11 items-center gap-1.5 rounded-lg px-2 text-sm font-medium text-indigo-600 hover:bg-indigo-50 hover:text-indigo-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
              >
                <MoreHorizontal className="h-4 w-4" aria-hidden="true" />
                {hidden} more calls — expand
              </button>
            </li>
          )}
        </ul>
      )}
    </article>
  )
}

/** One-column timeline of `data.items`, oldest first. `compact` keeps the phone layout up to lg
 * (booking pages); `maxItems` caps what is shown (the booking-page preview shows 50). */
export function ApiTimeline({ data, compact = false, maxItems }: { data: Pick<ApiTimelineResponse, 'items'>; compact?: boolean; maxItems?: number }) {
  const layout = compact ? LAYOUT.compact : LAYOUT.full
  const [limit, setLimit] = useState(TIMELINE_PAGE_SIZE)
  const capped = useMemo(() => (maxItems != null ? data.items.slice(0, maxItems) : data.items), [data.items, maxItems])
  const visible = useMemo(() => capped.slice(0, limit), [capped, limit])
  const rows = useMemo(() => groupTimeline(visible), [visible])
  const remaining = capped.length - visible.length

  return (
    <div className="min-w-0">
      <ol className="min-w-0">
        {rows.map((row) => {
          if (row.type === 'day') {
            return (
              <li key={row.key} className="flex items-center gap-3 py-2">
                <span className="shrink-0 text-xs font-semibold uppercase tracking-wide text-gray-600">{row.label}</span>
                <span aria-hidden="true" className="h-px flex-1 bg-gray-200" />
              </li>
            )
          }
          if (row.type === 'gap') {
            return (
              <li key={row.key} className="flex items-center gap-3 py-2 text-xs text-gray-500">
                <span aria-hidden="true" className="flex-1 border-t border-dashed border-gray-300" />
                <span className="shrink-0 italic">{row.label}</span>
                <span aria-hidden="true" className="flex-1 border-t border-dashed border-gray-300" />
              </li>
            )
          }
          return (
            <li key={row.key} className={cn('min-w-0 [contain-intrinsic-size:auto_96px] [content-visibility:auto]', layout.row)}>
              <div className={cn('pr-3 pt-3.5 text-right text-xs text-gray-500', layout.timeCol)}>
                <Clock iso={row.group.items[0].at} />
              </div>
              <div className={cn('relative min-w-0 border-l-2 border-gray-200 pb-3', layout.rail)}>
                <span
                  aria-hidden="true"
                  className={cn(
                    'absolute -left-[5px] top-4 h-2 w-2 rounded-full ring-2 ring-white',
                    row.group.needsAttention ? 'bg-violet-500' : 'bg-gray-300'
                  )}
                />
                <GroupCard group={row.group} layout={layout} />
              </div>
            </li>
          )
        })}
      </ol>
      {remaining > 0 && (
        <div className="flex flex-col items-center gap-1 pt-2">
          <button
            type="button"
            onClick={() => setLimit((l) => l + TIMELINE_PAGE_SIZE)}
            className="inline-flex min-h-11 w-full items-center justify-center rounded-lg border border-gray-300 bg-white px-4 text-sm font-medium text-gray-700 hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 sm:w-auto"
          >
            Show more
          </button>
          <p className="text-xs text-gray-500">
            Showing {visible.length.toLocaleString()} of {capped.length.toLocaleString()} items
          </p>
        </div>
      )}
    </div>
  )
}

/** "12 API calls · 5 journey events · 2 failures · [1 needs attention]" */
export function TimelineCounts({ counts, className }: { counts: ApiTimelineResponse['counts']; className?: string }) {
  const plural = (n: number, one: string, many: string) => `${n.toLocaleString()} ${n === 1 ? one : many}`
  return (
    <p className={cn('flex flex-wrap items-center gap-x-1.5 gap-y-1 text-sm text-gray-600', className)}>
      <span>{plural(counts.apiLogs, 'API call', 'API calls')}</span>
      <span aria-hidden="true">·</span>
      <span>{plural(counts.auditEvents, 'journey event', 'journey events')}</span>
      <span aria-hidden="true">·</span>
      <span className={cn(counts.failures > 0 && 'font-medium text-red-700')}>{plural(counts.failures, 'failure', 'failures')}</span>
      <span aria-hidden="true">·</span>
      {counts.needsAttention > 0 ? (
        <span className="inline-flex items-center gap-1 rounded-full bg-violet-50 px-2 py-0.5 text-xs font-semibold text-violet-800 ring-1 ring-inset ring-violet-200">
          <AlertTriangle className="h-3 w-3" aria-hidden="true" />
          {plural(counts.needsAttention, 'needs attention', 'need attention')}
        </span>
      ) : (
        <span>0 need attention</span>
      )}
    </p>
  )
}

const SECTION_MAX_ITEMS = 50

/** Collapsible "API timeline" card for booking pages (§4.7). Collapsed by default and fetches
 * only once opened. The host page mounts <ApiLogDrawer /> and <EventDrawer /> once.
 * `open` / `onOpenChange` optionally control it (e.g. to survive the host re-mounting it). */
export function ApiTimelineSection({
  refValue,
  title = 'API timeline',
  open: openProp,
  onOpenChange,
  className,
}: {
  refValue: string | null | undefined
  title?: string
  open?: boolean
  onOpenChange?: (open: boolean) => void
  className?: string
}) {
  const [openState, setOpenState] = useState(false)
  const open = openProp ?? openState
  const setOpen = (v: boolean) => {
    if (openProp === undefined) setOpenState(v)
    onOpenChange?.(v)
  }
  const ref = refValue ?? undefined
  const { data, isLoading, error, refetch } = useApiLogTimeline({ ref }, { enabled: open && !!ref })
  const meta = useVVAuditMeta()
  const retentionDays = meta.data?.apiLogs?.retentionDays ?? 7
  const bodyId = `api-timeline-${ref ?? 'none'}`

  if (!ref) return null

  return (
    <Card padding="none" className={cn('min-w-0', className)}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        aria-controls={bodyId}
        className="flex min-h-11 w-full items-center justify-between gap-3 rounded-xl px-5 py-3 text-left hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
      >
        <span className="flex min-w-0 items-center gap-2">
          <HistoryIcon className="h-4 w-4 shrink-0 text-gray-400" aria-hidden="true" />
          <span className="text-sm font-semibold text-gray-900">{title}</span>
          <span className="hidden min-w-0 truncate text-xs text-gray-500 sm:inline">Every API call and supplier exchange</span>
        </span>
        <ChevronDown className={cn('h-4 w-4 shrink-0 text-gray-400 motion-safe:transition-transform', open && 'rotate-180')} aria-hidden="true" />
      </button>
      {open && (
        <div id={bodyId} className="space-y-3 border-t border-gray-100 px-3 py-4 sm:px-5">
          {isLoading ? (
            <div className="flex justify-center py-8"><Spinner size="md" label="Loading API timeline…" /></div>
          ) : error || !data ? (
            <AuditErrorState error={error} onRetry={() => void refetch()} retentionDays={retentionDays} />
          ) : data.items.length === 0 ? (
            <AuditEmpty
              title="No API calls found"
              text={`Nothing found for '${ref}' in the last ${retentionDays} days — logs older than that are deleted.`}
            />
          ) : (
            <>
              <TimelineCounts counts={data.counts} />
              {data.truncated && (
                <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900 ring-1 ring-amber-200">
                  Showing the first 1,000 calls — open the full timeline and narrow the date range.
                </p>
              )}
              <ApiTimeline data={data} compact maxItems={SECTION_MAX_ITEMS} />
              {data.items.length > SECTION_MAX_ITEMS && (
                <p className="text-xs text-gray-500">
                  Showing the first {SECTION_MAX_ITEMS} of {data.items.length.toLocaleString()} items.
                </p>
              )}
            </>
          )}
          <Link
            to={apiTimelineHref({ ref })}
            className="inline-flex min-h-11 items-center gap-1.5 text-sm font-medium text-indigo-600 hover:text-indigo-800"
          >
            Open full timeline <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
          </Link>
        </div>
      )}
    </Card>
  )
}
