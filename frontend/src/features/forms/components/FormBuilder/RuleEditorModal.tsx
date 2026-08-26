import { useEffect, useState } from 'react'
import { nanoid } from 'nanoid'
import { Plus, Trash2, AlertTriangle, ArrowRight } from 'lucide-react'
import type { ConditionalRule, ConditionOperator, FieldRuleAction, FormField, FormStep, NavigationRuleAction, RuleActionType, RuleCondition } from '../../types'
import { NAVIGATION_ACTION_TYPES } from '../../types'
import { operatorsForFieldType } from '../../utils/rules'
import ConditionGroupEditor from './ConditionGroupEditor'

export const OPERATOR_LABELS: Record<ConditionOperator, string> = {
  equals: 'is', not_equals: 'is not',
  contains: 'contains', not_contains: 'does not contain',
  starts_with: 'starts with', ends_with: 'ends with',
  is_empty: 'is empty', is_not_empty: 'is not empty',
  greater_than: 'is greater than', less_than: 'is less than',
  greater_or_equal: 'is at least', less_or_equal: 'is at most',
  between: 'is between',
  one_of: 'is one of', none_of: 'is none of',
  domain_is: 'domain is',
}

// Field actions (target a field) vs. navigation actions (target a step) —
// kept as separate label maps because the editor renders them in two
// visually distinct sections ("Change fields" / "Then go to"), never mixed
// in one dropdown.
export const FIELD_ACTION_LABELS: Record<'show_field' | 'hide_field' | 'require_field' | 'unrequire_field' | 'set_value' | 'clear_value', string> = {
  show_field: 'Show', hide_field: 'Hide',
  require_field: 'Require', unrequire_field: 'Make optional',
  set_value: 'Set value of', clear_value: 'Clear value of',
}

// "Go to a specific step" vs "Continue to the next step in order" read too
// similarly when they were both worded as "Go to..." — easy to pick the
// wrong one when skimming a dropdown, since only one of them actually lets
// you name a destination. Worded further apart on purpose.
export const NAV_ACTION_LABELS: Record<'goto_step' | 'skip_step' | 'next_step' | 'previous_step' | 'end_form', string> = {
  goto_step: 'Jump to a specific step', skip_step: 'Skip over a specific step',
  next_step: 'Continue to the next step in order', previous_step: 'Go back to the previous step',
  end_form: 'Submit the form now',
}

