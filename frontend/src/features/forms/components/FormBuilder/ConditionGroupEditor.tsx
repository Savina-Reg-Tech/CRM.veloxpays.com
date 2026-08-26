import { nanoid } from 'nanoid'
import { Plus, Trash2 } from 'lucide-react'
import type { ConditionOperator, FormField, RuleCondition } from '../../types'
import { VALUELESS_OPERATORS, RANGE_OPERATORS, MULTI_VALUE_OPERATORS } from '../../types'
import { operatorsForFieldType } from '../../utils/rules'
import { OPERATOR_LABELS, FieldValueInput } from './RuleEditorModal'

interface ConditionGroupEditorProps {
  fields: FormField[]
  fieldLabel: (fieldId: string) => string
  logic: 'AND' | 'OR'
  conditions: RuleCondition[]
  onChangeLogic: (logic: 'AND' | 'OR') => void
  onChangeConditions: (conditions: RuleCondition[]) => void
  /** Shown next to "IF" — defaults to that, but callers like the on-submit
   * outcome editor use this same block to mean "WHEN" a submission matches. */
  label?: string
}

/** A comma-free multi-value picker for 'one_of' / 'none_of' — a row of
 * toggle chips when the field has a fixed option list (dropdown/radio/
 * checkbox), otherwise a plain comma-separated text input. Either way the
 * admin never has to think about how the list is encoded — that's this
 * component's job, not theirs. */
function FieldValuesInput({ field, values, onChange }: { field: FormField | undefined; values: string[]; onChange: (v: string[]) => void }) {
  if (field && ['dropdown', 'radio', 'checkbox'].includes(field.type) && (field.options?.length ?? 0) > 0) {
    return (
      <div className="flex flex-wrap gap-1.5">
        {field.options!.map((o) => {
          const active = values.includes(o)
          return (
            <button
              key={o}
              type="button"
              onClick={() => onChange(active ? values.filter((v) => v !== o) : [...values, o])}
              className={`rounded-full border px-2.5 py-1 text-xs font-medium transition-colors ${
                active ? 'border-indigo-500 bg-indigo-500 text-white' : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
              }`}
            >
              {o}
            </button>
          )
        })}
      </div>
    )
  }
  return (
    <input
      type="text"
      value={values.join(', ')}
      onChange={(e) => onChange(e.target.value.split(',').map((v) => v.trim()).filter(Boolean))}
      placeholder="Value one, value two, …"
      className="w-full rounded-lg border border-gray-200 px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-200"
    />
  )
}

/** The "IF <conditions>" condition-group builder — shared between rule
 * editing (RuleEditorModal) and conditional on-submit outcomes
 * (OutcomeEditorModal) so the two never drift into subtly different
 * condition-building UIs. Uses plain "ALL" / "ANY" wording rather than
 * AND/OR so a non-technical admin can read the group at a glance — a small
 * connector pill between rows echoes which one is active. */
