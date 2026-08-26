import { useMemo, useState } from 'react'
import { PlayCircle, CheckCircle2, Circle, ArrowDown, FlagOff } from 'lucide-react'
import type { ConditionalRule, FormField, FormStep } from '../../types'
import { NAVIGATION_ACTION_TYPES } from '../../types'
import { evaluateGroup, evaluateRules } from '../../utils/rules'

interface RuleTesterProps {
  fields: FormField[]
  steps: FormStep[]
  rules: ConditionalRule[]
}

interface TraceStep {
  step: FormStep
  matchedRule: ConditionalRule | null
}

/**
 * Walk the form the same way a real visitor would, starting from the first
 * step: at each step, check every enabled navigation rule anchored there
 * (same "first match wins" order the live form uses — see
 * PublicFormPage.tsx's step-advance handler), follow it if one matches,
 * otherwise fall through to the next step in sequence. `endedBySubmit`
 * tells the caller whether the walk actually reached the end of the form or
 * got cut off (defensively) after too many hops — which would only happen
 * if a step revisits itself, since every other path strictly consumes
 * steps or ends the walk.
 */
function buildJourneyTrace(rules: ConditionalRule[], steps: FormStep[], values: Record<string, unknown>): { trace: TraceStep[]; endedBySubmit: boolean } | null {
  const navigableSteps = steps.filter((s) => !s.isOnSubmit)
  if (navigableSteps.length === 0) return null

  const indexOf = (id: string) => navigableSteps.findIndex((s) => s.id === id)
  const trace: TraceStep[] = []
  const visited = new Set<string>()
  let current: FormStep | undefined = navigableSteps[0]
  let endedBySubmit = false

  while (current && !visited.has(current.id) && trace.length < navigableSteps.length + 1) {
    visited.add(current.id)
    const candidates = rules.filter((r) => r.enabled && r.fromStepId === current!.id && r.actions.some((a) => NAVIGATION_ACTION_TYPES.includes(a.type)))
    const matched = candidates.find((r) => evaluateGroup(r.group, values)) ?? null
    trace.push({ step: current, matchedRule: matched })

    if (matched) {
      const navAction = matched.actions.find((a) => NAVIGATION_ACTION_TYPES.includes(a.type))!
      if (navAction.type === 'end_form') { endedBySubmit = true; current = undefined }
      else if (navAction.type === 'goto_step') { current = navigableSteps.find((s) => s.id === navAction.stepId) }
      else if (navAction.type === 'skip_step') { const idx = indexOf(navAction.stepId); current = idx !== -1 ? navigableSteps[idx + 1] : undefined; if (idx !== -1 && !navigableSteps[idx + 1]) endedBySubmit = true }
      else if (navAction.type === 'previous_step') { const idx = indexOf(current.id); current = idx > 0 ? navigableSteps[idx - 1] : undefined }
      else if (navAction.type === 'next_step') { const idx = indexOf(current.id); current = navigableSteps[idx + 1]; if (!current) endedBySubmit = true }
    } else {
      const idx = indexOf(trace[trace.length - 1].step.id)
      current = navigableSteps[idx + 1]
      if (!current) endedBySubmit = true
    }
  }

  return { trace, endedBySubmit }
}

/** Lets an admin punch in sample field values and see the whole journey —
 * which step leads to which, and what happens to fields along the way —
 * without needing to actually convert the builder's static preview into
 * fully live/controlled inputs just to test logic. Only shows inputs for
 * fields actually referenced by a rule's conditions, so this stays focused
 * instead of listing every field in the form. */
