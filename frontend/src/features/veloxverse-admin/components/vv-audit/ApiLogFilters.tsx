// Filters for the API Logs list. All state lives in the URL query string; these components read
// URLSearchParams and report patches ({ key: value | undefined }). Quick chips · "More filters"
// (inline grid ≥ md, bottom sheet < md with Clear all + Apply) · removable active-filter chips.
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { MoreHorizontal, SlidersHorizontal, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import Button from '@/components/ui/Button'
import { API_OUTCOME_META, API_STATUS_CLASS_META, API_SUPPLIER_LABEL, apiOutcomeMeta, apiSupplierLabel, serviceLabel } from '../../audit'
import type { ApiLogFilters, ApiLogStatusClass } from '../../auditTypes'
import { useVVAuditMeta } from '../../hooks/useVVAudit'
import { DebouncedInput, MultiSelect, selectClass } from '../audit/AuditUI'
import { BottomSheet } from './BottomSheet'

export type ParamPatch = Record<string, string | undefined>

/** Comma-separated list params. */
export const API_LOG_LIST_KEYS = ['direction', 'outcome', 'statusClass', 'method', 'service', 'supplier'] as const
/** Free-text / exact params. */
export const API_LOG_TEXT_KEYS = ['statusCode', 'route', 'ref', 'requestId', 'journeyId', 'userId', 'email', 'jobName', 'minDurationMs'] as const
export const API_LOG_FLAG_KEYS = ['errorsOnly', 'moneyOnly'] as const
/** The fields inside "More filters" — what the "Filters (N)" count counts. */
export const API_LOG_PANEL_KEYS = ['outcome', 'statusClass', 'statusCode', 'method', 'service', 'supplier', 'route', 'email', 'jobName', 'requestId'] as const
/** Every filter param (not the range, not ?log). */
export const API_LOG_FILTER_KEYS = [...API_LOG_LIST_KEYS, ...API_LOG_TEXT_KEYS, ...API_LOG_FLAG_KEYS] as const

export function splitList(v: string | null | undefined): string[] {
  return v ? v.split(',').filter(Boolean) : []
}

/** URL → ApiLogFilters (without from / to — the page adds the range). */
export function apiLogFiltersFromParams(params: URLSearchParams): ApiLogFilters {
  const f: ApiLogFilters = {}
  for (const k of API_LOG_LIST_KEYS) {
    const v = splitList(params.get(k))
    if (v.length) f[k] = v
  }
  for (const k of ['route', 'ref', 'requestId', 'journeyId', 'userId', 'email', 'jobName'] as const) {
    const v = params.get(k)?.trim()
    if (v) f[k] = v
  }
  const code = Number(params.get('statusCode'))
  if (Number.isInteger(code) && code >= 100 && code <= 599) f.statusCode = code
  const min = Number(params.get('minDurationMs'))
  if (Number.isFinite(min) && min > 0) f.minDurationMs = min
  if (params.get('errorsOnly') === '1') f.errorsOnly = true
  if (params.get('moneyOnly') === '1') f.moneyOnly = true
  return f
}

export function countPanelFilters(params: URLSearchParams): number {
  return API_LOG_PANEL_KEYS.filter((k) => Boolean(params.get(k))).length
}

export function hasAnyFilter(params: URLSearchParams): boolean {
  return API_LOG_FILTER_KEYS.some((k) => Boolean(params.get(k)))
}

/** Removes every filter (keeps the range and an open ?log). */
export function clearAllPatch(): ParamPatch {
  return Object.fromEntries(API_LOG_FILTER_KEYS.map((k) => [k, undefined]))
}

const FIELD_LABEL: Record<string, string> = {
  direction: 'Direction',
  outcome: 'Outcome',
  statusClass: 'Status class',
  statusCode: 'Status code',
  method: 'Method',
  service: 'Service',
  supplier: 'Supplier',
  route: 'Route contains',
  ref: 'Search',
  requestId: 'Request id',
  journeyId: 'Journey id',
  userId: 'Customer id',
  email: 'Customer email',
  jobName: 'Job name',
}

const DIRECTION_CHIP: Record<string, string> = { inbound: 'Inbound', outbound: 'Supplier calls', webhook: 'Webhooks' }

const statusClassLabel = (v: string) => (v === 'none' ? 'No answer' : `${v} · ${API_STATUS_CLASS_META[v as ApiLogStatusClass]?.label ?? v}`)

function formatValue(key: string, v: string): string {
  if (key === 'outcome') return apiOutcomeMeta(v).label
  if (key === 'statusClass') return statusClassLabel(v)
  if (key === 'service') return serviceLabel(v)
  if (key === 'supplier') return apiSupplierLabel(v)
  if (key === 'direction') return DIRECTION_CHIP[v] ?? v
  return v
}

// ── Quick chips ─────────────────────────────────────────────────────

const chipClass = (on: boolean) =>
  cn(
    'inline-flex min-h-11 shrink-0 items-center whitespace-nowrap rounded-full px-3.5 text-sm font-medium ring-1 ring-inset transition-colors lg:min-h-9 lg:text-xs',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500',
    on ? 'bg-indigo-600 text-white ring-indigo-600' : 'bg-white text-gray-700 ring-gray-300 hover:bg-gray-50'
  )

export function QuickFilterChips({ params, onPatch, className }: { params: URLSearchParams; onPatch: (p: ParamPatch) => void; className?: string }) {
  const directions = splitList(params.get('direction'))
  const toggleDirection = (d: string) => {
    const next = directions.includes(d) ? directions.filter((x) => x !== d) : [...directions, d]
    onPatch({ direction: next.join(',') || undefined })
  }
  const chips: Array<{ key: string; label: string; on: boolean; toggle: () => void }> = [
    { key: 'errors', label: 'Errors only', on: params.get('errorsOnly') === '1', toggle: () => onPatch({ errorsOnly: params.get('errorsOnly') === '1' ? undefined : '1' }) },
    { key: 'money', label: 'Money calls', on: params.get('moneyOnly') === '1', toggle: () => onPatch({ moneyOnly: params.get('moneyOnly') === '1' ? undefined : '1' }) },
    ...(['inbound', 'outbound', 'webhook'] as const).map((d) => ({ key: d, label: DIRECTION_CHIP[d], on: directions.includes(d), toggle: () => toggleDirection(d) })),
    {
      key: 'slow',
      label: 'Slow (> 5 s)',
      on: params.get('minDurationMs') === '5000',
      toggle: () => onPatch({ minDurationMs: params.get('minDurationMs') === '5000' ? undefined : '5000' }),
    },
  ]
  return (
    <div
      role="group"
      aria-label="Quick filters"
      className={cn(
        // Phones: one row that scrolls sideways (inside itself — never the page).
        '-mx-1 flex flex-nowrap gap-2 overflow-x-auto px-1 py-0.5 [scrollbar-width:none] md:flex-wrap md:overflow-visible [&::-webkit-scrollbar]:hidden',
        className
      )}
    >
      {chips.map((c) => (
        <button key={c.key} type="button" aria-pressed={c.on} onClick={c.toggle} className={chipClass(c.on)}>
          {c.label}
        </button>
      ))}
    </div>
  )
}

// ── Fields (shared by the inline panel and the sheet) ───────────────

function useFieldOptions() {
  const meta = useVVAuditMeta()
  const api = meta.data?.apiLogs
  const suppliers = Array.from(new Set([...(meta.data?.suppliers ?? []), ...Object.keys(API_SUPPLIER_LABEL)]))
  return {
    outcome: api?.outcomes.map((o) => o.value) ?? (Object.keys(API_OUTCOME_META) as string[]),
    statusClass: api?.statusClasses ?? ['2xx', '3xx', '4xx', '5xx', 'none'],
    method: api?.methods ?? ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'SMTP', 'S3'],
    service: meta.data?.services ?? [],
    supplier: suppliers,
  } as Record<'outcome' | 'statusClass' | 'method' | 'service' | 'supplier', string[]>
}

