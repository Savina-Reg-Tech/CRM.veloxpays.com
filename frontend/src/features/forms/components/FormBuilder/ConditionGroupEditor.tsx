import { nanoid } from 'nanoid'
import { Plus, Trash2 } from 'lucide-react'
import type { ConditionOperator, FormField, RuleCondition } from '../../types'
import { VALUELESS_OPERATORS } from '../../types'
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

/** The "IF <conditions>" condition-group builder — shared between rule
 * editing (RuleEditorModal) and conditional on-submit outcomes
 * (OutcomeEditorModal) so the two never drift into subtly different
 * condition-building UIs. */
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

  return (
    <div className="rounded-xl border border-gray-200 overflow-hidden">
      <div className="flex items-center justify-between bg-gray-50 px-3 py-2 border-b border-gray-200">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-indigo-600 tracking-wide">{label}</span>
          {conditions.length > 1 && (
            <div className="flex rounded-lg border border-gray-200 overflow-hidden">
              {(['AND', 'OR'] as const).map((l) => (
                <button
                  key={l} type="button" onClick={() => onChangeLogic(l)}
                  className={`px-2 py-0.5 text-[11px] font-semibold transition-colors ${logic === l ? 'bg-indigo-600 text-white' : 'bg-white text-gray-500 hover:bg-gray-50'}`}
                >
                  {l}
                </button>
              ))}
            </div>
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
        {conditions.map((cond) => {
          const field = fieldsById[cond.fieldId]
          const ops = field ? operatorsForFieldType(field.type) : []
          const showValue = !VALUELESS_OPERATORS.includes(cond.operator)
          return (
            <div key={cond.id} className="flex items-center gap-2">
              <select
                value={cond.fieldId}
                onChange={(e) => {
                  const f = fieldsById[e.target.value]
                  const validOps = f ? operatorsForFieldType(f.type) : []
                  updateCondition(cond.id, { fieldId: e.target.value, operator: validOps[0] ?? cond.operator, value: undefined })
                }}
                className="flex-[1.2] min-w-0 rounded-lg border border-gray-200 px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-200"
              >
                {fields.length === 0 && <option value="">No fields yet</option>}
                {fields.map((f) => <option key={f.id} value={f.id}>{fieldLabel(f.id)}</option>)}
              </select>
              <select
                value={cond.operator}
                onChange={(e) => updateCondition(cond.id, { operator: e.target.value as ConditionOperator, value: VALUELESS_OPERATORS.includes(e.target.value as ConditionOperator) ? undefined : cond.value })}
                className="w-36 shrink-0 rounded-lg border border-gray-200 px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-200"
              >
                {ops.map((op) => <option key={op} value={op}>{OPERATOR_LABELS[op]}</option>)}
              </select>
              {showValue && (
                <div className="flex-1 min-w-0">
                  <FieldValueInput field={field} value={cond.value ?? ''} onChange={(v) => updateCondition(cond.id, { value: v })} />
                </div>
              )}
              <button type="button" onClick={() => removeCondition(cond.id)} className="text-gray-300 hover:text-red-400 shrink-0">
                <Trash2 size={14} />
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}
