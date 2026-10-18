// Detail drawer for one API log — mount once per page; it opens on ?log=<id>. The only place
// bodies are fetched (useApiLog, on open). URL-driven, so browser Back closes it on every size.
import { useEffect, useId, useRef, useState, type ElementType, type ReactNode } from 'react'
import { Link, useNavigate, useNavigationType, useSearchParams } from 'react-router-dom'
import FocusTrap from 'focus-trap-react'
import { AlertTriangle, ArrowLeft, ArrowRight, ChevronDown, Copy, ExternalLink, Link2, ListFilter, MoreHorizontal, Route, X } from 'lucide-react'
import Spinner from '@/components/ui/Spinner'
import { cn } from '@/lib/utils'
import { useApiLog, useVVAuditMeta } from '../../hooks/useVVAudit'
import {
  actorLabel,
  apiDirectionLabel,
  apiSupplierLabel,
  auditError,
  formatBytes,
  formatClockTime,
  missingBodyReason,
  serviceLabel,
  utcTitle,
} from '../../audit'
import type { ApiLogDetail, ApiLogDetailResponse, ApiLogSummary } from '../../auditTypes'
import { AuditErrorState, AuditTime, Field, MaskedNote, useCustomerHref } from '../audit/AuditUI'
import { useIsTablet } from './useMediaQuery'
import {
  CopyButton,
  CopyValue,
  DirectionIcon,
  DurationText,
  MoneyBadge,
  OutcomeBadge,
  StatusCodeBadge,
  apiLogsHref,
  apiTimelineHref,
  useCopy,
  AUDIT_BASE,
} from './ApiBits'
import { JsonViewer } from './JsonViewer'

const journeyHref = (id: string) => `${AUDIT_BASE}/journeys/${encodeURIComponent(id)}`

// ── Building blocks ─────────────────────────────────────────────────

/** Collapsible card. On phones the drawer's sections form an accordion with their own defaults. */
function Panel({ title, meta, defaultOpen, children }: { title: string; meta?: ReactNode; defaultOpen: boolean; children: ReactNode }) {
  const [open, setOpen] = useState(defaultOpen)
  const bodyId = useId()
  return (
    <section className="rounded-xl border border-gray-200 bg-white">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={bodyId}
        onClick={() => setOpen((o) => !o)}
        className="flex min-h-11 w-full items-center gap-2 rounded-xl px-4 py-2 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
      >
        <h3 className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">{title}</h3>
        {meta && <span className="min-w-0 truncate text-xs text-gray-400">{meta}</span>}
        <ChevronDown className={cn('ml-auto h-4 w-4 shrink-0 text-gray-400', open && 'rotate-180')} aria-hidden="true" />
      </button>
      {open && (
        <div id={bodyId} className="min-w-0 px-4 pb-4">
          {children}
        </div>
      )}
    </section>
  )
}

function Mono({ children }: { children: ReactNode }) {
  return <span className="break-all font-mono text-xs">{children}</span>
}

/** Full-width cell in the 2-col overview grid. */
function Wide({ children }: { children: ReactNode }) {
  return <div className="min-w-0 md:col-span-2">{children}</div>
}

function AttentionBanner({ log }: { log: ApiLogDetail }) {
  if (!log.needsAttention) return null
  const supplier = log.supplier ? apiSupplierLabel(log.supplier) : 'the supplier'
  return (
    <div role="note" className="flex gap-3 rounded-xl border border-purple-200 bg-purple-50 px-4 py-3 text-sm text-purple-900">
      <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-purple-600" aria-hidden="true" />
      {log.outcome === 'unknown' ? (
        <p className="min-w-0 break-words">
          <strong>Outcome unknown.</strong> This call changes something (booking / cancel / payment / refund) and got no clear answer — it may
          have happened. Check {supplier} (or the booking&apos;s current status) before retrying.
          {log.idempotencyKey && (
            <>
              {' '}Idempotency key: <span className="break-all font-mono text-xs">{log.idempotencyKey}</span>.
            </>
          )}
        </p>
      ) : (
        <p className="min-w-0 break-words">
          <strong>No answer in time.</strong> This was a read — safe to retry.
        </p>
      )}
    </div>
  )
}

/** What the call was, as one line: bold method + route (inbound / webhook) or the operation. */
function CallTitle({ log }: { log: ApiLogSummary }) {
  const op = log.direction === 'outbound' ? log.operation : null
  const path = log.route ?? log.operation ?? log.url
  return (
    <span className="min-w-0 break-all font-mono text-sm text-gray-900">
      {op ? (
        op
      ) : (
        <>
          {log.method && <strong className="font-semibold">{log.method} </strong>}
          {path ?? '—'}
        </>
      )}
    </span>
  )
}

