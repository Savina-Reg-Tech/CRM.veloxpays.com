import { useEffect, useMemo, useRef, useState, type ElementType, type ReactNode } from 'react'
import { Link, NavLink } from 'react-router-dom'
import {
  AlertCircle,
  AlertTriangle,
  Bug,
  Check,
  CheckCircle2,
  ChevronDown,
  Circle,
  Clock,
  Copy,
  CreditCard,
  Eye,
  EyeOff,
  Footprints,
  Lock,
  MonitorX,
  Plug,
  RefreshCw,
  Search,
  ServerOff,
  Shield,
  Webhook,
  XCircle,
} from 'lucide-react'
import Button from '@/components/ui/Button'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/store/authStore'
import {
  SEVERITY_BADGE_CLASS,
  STATUS_META,
  auditError,
  eventTypeLabel,
  formatAuditTime,
  humanize,
  isAuditAdmin,
  isAuditSupport,
  utcTitle,
} from '../../audit'
import type { AuditCustomer, EventStatus, Severity } from '../../auditTypes'

export const selectClass =
  'h-10 w-full rounded-lg border border-gray-300 bg-white px-3 text-base text-gray-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100 sm:text-sm'

export function useAuditViewer() {
  const role = useAuthStore((s) => s.user?.role)
  return { role, isAdmin: isAuditAdmin(role), isSupport: isAuditSupport(role) }
}

/** Where a customer link goes: admins → the full VV User page (Activity tab); support → the
 * audit-only customer timeline (the full profile reads admin-only VeloxVerse endpoints). */
export function useCustomerHref() {
  const { isAdmin } = useAuditViewer()
  return (userId: string) =>
    isAdmin ? `/dashboard/veloxverse/users/${userId}?tab=activity` : `/dashboard/veloxverse/audit-logs/customers/${userId}`
}

// ── Badges & icons ──────────────────────────────────────────────────

export function SeverityBadge({ severity, className }: { severity: Severity; className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold capitalize ring-1 ring-inset',
        SEVERITY_BADGE_CLASS[severity] ?? SEVERITY_BADGE_CLASS.info,
        className
      )}
    >
      {severity}
    </span>
  )
}

const STATUS_ICON: Record<EventStatus, ElementType> = { success: CheckCircle2, failure: XCircle, warning: AlertTriangle, info: Circle }

export function StatusIcon({ status, withLabel = false }: { status: EventStatus; withLabel?: boolean }) {
  const meta = STATUS_META[status] ?? STATUS_META.info
  const Icon = STATUS_ICON[status] ?? Circle
  return (
    <span className={cn('inline-flex items-center gap-1 text-xs font-medium', meta.className)} title={meta.label}>
      <Icon className={cn('h-4 w-4', status === 'info' && 'h-2.5 w-2.5 fill-current')} />
      {withLabel && meta.label}
    </span>
  )
}

const EVENT_TYPE_ICON: Record<string, ElementType> = {
  step: Footprints,
  page_view: Eye,
  api_error: AlertCircle,
  supplier_call: Plug,
  payment: CreditCard,
  webhook: Webhook,
  job: Clock,
  frontend_error: MonitorX,
  downtime: ServerOff,
  system_error: Bug,
  admin_access: Shield,
}

export function EventTypeIcon({ type, className }: { type: string; className?: string }) {
  const Icon = EVENT_TYPE_ICON[type] ?? Circle
  return (
    <span title={eventTypeLabel(type)} className="inline-flex">
      <Icon className={cn('h-4 w-4 text-gray-500', className)} aria-label={eventTypeLabel(type)} />
    </span>
  )
}

export function AuditTime({ iso, className }: { iso: string | null | undefined; className?: string }) {
  return (
    <time dateTime={iso ?? undefined} title={utcTitle(iso)} className={cn('whitespace-nowrap tabular-nums', className)}>
      {formatAuditTime(iso)}
    </time>
  )
}

export function GuestBadge() {
  return (
    <span className="rounded-full bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-amber-700 ring-1 ring-amber-200">
      Guest
    </span>
  )
}

