// ≥ lg list of API logs: a real table in its own scroll container (sticky header + sticky Time
// column). At lg the Customer and Flags columns fold into the Call cell's second line; from xl
// every column shows. Rows are focusable and Enter opens the drawer (?log=<id>). Never bodies.
import { useEffect, useRef, type KeyboardEvent } from 'react'
import { cn } from '@/lib/utils'
import { apiActorText, apiCallText, apiSupplierLabel, formatAuditTime, formatClockTime, formatRelative, utcTitle } from '../../audit'
import type { ApiLogSummary } from '../../auditTypes'
import { DirectionLabel, DurationText, FlagIcons, OutcomeBadge, RefChips, StatusCodeBadge } from './ApiBits'

export interface ApiLogTableProps {
  logs: ApiLogSummary[]
  onOpen: (id: string) => void
  /** Hide the Customer / Refs / Flags columns (their content stays on the Call cell's 2nd line). */
  compact?: boolean
  /** Fired when the last row scrolls into view inside the table's own container (infinite scroll). */
  onEndReached?: () => void
  /** Limits the container height so the header can stick; default 75vh. */
  scrollClassName?: string
}

const th = 'whitespace-nowrap bg-white px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide text-gray-500'
const td = 'px-3 py-2 align-middle'

/** "Inbound: POST /lounge…" for inbound / webhook, "DragonPass POST /v2/…" for supplier calls. */
export function ApiCallLine({ log, className }: { log: ApiLogSummary; className?: string }) {
  const title = apiCallText(log)
  if (log.direction === 'outbound') {
    return (
      <span className={cn('block truncate', className)} title={title}>
        <span className="font-semibold text-gray-900">{log.supplier ? apiSupplierLabel(log.supplier) : 'Supplier'}</span>{' '}
        <span className="font-mono text-xs text-gray-700">{log.operation ?? [log.method, log.route ?? log.url].filter(Boolean).join(' ')}</span>
      </span>
    )
  }
  return (
    <span className={cn('block truncate', className)} title={title}>
      {log.method && <span className="font-semibold text-gray-900">{log.method}</span>}{' '}
      <span className="font-mono text-xs text-gray-700">{log.route ?? log.operation ?? log.url ?? '—'}</span>
    </span>
  )
}

/** Thin vertical line joining adjacent rows of the same request. */
function Connector({ prev, next }: { prev: boolean; next: boolean }) {
  if (!prev && !next) return null
  return (
    <span
      aria-hidden="true"
      title="Same request"
      className={cn('absolute left-1.5 w-0.5 bg-indigo-200', prev ? 'top-0' : 'top-1/2', next ? 'bottom-0' : 'bottom-1/2')}
    />
  )
}

