import { useEffect, useId, useMemo, useState, type ReactNode } from 'react'
import FocusTrap from 'focus-trap-react'
import { ChevronDown, Info, X } from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'
import Button from '@/components/ui/Button'
import Switch from '@/components/ui/Switch'
import ConfirmDialog from '@/components/ui/ConfirmDialog'
import { useToast } from '@/app/providers/ToastProvider'
import { cn } from '@/lib/utils'
import { auditError, auditErrorText } from '../../audit'
import {
  DEFAULT_BLOCKED_MESSAGE,
  displayOptionsFor,
  MESSAGE_MAX,
  MODE_OPTIONS,
  REASON_MAX,
  UNKNOWN_OPTIONS,
  describeRule,
  draftCountriesError,
  draftFromRule,
  isDraftDirty,
  kindLabel,
  ruleInputFromDraft,
  ruleWords,
  usesCountries,
  type CountryNames,
  type RuleDraft,
} from '../../availability'
import { useVVUpdateAvailabilityRule } from '../../hooks/useVVAvailability'
import type { AvailabilityItem, AvailabilityOverview } from '../../types'
import CountryPicker from './CountryPicker'

interface Props {
  item: AvailabilityItem
  overview: AvailabilityOverview
  names: CountryNames
  onClose: () => void
}

function Step({ n, title, hint, children }: { n: number; title: string; hint?: string; children: ReactNode }) {
  return (
    <fieldset className="space-y-3">
      <legend className="flex items-start gap-2.5">
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-indigo-50 text-xs font-semibold text-indigo-700" aria-hidden="true">
          {n}
        </span>
        <span>
          <span className="block text-sm font-semibold text-gray-900">{title}</span>
          {hint && <span className="mt-0.5 block text-xs font-normal text-gray-500">{hint}</span>}
        </span>
      </legend>
      <div className="pl-0 sm:pl-8">{children}</div>
    </fieldset>
  )
}

function RadioCard({
  name, checked, onChange, label, hint,
}: { name: string; checked: boolean; onChange: () => void; label: string; hint?: string }) {
  return (
    <label
      className={cn(
        'flex min-h-[44px] cursor-pointer items-start gap-3 rounded-lg border px-3 py-2.5 transition-colors',
        checked ? 'border-indigo-500 bg-indigo-50/60 ring-1 ring-indigo-500' : 'border-gray-200 bg-white hover:bg-gray-50'
      )}
    >
      <input type="radio" name={name} checked={checked} onChange={onChange} className="mt-0.5 h-4 w-4 shrink-0 border-gray-300 text-indigo-600 focus:ring-indigo-500" />
      <span className="min-w-0">
        <span className="block text-sm font-medium text-gray-900">{label}</span>
        {hint && <span className="mt-0.5 block text-xs text-gray-500">{hint}</span>}
      </span>
    </label>
  )
}

function Counter({ value, max }: { value: string; max: number }) {
  return <span className={cn('text-xs', value.length >= max ? 'font-medium text-red-600' : 'text-gray-400')}>{value.length}/{max}</span>
}

const textareaClass =
  'block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-base text-gray-900 placeholder:text-gray-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100 sm:text-sm'

