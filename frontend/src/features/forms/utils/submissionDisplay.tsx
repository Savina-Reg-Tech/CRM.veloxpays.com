import { Paperclip } from 'lucide-react'
import type { FormJson } from '../types'

/** Shape written by the backend's handleSubmitForm once an uploaded file (a Form Builder "file"
 * field) has been stored — see FORM_UPLOAD_* in the CRM backend's middleware/upload.js. Lives
 * in `submission_data[fieldId]` alongside plain string/array answers for every other field type. */
export interface FileFieldValue {
  __type: 'file'
  originalName: string
  storagePath: string
  mimeType: string
  sizeBytes: number
}

export function isFileFieldValue(value: unknown): value is FileFieldValue {
  return !!value && typeof value === 'object' && (value as { __type?: unknown }).__type === 'file'
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

function formatValue(value: unknown): string | null {
  if (value == null || value === '' || isFileFieldValue(value)) return null
  if (Array.isArray(value)) return value.filter(Boolean).join(', ')
  return String(value)
}

interface Entry {
  fieldId: string
  label: string
  value?: string
  file?: FileFieldValue
}

function FileLink({
  file,
  fieldId,
  fileUrl,
}: {
  file: FileFieldValue
  fieldId: string
  fileUrl?: (fieldId: string) => string
}) {
  const content = (
    <span className="inline-flex min-w-0 items-center gap-1.5">
      <Paperclip className="h-3.5 w-3.5 shrink-0" />
      <span className="truncate">{file.originalName}</span>
      <span className="shrink-0 text-gray-400">({formatFileSize(file.sizeBytes)})</span>
    </span>
  )
  if (!fileUrl) return <span className="text-gray-700">{content}</span>
  return (
    <a
      href={fileUrl(fieldId)}
      target="_blank"
      rel="noreferrer"
      className="inline-flex min-w-0 text-indigo-600 hover:text-indigo-700 hover:underline"
    >
      {content}
    </a>
  )
}

function renderEntries(entries: Entry[], fileUrl?: (fieldId: string) => string) {
  if (entries.length === 0) return null
  return (
    <dl className="divide-y divide-gray-100 rounded-xl border border-gray-200 bg-white overflow-hidden">
      {entries.map((entry) => (
        <div key={entry.fieldId} className="grid grid-cols-1 gap-1 px-4 py-3 sm:grid-cols-3 sm:gap-4">
          <dt className="text-xs font-medium text-gray-500 sm:col-span-1">{entry.label}</dt>
          <dd className="text-sm text-gray-900 sm:col-span-2 break-words">
            {entry.file ? (
              <FileLink file={entry.file} fieldId={entry.fieldId} fileUrl={fileUrl} />
            ) : (
              entry.value
            )}
          </dd>
        </div>
      ))}
    </dl>
  )
}

/** Render submission answers with form field labels, grouped by step when available.
 *
 * `fileUrl`, when passed, turns a file-type answer into a clickable download link pointed at
 * the caller's own admin-authenticated download endpoint. A form submission and a lead are read
 * from different tables on the backend (a lead's `submission_data` is its own independent copy
 * taken at submit time, not a live join back to the originating submission — see the CRM
 * backend's models/Lead.js) so the two download routes differ; the caller decides which one
 * applies (formService.ts's `submissionFileUrl`/`leadFileUrl`), not this shared component.
 * Omit `fileUrl` to render the filename as plain, non-clickable text. */
export function SubmissionDataView({
  data,
  formJson,
  fileUrl,
}: {
  data: Record<string, unknown>
  formJson?: FormJson
  fileUrl?: (fieldId: string) => string
}) {
  const fields = formJson?.fields ?? []
  const fieldMap = new Map(fields.map((f) => [f.id, f]))
  const usedIds = new Set<string>()

  const entryForFieldId = (id: string): Entry | null => {
    const field = fieldMap.get(id)
    if (field && (field.type === 'section' || field.type === 'hidden')) return null
    const raw = data[id]
    const label = field?.label ?? id.replace(/_/g, ' ')
    if (isFileFieldValue(raw)) return { fieldId: id, label, file: raw }
    const formatted = formatValue(raw)
    if (!formatted) return null
    return { fieldId: id, label, value: formatted }
  }

  const entriesForFieldIds = (fieldIds: string[]) => {
    const entries: Entry[] = []
    for (const id of fieldIds) {
      if (!fieldMap.has(id)) continue
      const entry = entryForFieldId(id)
      if (!entry) continue
      usedIds.add(id)
      entries.push(entry)
    }
    return entries
  }

  const steps = formJson?.steps ?? []

  if (steps.length > 0) {
    const sections = steps
      .map((step) => {
        const entries = entriesForFieldIds(step.fieldIds)
        if (entries.length === 0) return null
        return (
          <section key={step.id} className="space-y-2">
            <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-500">
              {step.title}
            </h4>
            {renderEntries(entries, fileUrl)}
          </section>
        )
      })
      .filter(Boolean)

    const extraEntries = Object.keys(data)
      .filter((id) => !usedIds.has(id))
      .map((id) => entryForFieldId(id))
      .filter((e): e is Entry => e != null)

    return (
      <div className="space-y-4">
        {sections}
        {extraEntries.length > 0 && (
          <section className="space-y-2">
            <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-500">
              Other fields
            </h4>
            {renderEntries(extraEntries, fileUrl)}
          </section>
        )}
      </div>
    )
  }

  const allEntries = fields
    .filter((f) => f.type !== 'section' && f.type !== 'hidden')
    .map((f) => entryForFieldId(f.id))
    .filter((e): e is Entry => e != null)

  if (allEntries.length > 0) {
    return renderEntries(allEntries, fileUrl)
  }

  const fallback = Object.keys(data)
    .map((id) => entryForFieldId(id))
    .filter((e): e is Entry => e != null)

  return (
    renderEntries(fallback, fileUrl) ?? (
      <p className="text-sm text-gray-500">No submission data recorded.</p>
    )
  )
}
