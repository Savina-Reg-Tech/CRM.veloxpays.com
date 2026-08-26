import { useMemo, useState } from 'react'
import { PlayCircle, CheckCircle2, Circle } from 'lucide-react'
import type { ConditionalRule, FormField } from '../../types'
import { evaluateRules } from '../../utils/rules'

interface RuleTesterProps {
  fields: FormField[]
  rules: ConditionalRule[]
}

/** Lets an admin punch in sample field values and see which rules match and
 * what they'd do — without needing to actually convert the builder's static
 * preview into fully live/controlled inputs just to test logic. Only shows
 * inputs for fields actually referenced by a rule's conditions, so this
 * stays focused instead of listing every field in the form. */
export default function RuleTester({ fields, rules }: RuleTesterProps) {
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

        <div className="pt-3 border-t border-gray-100 space-y-1.5">
          <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide">Result</p>
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
            <p className="text-[11px] text-gray-400 pt-1">
              {result.hidden.size > 0
                ? `Hiding: ${[...result.hidden].map((id) => fieldsById[id]?.label ?? id).join(', ')}`
                : 'Nothing hidden with these values.'}
            </p>
          )}
        </div>
      </div>
    </section>
  )
}
