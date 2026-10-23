// "Customer email": who it goes to (read-only), the details still to fill in, every value, the
// subject and body (with fields as chips), the live preview and the voucher switch.
import { useEffect, useMemo, useState } from 'react'
import { CheckCircle2, ChevronDown, Eye, Lock, Paperclip, PencilLine, RotateCcw, SplitSquareVertical } from 'lucide-react'
import Switch from '@/components/ui/Switch'
import { cn } from '@/lib/utils'
import { useMediaQuery } from '../vv-audit/useMediaQuery'
import {
  MULTILINE_PLACEHOLDERS,
  closestPlaceholder,
  detailsCheckRows,
  effectiveValue,
  formatBytes,
  isAdminValue,
  placeholderLabel,
  placeholdersIn,
  unknownPlaceholdersIn,
} from '../../pickdropEmails'
import type { DraftDetail } from '../../types'
import EmailEditor from './EmailEditor'
import PlaceholderSubjectInput from './PlaceholderSubjectInput'
import { SafeHtmlFrame } from './SafeHtmlFrame'
import { fieldClass } from './PdUI'

export interface CustomerEmailPanelProps {
  draft: DraftDetail
  placeholders: { key: string; label: string }[]
  subject: string
  body: string
  /** Values typed this visit and not yet confirmed by the server. */
  overlay: Record<string, string>
  onSubjectChange: (v: string) => void
  onBodyChange: (v: string) => void
  onValueChange: (key: string, value: string) => void
  /** Save now (blur). */
  onCommit: () => void
  onAttachVoucher: (on: boolean) => void
  voucherAvailable: boolean
  /** Keys the server refused to send without — highlighted. */
  highlight: ReadonlySet<string>
  /** Problems from the last save (unknown placeholder…). */
  problems: string[]
  saving: boolean
  disabled?: boolean
}