export default function EditRulePanel({ item, overview, names, onClose }: Props) {
  const titleId = useId()
  const radioName = useId()
  const qc = useQueryClient()
  const { showToast } = useToast()
  const save = useVVUpdateAvailabilityRule()

  const parent = useMemo(() => overview.items.find((i) => i.key === item.parentKey) ?? null, [overview.items, item.parentKey])
  const children = useMemo(() => overview.items.filter((i) => i.parentKey === item.key), [overview.items, item.key])

  const [draft, setDraft] = useState<RuleDraft>(() => draftFromRule(item.rule))
  const [moreOpen, setMoreOpen] = useState(() => item.rule.unknownCountryPolicy === 'block' || item.rule.strictIpCheck)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [saveError, setSaveError] = useState('')
  const [confirmDiscard, setConfirmDiscard] = useState(false)
  const [confirmOff, setConfirmOff] = useState(false)

  // A fresh version (someone else saved → 409 → refetch) replaces the form with the latest values.
  useEffect(() => {
    setDraft(draftFromRule(item.rule))
    setFieldErrors({})
  }, [item.key, item.rule.version]) // eslint-disable-line react-hooks/exhaustive-deps

  const dirty = isDraftDirty(draft, item.rule)
  const countriesError = usesCountries(draft.mode) ? draftCountriesError(draft) : null
  const summary = describeRule(item, draft, names, { parent, children })
  const patch = (p: Partial<RuleDraft>) => {
    setDraft((d) => ({ ...d, ...p }))
    setSaveError('')
  }

  const requestClose = () => (dirty ? setConfirmDiscard(true) : onClose())

  // Lock the page behind and close on Esc (asking first when there are unsaved changes).
  useEffect(() => {
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previous
    }
  }, [])
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || confirmDiscard || confirmOff) return
      requestClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  const doSave = async () => {
    setConfirmOff(false)
    setSaveError('')
    setFieldErrors({})
    try {
      const rule = await save.mutateAsync({ serviceKey: item.key, input: ruleInputFromDraft(draft, item.rule.version) })
      showToast({ type: 'success', title: 'Saved', message: `${item.label}: ${ruleWords(rule, names, 3)}` })
      onClose()
    } catch (err) {
      const e = auditError(err, 'Could not save this rule.')
      if (e.status === 409) {
        showToast({ type: 'info', title: 'Someone else changed this rule', message: 'Reloaded the latest version — check it and save again.' })
        qc.invalidateQueries({ queryKey: ['vv-availability'] })
      } else if (e.notFound) {
        showToast({ type: 'error', title: 'Not found', message: `${item.label} no longer exists in VeloxVerse.` })
        qc.invalidateQueries({ queryKey: ['vv-availability'] })
        onClose()
      } else if (e.forbidden) {
        setSaveError("You don't have permission to change country rules.")
      } else if (e.status === 400) {
        setFieldErrors(Object.fromEntries(e.fieldErrors.map((f) => [f.field.replace(/^body\./, ''), f.message])))
        setSaveError(e.message)
      } else {
        setSaveError(auditErrorText(err, 'Could not save this rule.'))
        showToast({ type: 'error', title: 'Something went wrong', message: auditErrorText(err) })
      }
    }
  }

  const onSave = () => {
    if (countriesError) return
    if (children.length > 0 && draft.mode === 'disabled' && item.rule.mode !== 'disabled') setConfirmOff(true)
    else void doSave()
  }

  const childNames = children.map((c) => c.label)
  const offMessage =
    `This also switches off ${childNames.slice(0, 3).join(', ')}${childNames.length > 3 ? ` and ${childNames.length - 3} more` : ''} for every customer.`

  return (
    <>
      <FocusTrap focusTrapOptions={{ escapeDeactivates: false, clickOutsideDeactivates: false, returnFocusOnDeactivate: true, initialFocus: false, allowOutsideClick: true }}>
        <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-labelledby={titleId}>
          <div className="absolute inset-0 hidden bg-black/40 backdrop-blur-sm lg:block" onClick={requestClose} aria-hidden="true" />

          <div className="absolute inset-0 flex flex-col bg-white lg:left-auto lg:w-[520px] lg:max-w-full lg:shadow-2xl">
            {/* Header */}
            <div className="flex shrink-0 items-start justify-between gap-3 border-b border-gray-100 px-4 py-3 sm:px-6 sm:py-4">
              <div className="min-w-0">
                <h2 id={titleId} className="break-words text-base font-semibold text-gray-900">{item.label}</h2>
                <p className="mt-0.5 break-words text-xs text-gray-500">
                  {kindLabel(item.kind, parent?.label)} · <code className="font-mono">{item.key}</code>
                </p>
              </div>
              <button
                type="button"
                onClick={requestClose}
                aria-label="Close"
                className="-mr-2 flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
              >
                <X size={20} />
              </button>
            </div>

            {/* Body */}
            <div className="min-h-0 flex-1 space-y-6 overflow-y-auto px-4 py-5 sm:px-6">
              <p className="text-xs text-gray-500">
                Saving changes only {item.label}.{' '}
                {parent ? `${parent.label} and its other parts keep their own rules.` : children.length > 0 ? 'Its parts keep their own rules, but are off while this is off.' : ''}
              </p>

              <Step n={1} title={`Who can use ${item.label}?`}>
                <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                  {MODE_OPTIONS.map((o) => (
                    <RadioCard key={o.value} name={`${radioName}-mode`} checked={draft.mode === o.value} onChange={() => patch({ mode: o.value })} label={o.label} hint={o.hint} />
                  ))}
                </div>
                <p className="mt-2 text-xs text-gray-500">
                  A customer can use it if they live in an allowed country <strong className="font-semibold text-gray-700">or</strong> are in one right now.
                </p>
                {fieldErrors.mode && <p className="mt-2 text-xs text-red-600">{fieldErrors.mode}</p>}
              </Step>

              {usesCountries(draft.mode) && (
                <Step n={2} title="Countries" hint={draft.mode === 'allow_list' ? 'Customers who live in or are in these countries can use it.' : 'Customers who live in and are in these countries can’t use it.'}>
                  <CountryPicker
                    countries={overview.countries}
                    names={names}
                    selected={draft.countries}
                    onChange={(countries) => patch({ countries })}
                    error={fieldErrors.countries ?? countriesError}
                  />
                </Step>
              )}

              {draft.mode !== 'all_countries' && (
                <Step n={usesCountries(draft.mode) ? 3 : 2} title="What should other customers see?">
                  <div className="space-y-2">
                    {displayOptionsFor(overview.blockedDisplays).map((o) => (
                      <RadioCard key={o.value} name={`${radioName}-display`} checked={draft.blockedDisplay === o.value} onChange={() => patch({ blockedDisplay: o.value })} label={o.label} hint={o.hint} />
                    ))}
                  </div>
                  <div className="mt-4">
                    <div className="mb-1.5 flex items-center justify-between gap-2">
                      <label htmlFor={`${radioName}-message`} className="text-sm font-medium text-gray-700">Message shown to them (optional)</label>
                      <Counter value={draft.message} max={MESSAGE_MAX} />
                    </div>
                    <textarea
                      id={`${radioName}-message`}
                      rows={2}
                      maxLength={MESSAGE_MAX}
                      value={draft.message}
                      onChange={(e) => patch({ message: e.target.value })}
                      placeholder={DEFAULT_BLOCKED_MESSAGE}
                      className={textareaClass}
                    />
                    {fieldErrors.message && <p className="mt-1 text-xs text-red-600">{fieldErrors.message}</p>}
                  </div>
                </Step>
              )}

              {/* More options */}
              <div className="border-t border-gray-100 pt-4">
                <button
                  type="button"
                  onClick={() => setMoreOpen((v) => !v)}
                  aria-expanded={moreOpen}
                  className="flex min-h-[44px] items-center gap-1 text-sm font-medium text-indigo-600 hover:text-indigo-700"
                >
                  {moreOpen ? 'Hide more options' : 'Show more options'}
                  <ChevronDown size={16} className={cn('transition-transform', moreOpen && 'rotate-180')} aria-hidden="true" />
                </button>
                {moreOpen && (
                  <div className="mt-3 space-y-5">
                    {usesCountries(draft.mode) && (
                      <>
                        <fieldset className="space-y-2">
                          <legend className="text-sm font-medium text-gray-900">If we can&apos;t tell the customer&apos;s country</legend>
                          <p className="text-xs text-gray-500">Only used when we know neither where the customer lives nor where they are right now.</p>
                          {UNKNOWN_OPTIONS.map((o) => (
                            <RadioCard key={o.value} name={`${radioName}-unknown`} checked={draft.unknownCountryPolicy === o.value} onChange={() => patch({ unknownCountryPolicy: o.value })} label={o.label} />
                          ))}
                        </fieldset>
                        <div className="space-y-1">
                          <Switch checked={draft.strictIpCheck} onChange={(v) => patch({ strictIpCheck: v })} label="Only if they live there and are there right now" />
                          <p className="text-xs text-gray-500">
                            Normally a customer can use it if they live in an allowed country or are in one right now. Turn this on to require
                            both — for example a licence that only covers residents while they are in the country.
                          </p>
                        </div>
                      </>
                    )}
                    <div>
                      <div className="mb-1.5 flex items-center justify-between gap-2">
                        <label htmlFor={`${radioName}-reason`} className="text-sm font-medium text-gray-700">Reason for this change (optional)</label>
                        <Counter value={draft.reason} max={REASON_MAX} />
                      </div>
                      <textarea
                        id={`${radioName}-reason`}
                        rows={2}
                        maxLength={REASON_MAX}
                        value={draft.reason}
                        onChange={(e) => patch({ reason: e.target.value })}
                        placeholder="e.g. Client request 28 Oct"
                        className={textareaClass}
                      />
                      <p className="mt-1 text-xs text-gray-500">Shown in the change history.</p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Footer: live summary + actions */}
            <div className="shrink-0 space-y-3 border-t border-gray-100 bg-white px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 sm:px-6">
              <div className="flex items-start gap-2 rounded-lg bg-gray-50 px-3 py-2.5 text-sm text-gray-700" aria-live="polite">
                <Info size={16} className="mt-0.5 shrink-0 text-gray-400" aria-hidden="true" />
                <p className="max-h-24 overflow-y-auto">{summary}</p>
              </div>
              {saveError && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{saveError}</p>}
              <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <Button variant="outline" onClick={requestClose} disabled={save.isPending} className="min-h-[44px] sm:min-h-0">
                  Cancel
                </Button>
                <Button onClick={onSave} loading={save.isPending} disabled={!dirty || Boolean(countriesError)} className="min-h-[44px] sm:min-h-0">
                  Save
                </Button>
              </div>
            </div>
          </div>
        </div>
      </FocusTrap>

      <ConfirmDialog
        open={confirmDiscard}
        onClose={() => setConfirmDiscard(false)}
        onConfirm={() => {
          setConfirmDiscard(false)
          onClose()
        }}
        title="Discard your changes?"
        message={`Your changes to ${item.label} haven't been saved.`}
        confirmLabel="Discard"
        cancelLabel="Keep editing"
        danger
      />
      <ConfirmDialog
        open={confirmOff}
        onClose={() => setConfirmOff(false)}
        onConfirm={() => void doSave()}
        title={`Switch off ${item.label}?`}
        message={offMessage}
        confirmLabel="Switch off"
        loading={save.isPending}
        danger
      />
    </>
  )
}
