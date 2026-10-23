// One ViaTovia email in full: what VeloxVerse read from it, why (or why not) a draft was made.
import { useEffect, useId } from 'react'
import { Link } from 'react-router-dom'
import FocusTrap from 'focus-trap-react'
import { AlertTriangle, ArrowRight, Info, Link2, EyeOff, X } from 'lucide-react'
import Button from '@/components/ui/Button'
import Skeleton from '@/components/ui/Skeleton'
import { AuditErrorState } from '../audit/AuditUI'
import { useIsTablet } from '../vv-audit/useMediaQuery'
import { BottomSheet } from '../vv-audit/BottomSheet'
import { useInboxItem } from '../../hooks/usePickdropEmails'
import { MATCH_METHOD_LABEL, draftStatusMeta, inboundStatusMeta, inboundTypeMeta, shortDateTime } from '../../pickdropEmails'
import type { Extracted, InboxDetail, InboxSummary } from '../../types'
import { AttachmentChips, EmailBody, SenderLine, VoucherLink } from './ViatoviaEmailPanel'
import { ToneChip } from './PdUI'
import { bookingPath, draftPath } from './paths'

const EXTRACTED_LABELS: Array<[keyof Extracted, string]> = [
  ['reservationNo', 'Reservation no.'],
  ['orderTag', 'Order no. (from address)'],
  ['pickupDateTime', 'Pickup'],
  ['pickupPlace', 'From'],
  ['dropoffPlace', 'To'],
  ['flightNumber', 'Flight'],
  ['vehicle', 'Vehicle'],
  ['passengers', 'Passengers'],
  ['luggage', 'Luggage'],
  ['operator', 'Transport company'],
  ['driverName', 'Driver'],
  ['driverPhone', 'Driver phone'],
  ['vehiclePlate', 'Vehicle plate'],
  ['meetingPoint', 'Meeting point'],
  ['passengerName', 'Passenger (customer)'],
  ['passengerPhone', 'Passenger phone (customer)'],
]

function Body({ email, onLink, onIgnore }: { email: InboxDetail; onLink: (e: InboxSummary) => void; onIgnore: (e: InboxSummary) => void }) {
  const type = inboundTypeMeta(email.detectedType)
  const status = inboundStatusMeta(email.status)
  const ex = email.extracted ?? {}
  const rows = EXTRACTED_LABELS.filter(([k]) => ex[k] != null && ex[k] !== '')
  const canAct = email.status === 'UNMATCHED' || email.status === 'NEW'
  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <ToneChip tone={type.tone}>{type.label}</ToneChip>
          <ToneChip tone={status.tone} dot>
            {status.label}
          </ToneChip>
          {email.matchMethod && <span className="text-xs text-gray-500">matched {MATCH_METHOD_LABEL[email.matchMethod]}</span>}
        </div>
        <p className="break-words text-base font-semibold text-gray-900">{email.subject || '(no subject)'}</p>
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-600">
          <SenderLine email={email} />
          <span>{shortDateTime(email.receivedAt)}</span>
          {email.orderNo && (
            <Link to={bookingPath(email.orderNo)} className="font-mono text-indigo-600 hover:underline">
              {email.orderNo}
            </Link>
          )}
        </div>
      </div>

      {email.error && (
        <div role="alert" className="flex items-start gap-2 rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span className="break-words">{email.error}</span>
        </div>
      )}
      {email.handledNote && (
        <div className="flex items-start gap-2 rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-sm text-sky-900">
          <Info className="mt-0.5 h-4 w-4 shrink-0" />
          <span className="break-words">
            {email.handledNote}
            {email.handledBy && <span className="block text-xs text-sky-700">— {email.handledBy}, {shortDateTime(email.handledAt)}</span>}
          </span>
        </div>
      )}
      {email.mismatches.length > 0 && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          <p className="font-semibold">Differs from our booking</p>
          <ul className="mt-1 space-y-0.5 text-xs">
            {email.mismatches.map((m) => (
              <li key={m.field} className="break-words">
                {m.field}: email “{m.email}” · ours “{m.ours}”
              </li>
            ))}
          </ul>
        </div>
      )}

      {canAct && (
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => onLink(email)} className="min-h-11">
            <Link2 className="h-4 w-4" /> Link to booking
          </Button>
          <Button variant="outline" onClick={() => onIgnore(email)} className="min-h-11">
            <EyeOff className="h-4 w-4" /> Ignore
          </Button>
        </div>
      )}

      {email.drafts.length > 0 && (
        <section className="space-y-2">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-400">Drafts made from it</h3>
          <ul className="space-y-1.5">
            {email.drafts.map((d) => {
              const m = draftStatusMeta(d.status)
              return (
                <li key={d.id}>
                  <Link
                    to={draftPath(d.id)}
                    className="flex min-h-11 items-center justify-between gap-2 rounded-lg border border-gray-200 px-3 py-2 text-sm hover:border-indigo-300 hover:bg-indigo-50/40"
                  >
                    <span className="min-w-0 truncate font-medium text-gray-900">{d.templateName}</span>
                    <span className="flex shrink-0 items-center gap-2">
                      <ToneChip tone={m.tone}>{m.label}</ToneChip>
                      <ArrowRight className="h-4 w-4 text-gray-400" />
                    </span>
                  </Link>
                </li>
              )
            })}
          </ul>
        </section>
      )}

      {rows.length > 0 && (
        <section className="space-y-2">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-400">What VeloxVerse read</h3>
          <dl className="grid grid-cols-[minmax(7rem,40%)_minmax(0,1fr)] gap-x-3 gap-y-1.5 rounded-xl border border-gray-200 px-3 py-2.5 text-sm">
            {rows.map(([k, label]) => (
              <div key={k} className="contents">
                <dt className="text-gray-500">{label}</dt>
                <dd className="break-words text-gray-900">{String(ex[k])}</dd>
              </div>
            ))}
          </dl>
        </section>
      )}

      {email.attachments.length > 0 && (
        <section className="space-y-2">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-400">Attachments</h3>
          <AttachmentChips inboxId={email.id} attachments={email.attachments} />
        </section>
      )}
      <VoucherLink url={ex.voucherUrl} />

      <section className="space-y-2">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-400">Email</h3>
        <EmailBody bodyHtml={email.bodyHtml} bodyText={email.bodyText} title="ViaTovia email" />
      </section>
    </div>
  )
}