function Summary({ log }: { log: ApiLogDetail }) {
  return (
    <div className="min-w-0 space-y-1.5">
      <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
        <DirectionIcon direction={log.direction} />
        <CallTitle log={log} />
        <StatusCodeBadge code={log.statusCode} />
        <OutcomeBadge outcome={log.outcome} />
        {log.isMoneyCall && <MoneyBadge />}
      </div>
      <p className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs text-gray-500">
        <AuditTime iso={log.createdAt} />
        <span aria-hidden="true">·</span>
        <DurationText ms={log.durationMs} />
        <span aria-hidden="true">·</span>
        <span>{log.supplier ? apiSupplierLabel(log.supplier) : apiDirectionLabel(log.direction)}</span>
        <span aria-hidden="true">·</span>
        <span>{serviceLabel(log.service)}</span>
      </p>
    </div>
  )
}

// ── Actions (row on md+, ⋯ menu on phones) ──────────────────────────
interface Action {
  key: string
  label: string
  icon: ElementType
  to?: string
  onSelect?: () => void
}

function useActions(log: ApiLogDetail | undefined): Action[] {
  const copy = useCopy()
  if (!log) return []
  const timelineTo = log.requestId ? apiTimelineHref({ requestId: log.requestId }) : log.refs[0] ? apiTimelineHref({ ref: log.refs[0] }) : null
  const actions: Action[] = [{ key: 'link', label: 'Copy link', icon: Link2, onSelect: () => void copy(window.location.href, 'Link') }]
  if (log.requestId) actions.push({ key: 'rid', label: 'Copy request id', icon: Copy, onSelect: () => void copy(log.requestId!, 'Request id') })
  if (timelineTo) actions.push({ key: 'timeline', label: 'Open timeline', icon: Route, to: timelineTo })
  if (log.journeyId) actions.push({ key: 'journey', label: 'Open journey', icon: ExternalLink, to: journeyHref(log.journeyId) })
  return actions
}

function ActionRow({ actions }: { actions: Action[] }) {
  const cls =
    'inline-flex min-h-11 items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 text-xs font-medium text-gray-700 hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 lg:min-h-9'
  return (
    <div className="flex flex-wrap gap-2">
      {actions.map(({ key, label, icon: Icon, to, onSelect }) =>
        to ? (
          <Link key={key} to={to} className={cls}>
            <Icon className="h-4 w-4" aria-hidden="true" /> {label}
          </Link>
        ) : (
          <button key={key} type="button" onClick={onSelect} className={cls}>
            <Icon className="h-4 w-4" aria-hidden="true" /> {label}
          </button>
        )
      )}
    </div>
  )
}