/** Customer as VeloxVerse returned it (already masked for support). Links to the customer's
 * activity, or the guest timeline for anonymous rows. */
export function CustomerCell({
  customer,
  anonId,
  link = true,
}: {
  customer: AuditCustomer | null
  anonId?: string | null
  link?: boolean
}) {
  const customerHref = useCustomerHref()
  if (customer) {
    const body = (
      <span className="flex min-w-0 items-center gap-1.5">
        <span className="truncate">{customer.email ?? customer.name ?? customer.id}</span>
        {customer.role === 'GUEST' && <GuestBadge />}
      </span>
    )
    return link ? (
      <Link
        to={customerHref(customer.id)}
        onClick={(e) => e.stopPropagation()}
        className="block min-w-0 text-indigo-600 hover:text-indigo-800"
        title={customer.name ?? undefined}
      >
        {body}
      </Link>
    ) : (
      body
    )
  }
  if (anonId) {
    return link ? (
      <Link
        to={`/dashboard/veloxverse/audit-logs/guests/${encodeURIComponent(anonId)}`}
        onClick={(e) => e.stopPropagation()}
        className="inline-flex items-center gap-1.5 text-indigo-600 hover:text-indigo-800"
      >
        <GuestBadge /> <span className="font-mono text-xs">{anonId.slice(0, 10)}…</span>
      </Link>
    ) : (
      <span className="inline-flex items-center gap-1.5"><GuestBadge /> <span className="font-mono text-xs">{anonId.slice(0, 10)}…</span></span>
    )
  }
  return <span className="text-gray-400">—</span>
}

/** Monospace id with copy-to-clipboard and an optional link. */
export function CopyId({ value, to, short = false }: { value: string | null | undefined; to?: string; short?: boolean }) {
  const [copied, setCopied] = useState(false)
  if (!value) return <span className="text-gray-400">—</span>
  const text = short && value.length > 14 ? `${value.slice(0, 8)}…${value.slice(-4)}` : value
  return (
    <span className="inline-flex max-w-full items-center gap-1">
      {to ? (
        <Link to={to} onClick={(e) => e.stopPropagation()} className="truncate font-mono text-xs text-indigo-600 hover:text-indigo-800" title={value}>
          {text}
        </Link>
      ) : (
        <span className="truncate font-mono text-xs text-gray-800" title={value}>{text}</span>
      )}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation()
          void navigator.clipboard?.writeText(value).then(() => {
            setCopied(true)
            setTimeout(() => setCopied(false), 1200)
          })
        }}
        className="shrink-0 rounded p-0.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
        aria-label={`Copy ${value}`}
      >
        {copied ? <Check className="h-3 w-3 text-emerald-600" /> : <Copy className="h-3 w-3" />}
      </button>
    </span>
  )
}

/** metadata / errorDetails: small objects with varying keys. Plain text only — never HTML. */
export function KeyValueList({ data, empty = '—' }: { data: Record<string, unknown> | null | undefined; empty?: string }) {
  const entries = Object.entries(data ?? {})
  if (!entries.length) return <p className="text-sm text-gray-400">{empty}</p>
  return (
    <dl className="divide-y divide-gray-100 rounded-lg border border-gray-100">
      {entries.map(([k, v]) => (
        <div key={k} className="grid grid-cols-1 gap-1 px-3 py-2 sm:grid-cols-[minmax(0,10rem)_1fr] sm:gap-3">
          <dt className="break-words font-mono text-xs text-gray-500">{k}</dt>
          <dd className="min-w-0 text-sm text-gray-900">
            {v !== null && typeof v === 'object' ? (
              <pre className="overflow-x-auto whitespace-pre-wrap break-words rounded bg-gray-50 p-2 font-mono text-xs text-gray-700">
                {JSON.stringify(v, null, 2)}
              </pre>
            ) : v === null || v === undefined || v === '' ? (
              <span className="text-gray-400">—</span>
            ) : (
              <span className="break-words">{String(v)}</span>
            )}
          </dd>
        </div>
      ))}
    </dl>
  )
}

