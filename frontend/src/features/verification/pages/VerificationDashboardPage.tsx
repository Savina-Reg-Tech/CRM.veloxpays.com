import { useEffect, useMemo, useRef, useState } from 'react'
import {
  ShieldCheck,
  Clock,
  FileUp,
  AlertTriangle,
  ChevronDown,
  PartyPopper,
  BadgeCheck,
  Plus,
  UploadCloud,
  X,
} from 'lucide-react'
import { Card, CardHeader } from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import Spinner from '@/components/ui/Spinner'
import { cn } from '@/lib/utils'
import { useMyProgress, useMyDocuments, useUploadDocument } from '../hooks/useVerification'
import { DocStatusBadge, VerificationStatusBadge } from '../statusBadge'
import DocumentUploadCard from '../components/DocumentUploadCard'
import ConfettiBurst from '../components/ConfettiBurst'
import { docLabel, CUSTOM_DOC_PREFIX } from '@/config/verificationDocs'
import { useAuthStore } from '@/store/authStore'

const MAX_BYTES = 10 * 1024 * 1024
const ACCEPT = '.pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png'

/** Inline form to add a custom document with a user-defined label. */
function AddCustomDocumentForm() {
  const [open, setOpen] = useState(false)
  const [label, setLabel] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const upload = useUploadDocument(() => {
    setOpen(false)
    setLabel('')
    setFile(null)
    setError(null)
  })

  const handleSubmit = () => {
    setError(null)
    const trimmed = label.trim()
    if (!trimmed) { setError('Please enter a document name.'); return }
    if (trimmed.length < 2) { setError('Name must be at least 2 characters.'); return }
    if (!file) { setError('Please select a file.'); return }
    if (file.size > MAX_BYTES) { setError('File too large (max 10 MB).'); return }
    // Generate a unique doc_type with the custom_ prefix
    const slug = trimmed.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 40)
    const docType = `${CUSTOM_DOC_PREFIX}${slug}_${Date.now()}`
    upload.mutate({ docType, file, customLabel: trimmed })
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-gray-200 py-4 text-sm font-medium text-gray-500 transition-colors hover:border-indigo-300 hover:text-indigo-600"
      >
        <Plus size={18} /> Add New Document
      </button>
    )
  }

  return (
    <div className="rounded-xl border border-gray-200 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-gray-900">New Document</p>
        <button
          type="button"
          onClick={() => { setOpen(false); setLabel(''); setFile(null); setError(null) }}
          className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
        >
          <X size={16} />
        </button>
      </div>

      <div>
        <label htmlFor="custom-doc-label" className="mb-1 block text-xs font-medium text-gray-600">
          Document Name
        </label>
        <input
          id="custom-doc-label"
          type="text"
          maxLength={100}
          placeholder="e.g. Trade Certificate, Company License…"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-indigo-400 focus:outline-none focus:ring-1 focus:ring-indigo-400"
        />
      </div>

      <div>
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPT}
          className="hidden"
          onChange={(e) => { setFile(e.target.files?.[0] ?? null); setError(null) }}
        />
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="flex w-full items-center gap-2 rounded-lg border border-dashed border-gray-300 px-3 py-2.5 text-sm text-gray-500 transition-colors hover:border-indigo-300 hover:text-indigo-600"
        >
          <UploadCloud size={16} />
          {file ? (
            <span className="truncate text-gray-700">{file.name}</span>
          ) : (
            'Choose file (PDF, JPG, PNG — max 10 MB)'
          )}
        </button>
      </div>

      {error && <p className="text-xs text-red-600">{error}</p>}

      <Button
        size="sm"
        variant="primary"
        loading={upload.isPending}
        onClick={handleSubmit}
        disabled={!label.trim() || !file}
      >
        Upload Document
      </Button>
    </div>
  )
}

function deadlineNote(deadline?: string | null): string | null {
  if (!deadline) return null
  const ms = new Date(deadline).getTime() - Date.now()
  if (Number.isNaN(ms)) return null
  if (ms <= 0) return 'Your verification window has elapsed.'
  const days = Math.ceil(ms / (24 * 60 * 60 * 1000))
  return `Complete verification within ${days} day${days === 1 ? '' : 's'}.`
}

