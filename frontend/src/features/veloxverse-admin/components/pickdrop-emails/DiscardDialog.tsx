import { useEffect, useState } from 'react'
import { Trash2 } from 'lucide-react'
import Button from '@/components/ui/Button'
import { useToast } from '@/app/providers/ToastProvider'
import { useDiscardDraft } from '../../hooks/usePickdropEmails'
import { pdErrorText } from '../../pickdropEmails'
import type { DraftDetail } from '../../types'
import { ResponsiveDialog, fieldClass } from './PdUI'

const REASONS = ['Customer already informed by phone', 'Duplicate', 'Details not final yet', 'Ride cancelled']

export default function DiscardDialog({
  draft,
  open,
  onClose,
  onDiscarded,
}: {
  draft: Pick<DraftDetail, 'id' | 'orderNo'>
  open: boolean
  onClose: () => void
  onDiscarded: (detail: DraftDetail) => void
}) {
  const [reason, setReason] = useState('')
  const [error, setError] = useState('')
  const discard = useDiscardDraft()
  const { showToast } = useToast()

  useEffect(() => {
    if (open) {
      setReason('')
      setError('')
    }
  }, [open])

  const submit = () => {
    const r = reason.trim()
    if (!r) {
      setError('Give a reason so the team knows why this email was not sent.')
      return
    }
    discard.mutate(
      { id: draft.id, orderNo: draft.orderNo, reason: r },
      {
        onSuccess: (detail) => {
          onClose()
          showToast({ type: 'success', title: 'Draft discarded', message: 'The customer was not emailed.' })
          onDiscarded(detail)
        },
        onError: (err) => setError(pdErrorText(err)),
      },
    )
  }

  return (
    <ResponsiveDialog
      open={open}
      onClose={onClose}
      title="Discard this email?"
      description="The customer won't get it. You can still create a new email from the booking later."
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={discard.isPending}>
            Keep draft
          </Button>
          <Button variant="danger" onClick={submit} loading={discard.isPending} disabled={!reason.trim()}>
            <Trash2 className="h-4 w-4" /> Discard
          </Button>
        </>
      }
    >
      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault()
          submit()
        }}
      >
        <label htmlFor="discard-reason" className="block text-sm font-medium text-gray-800">
          Reason <span className="text-red-600">*</span>
        </label>
        <div className="flex flex-wrap gap-2">
          {REASONS.map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => {
                setReason(r)
                setError('')
              }}
              className={
                reason === r
                  ? 'min-h-9 rounded-full border border-indigo-300 bg-indigo-50 px-3 text-xs font-medium text-indigo-700'
                  : 'min-h-9 rounded-full border border-gray-200 bg-white px-3 text-xs font-medium text-gray-600 hover:bg-gray-50'
              }
            >
              {r}
            </button>
          ))}
        </div>
        <textarea
          id="discard-reason"
          value={reason}
          onChange={(e) => {
            setReason(e.target.value)
            setError('')
          }}
          rows={3}
          maxLength={500}
          placeholder="Why isn't this email needed?"
          className={`${fieldClass} resize-y`}
          autoFocus
        />
        {error && (
          <p role="alert" className="text-sm text-red-700">
            {error}
          </p>
        )}
      </form>
    </ResponsiveDialog>
  )
}