export function MaskedNote() {
  const { isSupport } = useAuditViewer()
  if (!isSupport) return null
  return (
    <p className="inline-flex items-center gap-1.5 rounded-lg bg-slate-50 px-3 py-1.5 text-xs text-slate-600 ring-1 ring-slate-200">
      <EyeOff className="h-3.5 w-3.5" /> Customer email, name, IP and browser are masked for support.
    </p>
  )
}

// ── States ──────────────────────────────────────────────────────────

export function AuditErrorState({
  error,
  onRetry,
  retentionDays,
  notFoundText,
}: {
  error: unknown
  onRetry?: () => void
  retentionDays?: number
  notFoundText?: string
}) {
  const e = auditError(error, 'Could not load audit data.')
  if (e.forbidden) {
    return (
      <div className="flex flex-col items-center gap-2 py-12 text-center">
        <Lock className="h-6 w-6 text-gray-400" />
        <p className="text-sm font-medium text-gray-700">You don&apos;t have permission to view this.</p>
      </div>
    )
  }
  if (e.notFound) {
    return (
      <AuditEmpty
        title="Not found"
        text={notFoundText ?? `It may have been deleted — detailed logs are kept ${retentionDays ?? 5} days. See Daily trends for older data.`}
      />
    )
  }
  return (
    <div className="flex flex-col items-center gap-3 py-12 text-center">
      <AlertTriangle className="h-6 w-6 text-red-500" />
      <p className="max-w-md text-sm text-gray-700">{e.message}</p>
      {e.requestId && <p className="font-mono text-xs text-gray-400">Ref: {e.requestId}</p>}
      {onRetry && (
        <Button variant="outline" size="sm" onClick={onRetry}>
          <RefreshCw className="h-4 w-4" /> Retry
        </Button>
      )}
    </div>
  )
}

export function AuditEmpty({ title, text, icon: Icon = Search }: { title: string; text?: ReactNode; icon?: ElementType }) {
  return (
    <div className="flex flex-col items-center gap-2 py-12 text-center">
      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-50">
        <Icon className="h-5 w-5 text-gray-300" />
      </div>
      <p className="text-sm font-medium text-gray-700">{title}</p>
      {text && <p className="max-w-md text-sm text-gray-500">{text}</p>}
    </div>
  )
}

// ── Layout ──────────────────────────────────────────────────────────

const AUDIT_BASE = '/dashboard/veloxverse/audit-logs'

export function AuditTabs() {
  const { isAdmin } = useAuditViewer()
  const tabs = [
    { to: AUDIT_BASE, label: 'Events', end: true },
    { to: `${AUDIT_BASE}/stuck`, label: 'Stuck customers' },
    { to: `${AUDIT_BASE}/errors`, label: 'Errors' },
    { to: `${AUDIT_BASE}/trends`, label: 'Daily trends' },
    { to: `${AUDIT_BASE}/alerts`, label: 'Alerts' },
    ...(isAdmin ? [{ to: `${AUDIT_BASE}/settings`, label: 'Settings' }] : []),
  ]
  return (
    <nav className="flex gap-1 overflow-x-auto border-b border-gray-200" aria-label="Audit log sections">
      {tabs.map((t) => (
        <NavLink
          key={t.to}
          to={t.to}
          end={t.end}
          className={({ isActive }) =>
            cn(
              '-mb-px shrink-0 border-b-2 px-3 py-2 text-sm font-medium transition-colors',
              isActive ? 'border-indigo-600 text-indigo-700' : 'border-transparent text-gray-500 hover:text-gray-800'
            )
          }
        >
          {t.label}
        </NavLink>
      ))}
    </nav>
  )
}