export default function RuleTester({ fields, steps, rules }: RuleTesterProps) {
  const [values, setValues] = useState<Record<string, unknown>>({})
  const [triggered, setTriggered] = useState<Set<string>>(new Set())

  const fieldsById = useMemo(() => Object.fromEntries(fields.map((f) => [f.id, f])), [fields])

  const referencedFields = useMemo(() => {
    const ids = new Set<string>()
    for (const r of rules) for (const c of r.group.conditions) ids.add(c.fieldId)
    return fields.filter((f) => ids.has(f.id))
  }, [rules, fields])

  const applyChange = (fieldId: string, value: unknown) => {
    const nextValues = { ...values, [fieldId]: value }
    const result = evaluateRules(rules, nextValues, triggered)
    // Mirror the live form: a just-triggered set_value/clear_value writes
    // straight back into the working value set, so cascading rules (a set
    // value that itself satisfies another rule's condition) resolve the
    // same way they would for a real visitor.
    for (const action of result.valueActions) {
      nextValues[action.fieldId] = action.value ?? ''
    }
    setValues(nextValues)
    setTriggered(result.triggeredRuleIds)
  }

  const result = useMemo(() => evaluateRules(rules, values, triggered), [rules, values, triggered])
  const journey = useMemo(() => buildJourneyTrace(rules, steps, values), [rules, steps, values])

  if (rules.length === 0) return null

  return (
    <section className="rounded-2xl border border-gray-200 bg-white overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-100">
        <PlayCircle size={15} className="text-gray-400" />
        <p className="text-sm font-semibold text-gray-700">Test your rules</p>
      </div>
      <div className="p-4 space-y-4">
        {referencedFields.length === 0 ? (
          <p className="text-xs text-gray-400">Add a condition that references a field to test it here.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {referencedFields.map((field) => (
              <div key={field.id}>
                <label className="block text-xs font-medium text-gray-500 mb-1">{field.label}</label>
                {field.type === 'checkbox' ? (
                  <div className="space-y-1">
                    {(field.options ?? []).map((o) => {
                      const current = (values[field.id] as string[] | undefined) ?? []
                      const checked = current.includes(o)
                      return (
                        <label key={o} className="flex items-center gap-2 text-xs text-gray-600">
                          <input
                            type="checkbox" checked={checked}
                            onChange={(e) => {
                              const next = e.target.checked ? [...current, o] : current.filter((v) => v !== o)
                              applyChange(field.id, next)
                            }}
                          />
                          {o}
                        </label>
                      )
                    })}
                  </div>
                ) : field.type === 'dropdown' || field.type === 'radio' ? (
                  <select
                    value={(values[field.id] as string) ?? ''}
                    onChange={(e) => applyChange(field.id, e.target.value)}
                    className="w-full rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-200"
                  >
                    <option value="">— empty —</option>
                    {(field.options ?? []).map((o) => <option key={o} value={o}>{o}</option>)}
                  </select>
                ) : field.type === 'date' ? (
                  <input
                    type="date" value={(values[field.id] as string) ?? ''}
                    onChange={(e) => applyChange(field.id, e.target.value)}
                    className="w-full rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-200"
                  />
                ) : field.type === 'number' ? (
                  <input
                    type="number" value={(values[field.id] as string) ?? ''}
                    onChange={(e) => applyChange(field.id, e.target.value)}
                    placeholder="0"
                    className="w-full rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-200"
                  />
                ) : (
                  <input
                    type="text" value={(values[field.id] as string) ?? ''}
                    onChange={(e) => applyChange(field.id, e.target.value)}
                    placeholder="Type a value…"
                    className="w-full rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-200"
                  />
                )}
              </div>
            ))}
          </div>
        )}

        {journey && (
          <div className="pt-3 border-t border-gray-100 space-y-1.5">
            <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide">Journey with these values</p>
            <div className="space-y-1">
              {journey.trace.map((t, i) => (
                <div key={t.step.id}>
                  <div className="flex items-center gap-2 text-xs">
                    <CheckCircle2 size={13} className="text-emerald-500 shrink-0" />
                    <span className="font-medium text-gray-700">{t.step.title}</span>
                  </div>
                  {i < journey.trace.length - 1 && (
                    <div className="flex items-center gap-2 pl-[6.5px] py-0.5">
                      <ArrowDown size={12} className="text-gray-300 shrink-0" />
                      {t.matchedRule && (
                        <span className="text-[11px] text-violet-600 font-medium">{t.matchedRule.name || 'matching rule'}</span>
                      )}
                    </div>
                  )}
                </div>
              ))}
              <div className="flex items-center gap-2 text-xs pt-0.5">
                {journey.endedBySubmit ? (
                  <>
                    <CheckCircle2 size={13} className="text-emerald-500 shrink-0" />
                    <span className="font-medium text-gray-700">Submitted</span>
                  </>
                ) : (
                  <>
                    <FlagOff size={13} className="text-amber-500 shrink-0" />
                    <span className="font-medium text-amber-600">Didn't reach the end — check for a step that only routes to itself or a missing forward path.</span>
                  </>
                )}
              </div>
            </div>
          </div>
        )}

        <div className="pt-3 border-t border-gray-100 space-y-1.5">
          <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide">Rule matches</p>
          {rules.map((rule) => {
            const isMatched = result.triggeredRuleIds.has(rule.id)
            return (
              <div key={rule.id} className="flex items-center gap-2 text-xs">
                {isMatched ? <CheckCircle2 size={13} className="text-emerald-500 shrink-0" /> : <Circle size={13} className="text-gray-300 shrink-0" />}
                <span className={isMatched ? 'text-gray-700 font-medium' : 'text-gray-400'}>
                  {rule.name || 'Unnamed rule'}
                </span>
                {!rule.enabled && <span className="text-[10px] text-gray-400">(disabled)</span>}
              </div>
            )
          })}
          {referencedFields.length > 0 && (
            <div className="text-[11px] text-gray-400 pt-1 space-y-0.5">
              <p>{result.hidden.size > 0 ? `Hidden: ${[...result.hidden].map((id) => fieldsById[id]?.label ?? id).join(', ')}` : 'Nothing hidden with these values.'}</p>
              {result.requiredOverride.size > 0 && (
                <p>
                  {[...result.requiredOverride.entries()].map(([id, req]) => `${fieldsById[id]?.label ?? id} → ${req ? 'Required' : 'Optional'}`).join(', ')}
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </section>
  )
}
