import type { FormJson } from '../types'

function formatValue(value: unknown): string | null {
  if (value == null || value === '') return null
  if (Array.isArray(value)) return value.filter(Boolean).join(', ')
  return String(value)
}

function renderEntries(entries: { label: string; value: string }[]) {
  if (entries.length === 0) return null
  return (
    <dl className="divide-y divide-gray-100 rounded-xl border border-gray-200 bg-white overflow-hidden">
      {entries.map(({ label, value }) => (
        <div key={label} className="grid grid-cols-1 gap-1 px-4 py-3 sm:grid-cols-3 sm:gap-4">
          <dt className="text-xs font-medium text-gray-500 sm:col-span-1">{label}</dt>
          <dd className="text-sm text-gray-900 sm:col-span-2 break-words">{value}</dd>
        </div>
      ))}
    </dl>
  )
}

/** Render submission answers with form field labels, grouped by step when available. */
export function SubmissionDataView({
  data,
  formJson,
}: {
  data: Record<string, unknown>
  formJson?: FormJson
}) {
  const fields = formJson?.fields ?? []
  const fieldMap = new Map(fields.map((f) => [f.id, f]))
  const usedIds = new Set<string>()

  const entriesForFieldIds = (fieldIds: string[]) => {
    const entries: { label: string; value: string }[] = []
    for (const id of fieldIds) {
      const field = fieldMap.get(id)
      if (!field || field.type === 'section' || field.type === 'hidden') continue
      const formatted = formatValue(data[id])
      if (!formatted) continue
      usedIds.add(id)
      entries.push({ label: field.label, value: formatted })
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
            {renderEntries(entries)}
          </section>
        )
      })
      .filter(Boolean)

    const extraEntries = Object.entries(data)
      .filter(([id, val]) => !usedIds.has(id) && formatValue(val))
      .map(([id, val]) => ({
        label: fieldMap.get(id)?.label ?? id.replace(/_/g, ' '),
        value: formatValue(val)!,
      }))

    return (
      <div className="space-y-4">
        {sections}
        {extraEntries.length > 0 && (
          <section className="space-y-2">
            <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-500">
              Other fields
            </h4>
            {renderEntries(extraEntries)}
          </section>
        )}
      </div>
    )
  }

  const allEntries = fields
    .filter((f) => f.type !== 'section' && f.type !== 'hidden')
    .map((f) => ({ label: f.label, value: formatValue(data[f.id]) }))
    .filter((e): e is { label: string; value: string } => e.value != null)

  if (allEntries.length > 0) {
    return renderEntries(allEntries)
  }

  const fallback = Object.entries(data)
    .map(([id, val]) => ({
      label: id.replace(/_/g, ' '),
      value: formatValue(val),
    }))
    .filter((e): e is { label: string; value: string } => e.value != null)

  return renderEntries(fallback) ?? (
    <p className="text-sm text-gray-500">No submission data recorded.</p>
  )
}
