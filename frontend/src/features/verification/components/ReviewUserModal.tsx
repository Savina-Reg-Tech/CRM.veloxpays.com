import { useState } from 'react'
import { Eye, CheckCircle2 } from 'lucide-react'
import Modal from '@/components/ui/Modal'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import Spinner from '@/components/ui/Spinner'
import { formatDateTime } from '@/lib/utils'
import { docLabel, isCustomDocType } from '@/config/verificationDocs'
import { DocStatusBadge, VerificationStatusBadge } from '../statusBadge'
import { verificationApi } from '../verificationService'
import {
  useVerificationDetail,
  useReviewDocument,
  useActivateAccount,
  useSuspendAccount,
  useRejectVerification,
} from '../hooks/useVerification'

interface Props {
  userId: number | null
  onClose: () => void
}

export default function ReviewUserModal({ userId, onClose }: Props) {
  const { data: detail, isLoading } = useVerificationDetail(userId)
  const [rejectNote, setRejectNote] = useState<Record<number, string>>({})
  const [verdictNote, setVerdictNote] = useState('')

  const review = useReviewDocument(userId ?? 0)
  const activate = useActivateAccount(userId ?? 0)
  const suspend = useSuspendAccount(userId ?? 0)
  const reject = useRejectVerification(userId ?? 0)

  const busy = review.isPending || activate.isPending || suspend.isPending || reject.isPending

  return (
    <Modal
      open={userId != null}
      onClose={() => !busy && onClose()}
      title={detail ? detail.user.name : 'Verification'}
      description={detail ? `${detail.user.email} · ${detail.user.role.replace(/_/g, ' ')}` : undefined}
      size="xl"
      footer={
        detail ? (
          <>
            <Button variant="outline" onClick={onClose} disabled={busy}>
              Close
            </Button>
            <Button
              variant="danger"
              loading={suspend.isPending}
              disabled={busy}
              onClick={() => suspend.mutate(undefined)}
            >
              Suspend
            </Button>
            <Button
              loading={activate.isPending}
              disabled={busy || detail.user.account_status === 'active'}
              title="Activate account"
              onClick={() => activate.mutate()}
            >
              <CheckCircle2 size={15} /> Activate account
            </Button>
          </>
        ) : null
      }
    >
      {isLoading || !detail ? (
        <div className="flex h-40 items-center justify-center">
          <Spinner />
        </div>
      ) : (
        <div className="space-y-5 text-sm">
          {/* Summary */}
          <div className="flex items-center justify-between rounded-lg bg-gray-50 px-4 py-3">
            <div>
              <p className="text-xs text-gray-500">Verification status</p>
              <div className="mt-1">
                <VerificationStatusBadge status={detail.progress.overall_status} />
              </div>
            </div>
            <div className="flex items-center gap-6">
              <div className="text-right">
                <p className="text-lg font-semibold text-gray-900">
                  {detail.progress.uploaded}/{detail.progress.total_docs || detail.progress.required_total}
                </p>
                <p className="text-xs text-gray-500">total uploaded</p>
              </div>
              <div className="text-right">
                <p className="text-lg font-semibold text-gray-900">
                  {detail.progress.required_approved}/{detail.progress.required_total}
                </p>
                <p className="text-xs text-gray-500">required approved</p>
              </div>
              {(detail.progress.custom_count ?? 0) > 0 && (
                <div className="text-right">
                  <p className="text-lg font-semibold text-amber-600">
                    {detail.progress.custom_count}
                  </p>
                  <p className="text-xs text-gray-500">additional</p>
                </div>
              )}
            </div>
          </div>

          {!detail.progress.can_activate && (
            <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
              Not all required documents are approved yet, but you can still activate the account at your discretion.
            </p>
          )}

          {/* Documents */}
          <div>
            <p className="mb-2 font-medium text-gray-800">Documents</p>
            <div className="space-y-2">
              {detail.documents.length === 0 && (
                <p className="text-gray-500">No documents uploaded yet.</p>
              )}
              {detail.documents.map((d) => (
                <div
                  key={d.id}
                  className={
                    'rounded-lg border p-3 ' +
                    (isCustomDocType(d.doc_type)
                      ? 'border-amber-300 bg-amber-50/30'
                      : 'border-gray-200')
                  }
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-medium text-gray-900">
                        {docLabel(d.doc_type, d.custom_label)}
                        {isCustomDocType(d.doc_type) && (
                          <span className="ml-2 inline-block rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-700">
                            Additional
                          </span>
                        )}
                      </p>
                      <p className="truncate text-xs text-gray-400">{d.original_file_name}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <DocStatusBadge status={d.status} />
                      <a
                        href={verificationApi.fileUrl(d.id)}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-gray-600 hover:bg-gray-100"
                      >
                        <Eye size={14} /> View
                      </a>
                    </div>
                  </div>

                  {(d.status === 'pending' || d.status === 'in_review') && (
                    <div className="mt-3 flex flex-wrap items-end gap-2">
                      <div className="flex-1 min-w-[180px]">
                        <Input
                          placeholder="Reason (required to reject)"
                          value={rejectNote[d.id] ?? ''}
                          onChange={(e) =>
                            setRejectNote((m) => ({ ...m, [d.id]: e.target.value }))
                          }
                        />
                      </div>
                      <Button
                        size="sm"
                        variant="danger"
                        disabled={busy || !(rejectNote[d.id] ?? '').trim()}
                        onClick={() =>
                          review.mutate({
                            documentId: d.id,
                            to_status: 'rejected',
                            note: rejectNote[d.id],
                          })
                        }
                      >
                        Reject
                      </Button>
                      <Button
                        size="sm"
                        disabled={busy}
                        onClick={() => review.mutate({ documentId: d.id, to_status: 'approved' })}
                      >
                        Approve
                      </Button>
                    </div>
                  )}

                  {d.status === 'rejected' && d.review_note && (
                    <p className="mt-2 text-xs text-red-600">Rejected: {d.review_note}</p>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Reject whole verification */}
          <div className="rounded-lg border border-gray-200 p-3">
            <p className="mb-2 font-medium text-gray-800">Reject verification</p>
            <div className="flex flex-wrap items-end gap-2">
              <div className="flex-1 min-w-[200px]">
                <Input
                  placeholder="Reason for rejecting this user's verification"
                  value={verdictNote}
                  onChange={(e) => setVerdictNote(e.target.value)}
                />
              </div>
              <Button
                variant="danger"
                disabled={busy || !verdictNote.trim()}
                loading={reject.isPending}
                onClick={() => reject.mutate(verdictNote)}
              >
                Reject verification
              </Button>
            </div>
          </div>

          {/* Timeline */}
          <div>
            <p className="mb-2 font-medium text-gray-800">Activity timeline</p>
            <ul className="max-h-56 space-y-2 overflow-y-auto">
              {detail.timeline.length === 0 && (
                <li className="text-gray-500">No activity yet.</li>
              )}
              {detail.timeline.map((a) => (
                <li
                  key={`${a.id}`}
                  className="rounded-lg border border-gray-100 bg-white px-3 py-2 text-xs text-gray-700"
                >
                  <span className="font-medium">{a.actor_name}</span>{' '}
                  <span className="text-gray-500">
                    {docLabel(a.doc_type, a.custom_label)}: {a.from_status ? `${a.from_status} → ` : ''}
                    {a.to_status}
                  </span>
                  <span className="ml-2 text-gray-400">{formatDateTime(a.created_at)}</span>
                  {a.note && <p className="mt-1 italic text-gray-600">{a.note}</p>}
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </Modal>
  )
}
