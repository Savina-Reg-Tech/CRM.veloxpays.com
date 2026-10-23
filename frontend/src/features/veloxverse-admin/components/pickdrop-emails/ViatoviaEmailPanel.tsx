// "ViaTovia said": the email ViaTovia sent us, shown read-only — sender, type, body (sandboxed),
// PDFs to download and ViaTovia's own voucher link.
import { useState } from 'react'
import { AlertTriangle, Download, ExternalLink, FileText, Mail, ShieldCheck } from 'lucide-react'
import Skeleton from '@/components/ui/Skeleton'
import { useToast } from '@/app/providers/ToastProvider'
import { cn } from '@/lib/utils'
import { useDownloadAttachment, useInboxItem } from '../../hooks/usePickdropEmails'
import { formatBytes, inboundTypeMeta, pdErrorText, shortDateTime } from '../../pickdropEmails'
import type { Extracted, InboxAttachment, InboxSummary } from '../../types'
import { SafeHtmlFrame } from './SafeHtmlFrame'
import { ToneChip } from './PdUI'

type EmailLike = InboxSummary & { bodyHtml: string | null; bodyText?: string | null; extracted: Extracted | null; to?: string | null }

export function AttachmentChips({ inboxId, attachments }: { inboxId: string; attachments: InboxAttachment[] }) {
  const download = useDownloadAttachment()
  const { showToast } = useToast()
  const [busy, setBusy] = useState<string | null>(null)
  if (attachments.length === 0) return null
  return (
    <ul className="flex flex-wrap gap-2">
      {attachments.map((a) => (
        <li key={a.id} className="min-w-0 max-w-full">
          <button
            type="button"
            disabled={busy === a.id}
            onClick={() => {
              setBusy(a.id)
              download.mutate(
                { inboxId, attachment: a },
                {
                  onError: (err) => showToast({ type: 'error', title: 'Download failed', message: pdErrorText(err) }),
                  onSettled: () => setBusy(null),
                },
              )
            }}
            className="inline-flex min-h-11 max-w-full items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-left text-sm shadow-sm hover:border-indigo-300 hover:bg-indigo-50/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 disabled:opacity-60"
            title={`Download ${a.filename}`}
          >
            <FileText className="h-4 w-4 shrink-0 text-red-500" />
            <span className="min-w-0">
              <span className="block truncate font-medium text-gray-900">{a.filename}</span>
              <span className="block text-xs text-gray-500">{formatBytes(a.sizeBytes)}</span>
            </span>
            <Download className={cn('h-4 w-4 shrink-0 text-gray-400', busy === a.id && 'animate-bounce')} />
          </button>
        </li>
      ))}
    </ul>
  )
}

export function SenderLine({ email }: { email: Pick<InboxSummary, 'from' | 'senderVerified'> }) {
  return (
    <span className="inline-flex min-w-0 items-center gap-1.5">
      {email.senderVerified ? (
        <ShieldCheck className="h-3.5 w-3.5 shrink-0 text-emerald-600" aria-label="Sender verified" />
      ) : (
        <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-amber-600" aria-label="Sender not verified" />
      )}
      <span className="truncate">{email.from ?? 'Unknown sender'}</span>
    </span>
  )
}

/** Body (HTML or text) with a plain-text toggle. */
export function EmailBody({ bodyHtml, bodyText, title }: { bodyHtml: string | null; bodyText?: string | null; title: string }) {
  const [plain, setPlain] = useState(false)
  const showPlain = plain || !bodyHtml
  return (
    <div className="space-y-2">
      {bodyHtml && bodyText && (
        <div className="flex justify-end">
          <div className="inline-flex rounded-lg border border-gray-200 bg-gray-50 p-0.5 text-xs font-medium">
            <button
              type="button"
              onClick={() => setPlain(false)}
              className={cn('rounded-md px-2.5 py-1', !plain ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-800')}
            >
              Formatted
            </button>
            <button
              type="button"
              onClick={() => setPlain(true)}
              className={cn('rounded-md px-2.5 py-1', plain ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-800')}
            >
              Plain text
            </button>
          </div>
        </div>
      )}
      {showPlain ? (
        bodyText ? (
          <pre className="max-h-[70vh] overflow-auto whitespace-pre-wrap break-words rounded-xl border border-gray-200 bg-gray-50 p-3 font-sans text-sm text-gray-800">
            {bodyText}
          </pre>
        ) : (
          <p className="rounded-xl border border-dashed border-gray-200 px-3 py-6 text-center text-sm text-gray-400">No body stored for this email.</p>
        )
      ) : (
        <SafeHtmlFrame html={bodyHtml ?? ''} title={title} />
      )}
    </div>
  )
}

export function VoucherLink({ url }: { url: string | null | undefined }) {
  if (!url || !/^https:\/\//i.test(url)) return null
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex min-h-11 items-center gap-1.5 text-sm font-medium text-indigo-600 hover:text-indigo-700 hover:underline"
    >
      <ExternalLink className="h-4 w-4" />
      Open ViaTovia&apos;s voucher link
    </a>
  )
}

export default function ViatoviaEmailPanel({ emailId, fallback }: { emailId: string; fallback?: EmailLike | null }) {
  const { data: detail, isLoading } = useInboxItem(emailId)
  const email: EmailLike | null | undefined = detail ?? fallback
  if (!email) {
    return isLoading ? (
      <div className="space-y-3">
        <Skeleton className="h-5 w-2/3" />
        <Skeleton className="h-64 w-full" />
      </div>
    ) : (
      <p className="text-sm text-gray-500">This ViaTovia email is no longer stored.</p>
    )
  }
  const type = inboundTypeMeta(email.detectedType)
  const attachments = detail?.attachments ?? []
  const skipped = email.extracted?.skippedAttachments ?? []
  return (
    <div className="space-y-3">
      <div className="space-y-1.5">
        <div className="flex flex-wrap items-center gap-2">
          <ToneChip tone={type.tone}>{type.label}</ToneChip>
          <span className="text-xs text-gray-500">{shortDateTime(email.receivedAt)}</span>
        </div>
        <p className="break-words text-sm font-semibold text-gray-900">
          <Mail className="mr-1.5 inline h-4 w-4 align-[-3px] text-gray-400" />
          {email.subject || '(no subject)'}
        </p>
        <p className="text-xs text-gray-600">
          <SenderLine email={email} />
        </p>
      </div>

      <EmailBody bodyHtml={email.bodyHtml} bodyText={email.bodyText} title="ViaTovia email" />

      {(attachments.length > 0 || isLoading) && (
        <div className="space-y-1.5">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">Attachments</p>
          {isLoading && !detail ? <Skeleton className="h-11 w-48" /> : <AttachmentChips inboxId={email.id} attachments={attachments} />}
        </div>
      )}
      {skipped.length > 0 && <p className="text-xs text-gray-500">Not kept: {skipped.join(', ')}</p>}
      <VoucherLink url={email.extracted?.voucherUrl} />
    </div>
  )
}