const TEXT_FIELDS: Array<{ key: string; placeholder: string; type?: string; inputMode?: 'numeric' | 'email' }> = [
  { key: 'statusCode', placeholder: 'e.g. 502', type: 'number', inputMode: 'numeric' },
  { key: 'route', placeholder: 'e.g. /lounge/visits' },
  { key: 'email', placeholder: 'Exact email', type: 'email', inputMode: 'email' },
  { key: 'jobName', placeholder: 'e.g. dragonpassReconciliation' },
  { key: 'requestId', placeholder: '16-hex or job-…' },
]

const MULTI_FIELDS = ['outcome', 'statusClass', 'method', 'service', 'supplier'] as const

function FieldLabel({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <p className="mb-1 text-xs font-medium text-gray-600">{label}</p>
      {children}
    </div>
  )
}

/** Normalises a text field for the URL ('' → undefined; status code must be 3 digits). */
function cleanText(key: string, v: string): string | undefined {
  const t = v.trim()
  if (!t) return undefined
  if (key === 'statusCode') return /^\d{3}$/.test(t) ? t : undefined
  return t
}

function multiFormat(key: string) {
  return (v: string) => formatValue(key, v)
}

/** Inline "More filters" grid (≥ md). Applies as you change it; text boxes debounce. */
export function ApiLogFilterPanel({ params, onPatch, className }: { params: URLSearchParams; onPatch: (p: ParamPatch) => void; className?: string }) {
  const options = useFieldOptions()
  return (
    <div className={cn('grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6', className)}>
      {MULTI_FIELDS.map((k) => (
        <FieldLabel key={k} label={FIELD_LABEL[k]}>
          <MultiSelect
            label={FIELD_LABEL[k]}
            options={options[k]}
            value={splitList(params.get(k))}
            onChange={(v) => onPatch({ [k]: v.join(',') || undefined })}
            format={multiFormat(k)}
          />
        </FieldLabel>
      ))}
      {TEXT_FIELDS.map((f) => (
        <FieldLabel key={f.key} label={FIELD_LABEL[f.key]}>
          <DebouncedInput
            value={params.get(f.key) ?? ''}
            onChange={(v) => onPatch({ [f.key]: cleanText(f.key, v) })}
            placeholder={f.placeholder}
            type={f.type}
            aria-label={FIELD_LABEL[f.key]}
          />
        </FieldLabel>
      ))}
    </div>
  )
}

