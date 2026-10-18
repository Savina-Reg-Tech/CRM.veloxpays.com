import { AlertOctagon, CheckCircle2, Clock, Info, X } from 'lucide-react'
import type { RefundOutcome, RefundTone } from '../refundOutcome'

const TONE: Record<RefundTone, { box: string; icon: typeof Info; iconClass: string }> = {
  success: { box: 'border-emerald-200 bg-emerald-50 text-emerald-900', icon: CheckCircle2, iconClass: 'text-emerald-600' },
  warning: { box: 'border-amber-300 bg-amber-50 text-amber-900', icon: Clock, iconClass: 'text-amber-600' },
  danger: { box: 'border-red-400 bg-red-50 text-red-900 ring-2 ring-red-200', icon: AlertOctagon, iconClass: 'text-red-600' },
  neutral: { box: 'border-gray-200 bg-gray-50 text-gray-800', icon: Info, iconClass: 'text-gray-500' },
}

/**
 * Result of an admin cancel / refund. Stays on the page until dismissed — a failed refund is an
 * action item for staff ("refund manually"), so it must not vanish like a toast.
 */
export default function RefundOutcomeNotice({
  outcome,
  subject,
  onDismiss,
}: {
  outcome: RefundOutcome
  /** Who / what was cancelled, e.g. "Jane Doe · TRF-123". */
  subject?: string
  onDismiss: () => void
}) {
  const t = TONE[outcome.tone]
  const Icon = t.icon
  return (
    <div role={outcome.tone === 'danger' ? 'alert' : 'status'} className={`flex items-start gap-3 rounded-xl border px-4 py-3 ${t.box}`}>
      <Icon className={`mt-0.5 h-5 w-5 shrink-0 ${t.iconClass}`} />
      <div className="min-w-0 flex-1 break-words">
        <p className="text-sm font-semibold">{outcome.title}</p>
        <p className="text-sm">{outcome.message}</p>
        {subject && <p className="mt-0.5 text-xs opacity-75">{subject}</p>}
      </div>
      <button type="button" onClick={onDismiss} aria-label="Dismiss" className="shrink-0 rounded p-1 opacity-70 transition hover:opacity-100">
        <X className="h-4 w-4" />
      </button>
    </div>
  )
}