function ValueInput({
  id,
  fieldKey,
  label,
  value,
  onChange,
  onCommit,
  suggestions,
  highlight,
  filled,
}: {
  id: string
  fieldKey: string
  label: string
  value: string
  onChange: (v: string) => void
  onCommit: () => void
  suggestions: string[]
  highlight?: boolean
  filled?: boolean
}) {
  const multiline = MULTILINE_PLACEHOLDERS.has(fieldKey)
  const cls = cn(fieldClass, highlight && !filled && 'border-red-400 ring-2 ring-red-100')
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="flex items-center justify-between gap-2 text-sm font-medium text-gray-800">
        <span>{label}</span>
        {filled ? <CheckCircle2 className="h-4 w-4 text-emerald-600" aria-label="Filled" /> : <span className="text-xs font-medium text-red-600">Required</span>}
      </label>
      {multiline ? (
        <textarea id={id} value={value} rows={3} onChange={(e) => onChange(e.target.value)} onBlur={onCommit} className={cn(cls, 'min-h-[5.5rem] resize-y')} />
      ) : (
        <input
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onBlur={onCommit}
          inputMode={fieldKey.toLowerCase().includes('phone') ? 'tel' : undefined}
          autoComplete="off"
          className={cn(cls, 'h-11')}
        />
      )}
      {suggestions.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs text-gray-500">Use:</span>
          {suggestions.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => {
                onChange(s)
                setTimeout(onCommit, 0)
              }}
              className="max-w-full truncate rounded-full border border-indigo-200 bg-indigo-50 px-2.5 py-1 text-xs font-medium text-indigo-700 hover:bg-indigo-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
              title={s}
            >
              {s}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

type BodyView = 'edit' | 'preview' | 'split'

export default function CustomerEmailPanel({
  draft,
  placeholders,
  subject,
  body,
  overlay,
  onSubjectChange,
  onBodyChange,
  onValueChange,
  onCommit,
  onAttachVoucher,
  voucherAvailable,
  highlight,
  problems,
  saving,
  disabled = false,
}: CustomerEmailPanelProps) {
  const wide = useMediaQuery('(min-width: 1536px)')
  const [view, setView] = useState<BodyView>(wide ? 'split' : 'edit')
  const [allOpen, setAllOpen] = useState(false)
  const missing = useMemo(() => new Set(draft.preview?.missing ?? draft.missing ?? []), [draft.preview?.missing, draft.missing])

  // Keys that needed filling at any point this visit stay in the card (so an input doesn't vanish
  // under the cursor once it's saved).
  const [fillKeys, setFillKeys] = useState<string[]>(() => [...missing])
  useEffect(() => {
    setFillKeys((prev) => {
      const add = [...missing].filter((k) => !prev.includes(k))
      return add.length ? [...prev, ...add] : prev
    })
  }, [missing])
  useEffect(() => setFillKeys([...(draft.preview?.missing ?? draft.missing ?? [])]), [draft.id])

  const valueOf = (key: string) => overlay[key] ?? effectiveValue(draft, key)
  const usedKeys = useMemo(() => {
    const keys = [...placeholdersIn(subject), ...placeholdersIn(body), ...(draft.requiredFields ?? [])]
    return keys.filter((k, i) => keys.indexOf(k) === i)
  }, [subject, body, draft.requiredFields])
  const filled = useMemo(() => new Set(usedKeys.filter((k) => !missing.has(k) && valueOf(k))), [usedKeys, missing, overlay, draft])

  const rows = useMemo(() => detailsCheckRows(draft), [draft])
  const suggestionsFor = (key: string): string[] => {
    const row = rows.find((r) => r.key === key)
    const current = valueOf(key).trim()
    const list = [row?.email, row?.ours, draft.values?.[key]].map((s) => (s ?? '').trim()).filter(Boolean)
    return list.filter((s, i) => list.indexOf(s) === i && s !== current).slice(0, 3)
  }

  const stillMissing = fillKeys.filter((k) => missing.has(k) && !(overlay[k] ?? '').trim())
  const unknown = unknownPlaceholdersIn(problems)

  return (
    <div className="space-y-5">
      {/* 1. To */}
      <div className="flex items-center gap-2 rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5" title="Always the customer's account email">
        <span className="text-xs font-semibold uppercase tracking-wide text-gray-400">To</span>
        <Lock className="h-3.5 w-3.5 shrink-0 text-gray-400" aria-hidden />
        <span className="min-w-0 truncate text-sm font-medium text-gray-900">{draft.preview?.to ?? 'No email address on the account'}</span>
        <span className="ml-auto hidden shrink-0 text-xs text-gray-400 sm:inline">Customer&apos;s account email</span>
      </div>

      {/* 2. Fill in before sending */}
      {fillKeys.length > 0 && (
        <section
          aria-labelledby="fill-in-title"
          className={cn('rounded-xl border p-3 sm:p-4', stillMissing.length ? 'border-amber-300 bg-amber-50/60' : 'border-emerald-200 bg-emerald-50/60')}
        >
          <h3 id="fill-in-title" className={cn('mb-3 flex items-center gap-2 text-sm font-semibold', stillMissing.length ? 'text-amber-900' : 'text-emerald-800')}>
            {stillMissing.length ? (
              <>Fill in before sending · {stillMissing.length} left</>
            ) : (
              <>
                <CheckCircle2 className="h-4 w-4" /> All details filled
              </>
            )}
          </h3>
          <div className="space-y-4">
            {fillKeys.map((k) => (
              <ValueInput
                key={k}
                id={`fill-${k}`}
                fieldKey={k}
                label={placeholderLabel(k, placeholders)}
                value={valueOf(k)}
                onChange={(v) => onValueChange(k, v)}
                onCommit={onCommit}
                suggestions={suggestionsFor(k)}
                highlight={highlight.has(k)}
                filled={!missing.has(k) || !!(overlay[k] ?? '').trim()}
              />
            ))}
          </div>
        </section>
      )}

      {/* 3. All values */}
      <section className="rounded-xl border border-gray-200">
        <button
          type="button"
          onClick={() => setAllOpen((o) => !o)}
          aria-expanded={allOpen}
          className="flex min-h-11 w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm font-semibold text-gray-800 hover:bg-gray-50"
        >
          <span>All values ({usedKeys.length})</span>
          <ChevronDown className={cn('h-4 w-4 text-gray-400 transition-transform', allOpen && 'rotate-180')} />
        </button>
        {allOpen && (
          <ul className="divide-y divide-gray-100 border-t border-gray-100">
            {usedKeys.map((k) => {
              const edited = isAdminValue(draft, k) || k in overlay
              const multiline = MULTILINE_PLACEHOLDERS.has(k)
              return (
                <li key={k} className="space-y-1 px-3 py-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <label htmlFor={`val-${k}`} className="text-xs font-medium text-gray-600" title={`{{${k}}}`}>
                      {placeholderLabel(k, placeholders)}
                    </label>
                    <span className="flex items-center gap-2">
                      {missing.has(k) && <span className="text-[11px] font-semibold text-red-600">Missing</span>}
                      {edited && <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-[11px] font-medium text-indigo-700">edited</span>}
                      {isAdminValue(draft, k) && (
                        <button
                          type="button"
                          onClick={() => {
                            onValueChange(k, '')
                            setTimeout(onCommit, 0)
                          }}
                          className="inline-flex items-center gap-1 text-[11px] font-medium text-gray-500 hover:text-gray-900"
                          title={`Back to the automatic value${draft.values?.[k] ? `: ${draft.values[k]}` : ''}`}
                        >
                          <RotateCcw className="h-3 w-3" /> reset
                        </button>
                      )}
                    </span>
                  </div>
                  {multiline ? (
                    <textarea
                      id={`val-${k}`}
                      rows={2}
                      value={valueOf(k)}
                      onChange={(e) => onValueChange(k, e.target.value)}
                      onBlur={onCommit}
                      placeholder="No value"
                      className={cn(fieldClass, 'resize-y py-1.5')}
                    />
                  ) : (
                    <input
                      id={`val-${k}`}
                      value={valueOf(k)}
                      onChange={(e) => onValueChange(k, e.target.value)}
                      onBlur={onCommit}
                      placeholder="No value"
                      autoComplete="off"
                      className={cn(fieldClass, 'h-10')}
                    />
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </section>

      {/* 4. Subject */}
      <div className="space-y-1.5">
        <label htmlFor="email-subject" className="text-sm font-semibold text-gray-800">
          Subject
        </label>
        <PlaceholderSubjectInput
          id="email-subject"
          value={subject}
          onChange={onSubjectChange}
          onBlur={onCommit}
          placeholders={placeholders}
          missing={missing}
          filled={filled}
          invalid={problems.some((p) => /subject/i.test(p))}
        />
      </div>

      {/* 5. Body */}
      <div className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-sm font-semibold text-gray-800">Message</span>
          <div className="inline-flex rounded-lg border border-gray-200 bg-gray-50 p-0.5 text-xs font-medium" role="tablist" aria-label="Body view">
            {(
              [
                ['edit', 'Edit', PencilLine],
                ['preview', 'Preview', Eye],
                ['split', 'Both', SplitSquareVertical],
              ] as const
            ).map(([v, label, Icon]) => (
              <button
                key={v}
                type="button"
                role="tab"
                aria-selected={view === v}
                onClick={() => setView(v)}
                className={cn(
                  'inline-flex min-h-9 items-center gap-1.5 rounded-md px-3',
                  v === 'split' && 'hidden lg:inline-flex',
                  view === v ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-800',
                )}
              >
                <Icon className="h-3.5 w-3.5" />
                {label}
              </button>
            ))}
          </div>
        </div>
        {(view === 'edit' || view === 'split') && (
          <EmailEditor
            value={body}
            onChange={onBodyChange}
            onBlur={onCommit}
            placeholders={placeholders}
            missing={missing}
            filled={filled}
            invalid={problems.length > 0}
            disabled={disabled}
          />
        )}
        {problems.length > 0 && (
          <div role="alert" className="rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800">
            <p className="font-semibold">Not saved:</p>
            <ul className="mt-1 list-disc space-y-0.5 pl-5">
              {problems.map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ul>
            {unknown.map((u) => {
              const fix = closestPlaceholder(u, placeholders)
              return fix ? (
                <p key={u} className="mt-1.5">
                  Did you mean{' '}
                  <button
                    type="button"
                    onClick={() => {
                      const re = new RegExp(`\\{\\{\\s*${u}\\s*\\}\\}`, 'g')
                      onBodyChange(body.replace(re, `{{${fix}}}`))
                      onSubjectChange(subject.replace(re, `{{${fix}}}`))
                    }}
                    className="rounded bg-white px-1.5 py-0.5 font-mono text-xs font-semibold text-indigo-700 underline-offset-2 ring-1 ring-red-200 hover:underline"
                  >
                    {`{{${fix}}}`}
                  </button>{' '}
                  instead of <span className="font-mono text-xs">{`{{${u}}}`}</span>?
                </p>
              ) : null
            })}
          </div>
        )}
        {(view === 'preview' || view === 'split') && (
          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-gray-500">
              <span>
                What the customer gets · <span className="font-medium text-gray-700">{draft.preview?.subject}</span>
              </span>
              {saving && <span className="text-indigo-600">Updating after save…</span>}
            </div>
            <SafeHtmlFrame html={draft.preview?.html ?? ''} title="Customer email preview" />
          </div>
        )}
      </div>

      {/* 6. Voucher */}
      <div className="rounded-xl border border-gray-200 px-3 py-3">
        <div className="flex items-start justify-between gap-3" title={voucherAvailable ? undefined : 'No PDF on this ViaTovia email'}>
          <div className="min-w-0">
            <p className="flex items-center gap-1.5 text-sm font-medium text-gray-900">
              <Paperclip className="h-4 w-4 text-gray-400" />
              Attach ViaTovia&apos;s voucher PDF
            </p>
            <p className="mt-0.5 text-xs text-gray-500">
              {voucherAvailable
                ? 'Off by default — the PDF shows ViaTovia’s own contact details.'
                : 'No PDF on this ViaTovia email.'}
              {draft.attachVoucher && draft.preview?.voucher && (
                <span className="block text-gray-700">
                  {draft.preview.voucher.filename} · {formatBytes(draft.preview.voucher.sizeBytes)}
                </span>
              )}
            </p>
          </div>
          <Switch checked={draft.attachVoucher} onChange={onAttachVoucher} disabled={!voucherAvailable} />
        </div>
      </div>
    </div>
  )
}
