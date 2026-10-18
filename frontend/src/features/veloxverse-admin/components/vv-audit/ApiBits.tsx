// Small shared pieces for the API-log screens (list, drawer, timeline, health, booking sections):
// paths, the ?log=<id> drawer link, badges and the copy button. Every badge carries text, never
// colour alone.
import { useCallback, useState, type ElementType } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import {
  AlertOctagon,
  ArrowDownLeft,
  ArrowUpRight,
  Check,
  CheckCircle2,
  Clock,
  Copy,
  Coins,
  HelpCircle,
  Lock,
  RotateCw,
  Webhook,
  XCircle,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useToast } from '@/app/providers/ToastProvider'
import {
  API_DIRECTION_SHORT,
  API_STATUS_CLASS_META,
  DURATION_TONE_CLASS,
  apiDirectionLabel,
  apiOutcomeMeta,
  durationTone,
  formatApiDuration,
  statusClassOf,
  statusCodeText,
} from '../../audit'
import type { ApiLogDirection, ApiLogOutcome, ApiLogSummary, ApiTimelineParams } from '../../auditTypes'

// ── Paths ───────────────────────────────────────────────────────────
export const AUDIT_BASE = '/dashboard/veloxverse/audit-logs'
export const API_LOGS_PATH = `${AUDIT_BASE}/api`
export const API_TIMELINE_PATH = `${AUDIT_BASE}/api/timeline`
export const API_HEALTH_PATH = `${AUDIT_BASE}/api-health`

/** Timeline link for a ref / request / journey. */
export function apiTimelineHref(params: ApiTimelineParams): string {
  const q = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) if (v) q.set(k, String(v))
  return `${API_TIMELINE_PATH}?${q.toString()}`
}

/** List link with filters, e.g. apiLogsHref({ outcome: 'unknown,timeout' }). */
export function apiLogsHref(params: Record<string, string | number | undefined>): string {
  const q = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== '') q.set(k, String(v))
  const s = q.toString()
  return s ? `${API_LOGS_PATH}?${s}` : API_LOGS_PATH
}

// ── Drawer link (?log=<id>) ─────────────────────────────────────────
/** Opens the API-log drawer on any page. Pushes a history entry, so browser Back closes it. */
export function useOpenApiLog() {
  const [, setParams] = useSearchParams()
  return useCallback(
    (id: string) =>
      setParams(
        (prev) => {
          const next = new URLSearchParams(prev)
          next.set('log', id)
          return next
        },
        { replace: false }
      ),
    [setParams]
  )
}

// ── Badges ──────────────────────────────────────────────────────────
const badgeBase = 'inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset'

const OUTCOME_ICON: Record<ApiLogOutcome, ElementType> = {
  success: CheckCircle2,
  failure: XCircle,
  error: AlertOctagon,
  timeout: Clock,
  unknown: HelpCircle,
}

export function OutcomeBadge({ outcome, className }: { outcome: string; className?: string }) {
  const meta = apiOutcomeMeta(outcome)
  const Icon = OUTCOME_ICON[outcome as ApiLogOutcome] ?? HelpCircle
  return (
    <span className={cn(badgeBase, meta.className, className)}>
      <Icon className="h-3 w-3" aria-hidden="true" />
      {meta.label}
    </span>
  )
}

/** "502" / "No answer", tinted by class; the class name is in the tooltip. */
export function StatusCodeBadge({ code, className }: { code: number | null | undefined; className?: string }) {
  const cls = statusClassOf(code)
  const meta = API_STATUS_CLASS_META[cls]
  return (
    <span className={cn(badgeBase, 'font-mono', meta.className, className)} title={meta.label}>
      {statusCodeText(code)}
    </span>
  )
}

const DIRECTION_ICON: Record<ApiLogDirection, ElementType> = { inbound: ArrowDownLeft, outbound: ArrowUpRight, webhook: Webhook }

export function DirectionIcon({ direction, className }: { direction: string; className?: string }) {
  const Icon = DIRECTION_ICON[direction as ApiLogDirection] ?? ArrowDownLeft
  return <Icon className={cn('h-4 w-4 shrink-0 text-gray-500', className)} aria-label={apiDirectionLabel(direction)} />
}

/** Icon + short label ("Supplier"); the long label is the tooltip. */
export function DirectionLabel({ direction, className }: { direction: string; className?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-1 whitespace-nowrap text-xs text-gray-700', className)} title={apiDirectionLabel(direction)}>
      <DirectionIcon direction={direction} />
      {API_DIRECTION_SHORT[direction as ApiLogDirection] ?? direction}
    </span>
  )
}