export function ApiLogTable({ logs, onOpen, compact = false, onEndReached, scrollClassName }: ApiLogTableProps) {
  const scrollRef = useRef<HTMLDivElement | null>(null)
  const endRef = useRef<HTMLTableRowElement | null>(null)
  const endCb = useRef(onEndReached)
  endCb.current = onEndReached
  const wantsEnd = Boolean(onEndReached)

  useEffect(() => {
    if (!wantsEnd || typeof IntersectionObserver === 'undefined' || !endRef.current) return
    const io = new IntersectionObserver((entries) => entries.some((e) => e.isIntersecting) && endCb.current?.(), {
      root: scrollRef.current,
      rootMargin: '200px',
    })
    io.observe(endRef.current)
    return () => io.disconnect()
  }, [wantsEnd, logs.length])

  const onKey = (e: KeyboardEvent<HTMLTableRowElement>, id: string) => {
    // Only the row itself — Enter on a ref chip inside it follows that link.
    if (e.target !== e.currentTarget) return
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      onOpen(id)
    }
  }

  const wide = compact ? 'hidden' : 'hidden xl:table-cell'

  return (
    <div ref={scrollRef} className={cn('max-w-full overflow-auto overscroll-contain', scrollClassName ?? 'max-h-[75vh]')}>
      <table className="w-full border-separate border-spacing-0 text-sm">
        <thead>
          <tr>
            <th scope="col" className={cn(th, 'sticky left-0 top-0 z-20 border-b border-gray-200 pl-4')}>Time</th>
            <th scope="col" className={cn(th, 'sticky top-0 z-10 border-b border-gray-200')}>Direction</th>
            <th scope="col" className={cn(th, 'sticky top-0 z-10 w-full border-b border-gray-200')}>Call</th>
            <th scope="col" className={cn(th, 'sticky top-0 z-10 border-b border-gray-200')}>Status</th>
            <th scope="col" className={cn(th, 'sticky top-0 z-10 border-b border-gray-200')}>Outcome</th>
            <th scope="col" className={cn(th, 'sticky top-0 z-10 border-b border-gray-200 text-right')}>Duration</th>
            <th scope="col" className={cn(th, wide, 'sticky top-0 z-10 border-b border-gray-200')}>Customer</th>
            {!compact && <th scope="col" className={cn(th, 'sticky top-0 z-10 border-b border-gray-200')}>Refs</th>}
            <th scope="col" className={cn(th, wide, 'sticky top-0 z-10 border-b border-gray-200')}>
              Flags
            </th>
          </tr>
        </thead>
        <tbody>
          {logs.map((log, i) => {
            const prev = i > 0 && !!log.requestId && logs[i - 1].requestId === log.requestId
            const next = i < logs.length - 1 && !!log.requestId && logs[i + 1].requestId === log.requestId
            const actor = apiActorText(log)
            const cellBorder = 'border-b border-gray-100'
            return (
              <tr
                key={log.id}
                ref={i === logs.length - 1 ? endRef : undefined}
                tabIndex={0}
                data-log-id={log.id}
                onClick={() => onOpen(log.id)}
                onKeyDown={(e) => onKey(e, log.id)}
                className={cn(
                  'group cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-indigo-500',
                  log.needsAttention ? 'bg-violet-50/40 hover:bg-violet-50' : 'hover:bg-gray-50'
                )}
              >
                <td
                  className={cn(
                    td,
                    cellBorder,
                    'sticky left-0 z-[5] border-l-4 pl-3',
                    log.needsAttention ? 'border-l-violet-600 bg-violet-50' : 'border-l-transparent bg-white group-hover:bg-gray-50'
                  )}
                >
                  <span className="relative block pl-2">
                    <Connector prev={prev} next={next} />
                    <time dateTime={log.createdAt} title={`${formatAuditTime(log.createdAt)}\n${utcTitle(log.createdAt) ?? ''}`} className="block whitespace-nowrap font-mono text-xs tabular-nums text-gray-900">
                      {formatClockTime(log.createdAt)}
                    </time>
                    <span className="block whitespace-nowrap text-[11px] text-gray-500">{formatRelative(log.createdAt)}</span>
                  </span>
                </td>
                <td className={cn(td, cellBorder)}><DirectionLabel direction={log.direction} /></td>
                <td className={cn(td, cellBorder, 'max-w-0 min-w-[14rem]')}>
                  <ApiCallLine log={log} />
                  <span className={cn('mt-0.5 flex min-w-0 items-center gap-2 text-xs text-gray-500', !compact && 'xl:hidden')}>
                    <span className="min-w-0 truncate" title={actor}>{actor}</span>
                    <FlagIcons log={log} />
                  </span>
                </td>
                <td className={cn(td, cellBorder)}><StatusCodeBadge code={log.statusCode} /></td>
                <td className={cn(td, cellBorder)}><OutcomeBadge outcome={log.outcome} /></td>
                <td className={cn(td, cellBorder, 'text-right text-xs')}><DurationText ms={log.durationMs} /></td>
                <td className={cn(td, cellBorder, wide, 'max-w-[14rem] text-xs text-gray-700')}>
                  <span className="block truncate" title={actor}>{actor}</span>
                </td>
                {!compact && (
                  <td className={cn(td, cellBorder, 'min-w-[8rem] max-w-[16rem]')}>
                    {log.refs.length ? <RefChips refs={log.refs} /> : <span className="text-gray-300">—</span>}
                  </td>
                )}
                <td className={cn(td, cellBorder, wide)}><FlagIcons log={log} /></td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

/** Placeholder rows with the same columns. */
export function ApiLogTableSkeleton({ rows = 8, compact = false }: { rows?: number; compact?: boolean }) {
  const bar = 'block h-3 animate-pulse rounded bg-gray-100 motion-reduce:animate-none'
  return (
    <div className="max-w-full overflow-hidden" aria-busy="true" aria-label="Loading API calls">
      <table className="w-full border-separate border-spacing-0 text-sm">
        <thead>
          <tr>
            {['Time', 'Direction', 'Call', 'Status', 'Outcome', 'Duration'].map((h) => (
              <th key={h} scope="col" className={cn(th, 'border-b border-gray-200', h === 'Time' && 'pl-4')}>{h}</th>
            ))}
            {!compact && <th scope="col" className={cn(th, 'border-b border-gray-200')}>Refs</th>}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: rows }, (_, i) => (
            <tr key={i}>
              <td className={cn(td, 'border-b border-gray-100 pl-4')}><span className={cn(bar, 'w-16')} /><span className={cn(bar, 'mt-1.5 w-10')} /></td>
              <td className={cn(td, 'border-b border-gray-100')}><span className={cn(bar, 'w-16')} /></td>
              <td className={cn(td, 'w-full border-b border-gray-100')}><span className={cn(bar, 'w-3/4')} /><span className={cn(bar, 'mt-1.5 w-1/3')} /></td>
              <td className={cn(td, 'border-b border-gray-100')}><span className={cn(bar, 'h-5 w-10 rounded-full')} /></td>
              <td className={cn(td, 'border-b border-gray-100')}><span className={cn(bar, 'h-5 w-20 rounded-full')} /></td>
              <td className={cn(td, 'border-b border-gray-100')}><span className={cn(bar, 'ml-auto w-12')} /></td>
              {!compact && <td className={cn(td, 'border-b border-gray-100')}><span className={cn(bar, 'w-20')} /></td>}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
