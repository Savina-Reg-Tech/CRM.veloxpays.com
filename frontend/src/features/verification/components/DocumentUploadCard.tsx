import { useRef, useState } from 'react'
import { UploadCloud, FileCheck2, AlertCircle, Eye } from 'lucide-react'
import Button from '@/components/ui/Button'
import { DocStatusBadge } from '../statusBadge'
import { useUploadDocument } from '../hooks/useVerification'
import { verificationApi } from '../verificationService'
import { docLabel } from '@/config/verificationDocs'
import type { VerificationDocRow } from '@/types'

const ACCEPT = '.pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png'
const MAX_BYTES = 10 * 1024 * 1024

interface Props {
  row: VerificationDocRow
}

export default function DocumentUploadCard({ row }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [localError, setLocalError] = useState<string | null>(null)
  const upload = useUploadDocument()

  const onPick = (file: File | undefined) => {
    setLocalError(null)
    if (!file) return
    if (file.size > MAX_BYTES) {
      setLocalError('File too large (max 10 MB).')
      return
    }
    upload.mutate({ docType: row.doc_type, file })
  }

  const isRejected = row.status === 'rejected'
  const canReplace = row.status === 'not_uploaded' || row.status === 'rejected'

  return (
    <div className="flex flex-col gap-2 rounded-xl border border-gray-200 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium text-gray-900 truncate">
            {row.label || docLabel(row.doc_type)}
            {!row.required && (
              <span className="ml-1.5 text-xs font-normal text-gray-400">(optional)</span>
            )}
          </p>
          <div className="mt-1.5">
            <DocStatusBadge status={row.status} />
          </div>
        </div>
        {row.status === 'approved' ? (
          <FileCheck2 className="text-emerald-500 shrink-0" size={20} />
        ) : (
          <UploadCloud className="text-gray-300 shrink-0" size={20} />
        )}
      </div>

      {isRejected && row.review_note && (
        <p className="flex items-start gap-1.5 text-xs text-red-600">
          <AlertCircle size={14} className="mt-0.5 shrink-0" />
          <span>{row.review_note}</span>
        </p>
      )}

      {localError && <p className="text-xs text-red-600">{localError}</p>}

      <div className="mt-1 flex items-center gap-2">
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPT}
          className="hidden"
          onChange={(e) => onPick(e.target.files?.[0])}
        />
        {canReplace && (
          <Button
            size="sm"
            variant={isRejected ? 'danger' : 'primary'}
            loading={upload.isPending}
            onClick={() => inputRef.current?.click()}
          >
            {isRejected ? 'Re-upload' : 'Upload'}
          </Button>
        )}
        {row.document_id != null && (
          <a
            href={verificationApi.fileUrl(row.document_id)}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-100"
          >
            <Eye size={14} /> View
          </a>
        )}
      </div>
    </div>
  )
}
