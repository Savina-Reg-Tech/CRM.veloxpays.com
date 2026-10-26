// The send confirmation, shared by the Review screen and the queue's quick Send. Shows the email
// exactly as the customer will get it (VeloxVerse's rendered preview), handles the second
// "ride is cancelled — send anyway?" confirmation and every send error VeloxVerse gives.
import { useEffect, useState } from 'react'
import { AlertTriangle, Bell, Lock, Paperclip, Send } from 'lucide-react'
import Button from '@/components/ui/Button'
import Skeleton from '@/components/ui/Skeleton'
import { useToast } from '@/app/providers/ToastProvider'
import { useDraft, useSendDraft } from '../../hooks/usePickdropEmails'
import {
  SUPPLIER_COPY_EMOJI,
  isConflict,
  isSupplierCopy,
  isTestModeError,
  isVoucherError,
  missingFromError,
  needsCancelledConfirm,
  pdErrorText,
  shortDateTime,
} from '../../pickdropEmails'
import type { DraftDetail } from '../../types'
import { Kbd, ResponsiveDialog, modKey } from './PdUI'
import { SafeHtmlFrame } from './SafeHtmlFrame'

export interface SendOutcomeHandlers {
  onSent: (detail: DraftDetail) => void
  /** 400 "Fill in before sending" — the keys to highlight. */
  onMissing?: (keys: string[], message: string) => void
  /** 403/502 "Test mode: …" — nothing was sent. */
  onTestMode?: (message: string) => void
  /** 400 about the voucher PDF. */
  onVoucherError?: (message: string) => void
}

