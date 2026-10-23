// Small shared pieces for the Pick & Drop customer-email screens.
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { AlertTriangle, Check, CheckCircle2, Copy, Info, Keyboard, X, XCircle } from 'lucide-react'
import Modal from '@/components/ui/Modal'
import { useToast } from '@/app/providers/ToastProvider'
import { cn } from '@/lib/utils'
import { BottomSheet } from '../vv-audit/BottomSheet'
import { useMediaQuery } from '../vv-audit/useMediaQuery'
import {
  TONE_CHIP,
  TONE_DOT,
  bookingStatusMeta,
  countdown,
  readiness,
  templateIcon,
  type Tone,
} from '../../pickdropEmails'
import type { DraftSummary } from '../../types'

/** Re-renders every `ms` so countdowns and "waiting …" stay current. */
export function useNow(ms = 30_000): number {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), ms)
    return () => clearInterval(t)
  }, [ms])
  return now
}

export function ToneChip({
  tone,
  children,
  title,
  dot = false,
  className,
}: {
  tone: Tone
  children: ReactNode
  title?: string
  dot?: boolean
  className?: string
}) {
  return (
    <span
      title={title}
      className={cn(
        'inline-flex max-w-full items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset whitespace-nowrap',
        TONE_CHIP[tone],
        className,
      )}
    >
      {dot && <span className={cn('h-1.5 w-1.5 shrink-0 rounded-full', TONE_DOT[tone])} />}
      <span className="truncate">{children}</span>
    </span>
  )
}

export function CountdownChip({ pickupAt, now, className }: { pickupAt: string | null | undefined; now: number; className?: string }) {
  const c = countdown(pickupAt, now)
  return (
    <ToneChip tone={c.tone} dot className={cn(c.tone === 'red' && 'font-semibold', className)} title="Time until pickup">
      {c.text}
    </ToneChip>
  )
}

export function ReadinessChip({
  draft,
  placeholders,
}: {
  draft: Pick<DraftSummary, 'status' | 'missing' | 'error'>
  placeholders?: { key: string; label: string }[] | null
}) {
  const r = readiness(draft, placeholders)
  const Icon = r.kind === 'ready' ? CheckCircle2 : r.kind === 'failed' ? XCircle : r.kind === 'missing' ? AlertTriangle : null
  return (
    <span
      title={r.detail ? (r.kind === 'missing' ? `Missing: ${r.detail}` : r.detail) : undefined}
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset whitespace-nowrap',
        TONE_CHIP[r.tone],
      )}
    >
      {Icon && <Icon className="h-3.5 w-3.5 shrink-0" />}
      {r.label}
    </span>
  )
}

export function BookingStatusChip({ status }: { status: string | null | undefined }) {
  if (!status) return null
  const m = bookingStatusMeta(status)
  return <ToneChip tone={m.tone}>{m.label}</ToneChip>
}

export function TemplateName({ templateKey, name, className }: { templateKey: string; name: string; className?: string }) {
  const Icon = templateIcon(templateKey)
  return (
    <span className={cn('inline-flex min-w-0 items-center gap-2 font-medium text-gray-900', className)}>
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
        <Icon className="h-4 w-4" />
      </span>
      <span className="truncate">{name}</span>
    </span>
  )
}

/** Monospace order number; click copies it. */
export function OrderNoCopy({ orderNo, className }: { orderNo: string; className?: string }) {
  const { showToast } = useToast()
  const [copied, setCopied] = useState(false)
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation()
        navigator.clipboard
          ?.writeText(orderNo)
          .then(() => {
            setCopied(true)
            setTimeout(() => setCopied(false), 1500)
          })
          .catch(() => showToast({ type: 'error', title: 'Could not copy' }))
      }}
      title="Copy order number"
      className={cn(
        'inline-flex max-w-full items-center gap-1 rounded-md px-1.5 py-0.5 font-mono text-xs text-gray-600 hover:bg-gray-100 hover:text-gray-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500',
        className,
      )}
    >
      <span className="truncate">{orderNo}</span>
      {copied ? <Check className="h-3 w-3 shrink-0 text-emerald-600" /> : <Copy className="h-3 w-3 shrink-0 text-gray-400" />}
    </button>
  )
}

const BANNER_TONE = {
  warning: { box: 'border-amber-300 bg-amber-50 text-amber-900', icon: AlertTriangle, iconClass: 'text-amber-600' },
  info: { box: 'border-sky-200 bg-sky-50 text-sky-900', icon: Info, iconClass: 'text-sky-600' },
  error: { box: 'border-red-300 bg-red-50 text-red-900', icon: XCircle, iconClass: 'text-red-600' },
  success: { box: 'border-emerald-200 bg-emerald-50 text-emerald-900', icon: CheckCircle2, iconClass: 'text-emerald-600' },
} as const

