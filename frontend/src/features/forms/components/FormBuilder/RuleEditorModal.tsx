import { useEffect, useState } from 'react'
import { nanoid } from 'nanoid'
import { Plus, Trash2, AlertTriangle } from 'lucide-react'
import type { ConditionalRule, ConditionOperator, FormField, RuleAction, RuleActionType, RuleCondition } from '../../types'
import { operatorsForFieldType } from '../../utils/rules'
import ConditionGroupEditor from './ConditionGroupEditor'

export const OPERATOR_LABELS: Record<ConditionOperator, string> = {
  equals: 'is', not_equals: 'is not',
  contains: 'contains', not_contains: 'does not contain',
  is_empty: 'is empty', is_not_empty: 'is not empty',
  greater_than: 'is greater than', less_than: 'is less than',
  greater_or_equal: 'is at least', less_or_equal: 'is at most',
}

export const ACTION_LABELS: Record<RuleActionType, string> = {
  show_field: 'Show field', hide_field: 'Hide field',
  require_field: 'Make field required', unrequire_field: 'Make field optional',
  set_value: 'Set field value', clear_value: 'Clear field value',
}

/** Which fields make sense as the target of a given action type — e.g.
 * "make required" on a section, or "set value" on a file upload, has no
 * well-defined meaning, so those combinations aren't offered. */
function targetableFields(actionType: RuleActionType, fields: FormField[]): FormField[] {
  if (actionType === 'require_field' || actionType === 'unrequire_field') {
    return fields.filter((f) => f.type !== 'section' && f.type !== 'hidden')
  }
  if (actionType === 'set_value' || actionType === 'clear_value') {
    // 'email' is excluded: the live public form renders it as a controlled
    // React input (it needs local state for the typo-suggestion/validation
    // UI), so a rule writing directly to its DOM node would get immediately
    // overwritten by React on the next render instead of sticking.
    return fields.filter((f) => f.type !== 'section' && f.type !== 'file' && f.type !== 'email')
  }
  return fields // show_field / hide_field — any field, including sections
}

function newCondition(fields: FormField[]): RuleCondition {
  const first = fields[0]
  return { id: `cond_${nanoid(6)}`, fieldId: first?.id ?? '', operator: first ? operatorsForFieldType(first.type)[0] : 'is_not_empty' }
}

function newAction(fields: FormField[]): RuleAction {
  const targets = targetableFields('show_field', fields)
  return { id: `act_${nanoid(6)}`, type: 'show_field', fieldId: targets[0]?.id ?? '' }
}

/** A value input whose control shape follows the target field's type —
 * a <select> of that field's own options for dropdown/radio/checkbox, a
 * date picker for date fields, otherwise a plain text input. Keeps typed
 * values ("value" comparisons/set) consistent with what the field can
 * actually hold instead of letting an admin type a value the field could
 * never realistically contain. */