export default function SendFlow({
  draftId,
  open,
  onClose,
  beforeSend,
  ...handlers
}: {
  draftId: string
  open: boolean
  onClose: () => void
  /** Saves pending edits first; false = don't send. */
  beforeSend?: () => Promise<boolean>
} & SendOutcomeHandlers) {
  const { data: draft, isLoading } = useDraft(open ? draftId : undefined)
  const send = useSendDraft()
  const { showToast } = useToast()
  const [confirmCancelled, setConfirmCancelled] = useState(false)
  const [cancelMessage, setCancelMessage] = useState('')
  const [preparing, setPreparing] = useState(false)

  useEffect(() => {
    if (!open) {
      setConfirmCancelled(false)
      setCancelMessage('')
    }
  }, [open])

  const resend = draft?.status === 'SENT'
  const busy = send.isPending || preparing

  const doSend = async (withCancelled = false) => {
    if (!draft || busy) return
    if (beforeSend) {
      setPreparing(true)
      const ok = await beforeSend().finally(() => setPreparing(false))
      if (!ok) {
        showToast({ type: 'error', title: 'Not sent', message: 'Your latest changes could not be saved. Fix them, then send.' })
        return
      }
    }
    send.mutate(
      { id: draft.id, orderNo: draft.orderNo, resend, confirmCancelled: withCancelled || undefined },
      {
        onSuccess: (detail) => {
          setConfirmCancelled(false)
          onClose()
          showToast({ type: 'success', title: `Sent to ${detail.sentTo ?? detail.preview?.to ?? 'the customer'}` })
          handlers.onSent(detail)
        },
        onError: (err) => {
          if (needsCancelledConfirm(err)) {
            setCancelMessage(pdErrorText(err, 'This ride is cancelled — confirm to send anyway'))
            setConfirmCancelled(true)
            return
          }
          setConfirmCancelled(false)
          onClose()
          if (isTestModeError(err)) {
            handlers.onTestMode?.(pdErrorText(err))
            showToast({ type: 'info', title: 'Test mode — nothing was sent' })
            return
          }
          const missing = missingFromError(err)
          if (missing.length) {
            handlers.onMissing?.(missing, pdErrorText(err))
            showToast({ type: 'error', title: 'Fill in the highlighted details', message: pdErrorText(err) })
            return
          }
          if (isVoucherError(err)) {
            handlers.onVoucherError?.(pdErrorText(err))
            showToast({ type: 'error', title: 'Voucher problem', message: pdErrorText(err) })
            return
          }
          if (isConflict(err)) {
            showToast({ type: 'error', title: 'This email changed', message: pdErrorText(err) })
            return
          }
          if (/no email address/i.test(pdErrorText(err))) {
            showToast({ type: 'error', title: 'No email address', message: `${pdErrorText(err)} — contact the customer by phone.` })
            return
          }
          showToast({ type: 'error', title: 'Not sent', message: pdErrorText(err) })
        },
      },
    )
  }

  // ⌘/Ctrl+Enter confirms.
  useEffect(() => {
    if (!open || !draft) return
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        e.preventDefault()
        e.stopPropagation()
        void doSend(confirmCancelled)
      }
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  })

  if (confirmCancelled && open) {
    return (
      <ResponsiveDialog
        open
        onClose={() => {
          setConfirmCancelled(false)
          onClose()
        }}
        title="This ride is cancelled — send anyway?"
        size="sm"
        footer={
          <>
            <Button variant="outline" onClick={() => { setConfirmCancelled(false); onClose() }} disabled={busy}>
              Don&apos;t send
            </Button>
            <Button variant="danger" onClick={() => void doSend(true)} loading={busy}>
              <Send className="h-4 w-4" /> Send anyway
            </Button>
          </>
        }
      >
        <div className="flex items-start gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-red-50">
            <AlertTriangle className="h-5 w-5 text-red-500" />
          </span>
          <p className="pt-1 text-sm text-gray-700">{cancelMessage}. The customer may be confused by ride details for a cancelled booking.</p>
        </div>
      </ResponsiveDialog>
    )
  }

  const to = draft?.preview?.to
  return (
    <ResponsiveDialog
      open={open}
      onClose={onClose}
      title={resend ? 'Send this email again?' : 'Send this email?'}
      size="xl"
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={() => void doSend()} loading={busy} disabled={!draft || !to || (draft.preview?.missing?.length ?? 0) > 0}>
            <Send className="h-4 w-4" />
            {resend ? 'Resend' : 'Send'}
            <span className="ml-1 hidden text-[11px] opacity-80 sm:inline">{modKey}+Enter</span>
          </Button>
        </>
      }
    >
      {isLoading || !draft ? (
        <div className="space-y-3">
          <Skeleton className="h-5 w-3/4" />
          <Skeleton className="h-4 w-1/2" />
        </div>
      ) : (
        <div className="space-y-4 text-sm">
          {/* The email as it lands in the customer's inbox. */}
          <div className="overflow-hidden rounded-xl border border-gray-200">
            <dl className="grid grid-cols-[4.5rem_minmax(0,1fr)] gap-x-2 gap-y-1.5 border-b border-gray-200 bg-gray-50 px-3 py-2.5">
              <dt className="text-xs font-semibold uppercase tracking-wide text-gray-400">To</dt>
              <dd className="flex min-w-0 items-center gap-1 break-all font-semibold text-gray-900">
                <Lock className="h-3.5 w-3.5 shrink-0 text-gray-400" aria-hidden />
                {to ?? 'no email address'}
              </dd>
              <dt className="text-xs font-semibold uppercase tracking-wide text-gray-400">Subject</dt>
              <dd className="break-words font-medium text-gray-900">{draft.preview?.subject}</dd>
              {draft.attachVoucher && (
                <>
                  <dt className="text-xs font-semibold uppercase tracking-wide text-gray-400">Attached</dt>
                  <dd className="flex min-w-0 items-center gap-1.5 text-gray-700">
                    <Paperclip className="h-3.5 w-3.5 shrink-0 text-gray-400" aria-hidden />
                    <span className="truncate">{draft.preview?.voucher?.filename ?? 'voucher.pdf'}</span>
                  </dd>
                </>
              )}
            </dl>
            <SafeHtmlFrame
              html={draft.preview?.html ?? ''}
              title="Email preview — what the customer gets"
              deviceToggle
              heightClass="h-[min(52vh,520px)] min-h-[240px]"
              className="rounded-none border-0"
            />
          </div>
          {isSupplierCopy(draft) && (
            <p className="rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-sky-900">
              <span aria-hidden>{SUPPLIER_COPY_EMOJI} </span>
              Copied from ViaTovia&apos;s email and rebranded — check it reads well and shows no ViaTovia details.
            </p>
          )}
          <p className="flex items-center gap-2 text-gray-600">
            <Bell className="h-4 w-4 text-gray-400" />
            The customer also gets an in-app notification.
          </p>
          {resend && (
            <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-amber-900">
              The customer will get this email again (sent {draft.sendCount}×, last {shortDateTime(draft.sentAt)}).
            </p>
          )}
          {(draft.preview?.missing?.length ?? 0) > 0 && (
            <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-red-800">Fill in the missing details before sending.</p>
          )}
          {!to && <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-red-800">The customer has no email address on their account — contact them by phone.</p>}
          <p className="hidden text-xs text-gray-400 sm:block">
            <Kbd>{modKey}</Kbd> <Kbd>Enter</Kbd> to send · <Kbd>Esc</Kbd> to cancel
          </p>
        </div>
      )}
    </ResponsiveDialog>
  )
}