export function DurationText({ ms, className }: { ms: number | null | undefined; className?: string }) {
  return <span className={cn('whitespace-nowrap tabular-nums', DURATION_TONE_CLASS[durationTone(ms)], className)}>{formatApiDuration(ms)}</span>
}

export function MoneyBadge() {
  return (
    <span className={cn(badgeBase, 'bg-emerald-50 text-emerald-800 ring-emerald-200')}>
      <Coins className="h-3 w-3" aria-hidden="true" /> Payment / refund call
    </span>
  )
}

/** Money / retry / masked icons with tooltips (and screen-reader text). */
export function FlagIcons({ log, className }: { log: Pick<ApiLogSummary, 'isMoneyCall' | 'attempt' | 'isSensitiveMasked'>; className?: string }) {
  if (!log.isMoneyCall && !(log.attempt && log.attempt > 1) && !log.isSensitiveMasked) return null
  return (
    <span className={cn('inline-flex shrink-0 items-center gap-1.5 text-gray-500', className)}>
      {log.isMoneyCall && (
        <span title="Payment / refund call" className="inline-flex text-emerald-700">
          <Coins className="h-4 w-4" aria-hidden="true" />
          <span className="sr-only">Payment / refund call</span>
        </span>
      )}
      {log.attempt && log.attempt > 1 && (
        <span title={`Attempt ${log.attempt}`} className="inline-flex items-center gap-0.5 text-xs text-amber-700">
          <RotateCw className="h-3.5 w-3.5" aria-hidden="true" />
          {log.attempt}
          <span className="sr-only">Attempt {log.attempt}</span>
        </span>
      )}
      {log.isSensitiveMasked && (
        <span title="Sensitive values removed" className="inline-flex">
          <Lock className="h-3.5 w-3.5" aria-hidden="true" />
          <span className="sr-only">Sensitive values removed</span>
        </span>
      )}
    </span>
  )
}

/** First `max` refs as mono chips linking to the timeline, then "+N". */
export function RefChips({ refs, max = 2, className }: { refs: string[]; max?: number; className?: string }) {
  if (!refs.length) return null
  const shown = refs.slice(0, max)
  const more = refs.length - shown.length
  return (
    <span className={cn('flex min-w-0 flex-wrap items-center gap-1', className)}>
      {shown.map((r) => (
        <Link
          key={r}
          to={apiTimelineHref({ ref: r })}
          onClick={(e) => e.stopPropagation()}
          title={`Timeline for ${r}`}
          className="inline-flex min-h-6 max-w-full items-center truncate rounded bg-gray-100 px-1.5 py-0.5 font-mono text-xs text-gray-800 hover:bg-indigo-50 hover:text-indigo-700"
        >
          {r}
        </Link>
      ))}
      {more > 0 && <span className="text-xs text-gray-500" title={refs.slice(max).join(', ')}>+{more}</span>}
    </span>
  )
}

// ── Copy ────────────────────────────────────────────────────────────
/** Clipboard API with a textarea fallback (older browsers / non-secure contexts). */
export async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text)
      return true
    }
  } catch {
    /* fall through */
  }
  try {
    const ta = document.createElement('textarea')
    ta.value = text
    ta.setAttribute('readonly', '')
    ta.style.position = 'fixed'
    ta.style.opacity = '0'
    document.body.appendChild(ta)
    ta.select()
    const ok = document.execCommand('copy')
    document.body.removeChild(ta)
    return ok
  } catch {
    return false
  }
}

export function useCopy() {
  const { showToast } = useToast()
  return useCallback(
    async (text: string, what = 'Value') => {
      const ok = await copyText(text)
      showToast(ok ? { type: 'success', title: `${what} copied` } : { type: 'error', title: `Could not copy ${what.toLowerCase()}` })
      return ok
    },
    [showToast]
  )
}

/** 44×44 icon button that copies `value`. */
export function CopyButton({ value, what = 'Value', className }: { value: string; what?: string; className?: string }) {
  const copy = useCopy()
  const [done, setDone] = useState(false)
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation()
        void copy(value, what).then((ok) => {
          if (!ok) return
          setDone(true)
          setTimeout(() => setDone(false), 1200)
        })
      }}
      aria-label={`Copy ${what.toLowerCase()}`}
      className={cn(
        'inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500',
        className
      )}
    >
      {done ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
    </button>
  )
}

/** Mono value that wraps anywhere, with a copy button. */
export function CopyValue({ value, what, className }: { value: string | null | undefined; what?: string; className?: string }) {
  if (!value) return <span className="text-gray-400">—</span>
  return (
    <span className={cn('flex min-w-0 items-start gap-1', className)}>
      <span className="min-w-0 flex-1 break-all py-3 font-mono text-xs text-gray-900">{value}</span>
      <CopyButton value={value} what={what} />
    </span>
  )
}