export default function VerificationDashboardPage() {
  const user = useAuthStore((s) => s.user)
  const { data: progress, isLoading } = useMyProgress()
  const { data: documents } = useMyDocuments()
  const [celebrate, setCelebrate] = useState(false)
  const [showDetails, setShowDetails] = useState(false)

  // Fire the confetti burst for a few seconds whenever the page opens
  // with an activated account.
  const overallStatus = progress?.overall_status
  useEffect(() => {
    if (overallStatus !== 'activated') return
    setCelebrate(true)
    const t = setTimeout(() => setCelebrate(false), 6000)
    return () => clearTimeout(t)
  }, [overallStatus])

  // Activity timeline synthesized from the user's documents.
  const timeline = useMemo(() => {
    const events: { at: string; label: string }[] = []
    for (const d of documents ?? []) {
      const name = docLabel(d.doc_type, d.custom_label)
      events.push({ at: d.uploaded_at, label: `Uploaded ${name}` })
      if (d.reviewed_at && (d.status === 'approved' || d.status === 'rejected')) {
        events.push({
          at: d.reviewed_at,
          label: `${name} ${d.status === 'approved' ? 'approved' : 'rejected'}`,
        })
      }
    }
    return events.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime()).slice(0, 12)
  }, [documents])

  if (isLoading || !progress) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Spinner />
      </div>
    )
  }

  const pct =
    progress.required_total > 0
      ? Math.round((progress.required_approved / progress.required_total) * 100)
      : 100
  const note = deadlineNote(user?.verification_deadline)
  const isActivated = progress.overall_status === 'activated'

  // ── Activated: celebration view ───────────────────────────────────────────
  if (isActivated) {
    const firstName = user?.name?.split(' ')[0]
    return (
      <div className="mx-auto max-w-5xl space-y-6">
        {celebrate && <ConfettiBurst />}

        {/* Celebration hero */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-emerald-500 via-emerald-600 to-teal-600 p-8 text-white shadow-lg">
          {/* decorative shapes */}
          <div className="pointer-events-none absolute -right-10 -top-10 h-44 w-44 rounded-full bg-white/10" />
          <div className="pointer-events-none absolute -bottom-14 right-24 h-32 w-32 rounded-full bg-white/10" />
          <div className="pointer-events-none absolute -left-8 -bottom-8 h-28 w-28 rounded-full bg-white/10" />

          <div className="relative flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-4">
              <div className="rounded-2xl bg-white/15 p-3 backdrop-blur-sm">
                <PartyPopper size={30} />
              </div>
              <div>
                <h2 className="text-2xl font-semibold">
                  Congratulations{firstName ? `, ${firstName}` : ''}!
                </h2>
                <p className="mt-1 max-w-md text-sm text-emerald-50">
                  Your account is fully verified and active. You now have complete
                  access to the CRM — enjoy!
                </p>
              </div>
            </div>
            <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-white/15 px-4 py-1.5 text-sm font-medium backdrop-blur-sm">
              <BadgeCheck size={16} /> Verified
            </span>
          </div>
        </div>

        {/* Verification details dropdown */}
        <Card padding="none">
          <button
            type="button"
            onClick={() => setShowDetails((v) => !v)}
            aria-expanded={showDetails}
            className="flex w-full items-center justify-between rounded-xl px-6 py-4 text-left transition-colors hover:bg-gray-50"
          >
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-emerald-50 p-2">
                <ShieldCheck className="text-emerald-600" size={18} />
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-900">Verification details</p>
                <p className="text-xs text-gray-500">
                  {progress.required_approved} of {progress.required_total} required
                  documents approved · {progress.documents_uploaded_label} uploaded
                </p>
              </div>
            </div>
            <ChevronDown
              size={18}
              className={cn(
                'shrink-0 text-gray-400 transition-transform duration-200',
                showDetails && 'rotate-180'
              )}
            />
          </button>

          {showDetails && (
            <div className="space-y-6 border-t border-gray-100 p-6">
              {/* Document status table */}
              <div>
                <p className="mb-2 text-sm font-medium text-gray-800">Document Status</p>
                <div className="overflow-hidden rounded-lg border border-gray-100">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 text-left text-xs font-medium text-gray-500">
                      <tr>
                        <th className="px-4 py-2">Document</th>
                        <th className="px-4 py-2">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {progress.documents.map((row) => (
                        <tr key={row.doc_type}>
                          <td className="px-4 py-2.5 text-gray-700">{row.label}</td>
                          <td className="px-4 py-2.5">
                            <DocStatusBadge status={row.status} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Activity timeline */}
              <div>
                <p className="mb-2 text-sm font-medium text-gray-800">Activity Timeline</p>
                {timeline.length === 0 ? (
                  <p className="flex items-center gap-2 text-sm text-gray-500">
                    <AlertTriangle size={16} /> No activity yet.
                  </p>
                ) : (
                  <ol className="relative space-y-4 border-l border-gray-200 pl-4">
                    {timeline.map((e, i) => (
                      <li key={i} className="relative">
                        <span className="absolute -left-[21px] top-1 h-2.5 w-2.5 rounded-full bg-emerald-500 ring-2 ring-white" />
                        <p className="text-sm text-gray-700">{e.label}</p>
                        <p className="text-xs text-gray-400">
                          {new Date(e.at).toLocaleString()}
                        </p>
                      </li>
                    ))}
                  </ol>
                )}
              </div>
            </div>
          )}
        </Card>
      </div>
    )
  }

  // ── Not yet activated: upload / progress view ─────────────────────────────
  return (
    <div className="mx-auto max-w-5xl space-y-6">
      {/* Header / progress summary */}
      <Card>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <div className="rounded-xl bg-indigo-50 p-2.5">
              <ShieldCheck className="text-indigo-600" size={22} />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Account Verification</h2>
              <p className="mt-0.5 text-sm text-gray-500">
                Upload your required documents to unlock full CRM access.
              </p>
              <div className="mt-2">
                <VerificationStatusBadge status={progress.overall_status} />
              </div>
            </div>
          </div>
          <div className="sm:text-right">
            <p className="text-2xl font-semibold text-gray-900">
              {progress.documents_uploaded_label}
            </p>
            <p className="text-xs text-gray-500">documents uploaded</p>
          </div>
        </div>

        {/* Progress bar */}
        <div className="mt-5">
          <div className="mb-1.5 flex items-center justify-between text-xs text-gray-500">
            <span>
              {progress.required_approved} of {progress.required_total} required documents approved
            </span>
            <span>{pct}%</span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-gray-100">
            <div
              className="h-full rounded-full bg-gradient-to-r from-[#4EAFFF] to-blue-600 transition-all"
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>

        {note && (
          <p className="mt-4 flex items-center gap-2 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-700">
            <Clock size={16} /> {note}
          </p>
        )}
      </Card>

      {/* Upload cards */}
      <Card>
        <CardHeader
          title="Required Documents"
          description="Accepted formats: PDF, JPG, JPEG, PNG — max 10 MB each."
        />
        {progress.documents.filter((r) => r.required).length === 0 ? (
          <p className="flex items-center gap-2 text-sm text-gray-500">
            <FileUp size={16} /> No documents are required for your role.
          </p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {progress.documents.filter((r) => r.required).map((row) => (
              <DocumentUploadCard key={row.doc_type} row={row} />
            ))}
          </div>
        )}
      </Card>

      {/* Optional + custom documents */}
      <Card>
        <CardHeader
          title="Additional Documents"
          description="Upload any extra supporting documents. These are optional and won't block activation."
        />
        {/* Existing optional / custom docs */}
        {progress.documents.filter((r) => !r.required).length > 0 && (
          <div className="mb-4 grid gap-3 sm:grid-cols-2">
            {progress.documents.filter((r) => !r.required).map((row) => (
              <DocumentUploadCard key={row.doc_type} row={row} />
            ))}
          </div>
        )}
        <AddCustomDocumentForm />
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Document status table */}
        <Card>
          <CardHeader title="Document Status" />
          <div className="overflow-hidden rounded-lg border border-gray-100">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-left text-xs font-medium text-gray-500">
                <tr>
                  <th className="px-4 py-2">Document</th>
                  <th className="px-4 py-2">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {progress.documents.map((row) => (
                  <tr key={row.doc_type}>
                    <td className="px-4 py-2.5 text-gray-700">{row.label}</td>
                    <td className="px-4 py-2.5">
                      <DocStatusBadge status={row.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        {/* Activity timeline */}
        <Card>
          <CardHeader title="Activity Timeline" />
          {timeline.length === 0 ? (
            <p className="flex items-center gap-2 text-sm text-gray-500">
              <AlertTriangle size={16} /> No activity yet.
            </p>
          ) : (
            <ol className="relative space-y-4 border-l border-gray-200 pl-4">
              {timeline.map((e, i) => (
                <li key={i} className="relative">
                  <span className="absolute -left-[21px] top-1 h-2.5 w-2.5 rounded-full bg-indigo-500 ring-2 ring-white" />
                  <p className="text-sm text-gray-700">{e.label}</p>
                  <p className="text-xs text-gray-400">
                    {new Date(e.at).toLocaleString()}
                  </p>
                </li>
              ))}
            </ol>
          )}
        </Card>
      </div>
    </div>
  )
}
