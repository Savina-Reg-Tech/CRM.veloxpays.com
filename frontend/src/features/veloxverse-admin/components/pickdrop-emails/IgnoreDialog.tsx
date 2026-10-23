import { useEffect, useState } from 'react'
import { EyeOff } from 'lucide-react'
import Button from '@/components/ui/Button'
import { useToast } from '@/app/providers/ToastProvider'
import { useIgnoreInbox } from '../../hooks/usePickdropEmails'
import { pdErrorText } from '../../pickdropEmails'
import type { InboxSummary } from '../../types'
import { ResponsiveDialog, fieldClass } from './PdUI'

const NOTES = ['Spam', 'Not our booking', 'Marketing email']

export default function IgnoreDialog({ email, onClose }: { email: InboxSummary | null; onClose: () => void }) {
  const [note, setNote] = useState('')
  const [error, setError] = useState('')
  const ignore = useIgnoreInbox()
  const { showToast } = useToast()

  useEffect(() => {
    setNote('')
    setError('')
  }, [email?.id])

  const submit = () => {
    if (!email) return
    ignore.mutate(
      { id: email.id, note: note.trim() || undefined },
      {
        onSuccess: () => {
          onClose()
          showToast({ type: 'success', title: 'Marked as no action needed' })
        },
        onError: (err) => setError(pdErrorText(err)),
      },
    )
  }

  return (
    <ResponsiveDialog
      open={!!email}
      onClose={onClose}
      title="No action needed?"
      description={email?.subject ?? undefined}
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={ignore.isPending}>
            Cancel
          </Button>
          <Button onClick={submit} loading={ignore.isPending}>
            <EyeOff className="h-4 w-4" /> Ignore email
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
        <p className="text-sm text-gray-600">It leaves the Unmatched list. No customer email is made.</p>
        <label htmlFor="ignore-note" className="block text-sm font-medium text-gray-800">
          Note <span className="font-normal text-gray-400">(optional)</span>
        </label>
        <div className="flex flex-wrap gap-2">
          {NOTES.map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => setNote(n)}
              className={
                note === n
                  ? 'min-h-9 rounded-full border border-indigo-300 bg-indigo-50 px-3 text-xs font-medium text-indigo-700'
                  : 'min-h-9 rounded-full border border-gray-200 bg-white px-3 text-xs font-medium text-gray-600 hover:bg-gray-50'
              }
            >
              {n}
            </button>
          ))}
        </div>
        <input id="ignore-note" value={note} onChange={(e) => setNote(e.target.value)} maxLength={300} className={`${fieldClass} h-11`} />
        {error && (
          <p role="alert" className="text-sm text-red-700">
            {error}
          </p>
        )}
      </form>
    </ResponsiveDialog>
  )
}