export function AuditPageShell({
  title,
  subtitle,
  actions,
  children,
  tabs = true,
}: {
  title: ReactNode
  subtitle?: ReactNode
  actions?: ReactNode
  children: ReactNode
  tabs?: boolean
}) {
  return (
    <div className="max-w-full space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-xl font-bold text-gray-900">{title}</h1>
          {subtitle && <div className="mt-0.5 text-sm text-gray-500">{subtitle}</div>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
      {tabs && <AuditTabs />}
      {children}
    </div>
  )
}

export function Section({ title, children, action }: { title: string; children: ReactNode; action?: ReactNode }) {
  return (
    <section className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">{title}</h3>
        {action}
      </div>
      {children}
    </section>
  )
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  const empty = children === null || children === undefined || children === ''
  return (
    <div className="min-w-0">
      <p className="text-[11px] uppercase tracking-wide text-gray-400">{label}</p>
      <div className="break-words text-sm text-gray-900">{empty ? <span className="text-gray-400">—</span> : children}</div>
    </div>
  )
}

// ── Inputs ──────────────────────────────────────────────────────────

/** Text input that reports its value 400ms after typing stops (every audit read is logged by
 * VeloxVerse, so no request per keystroke). */
export function DebouncedInput({
  value,
  onChange,
  placeholder,
  className,
  type = 'text',
  'aria-label': ariaLabel,
}: {
  value: string
  onChange: (v: string) => void
  placeholder?: string
  className?: string
  type?: string
  'aria-label'?: string
}) {
  const [draft, setDraft] = useState(value)
  const first = useRef(true)
  useEffect(() => setDraft(value), [value])
  useEffect(() => {
    if (first.current) {
      first.current = false
      return
    }
    const t = setTimeout(() => {
      if (draft !== value) onChange(draft.trim())
    }, 400)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft])
  return (
    <input
      type={type}
      value={draft}
      aria-label={ariaLabel ?? placeholder}
      placeholder={placeholder}
      onChange={(e) => setDraft(e.target.value)}
      className={cn(selectClass, className)}
    />
  )
}

/** Dropdown with checkboxes (and an optional search for long lists like steps). */
export function MultiSelect({
  label,
  options,
  value,
  onChange,
  format = humanize,
  searchable = false,
}: {
  label: string
  options: string[]
  value: string[]
  onChange: (v: string[]) => void
  format?: (v: string) => string
  searchable?: boolean
}) {
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const ref = useRef<HTMLDivElement | null>(null)
  useEffect(() => {
    if (!open) return
    const close = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('mousedown', close)
    document.addEventListener('keydown', esc)
    return () => {
      document.removeEventListener('mousedown', close)
      document.removeEventListener('keydown', esc)
    }
  }, [open])
  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase()
    return needle ? options.filter((o) => o.toLowerCase().includes(needle) || format(o).toLowerCase().includes(needle)) : options
  }, [options, q, format])
  const toggle = (o: string) => onChange(value.includes(o) ? value.filter((v) => v !== o) : [...value, o])

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className={cn(selectClass, 'flex items-center justify-between gap-2 text-left', value.length && 'border-indigo-300 bg-indigo-50/50')}
      >
        <span className="truncate">
          {label}
          {value.length > 0 && <span className="ml-1 font-semibold text-indigo-700">({value.length})</span>}
        </span>
        <ChevronDown className="h-4 w-4 shrink-0 text-gray-400" />
      </button>
      {open && (
        <div className="absolute left-0 z-30 mt-1 w-72 max-w-[85vw] rounded-lg border border-gray-200 bg-white p-2 shadow-lg">
          {searchable && (
            <input
              autoFocus
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={`Search ${label.toLowerCase()}…`}
              className="mb-2 h-8 w-full rounded-md border border-gray-200 px-2 text-sm focus:border-indigo-400 focus:outline-none"
            />
          )}
          <div className="max-h-64 overflow-y-auto">
            {shown.length === 0 && <p className="px-2 py-3 text-xs text-gray-400">No matches</p>}
            {shown.map((o) => (
              <label key={o} className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-gray-50">
                <input type="checkbox" checked={value.includes(o)} onChange={() => toggle(o)} className="rounded border-gray-300 text-indigo-600" />
                <span className="truncate">{format(o)}</span>
              </label>
            ))}
          </div>
          {value.length > 0 && (
            <button type="button" onClick={() => onChange([])} className="mt-1 w-full rounded px-2 py-1 text-left text-xs text-gray-500 hover:bg-gray-50">
              Clear
            </button>
          )}
        </div>
      )}
    </div>
  )
}
