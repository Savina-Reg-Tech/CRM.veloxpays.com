// < lg list of API logs: one card per log, the whole card is a button that opens the drawer.
// Ref chips here are plain text (no links nested inside the button) — the drawer has the
// Timeline / Filter actions for each ref.
import { cn } from '@/lib/utils'
import { apiActorText, apiCallText, apiSupplierLabel, formatAuditTime, formatClockTime, utcTitle } from '../../audit'
import type { ApiLogSummary } from '../../auditTypes'
import { DirectionIcon, DurationText, FlagIcons, OutcomeBadge, StatusCodeBadge } from './ApiBits'

function sourceLabel(log: ApiLogSummary): string {
  if (log.direction === 'outbound') return log.supplier ? apiSupplierLabel(log.supplier) : 'Supplier'
  if (log.direction === 'webhook') return log.supplier ? `${apiSupplierLabel(log.supplier)} webhook` : 'Webhook'
  return 'Inbound'
}

function callPath(log: ApiLogSummary): string {
  if (log.direction === 'outbound') return log.operation ?? ([log.method, log.route ?? log.url].filter(Boolean).join(' ') || '—')
  return [log.method, log.route ?? log.operation ?? log.url ?? '—'].filter(Boolean).join(' ')
}

export function ApiLogCard({ log, sameRequestAsPrevious = false, onOpen }: { log: ApiLogSummary; sameRequestAsPrevious?: boolean; onOpen: (id: string) => void }) {
  const actor = apiActorText(log)
  const refs = log.refs.slice(0, 2)
  const more = log.refs.length - refs.length
  const badges = log.needsAttention
    ? [<OutcomeBadge key="o" outcome={log.outcome} />, <StatusCodeBadge key="s" code={log.statusCode} />]
    : [<StatusCodeBadge key="s" code={log.statusCode} />, <OutcomeBadge key="o" outcome={log.outcome} />]
  return (
    <button
      type="button"
      data-log-id={log.id}
      onClick={() => onOpen(log.id)}
      title={apiCallText(log)}
      className={cn(
        'flex min-h-[72px] w-full flex-col gap-1 rounded-xl border border-l-4 bg-white px-3 py-2.5 text-left shadow-sm [contain-intrinsic-size:auto_112px] [content-visibility:auto]',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 active:bg-gray-50',
        log.needsAttention ? 'border-violet-200 border-l-violet-600 bg-violet-50/40' : 'border-gray-200 border-l-gray-200'
      )}
    >
      <span className="flex w-full flex-wrap items-center justify-between gap-x-2 gap-y-1">
        <span className="flex min-w-0 items-center gap-1.5">
          <DirectionIcon direction={log.direction} />
          <span className="truncate text-sm font-semibold text-gray-900">{sourceLabel(log)}</span>
          {sameRequestAsPrevious && (
            <span className="shrink-0 rounded-full bg-indigo-50 px-1.5 py-0.5 text-[10px] font-semibold text-indigo-700 ring-1 ring-inset ring-indigo-100">same request</span>
          )}
        </span>
        <span className="flex flex-wrap items-center gap-1">{badges}</span>
      </span>
      <span className="line-clamp-2 break-all font-mono text-xs text-gray-800">{callPath(log)}</span>
      <span className="flex w-full min-w-0 items-center gap-1 text-xs text-gray-500">
        <time dateTime={log.createdAt} title={`${formatAuditTime(log.createdAt)}\n${utcTitle(log.createdAt) ?? ''}`} className="shrink-0 tabular-nums">
          {formatClockTime(log.createdAt)}
        </time>
        <span aria-hidden="true">·</span>
        <DurationText ms={log.durationMs} className="shrink-0" />
        <span aria-hidden="true">·</span>
        <span className="min-w-0 truncate">{actor}</span>
      </span>
      {(refs.length > 0 || log.isMoneyCall || (log.attempt ?? 0) > 1 || log.isSensitiveMasked) && (
        <span className="flex w-full min-w-0 items-center justify-between gap-2">
          <span className="flex min-w-0 flex-wrap items-center gap-1">
            {refs.map((r) => (
              <span key={r} className="max-w-[10rem] truncate rounded bg-gray-100 px-1.5 py-0.5 font-mono text-xs text-gray-800">{r}</span>
            ))}
            {more > 0 && <span className="text-xs text-gray-500">+{more}</span>}
          </span>
          <FlagIcons log={log} />
        </span>
      )}
    </button>
  )
}

export function ApiLogCards({ logs, onOpen }: { logs: ApiLogSummary[]; onOpen: (id: string) => void }) {
  return (
    <ul className="space-y-2">
      {logs.map((log, i) => (
        <li key={log.id}>
          <ApiLogCard log={log} onOpen={onOpen} sameRequestAsPrevious={i > 0 && !!log.requestId && logs[i - 1].requestId === log.requestId} />
        </li>
      ))}
    </ul>
  )
}

export function ApiLogCardSkeleton({ count = 6 }: { count?: number }) {
  const bar = 'block h-3 animate-pulse rounded bg-gray-100 motion-reduce:animate-none'
  return (
    <ul className="space-y-2" aria-busy="true" aria-label="Loading API calls">
      {Array.from({ length: count }, (_, i) => (
        <li key={i} className="flex min-h-[72px] flex-col gap-2 rounded-xl border border-l-4 border-gray-200 bg-white px-3 py-2.5">
          <span className="flex items-center justify-between gap-2">
            <span className={cn(bar, 'w-24')} />
            <span className="flex gap-1"><span className={cn(bar, 'h-5 w-10 rounded-full')} /><span className={cn(bar, 'h-5 w-16 rounded-full')} /></span>
          </span>
          <span className={cn(bar, 'w-3/4')} />
          <span className={cn(bar, 'w-1/2')} />
        </li>
      ))}
    </ul>
  )
}