export default function InboxDrawer({
  emailId,
  onClose,
  onLink,
  onIgnore,
}: {
  emailId: string | null
  onClose: () => void
  onLink: (e: InboxSummary) => void
  onIgnore: (e: InboxSummary) => void
}) {
  const isTablet = useIsTablet()
  const titleId = useId()
  const { data, isLoading, error, refetch } = useInboxItem(emailId)
  const content = isLoading ? (
    <div className="space-y-3">
      <Skeleton className="h-5 w-1/2" />
      <Skeleton className="h-6 w-3/4" />
      <Skeleton className="h-64 w-full" />
    </div>
  ) : error ? (
    <AuditErrorState error={error} onRetry={() => void refetch()} notFoundText="This ViaTovia email is no longer stored." />
  ) : data ? (
    <Body email={data} onLink={onLink} onIgnore={onIgnore} />
  ) : null

  useEffect(() => {
    if (!emailId || !isTablet) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && !document.querySelector('[role="dialog"][aria-modal="true"]:not([data-drawer])') && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [emailId, isTablet, onClose])

  if (!emailId) return null
  if (!isTablet) {
    return (
      <BottomSheet open onClose={onClose} title="ViaTovia email" className="max-h-[92vh]">
        {content}
      </BottomSheet>
    )
  }
  return (
    <FocusTrap focusTrapOptions={{ initialFocus: false, escapeDeactivates: false, clickOutsideDeactivates: true, returnFocusOnDeactivate: true, allowOutsideClick: true }}>
      <div className="fixed inset-0 z-40">
        <button type="button" aria-label="Close" onClick={onClose} className="absolute inset-0 bg-gray-900/30" />
        <aside
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          data-drawer
          className="absolute inset-y-0 right-0 flex w-[min(42rem,100vw)] flex-col bg-white shadow-2xl"
        >
          <div className="flex shrink-0 items-center justify-between border-b border-gray-100 px-5 py-3">
            <h2 id={titleId} className="text-base font-semibold text-gray-900">
              ViaTovia email
            </h2>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="flex h-10 w-10 items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-700"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">{content}</div>
        </aside>
      </div>
    </FocusTrap>
  )
}