export function Banner({
  tone,
  title,
  children,
  onDismiss,
  action,
  className,
}: {
  tone: keyof typeof BANNER_TONE
  title: ReactNode
  children?: ReactNode
  onDismiss?: () => void
  action?: ReactNode
  className?: string
}) {
  const t = BANNER_TONE[tone]
  const Icon = t.icon
  return (
    <div role={tone === 'error' ? 'alert' : 'status'} className={cn('flex items-start gap-3 rounded-xl border px-3 py-2.5 text-sm', t.box, className)}>
      <Icon className={cn('mt-0.5 h-4 w-4 shrink-0', t.iconClass)} />
      <div className="min-w-0 flex-1">
        <p className="font-semibold">{title}</p>
        {children && <div className="mt-0.5 break-words opacity-90">{children}</div>}
        {action && <div className="mt-2">{action}</div>}
      </div>
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss"
          className="-m-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg opacity-60 hover:bg-black/5 hover:opacity-100"
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  )
}

/** A centred dialog on tablets and up; a bottom sheet on phones. */
export function ResponsiveDialog({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = 'md',
}: {
  open: boolean
  onClose: () => void
  title: string
  description?: string
  children: ReactNode
  footer?: ReactNode
  size?: 'sm' | 'md' | 'lg' | 'xl'
}) {
  const isPhone = !useMediaQuery('(min-width: 640px)')
  if (isPhone) {
    return (
      <BottomSheet
        open={open}
        onClose={onClose}
        title={title}
        footer={footer ? <div className="flex flex-col-reverse gap-2 [&>button]:min-h-11 [&>button]:w-full">{footer}</div> : undefined}
      >
        {description && <p className="-mt-1 mb-3 text-sm text-gray-500">{description}</p>}
        {children}
      </BottomSheet>
    )
  }
  return (
    <Modal open={open} onClose={onClose} title={title} description={description} footer={footer} size={size}>
      {children}
    </Modal>
  )
}

export function Kbd({ children }: { children: ReactNode }) {
  return (
    <kbd className="inline-flex min-w-[1.5rem] items-center justify-center rounded border border-gray-300 bg-gray-50 px-1.5 py-0.5 font-mono text-[11px] text-gray-700 shadow-[0_1px_0_rgba(0,0,0,0.08)]">
      {children}
    </kbd>
  )
}

/** "?" popover listing the keyboard shortcuts. */
export function ShortcutsPopover({ items }: { items: Array<{ keys: string[]; label: string }> }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])
  return (
    <div ref={ref} className="relative hidden md:block">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-label="Keyboard shortcuts"
        title="Keyboard shortcuts (?)"
        className="flex h-10 w-10 items-center justify-center rounded-lg border border-gray-300 bg-white text-gray-500 shadow-sm hover:bg-gray-50 hover:text-gray-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
      >
        <Keyboard className="h-4 w-4" />
      </button>
      {open && (
        <div className="absolute right-0 top-12 z-30 w-72 rounded-xl border border-gray-200 bg-white p-3 shadow-lg">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">Keyboard shortcuts</p>
          <ul className="space-y-1.5">
            {items.map((it) => (
              <li key={it.label} className="flex items-center justify-between gap-3 text-sm text-gray-700">
                <span>{it.label}</span>
                <span className="flex shrink-0 gap-1">
                  {it.keys.map((k) => (
                    <Kbd key={k}>{k}</Kbd>
                  ))}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

/** True when a keypress is going into a text field (shortcuts must not fire there). */
export function isTypingTarget(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null
  if (!el) return false
  const tag = el.tagName
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el.isContentEditable
}

export const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent)
export const modKey = isMac ? '⌘' : 'Ctrl'

export function AllCaughtUp({ text = 'All caught up — no customer emails waiting.' }: { text?: string }) {
  return (
    <div className="flex flex-col items-center gap-3 px-4 py-16 text-center">
      <div className="relative flex h-20 w-20 items-center justify-center rounded-full bg-emerald-50 ring-8 ring-emerald-50/50">
        <CheckCircle2 className="h-10 w-10 text-emerald-500" />
      </div>
      <p className="text-base font-semibold text-gray-900">{text}</p>
      <p className="max-w-sm text-sm text-gray-500">New drafts appear here when ViaTovia emails us about a ride. The inbox is checked every 2 minutes.</p>
    </div>
  )
}

export const fieldClass =
  'w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100 disabled:bg-gray-50 disabled:text-gray-500'
