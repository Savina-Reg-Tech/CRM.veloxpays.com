// Link an unmatched ViaTovia email to its booking: suggested bookings first, or type an order no.
// VeloxVerse then refreshes the booking and makes the draft (when one is needed).
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { CheckCircle2, Link2, MapPin, Plane, User } from 'lucide-react'
import Button from '@/components/ui/Button'
import Skeleton from '@/components/ui/Skeleton'
import { useToast } from '@/app/providers/ToastProvider'
import { useInboxItem, useLinkInbox } from '../../hooks/usePickdropEmails'
import { inboundTypeMeta, pdErrorText } from '../../pickdropEmails'
import type { InboxDetail, InboxSummary } from '../../types'
import { ResponsiveDialog, ToneChip, fieldClass } from './PdUI'
import { draftPath } from './paths'

export default function LinkEmailDialog({ email, onClose }: { email: InboxSummary | null; onClose: () => void }) {
  const { data: detail, isLoading } = useInboxItem(email?.id)
  const link = useLinkInbox()
  const { showToast } = useToast()
  const navigate = useNavigate()
  const [orderNo, setOrderNo] = useState('')
  const [error, setError] = useState('')
  const [linking, setLinking] = useState<string | null>(null)
  const [result, setResult] = useState<InboxDetail | null>(null)

  useEffect(() => {
    setOrderNo('')
    setError('')
    setResult(null)
    setLinking(null)
  }, [email?.id])

  const doLink = (no: string) => {
    const value = no.trim()
    if (!email || !value) return
    setError('')
    setLinking(value)
    link.mutate(
      { id: email.id, orderNo: value },
      {
        onSuccess: (res) => {
          setResult(res)
          const made = res.drafts.find((d) => d.status === 'DRAFT' || d.status === 'FAILED')
          showToast({
            type: 'success',
            title: `Linked to ${res.orderNo ?? value}`,
            message: made ? 'Draft created.' : res.handledNote ?? 'No customer email needed.',
          })
        },
        onError: (err) => setError(pdErrorText(err)),
        onSettled: () => setLinking(null),
      },
    )
  }

  const ex = detail?.extracted
  const newDraft = result?.drafts.find((d) => d.status === 'DRAFT' || d.status === 'FAILED')
  const type = email ? inboundTypeMeta(email.detectedType) : null

  return (
    <ResponsiveDialog
      open={!!email}
      onClose={onClose}
      title={result ? 'Linked' : 'Link to a booking'}
      size="xl"
      footer={
        result ? (
          <>
            <Button variant="outline" onClick={onClose}>
              Close
            </Button>
            {newDraft && (
              <Button
                onClick={() => {
                  onClose()
                  navigate(draftPath(newDraft.id))
                }}
              >
                Open draft
              </Button>
            )}
          </>
        ) : (
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
        )
      }
    >
      {result ? (
        <div className="flex flex-col items-center gap-2 py-4 text-center">
          <CheckCircle2 className="h-10 w-10 text-emerald-500" />
          <p className="text-base font-semibold text-gray-900">Linked to {result.orderNo}</p>
          <p className="max-w-md text-sm text-gray-600">
            {newDraft ? `A “${newDraft.templateName}” draft is ready to review.` : result.handledNote ?? 'No customer email is needed for this ViaTovia email.'}
          </p>
        </div>
      ) : (
        <div className="space-y-5">
          {/* The email in short */}
          <div className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm">
            <div className="flex flex-wrap items-center gap-2">
              {type && <ToneChip tone={type.tone}>{type.label}</ToneChip>}
              {email?.reservationNo && <span className="font-mono text-xs text-gray-600">Res. {email.reservationNo}</span>}
            </div>
            <p className="mt-1 break-words font-medium text-gray-900">{email?.subject || '(no subject)'}</p>
            {isLoading ? (
              <Skeleton className="mt-2 h-4 w-2/3" />
            ) : (
              <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-600">
                {ex?.pickupDateTime && <span>Pickup {ex.pickupDateTime}</span>}
                {ex?.flightNumber && (
                  <span className="inline-flex items-center gap-1">
                    <Plane className="h-3.5 w-3.5" /> {ex.flightNumber}
                  </span>
                )}
                {ex?.passengerName && (
                  <span className="inline-flex items-center gap-1">
                    <User className="h-3.5 w-3.5" /> {ex.passengerName}
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Suggested bookings */}
          <div className="space-y-2">
            <p className="text-sm font-semibold text-gray-800">Suggested bookings</p>
            {isLoading ? (
              <div className="grid gap-2 sm:grid-cols-2">
                <Skeleton className="h-28 w-full" />
                <Skeleton className="h-28 w-full" />
              </div>
            ) : (detail?.candidates?.length ?? 0) === 0 ? (
              <p className="rounded-xl border border-dashed border-gray-200 px-3 py-4 text-center text-sm text-gray-500">
                No likely booking found — enter the order number below.
              </p>
            ) : (
              <ul className="grid gap-2 sm:grid-cols-2">
                {detail!.candidates.map((c) => (
                  <li key={c.orderNo} className="flex flex-col gap-2 rounded-xl border border-gray-200 bg-white p-3 shadow-sm">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate font-mono text-xs text-gray-500">{c.orderNo}</p>
                        <p className="truncate text-sm font-semibold text-gray-900">{c.customerName ?? 'Unknown customer'}</p>
                      </div>
                      {c.reservationNo && <span className="shrink-0 font-mono text-[11px] text-gray-500">Res. {c.reservationNo}</span>}
                    </div>
                    <div className="space-y-0.5 text-xs text-gray-600">
                      <p>Pickup {c.pickupLocal ?? '—'} (local)</p>
                      <p className="flex items-start gap-1">
                        <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-gray-400" />
                        <span className="break-words">
                          {c.pickupName ?? '—'} → {c.dropoffName ?? '—'}
                        </span>
                      </p>
                      {c.flightNumber && <p>Flight {c.flightNumber}</p>}
                    </div>
                    <Button size="sm" className="mt-auto min-h-10" onClick={() => doLink(c.orderNo)} loading={linking === c.orderNo} disabled={!!linking}>
                      <Link2 className="h-4 w-4" /> Link to this booking
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Or type it */}
          <form
            className="space-y-1.5"
            onSubmit={(e) => {
              e.preventDefault()
              doLink(orderNo)
            }}
          >
            <label htmlFor="link-order-no" className="text-sm font-semibold text-gray-800">
              Or enter an order number
            </label>
            <div className="flex flex-col gap-2 sm:flex-row">
              <input
                id="link-order-no"
                value={orderNo}
                onChange={(e) => {
                  setOrderNo(e.target.value)
                  setError('')
                }}
                placeholder="TRF-…"
                autoComplete="off"
                className={`${fieldClass} h-11 font-mono sm:flex-1`}
              />
              <Button type="submit" className="min-h-11" disabled={orderNo.trim().length < 3 || !!linking} loading={linking === orderNo.trim()}>
                <Link2 className="h-4 w-4" /> Link
              </Button>
            </div>
          </form>
          {error && (
            <p role="alert" className="rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800">
              {error}
            </p>
          )}
        </div>
      )}
    </ResponsiveDialog>
  )
}