function ActionMenu({ actions }: { actions: Action[] }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement | null>(null)
  const navigate = useNavigate()
  useEffect(() => {
    if (!open) return
    const onDown = (e: PointerEvent) => ref.current && !ref.current.contains(e.target as Node) && setOpen(false)
    // Capture + preventDefault: Esc closes the menu, not the drawer.
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      e.preventDefault()
      setOpen(false)
    }
    document.addEventListener('pointerdown', onDown)
    window.addEventListener('keydown', onKey, true)
    return () => {
      document.removeEventListener('pointerdown', onDown)
      window.removeEventListener('keydown', onKey, true)
    }
  }, [open])
  if (!actions.length) return null
  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-label="More actions"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="inline-flex h-11 w-11 items-center justify-center rounded-lg text-gray-600 hover:bg-gray-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
      >
        <MoreHorizontal className="h-5 w-5" />
      </button>
      {open && (
        <div role="menu" className="absolute right-0 top-full z-10 mt-1 w-56 rounded-xl border border-gray-200 bg-white p-1 shadow-lg">
          {actions.map(({ key, label, icon: Icon, to, onSelect }) => (
            <button
              key={key}
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false)
                if (to) navigate(to)
                else onSelect?.()
              }}
              className="flex min-h-11 w-full items-center gap-2 rounded-lg px-3 text-left text-sm text-gray-800 hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
            >
              <Icon className="h-4 w-4 text-gray-500" aria-hidden="true" /> {label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Sections ────────────────────────────────────────────────────────

function Overview({ log }: { log: ApiLogDetail }) {
  const customerHref = useCustomerHref()
  const who = log.customer?.email ?? log.customer?.name ?? null
  return (
    <div className="grid grid-cols-1 gap-x-6 gap-y-3 md:grid-cols-2">
      <Field label="Direction">{apiDirectionLabel(log.direction)}</Field>
      <Field label="Actor">{actorLabel(log.actor)}</Field>
      <Field label="Customer">
        {/* Link by user id — never by (possibly masked) email. */}
        {log.userId ? (
          <Link to={customerHref(log.userId)} className="break-all text-indigo-600 hover:text-indigo-800" title={log.customer?.name ?? undefined}>
            {who ?? log.userId}
          </Link>
        ) : (
          who ?? (log.actor === 'guest' ? 'Guest' : null)
        )}
      </Field>
      <Field label="Service">{serviceLabel(log.service)}</Field>
      <Field label="Supplier">{log.supplier ? apiSupplierLabel(log.supplier) : null}</Field>
      <Field label="Operation">{log.operation ? <Mono>{log.operation}</Mono> : null}</Field>
      <Field label="Method">{log.method}</Field>
      <Field label="Route">{log.route ? <Mono>{log.route}</Mono> : null}</Field>
      <Wide>
        <Field label="URL">{log.url ? <CopyValue value={log.url} what="URL" /> : null}</Field>
      </Wide>
      <Field label="Status code"><StatusCodeBadge code={log.statusCode} /></Field>
      <Field label="Duration"><DurationText ms={log.durationMs} /></Field>
      <Field label="Attempt">{log.attempt != null ? String(log.attempt) : null}</Field>
      <Field label="Idempotency key">{log.idempotencyKey ? <CopyValue value={log.idempotencyKey} what="Idempotency key" /> : null}</Field>
      <Field label="Error code">{log.errorCode ? <Mono>{log.errorCode}</Mono> : null}</Field>
      <Wide>
        {/* Never truncated in the drawer. */}
        <Field label="Error message">{log.errorMessage ? <CopyValue value={log.errorMessage} what="Error message" className="[&>span:first-child]:whitespace-pre-wrap" /> : null}</Field>
      </Wide>
      <Field label="Request id">
        {log.requestId ? (
          <span className="flex min-w-0 items-center gap-1">
            <Link
              to={apiTimelineHref({ requestId: log.requestId })}
              className="min-w-0 flex-1 break-all py-3 font-mono text-xs text-indigo-600 hover:text-indigo-800"
              title="Timeline for this request"
            >
              {log.requestId}
            </Link>
            <CopyButton value={log.requestId} what="Request id" />
          </span>
        ) : null}
      </Field>
      <Field label="Journey id">
        {log.journeyId ? (
          <span className="flex min-w-0 items-center gap-1">
            <Link to={journeyHref(log.journeyId)} className="min-w-0 flex-1 break-all py-3 font-mono text-xs text-indigo-600 hover:text-indigo-800">
              {log.journeyId}
            </Link>
            <CopyButton value={log.journeyId} what="Journey id" />
          </span>
        ) : null}
      </Field>
      <Field label="Job name">{log.jobName ? <Mono>{log.jobName}</Mono> : null}</Field>
      <Field label="IP">{log.ip ? <Mono>{log.ip}</Mono> : null}</Field>
      <Wide>
        <Field label="User agent">{log.userAgent ? <span className="break-all text-xs">{log.userAgent}</span> : null}</Field>
      </Wide>
      <Field label="Time (local)"><AuditTime iso={log.createdAt} /></Field>
      <Field label="Time (UTC)"><span className="tabular-nums">{utcTitle(log.createdAt)}</span></Field>
    </div>
  )
}

function References({ refs }: { refs: string[] }) {
  const link =
    'inline-flex min-h-11 items-center gap-1 rounded-md px-2 text-xs font-medium text-indigo-600 hover:bg-indigo-50 hover:text-indigo-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 md:min-h-8'
  return (
    <ul className="flex flex-wrap gap-2">
      {refs.map((r) => (
        <li key={r} className="flex min-w-0 max-w-full flex-wrap items-center gap-0.5 rounded-lg border border-gray-200 bg-gray-50 pl-2">
          <span className="min-w-0 break-all font-mono text-xs text-gray-900">{r}</span>
          <Link to={apiTimelineHref({ ref: r })} className={link} aria-label={`Timeline for ${r}`}>
            <Route className="h-3.5 w-3.5" aria-hidden="true" /> Timeline
          </Link>
          <Link to={apiLogsHref({ ref: r })} className={link} aria-label={`Filter list by ${r}`}>
            <ListFilter className="h-3.5 w-3.5" aria-hidden="true" /> Filter list
          </Link>
        </li>
      ))}
    </ul>
  )
}

function NotStored({ text }: { text: string }) {
  return <p className="rounded-lg bg-gray-50 px-3 py-2 text-sm text-gray-500">{text}</p>
}

function BodyBlock({ log, body, bytes, label }: { log: ApiLogDetail; body: unknown; bytes: number | null; label: string }) {
  if (!log.hasBodies) return <NotStored text={missingBodyReason(log)} />
  if (body === null || body === undefined) return <NotStored text="No body" />
  return <JsonViewer value={body} label={label} bytes={bytes} />
}

function HeadersTable({ headers }: { headers: Record<string, string> | null }) {
  const entries = Object.entries(headers ?? {})
  if (!entries.length) return <p className="text-sm text-gray-400">No headers stored.</p>
  return (
    <div className="overflow-x-auto rounded-lg border border-gray-100">
      <table className="w-full text-left text-xs">
        <thead className="bg-gray-50 text-[11px] uppercase tracking-wide text-gray-500">
          <tr>
            <th scope="col" className="px-3 py-2 font-semibold">Header</th>
            <th scope="col" className="px-3 py-2 font-semibold">Value</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {entries.map(([k, v]) => (
            <tr key={k} className="align-top">
              <td className="whitespace-nowrap px-3 py-2 font-mono text-gray-600">{k}</td>
              <td className="break-all px-3 py-2 font-mono text-gray-900">{v}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function Retries({ attempts, onOpen }: { attempts: ApiLogSummary[]; onOpen: (id: string) => void }) {
  return (
    <ul className="space-y-1.5">
      {attempts.map((a) => (
        <li key={a.id}>
          <button
            type="button"
            onClick={() => onOpen(a.id)}
            className="flex min-h-11 w-full flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border border-gray-100 px-3 py-2 text-left text-sm hover:border-indigo-200 hover:bg-indigo-50/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
          >
            <time dateTime={a.createdAt} title={utcTitle(a.createdAt)} className="tabular-nums text-gray-700">{formatClockTime(a.createdAt)}</time>
            <span className="text-gray-600">Attempt {a.attempt ?? '—'}</span>
            <StatusCodeBadge code={a.statusCode} />
            <OutcomeBadge outcome={a.outcome} />
            <DurationText ms={a.durationMs} className="text-xs" />
            <ArrowRight className="ml-auto h-3.5 w-3.5 shrink-0 text-gray-400" aria-hidden="true" />
          </button>
        </li>
      ))}
    </ul>
  )
}

function DrawerContent({ data, onSwitch }: { data: ApiLogDetailResponse; onSwitch: (id: string) => void }) {
  const log = data.log
  // Desktop: every card open. Phones: an accordion with Overview open, bodies closed.
  const wide = useIsTablet()
  const reqMeta = log.hasBodies && log.requestBytes != null ? formatBytes(log.requestBytes) : undefined
  const resMeta = log.hasBodies && log.responseBytes != null ? formatBytes(log.responseBytes) : undefined
  return (
    <>
      <AttentionBanner log={log} />
      <MaskedNote />
      {log.isSensitiveMasked && (
        <p className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">Sensitive values were removed or masked before this call was stored.</p>
      )}
      <Panel title="Overview" defaultOpen>
        <Overview log={log} />
      </Panel>
      {log.refs.length > 0 && (
        <Panel title="References" meta={String(log.refs.length)} defaultOpen>
          <References refs={log.refs} />
        </Panel>
      )}
      <Panel title="Request" meta={reqMeta} defaultOpen={wide}>
        <div className="space-y-3">
          <HeadersTable headers={log.requestHeaders} />
          <BodyBlock log={log} body={log.requestBody} bytes={log.requestBytes} label="Request body" />
        </div>
      </Panel>
      <Panel title="Response" meta={resMeta} defaultOpen={wide}>
        <BodyBlock log={log} body={log.responseBody} bytes={log.responseBytes} label="Response body" />
      </Panel>
      {data.otherAttempts.length > 0 && (
        <Panel title="Retries" meta={`${data.otherAttempts.length} other attempt${data.otherAttempts.length === 1 ? '' : 's'}`} defaultOpen>
          <Retries attempts={data.otherAttempts} onOpen={onSwitch} />
        </Panel>
      )}
      {log.requestId && (
        <Panel title="Same request" defaultOpen>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm text-gray-700">
              {data.sameRequestLogs} API call{data.sameRequestLogs === 1 ? '' : 's'} and {data.sameRequestAuditEvents} journey event
              {data.sameRequestAuditEvents === 1 ? '' : 's'} in this request
            </p>
            <Link
              to={apiTimelineHref({ requestId: log.requestId })}
              className="inline-flex min-h-11 items-center gap-1 text-sm font-medium text-indigo-600 hover:text-indigo-800 md:min-h-0"
            >
              Show all <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
            </Link>
          </div>
        </Panel>
      )}
    </>
  )
}

// ── Drawer ──────────────────────────────────────────────────────────

/** Opened anywhere by `?log=<id>` (see useOpenApiLog). */
export function ApiLogDrawer() {
  const [params, setParams] = useSearchParams()
  const id = params.get('log')
  const navigate = useNavigate()
  const navType = useNavigationType()
  const { data, isLoading, error, refetch } = useApiLog(id)
  const meta = useVVAuditMeta()
  const titleId = useId()
  const dialogRef = useRef<HTMLDivElement | null>(null)
  const actions = useActions(data?.log)

  // Opened by a push in this session (a row click) → Close = Back, so both behave the same.
  // Cold deep links (POP) close by removing the param instead. Retry switches use replace and
  // keep the flag.
  const openedByPush = useRef(false)
  const prevId = useRef<string | null>(null)
  useEffect(() => {
    if (id && !prevId.current) openedByPush.current = navType === 'PUSH'
    if (!id) openedByPush.current = false
    prevId.current = id
  }, [id, navType])

  const removeParam = () =>
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        next.delete('log')
        return next
      },
      { replace: true }
    )
  const close = () => (openedByPush.current ? navigate(-1) : removeParam())
  const closeRef = useRef(close)
  closeRef.current = close

  const switchTo = (otherId: string) =>
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        next.set('log', otherId)
        return next
      },
      { replace: true }
    )

  const open = Boolean(id)
  useEffect(() => {
    if (!open) return
    // Menus and the full-screen body viewer handle Esc first (capture) and preventDefault.
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && !e.defaultPrevented && closeRef.current()
    window.addEventListener('keydown', onKey)
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = prevOverflow
    }
  }, [open])

  if (!id) return null
  const log = data?.log
  const retentionDays = meta.data?.apiLogs?.retentionDays ?? meta.data?.retentionDays
  const notFound = error ? auditError(error).notFound : false

  return (
    <FocusTrap
      focusTrapOptions={{
        // Focus the dialog itself so screen readers announce it; Tab then walks its controls.
        initialFocus: () => dialogRef.current ?? false,
        fallbackFocus: () => dialogRef.current ?? document.body,
        escapeDeactivates: false,
        clickOutsideDeactivates: false,
        allowOutsideClick: true,
        returnFocusOnDeactivate: true,
      }}
    >
      <div className="fixed inset-0 z-[65] flex justify-end">
        <button type="button" tabIndex={-1} aria-label="Close" onClick={close} className="absolute inset-0 hidden bg-gray-900/30 md:block" />
        <div
          ref={dialogRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          tabIndex={-1}
          className="relative flex h-full w-full flex-col bg-white shadow-xl focus:outline-none md:w-[90vw] lg:w-[720px]"
        >
          <header className="shrink-0 border-b border-gray-100">
            <div className="flex items-center gap-1 px-1 py-1 md:px-5 md:pt-3 md:pb-0">
              <button
                type="button"
                onClick={close}
                aria-label="Back"
                className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-gray-600 hover:bg-gray-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 md:hidden"
              >
                <ArrowLeft className="h-5 w-5" />
              </button>
              <h2 id={titleId} className="min-w-0 flex-1 text-base font-semibold text-gray-900 md:text-[11px] md:uppercase md:tracking-wide md:text-gray-400">
                API call
              </h2>
              <div className="md:hidden">
                <ActionMenu actions={actions} />
              </div>
              <button
                type="button"
                onClick={close}
                aria-label="Close"
                className="-mr-2 hidden h-11 w-11 shrink-0 items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 md:inline-flex"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            {log && (
              <div className="space-y-3 px-4 pb-3 md:px-5 md:pb-4">
                <Summary log={log} />
                <div className="hidden md:block">
                  <ActionRow actions={actions} />
                </div>
              </div>
            )}
          </header>

          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain px-4 pt-4 pb-[max(1.25rem,env(safe-area-inset-bottom))] md:px-5">
            {isLoading ? (
              <div className="flex justify-center py-16"><Spinner size="md" label="Loading API call…" /></div>
            ) : error || !data ? (
              <AuditErrorState
                error={error}
                onRetry={notFound ? undefined : () => void refetch()}
                retentionDays={retentionDays}
                notFoundText={`This log has been deleted (logs are kept ${retentionDays ?? 7} days)`}
              />
            ) : (
              // Keyed by id: switching to another attempt resets the accordion and viewers.
              <div key={data.log.id} className="space-y-4">
                <DrawerContent data={data} onSwitch={switchTo} />
              </div>
            )}
          </div>
        </div>
      </div>
    </FocusTrap>
  )
}