export default function ConditionGroupEditor({
  fields, fieldLabel, logic, conditions, onChangeLogic, onChangeConditions, label = 'IF',
}: ConditionGroupEditorProps) {
  const fieldsById = Object.fromEntries(fields.map((f) => [f.id, f]))

  const updateCondition = (id: string, patch: Partial<RuleCondition>) =>
    onChangeConditions(conditions.map((c) => (c.id === id ? { ...c, ...patch } : c)))
  const removeCondition = (id: string) => onChangeConditions(conditions.filter((c) => c.id !== id))
  const addCondition = () => {
    const first = fields[0]
    onChangeConditions([...conditions, { id: `cond_${nanoid(6)}`, fieldId: first?.id ?? '', operator: first ? operatorsForFieldType(first.type)[0] : 'is_not_empty' }])
  }

  const changeFieldId = (condId: string, fieldId: string) => {
    const f = fieldsById[fieldId]
    const validOps = f ? operatorsForFieldType(f.type) : []
    updateCondition(condId, { fieldId, operator: validOps[0] ?? 'is_not_empty', value: undefined, value2: undefined, values: undefined })
  }

  const changeOperator = (condId: string, operator: ConditionOperator, currentValue: string | undefined) => {
    // Clear whichever value-shaped fields the new operator doesn't use, so
    // switching operators never leaves a stale value2/values behind that
    // the new operator would silently ignore or misread. A single typed
    // `value` carries over when the new operator still wants one (e.g.
    // switching "is" → "contains"), rather than being wiped every time.
    updateCondition(condId, {
      operator,
      value: VALUELESS_OPERATORS.includes(operator) ? undefined : currentValue,
      value2: undefined,
      values: undefined,
    })
  }

  return (
    <div className="rounded-xl border border-gray-200 overflow-hidden">
      <div className="flex items-center justify-between bg-gray-50 px-3 py-2 border-b border-gray-200">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-indigo-600 tracking-wide">{label}</span>
          {conditions.length > 1 && (
            <>
              <div className="flex rounded-lg border border-gray-200 overflow-hidden">
                {(['AND', 'OR'] as const).map((l) => (
                  <button
                    key={l} type="button" onClick={() => onChangeLogic(l)}
                    className={`px-2 py-0.5 text-[11px] font-semibold transition-colors ${logic === l ? 'bg-indigo-600 text-white' : 'bg-white text-gray-500 hover:bg-gray-50'}`}
                  >
                    {l === 'AND' ? 'ALL' : 'ANY'}
                  </button>
                ))}
              </div>
              <span className="text-[11px] text-gray-400">of these are true</span>
            </>
          )}
        </div>
        <button type="button" onClick={addCondition} className="flex items-center gap-1 text-xs font-medium text-indigo-600 hover:text-indigo-700">
          <Plus size={12} /> Condition
        </button>
      </div>
      <div className="p-3 space-y-2">
        {conditions.length === 0 && (
          <p className="text-xs text-gray-400">No conditions yet — add one, or this will never match.</p>
        )}
        {conditions.map((cond, i) => {
          const field = fieldsById[cond.fieldId]
          const ops = field ? operatorsForFieldType(field.type) : []
          const isRange = RANGE_OPERATORS.includes(cond.operator)
          const isMultiValue = MULTI_VALUE_OPERATORS.includes(cond.operator)
          const showSingleValue = !VALUELESS_OPERATORS.includes(cond.operator) && !isRange && !isMultiValue
          return (
            <div key={cond.id}>
              {i > 0 && (
                <div className="flex items-center gap-2 py-1">
                  <div className="h-px flex-1 bg-gray-100" />
                  <span className="text-[10px] font-bold text-gray-400 tracking-wide">{logic}</span>
                  <div className="h-px flex-1 bg-gray-100" />
                </div>
              )}
              <div className="flex items-center gap-2">
                <select
                  value={cond.fieldId}
                  onChange={(e) => changeFieldId(cond.id, e.target.value)}
                  className="flex-[1.2] min-w-0 rounded-lg border border-gray-200 px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-200"
                >
                  {fields.length === 0 && <option value="">No fields yet</option>}
                  {fields.map((f) => <option key={f.id} value={f.id}>{fieldLabel(f.id)}</option>)}
                </select>
                <select
                  value={cond.operator}
                  onChange={(e) => changeOperator(cond.id, e.target.value as ConditionOperator, cond.value)}
                  className="w-40 shrink-0 rounded-lg border border-gray-200 px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-200"
                >
                  {ops.map((op) => <option key={op} value={op}>{OPERATOR_LABELS[op]}</option>)}
                </select>
                {showSingleValue && (
                  <div className="flex-1 min-w-0">
                    <FieldValueInput field={field} value={cond.value ?? ''} onChange={(v) => updateCondition(cond.id, { value: v })} />
                  </div>
                )}
                <button type="button" onClick={() => removeCondition(cond.id)} className="text-gray-300 hover:text-red-400 shrink-0">
                  <Trash2 size={14} />
                </button>
              </div>
              {isRange && (
                <div className="flex items-center gap-2 mt-1.5 pl-1">
                  <span className="text-[11px] text-gray-400 shrink-0">from</span>
                  <div className="flex-1 min-w-0">
                    <FieldValueInput field={field} value={cond.value ?? ''} onChange={(v) => updateCondition(cond.id, { value: v })} />
                  </div>
                  <span className="text-[11px] text-gray-400 shrink-0">to</span>
                  <div className="flex-1 min-w-0">
                    <FieldValueInput field={field} value={cond.value2 ?? ''} onChange={(v) => updateCondition(cond.id, { value2: v })} />
                  </div>
                </div>
              )}
              {isMultiValue && (
                <div className="mt-1.5 pl-1">
                  <FieldValuesInput field={field} values={cond.values ?? []} onChange={(v) => updateCondition(cond.id, { values: v })} />
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