/** < md: the same fields one per row in a bottom sheet; nothing applies until Apply. */
export function ApiLogFilterSheet({
  open,
  onClose,
  params,
  onApply,
  extra,
}: {
  open: boolean
  onClose: () => void
  params: URLSearchParams
  onApply: (p: ParamPatch) => void
  /** Rendered above the fields (e.g. the custom date range on phones). */
  extra?: ReactNode
}) {
  const options = useFieldOptions()
  const [draft, setDraft] = useState<Record<string, string>>({})
  const paramString = params.toString()
  useEffect(() => {
    if (!open) return
    const p = new URLSearchParams(paramString)
    setDraft(Object.fromEntries(API_LOG_PANEL_KEYS.map((k) => [k, p.get(k) ?? ''])))
  }, [open, paramString])

  const set = (k: string, v: string) => setDraft((d) => ({ ...d, [k]: v }))
  const apply = () => {
    const patch: ParamPatch = {}
    for (const k of API_LOG_PANEL_KEYS) {
      const v = draft[k] ?? ''
      patch[k] = MULTI_FIELDS.includes(k as (typeof MULTI_FIELDS)[number]) ? v || undefined : cleanText(k, v)
    }
    onApply(patch)
    onClose()
  }

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title="Filters"
      footer={
        <div className="flex gap-2">
          <Button type="button" variant="outline" className="min-h-11 flex-1" onClick={() => setDraft(Object.fromEntries(API_LOG_PANEL_KEYS.map((k) => [k, ''])))}>
            Clear all
          </Button>
          <Button type="button" className="min-h-11 flex-1" onClick={apply}>
            Apply
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        {extra}
        {MULTI_FIELDS.map((k) => (
          <FieldLabel key={k} label={FIELD_LABEL[k]}>
            <MultiSelect
              label={FIELD_LABEL[k]}
              options={options[k]}
              value={splitList(draft[k])}
              onChange={(v) => set(k, v.join(','))}
              format={multiFormat(k)}
            />
          </FieldLabel>
        ))}
        {TEXT_FIELDS.map((f) => (
          <label key={f.key} className="block min-w-0">
            <span className="mb-1 block text-xs font-medium text-gray-600">{FIELD_LABEL[f.key]}</span>
            <input
              type={f.type ?? 'text'}
              inputMode={f.inputMode}
              value={draft[f.key] ?? ''}
              onChange={(e) => set(f.key, e.target.value)}
              placeholder={f.placeholder}
              className={cn(selectClass, 'h-11')}
            />
          </label>
        ))}
      </div>
    </BottomSheet>
  )
}

// ── Active filters ──────────────────────────────────────────────────

