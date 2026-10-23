// "Details check": for each detail, what our booking says (just refreshed from ViaTovia), what
// ViaTovia's email said, and what will be sent. Differences can be settled in one click.
import { useState } from 'react'
import { AlertTriangle, CheckCircle2, ChevronDown, User, XCircle } from 'lucide-react'
import Button from '@/components/ui/Button'
import { cn } from '@/lib/utils'
import { detailsCheckRows, type DetailRow } from '../../pickdropEmails'
import type { DraftDetail } from '../../types'

const STATE_META = {
  ok: { icon: CheckCircle2, label: 'OK', className: 'text-emerald-600', box: 'border-gray-200 bg-white' },
  different: { icon: AlertTriangle, label: 'Different', className: 'text-amber-600', box: 'border-amber-300 bg-amber-50/60' },
  missing: { icon: XCircle, label: 'Missing', className: 'text-red-600', box: 'border-red-300 bg-red-50/60' },
} as const

function Value({ v, strong }: { v: string; strong?: boolean }) {
  return v ? (
    <span className={cn('break-words', strong ? 'font-semibold text-gray-900' : 'text-gray-700')}>{v}</span>
  ) : (
    <span className="text-gray-300">—</span>
  )
}

function RowCard({
  row,
  readOnly,
  busy,
  onUseEmail,
  onKeepOurs,
  onFill,
}: {
  row: DetailRow
  readOnly: boolean
  busy: boolean
  onUseEmail: (row: DetailRow) => void
  onKeepOurs: (row: DetailRow) => void
  onFill: (key: string) => void
}) {
  const m = STATE_META[row.state]
  const Icon = m.icon
  return (
    <li id={`detail-${row.key}`} className={cn('rounded-xl border px-3 py-2.5', m.box)}>
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-semibold text-gray-900">{row.label}</p>
        <span className={cn('inline-flex items-center gap-1 text-xs font-semibold', m.className)}>
          <Icon className="h-3.5 w-3.5" />
          {m.label}
        </span>
      </div>
      <dl className="mt-1.5 grid grid-cols-[5.5rem_minmax(0,1fr)] gap-x-2 gap-y-0.5 text-xs">
        <dt className="text-gray-500">Our booking</dt>
        <dd><Value v={row.ours} /></dd>
        <dt className="text-gray-500">ViaTovia email</dt>
        <dd><Value v={row.email} /></dd>
        <dt className="text-gray-500">Will be sent</dt>
        <dd><Value v={row.willSend} strong /></dd>
      </dl>
      {!readOnly && row.state === 'different' && (
        <div className="mt-2 flex flex-wrap gap-2">
          <Button size="sm" onClick={() => onUseEmail(row)} loading={busy} disabled={!row.mismatch?.email && !row.email} className="min-h-9">
            Use ViaTovia&apos;s
          </Button>
          <Button size="sm" variant="outline" onClick={() => onKeepOurs(row)} className="min-h-9">
            Keep ours
          </Button>
        </div>
      )}
      {!readOnly && row.state === 'missing' && (
        <div className="mt-2 flex flex-wrap gap-2">
          {row.email && (
            <Button size="sm" onClick={() => onUseEmail(row)} loading={busy} className="min-h-9">
              Use ViaTovia&apos;s: {row.email.length > 24 ? `${row.email.slice(0, 24)}…` : row.email}
            </Button>
          )}
          <Button size="sm" variant="outline" onClick={() => onFill(row.key)} className="min-h-9">
            Fill in
          </Button>
        </div>
      )}
    </li>
  )
}

export default function DetailsCheck({
  draft,
  dismissed,
  onDismiss,
  onUseValue,
  onFill,
  readOnly = false,
  busyKey,
}: {
  draft: DraftDetail
  dismissed: ReadonlySet<string>
  onDismiss: (key: string) => void
  onUseValue: (key: string, value: string) => void
  onFill: (key: string) => void
  readOnly?: boolean
  busyKey?: string | null
}) {
  const [showMore, setShowMore] = useState(false)
  const rows = detailsCheckRows(draft, dismissed)
  const main = rows.filter((r) => r.relevant)
  const more = rows.filter((r) => !r.relevant)
  const problems = rows.filter((r) => r.state !== 'ok').length
  const ex = draft.sourceEmail?.extracted
  const card = (r: DetailRow) => (
    <RowCard
      key={r.key}
      row={r}
      readOnly={readOnly}
      busy={busyKey === r.key}
      onUseEmail={(row) => onUseValue(row.key, row.mismatch?.email || row.email)}
      onKeepOurs={(row) => onDismiss(row.key)}
      onFill={onFill}
    />
  )

  return (
    <div className="space-y-3">
      <p className={cn('text-sm', problems ? 'font-medium text-amber-800' : 'text-emerald-700')}>
        {problems ? `${problems} detail${problems === 1 ? '' : 's'} to check` : '✓ Everything matches'}
      </p>
      {draft.booking?.lastSyncedAt && (
        <p className="text-xs text-gray-500">Our booking was refreshed from ViaTovia {new Date(draft.booking.lastSyncedAt).toLocaleString()}.</p>
      )}
      <ul className="space-y-2">{main.map(card)}</ul>
      {more.length > 0 && (
        <div>
          <button
            type="button"
            onClick={() => setShowMore((s) => !s)}
            aria-expanded={showMore}
            className="inline-flex min-h-10 items-center gap-1 text-sm font-medium text-gray-600 hover:text-gray-900"
          >
            <ChevronDown className={cn('h-4 w-4 transition-transform', showMore && 'rotate-180')} />
            More details ({more.length})
          </button>
          {showMore && <ul className="mt-2 space-y-2">{more.map(card)}</ul>}
        </div>
      )}
      {/* The customer as ViaTovia holds them — to compare with our customer, never a driver detail. */}
      {(ex?.passengerName || ex?.passengerPhone) && (
        <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 px-3 py-2 text-xs text-gray-600">
          <p className="mb-0.5 inline-flex items-center gap-1 font-semibold text-gray-700">
            <User className="h-3.5 w-3.5" /> Passenger as ViaTovia has it
          </p>
          <p className="break-words">
            {ex.passengerName || '—'}
            {ex.passengerPhone ? ` · ${ex.passengerPhone}` : ''}
          </p>
        </div>
      )}
    </div>
  )
}