// Combined map — used anywhere a rule's actions need a one-line plain-
// language description regardless of which kind they are (e.g. rule cards).
export const ACTION_LABELS: Record<RuleActionType, string> = {
  ...FIELD_ACTION_LABELS,
  ...NAV_ACTION_LABELS,
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

function newFieldAction(fields: FormField[]): FieldRuleAction {
  const targets = targetableFields('show_field', fields)
  return { id: `act_${nanoid(6)}`, type: 'show_field', fieldId: targets[0]?.id ?? '' }
}

/** A value input whose control shape follows the target field's type —
 * a <select> of that field's own options for dropdown/radio/checkbox, a
 * date/number picker for date/number fields, otherwise a plain text input.
 * Keeps typed values ("value" comparisons/set) consistent with what the
 * field can actually hold instead of letting an admin type a value the
 * field could never realistically contain. */
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
  if (field.type === 'number') {
    return (
      <input
        type="number" value={value} onChange={(e) => onChange(e.target.value)}
        placeholder="0" className="w-full rounded-lg border border-gray-200 px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-200"
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

type NavKind = '' | (typeof NAVIGATION_ACTION_TYPES)[number]
const NAV_TARGETED_KINDS: NavKind[] = ['goto_step', 'skip_step']

interface RuleEditorModalProps {
  open: boolean
  onClose: () => void
  onSave: (rule: ConditionalRule) => void
  fields: FormField[]
  steps: FormStep[]
  fieldLabel: (fieldId: string) => string
  initialRule: ConditionalRule | null   // null = creating a new rule
  cycleError: string | null             // set by the parent when saving this rule would introduce a circular dependency
}

export default function RuleEditorModal({ open, onClose, onSave, fields, steps, fieldLabel, initialRule, cycleError }: RuleEditorModalProps) {
  const [name, setName] = useState('')
  const [logic, setLogic] = useState<'AND' | 'OR'>('AND')
  const [conditions, setConditions] = useState<RuleCondition[]>([])
  const [fieldActions, setFieldActions] = useState<FieldRuleAction[]>([])
  const [navAction, setNavAction] = useState<NavigationRuleAction | null>(null)
  const [fromStepId, setFromStepId] = useState('')

  // Steps a rule can actually navigate between — the reserved on-submit
  // step is never a valid "leave from" or "go to" target, it's the fixed
  // destination visitors land on automatically once they actually submit.
  const navigableSteps = steps.filter((s) => !s.isOnSubmit)

  // Re-seed the draft every time the modal opens (either editing an existing
  // rule or starting a blank one) — not on every prop change, so typing
  // inside the modal never gets clobbered by an unrelated parent re-render.
  useEffect(() => {
    if (!open) return
    if (initialRule) {
      setName(initialRule.name ?? '')
      setLogic(initialRule.group.logic)
      setConditions(initialRule.group.conditions)
      const existingNav = initialRule.actions.find((a): a is NavigationRuleAction => !('fieldId' in a)) ?? null
      setFieldActions(initialRule.actions.filter((a): a is FieldRuleAction => 'fieldId' in a))
      setNavAction(existingNav)
      setFromStepId(initialRule.fromStepId ?? navigableSteps[0]?.id ?? '')
    } else {
      setName('')
      setLogic('AND')
      setConditions([newCondition(fields)])
      setFieldActions(fields.length ? [newFieldAction(fields)] : [])
      setNavAction(null)
      setFromStepId(navigableSteps[0]?.id ?? '')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initialRule])

  const fieldsById = Object.fromEntries(fields.map((f) => [f.id, f]))

  const updateFieldAction = (id: string, patch: Partial<FieldRuleAction>) =>
    setFieldActions((as) => as.map((a) => (a.id === id ? ({ ...a, ...patch } as FieldRuleAction) : a)))
  const removeFieldAction = (id: string) => setFieldActions((as) => as.filter((a) => a.id !== id))
  const addFieldAction = () => setFieldActions((as) => [...as, newFieldAction(fields)])

  const changeFieldActionType = (id: string, type: keyof typeof FIELD_ACTION_LABELS) => {
    setFieldActions((as) => as.map((a) => {
      if (a.id !== id) return a
      const targets = targetableFields(type, fields)
      const fieldId = targets.some((f) => f.id === a.fieldId) ? a.fieldId : (targets[0]?.id ?? '')
      if (type === 'set_value') return { id: a.id, type, fieldId, value: '' }
      return { id: a.id, type, fieldId } as FieldRuleAction
    }))
  }

  const changeNavKind = (kind: NavKind) => {
    if (kind === '') { setNavAction(null); return }
    const id = navAction?.id ?? `act_${nanoid(6)}`
    if (kind === 'goto_step' || kind === 'skip_step') {
      // Deliberately left blank rather than silently defaulting to "the
      // next available step" — that default is easy to mistake for an
      // intentional choice and looks identical to picking "Continue to the
      // next step in order" by accident. Leaving it blank disables Save
      // (see canSave) until the admin explicitly names a destination.
      const existingStepId = navAction && 'stepId' in navAction ? navAction.stepId : ''
      setNavAction({ id, type: kind, stepId: existingStepId } as NavigationRuleAction)
    } else {
      setNavAction({ id, type: kind } as NavigationRuleAction)
    }
  }

  const navKind: NavKind = navAction?.type ?? ''
  const navStepId = navAction && 'stepId' in navAction ? navAction.stepId : ''
  const navNeedsTarget = NAV_TARGETED_KINDS.includes(navKind)

  const canSave = conditions.length > 0 && conditions.every((c) => c.fieldId)
    && (fieldActions.length > 0 || !!navAction)
    && fieldActions.every((a) => a.fieldId)
    && (!navAction || !navNeedsTarget || !!navStepId)
    && (!navAction || !!fromStepId)

  const handleSave = () => {
    if (!canSave) return
    const rule: ConditionalRule = {
      id: initialRule?.id ?? `rule_${nanoid(8)}`,
      name: name.trim() || undefined,
      enabled: initialRule?.enabled ?? true,
      group: { logic, conditions },
      actions: navAction ? [...fieldActions, navAction] : fieldActions,
      fromStepId: navAction ? fromStepId : undefined,
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

          {/* THEN — change fields */}
          <div className="rounded-xl border border-gray-200 overflow-hidden">
            <div className="flex items-center justify-between bg-gray-50 px-3 py-2 border-b border-gray-200">
              <span className="text-xs font-bold text-emerald-600 tracking-wide">THEN — change fields</span>
              <button type="button" onClick={addFieldAction} className="flex items-center gap-1 text-xs font-medium text-indigo-600 hover:text-indigo-700">
                <Plus size={12} /> Action
              </button>
            </div>
            <div className="p-3 space-y-2">
              {fieldActions.length === 0 && (
                <p className="text-xs text-gray-400">No field changes — this rule only navigates (below), or does nothing yet.</p>
              )}
              {fieldActions.map((action) => {
                const targets = targetableFields(action.type, fields)
                const target = fieldsById[action.fieldId]
                return (
                  <div key={action.id} className="flex items-center gap-2">
                    <select
                      value={action.type}
                      onChange={(e) => changeFieldActionType(action.id, e.target.value as keyof typeof FIELD_ACTION_LABELS)}
                      className="flex-[1.1] min-w-0 rounded-lg border border-gray-200 px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-200"
                    >
                      {(Object.keys(FIELD_ACTION_LABELS) as (keyof typeof FIELD_ACTION_LABELS)[]).map((t) => <option key={t} value={t}>{FIELD_ACTION_LABELS[t]}</option>)}
                    </select>
                    <select
                      value={action.fieldId}
                      onChange={(e) => updateFieldAction(action.id, { fieldId: e.target.value })}
                      className="flex-1 min-w-0 rounded-lg border border-gray-200 px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-200"
                    >
                      {targets.length === 0 && <option value="">No eligible fields</option>}
                      {targets.map((f) => <option key={f.id} value={f.id}>{fieldLabel(f.id)}</option>)}
                    </select>
                    {action.type === 'set_value' && (
                      <div className="flex-1 min-w-0">
                        <FieldValueInput field={target} value={action.value} onChange={(v) => updateFieldAction(action.id, { value: v } as Partial<FieldRuleAction>)} />
                      </div>
                    )}
                    <button type="button" onClick={() => removeFieldAction(action.id)} className="text-gray-300 hover:text-red-400 shrink-0">
                      <Trash2 size={14} />
                    </button>
                  </div>
                )
              })}
            </div>
          </div>

          {/* THEN — go to (navigation, at most one per rule) */}
          {navigableSteps.length > 0 && (
            <div className="rounded-xl border border-gray-200 overflow-hidden">
              <div className="flex items-center justify-between bg-gray-50 px-3 py-2 border-b border-gray-200">
                <span className="text-xs font-bold text-violet-600 tracking-wide">THEN — go to</span>
              </div>
              <div className="p-3 space-y-2">
                <select
                  value={navKind}
                  onChange={(e) => changeNavKind(e.target.value as NavKind)}
                  className="w-full rounded-lg border border-gray-200 px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-200"
                >
                  <option value="">Don't navigate — stay on the normal path</option>
                  {(Object.keys(NAV_ACTION_LABELS) as (keyof typeof NAV_ACTION_LABELS)[]).map((k) => (
                    <option key={k} value={k}>{NAV_ACTION_LABELS[k]}</option>
                  ))}
                </select>

                {navAction && (
                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    <span className="text-[11px] text-gray-400 shrink-0">When leaving</span>
                    <select
                      value={fromStepId}
                      onChange={(e) => setFromStepId(e.target.value)}
                      className="flex-1 min-w-[8rem] rounded-lg border border-gray-200 px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-200"
                    >
                      {navigableSteps.map((s) => <option key={s.id} value={s.id}>{s.title}</option>)}
                    </select>
                    {navNeedsTarget && (
                      <>
                        <ArrowRight size={13} className="text-gray-300 shrink-0" />
                        <select
                          value={navStepId}
                          onChange={(e) => setNavAction((a) => (a && 'stepId' in a ? { ...a, stepId: e.target.value } : a))}
                          className={`flex-1 min-w-[8rem] rounded-lg border px-2 py-1.5 text-xs focus:outline-none focus:ring-2 ${
                            navStepId ? 'border-gray-200 focus:ring-indigo-200' : 'border-amber-300 focus:ring-amber-200'
                          }`}
                        >
                          <option value="" disabled>Choose a step…</option>
                          {navigableSteps.filter((s) => s.id !== fromStepId).map((s) => <option key={s.id} value={s.id}>{s.title}</option>)}
                        </select>
                      </>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
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