export function activeFilterChips(params: URLSearchParams): Array<{ id: string; label: string; patch: ParamPatch }> {
  const out: Array<{ id: string; label: string; patch: ParamPatch }> = []
  for (const k of API_LOG_LIST_KEYS) {
    const values = splitList(params.get(k))
    for (const v of values) {
      out.push({
        id: `${k}:${v}`,
        label: k === 'direction' ? formatValue(k, v) : `${FIELD_LABEL[k]}: ${formatValue(k, v)}`,
        patch: { [k]: values.filter((x) => x !== v).join(',') || undefined },
      })
    }
  }
  if (params.get('errorsOnly') === '1') out.push({ id: 'errorsOnly', label: 'Errors only', patch: { errorsOnly: undefined } })
  if (params.get('moneyOnly') === '1') out.push({ id: 'moneyOnly', label: 'Money calls', patch: { moneyOnly: undefined } })
  const min = Number(params.get('minDurationMs'))
  if (min > 0) out.push({ id: 'minDurationMs', label: min === 5000 ? 'Slow (> 5 s)' : `Slower than ${min.toLocaleString()} ms`, patch: { minDurationMs: undefined } })
  for (const k of ['ref', 'statusCode', 'route', 'requestId', 'journeyId', 'userId', 'email', 'jobName'] as const) {
    const v = params.get(k)
    if (v) out.push({ id: k, label: `${FIELD_LABEL[k]}: ${v}`, patch: { [k]: undefined } })
  }
  return out
}

export function ActiveFilterChips({ params, onPatch, onClearAll }: { params: URLSearchParams; onPatch: (p: ParamPatch) => void; onClearAll: () => void }) {
  const chips = activeFilterChips(params)
  if (!chips.length) return null
  return (
    <div className="-mx-1 flex flex-nowrap items-center gap-1.5 overflow-x-auto px-1 py-0.5 [scrollbar-width:none] md:flex-wrap md:overflow-visible [&::-webkit-scrollbar]:hidden">
      {chips.map((c) => (
        <span
          key={c.id}
          className="inline-flex min-h-11 max-w-[80vw] shrink-0 items-center gap-0.5 rounded-full bg-indigo-50 pl-3 text-sm text-indigo-800 ring-1 ring-inset ring-indigo-100 md:min-h-8 md:max-w-full md:text-xs"
        >
          <span className="min-w-0 truncate md:whitespace-normal md:break-all" title={c.label}>{c.label}</span>
          <button
            type="button"
            onClick={() => onPatch(c.patch)}
            aria-label={`Remove filter ${c.label}`}
            className="flex h-11 w-10 shrink-0 items-center justify-center rounded-full hover:text-indigo-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 md:h-8 md:w-8"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </span>
      ))}
      <button
        type="button"
        onClick={onClearAll}
        className="min-h-11 shrink-0 px-2 text-sm text-gray-600 underline hover:text-gray-900 md:min-h-8 md:text-xs"
      >
        Clear all
      </button>
    </div>
  )
}

// ── Buttons ─────────────────────────────────────────────────────────

export function FiltersButton({ count, expanded, onClick, className }: { count: number; expanded?: boolean; onClick: () => void; className?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-expanded={expanded}
      className={cn(
        'inline-flex h-11 shrink-0 items-center gap-1.5 rounded-lg border px-3 text-sm font-medium md:h-10',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500',
        count ? 'border-indigo-300 bg-indigo-50 text-indigo-800' : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50',
        className
      )}
    >
      <SlidersHorizontal className="h-4 w-4" aria-hidden="true" />
      Filters{count > 0 ? ` (${count})` : ''}
    </button>
  )
}

/** "⋯" menu for actions that don't fit on a phone (e.g. Export CSV). */
export function OverflowMenu({
  items,
  label = 'More actions',
  className,
}: {
  items: Array<{ key: string; label: ReactNode; onSelect: () => void; disabled?: boolean }>
  label?: string
  className?: string
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement | null>(null)
  useEffect(() => {
    if (!open) return
    const close = (e: MouseEvent | TouchEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('mousedown', close)
    document.addEventListener('touchstart', close)
    document.addEventListener('keydown', esc)
    return () => {
      document.removeEventListener('mousedown', close)
      document.removeEventListener('touchstart', close)
      document.removeEventListener('keydown', esc)
    }
  }, [open])
  if (!items.length) return null
  return (
    <div ref={ref} className={cn('relative shrink-0', className)}>
      <button
        type="button"
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="inline-flex h-11 w-11 items-center justify-center rounded-lg border border-gray-300 bg-white text-gray-600 hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
      >
        <MoreHorizontal className="h-5 w-5" />
      </button>
      {open && (
        <div role="menu" className="absolute right-0 z-30 mt-1 w-56 max-w-[85vw] rounded-lg border border-gray-200 bg-white p-1 shadow-lg">
          {items.map((it) => (
            <button
              key={it.key}
              type="button"
              role="menuitem"
              disabled={it.disabled}
              onClick={() => {
                setOpen(false)
                it.onSelect()
              }}
              className="flex min-h-11 w-full items-center gap-2 rounded-md px-3 text-left text-sm text-gray-800 hover:bg-gray-50 disabled:opacity-50"
            >
              {it.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