export function FieldValueInput({ field, value, onChange }: { field: FormField | undefined; value: string; onChange: (v: string) => void }) {
  if (!field) {
    return (
      <input
        type="text" value={value} onChange={(e) => onChange(e.target.value)}
        placeholder="Value" className="w-full rounded-lg border border-gray-200 px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-200"
      />
    )
  }
  if (['dropdown', 'radio', 'checkbox'].includes(field.type)) {
    return (
      <select
        value={value} onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-gray-200 px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-200"
      >
        <option value="">Select an option…</option>
        {(field.options ?? []).map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
    )
  }
  if (field.type === 'date') {
    return (
      <input
        type="date" value={value} onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-gray-200 px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-200"
      />
    )
  }
  return (
    <input
      type="text" value={value} onChange={(e) => onChange(e.target.value)}
      placeholder="Value" className="w-full rounded-lg border border-gray-200 px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-200"
    />
  )
}

interface RuleEditorModalProps {
  open: boolean
  onClose: () => void
  onSave: (rule: ConditionalRule) => void
  fields: FormField[]
  fieldLabel: (fieldId: string) => string
  initialRule: ConditionalRule | null   // null = creating a new rule
  cycleError: string | null             // set by the parent when saving this rule would introduce a circular dependency
}

export default function RuleEditorModal({ open, onClose, onSave, fields, fieldLabel, initialRule, cycleError }: RuleEditorModalProps) {
  const [name, setName] = useState('')
  const [logic, setLogic] = useState<'AND' | 'OR'>('AND')
  const [conditions, setConditions] = useState<RuleCondition[]>([])
  const [actions, setActions] = useState<RuleAction[]>([])

  // Re-seed the draft every time the modal opens (either editing an existing
  // rule or starting a blank one) — not on every prop change, so typing
  // inside the modal never gets clobbered by an unrelated parent re-render.
  useEffect(() => {
    if (!open) return
    if (initialRule) {
      setName(initialRule.name ?? '')
      setLogic(initialRule.group.logic)
      setConditions(initialRule.group.conditions)
      setActions(initialRule.actions)
    } else {
      setName('')
      setLogic('AND')
      setConditions([newCondition(fields)])
      setActions([newAction(fields)])
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initialRule])

  const fieldsById = Object.fromEntries(fields.map((f) => [f.id, f]))

  const updateAction = (id: string, patch: Partial<RuleAction>) =>
    setActions((as) => as.map((a) => (a.id === id ? ({ ...a, ...patch } as RuleAction) : a)))
  const removeAction = (id: string) => setActions((as) => as.filter((a) => a.id !== id))
  const addAction = () => setActions((as) => [...as, newAction(fields)])

  const changeActionType = (id: string, type: RuleActionType) => {
    setActions((as) => as.map((a) => {
      if (a.id !== id) return a
      const targets = targetableFields(type, fields)
      const fieldId = targets.some((f) => f.id === a.fieldId) ? a.fieldId : (targets[0]?.id ?? '')
      if (type === 'set_value') return { id: a.id, type, fieldId, value: '' }
      return { id: a.id, type, fieldId } as RuleAction
    }))
  }

  const canSave = name !== undefined && conditions.length > 0 && actions.length > 0
    && conditions.every((c) => c.fieldId) && actions.every((a) => a.fieldId)

  const handleSave = () => {
    if (!canSave) return
    const rule: ConditionalRule = {
      id: initialRule?.id ?? `rule_${nanoid(8)}`,
      name: name.trim() || undefined,
      enabled: initialRule?.enabled ?? true,
      group: { logic, conditions },
      actions,
    }
    onSave(rule)
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-2xl bg-white rounded-2xl shadow-xl z-10 flex flex-col max-h-[calc(100vh-2rem)]">
        <div className="flex items-start justify-between p-6 border-b border-gray-100 shrink-0">
          <div>
            <h2 className="text-base font-semibold text-gray-900">{initialRule ? 'Edit rule' : 'New rule'}</h2>
            <p className="text-sm text-gray-500 mt-0.5">IF the conditions below match, THEN run the actions.</p>
          </div>
          <button type="button" onClick={onClose} className="ml-4 p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors">✕</button>
        </div>

        <div className="p-6 flex-1 min-h-0 overflow-y-auto space-y-5">
          {cycleError && (
            <div className="rounded-xl border border-red-200 bg-red-50 p-3 flex items-start gap-2">
              <AlertTriangle size={14} className="text-red-500 mt-0.5 shrink-0" />
              <p className="text-xs text-red-700">{cycleError}</p>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Rule name (optional)</label>
            <input
              value={name} onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Show shipping address"
              className="w-full rounded-lg border border-gray-200 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-200"
            />
          </div>

          <ConditionGroupEditor
            fields={fields}
            fieldLabel={fieldLabel}
            logic={logic}
            conditions={conditions}
            onChangeLogic={setLogic}
            onChangeConditions={setConditions}
          />

          {/* THEN */}
          <div className="rounded-xl border border-gray-200 overflow-hidden">
            <div className="flex items-center justify-between bg-gray-50 px-3 py-2 border-b border-gray-200">
              <span className="text-xs font-bold text-emerald-600 tracking-wide">THEN</span>
              <button type="button" onClick={addAction} className="flex items-center gap-1 text-xs font-medium text-indigo-600 hover:text-indigo-700">
                <Plus size={12} /> Action
              </button>
            </div>
            <div className="p-3 space-y-2">
              {actions.map((action) => {
                const targets = targetableFields(action.type, fields)
                const target = fieldsById[action.fieldId]
                return (
                  <div key={action.id} className="flex items-center gap-2">
                    <select
                      value={action.type}
                      onChange={(e) => changeActionType(action.id, e.target.value as RuleActionType)}
                      className="flex-[1.1] min-w-0 rounded-lg border border-gray-200 px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-200"
                    >
                      {(Object.keys(ACTION_LABELS) as RuleActionType[]).map((t) => <option key={t} value={t}>{ACTION_LABELS[t]}</option>)}
                    </select>
                    <select
                      value={action.fieldId}
                      onChange={(e) => updateAction(action.id, { fieldId: e.target.value })}
                      className="flex-1 min-w-0 rounded-lg border border-gray-200 px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-200"
                    >
                      {targets.length === 0 && <option value="">No eligible fields</option>}
                      {targets.map((f) => <option key={f.id} value={f.id}>{fieldLabel(f.id)}</option>)}
                    </select>
                    {action.type === 'set_value' && (
                      <div className="flex-1 min-w-0">
                        <FieldValueInput field={target} value={action.value} onChange={(v) => updateAction(action.id, { value: v } as Partial<RuleAction>)} />
                      </div>
                    )}
                    <button type="button" onClick={() => removeAction(action.id)} disabled={actions.length <= 1} className="text-gray-300 hover:text-red-400 disabled:opacity-30 disabled:hover:text-gray-300 shrink-0">
                      <Trash2 size={14} />
                    </button>
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        <div className="px-6 py-4 border-t border-gray-100 shrink-0 flex flex-wrap items-center justify-end gap-3">
          <button type="button" onClick={onClose} className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
            Cancel
          </button>
          <button
            type="button" onClick={handleSave} disabled={!canSave}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-40"
          >
            Save rule
          </button>
        </div>
      </div>
    </div>
  )
}
