import { useState } from 'react'
import { GitBranch, Plus, Pencil, Copy, MoreVertical, Trash2, ChevronUp, ChevronDown, AlertTriangle } from 'lucide-react'
import { nanoid } from 'nanoid'
import type { ConditionalRule, FormField, FormStep } from '../../types'
import { VALUELESS_OPERATORS, RANGE_OPERATORS, MULTI_VALUE_OPERATORS } from '../../types'
import { findRuleCycle, findStepSelfLoopRule, findStepNavCycle, findPossibleConflicts } from '../../utils/rules'
import { buildFieldLabeler } from '../../utils/fieldLabels'
import RuleEditorModal, { OPERATOR_LABELS, ACTION_LABELS } from './RuleEditorModal'
import RuleTester from './RuleTester'
import ConfirmDialog from '@/components/ui/ConfirmDialog'

interface RulesPanelProps {
  fields: FormField[]
  steps: FormStep[]
  rules: ConditionalRule[]
  onChange: (rules: ConditionalRule[]) => void
}

export default function RulesPanel({ fields, steps, rules, onChange }: RulesPanelProps) {
  const [editingRule, setEditingRule] = useState<ConditionalRule | null>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [cycleError, setCycleError] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<ConditionalRule | null>(null)
  const [openMenuId, setOpenMenuId] = useState<string | null>(null)

  const fieldsById = Object.fromEntries(fields.map((f) => [f.id, f]))
  const stepsById = Object.fromEntries(steps.map((s) => [s.id, s]))
  const fieldLabel = buildFieldLabeler(fields, steps)

  const describeCondition = (c: ConditionalRule['group']['conditions'][number]): string => {
    const label = fieldLabel(c.fieldId)
    const op = OPERATOR_LABELS[c.operator]
    if (VALUELESS_OPERATORS.includes(c.operator)) return `${label} ${op}`
    if (RANGE_OPERATORS.includes(c.operator)) return `${label} ${op} ${c.value ?? ''} and ${c.value2 ?? ''}`
    if (MULTI_VALUE_OPERATORS.includes(c.operator)) return `${label} ${op} ${(c.values ?? []).join(', ')}`
    return `${label} ${op} "${c.value ?? ''}"`
  }

  const describeAction = (a: ConditionalRule['actions'][number]): string => {
    if ('stepId' in a) {
      const step = stepsById[a.stepId]
      return `${ACTION_LABELS[a.type]} ${step ? `"${step.title}"` : '(deleted step)'}`
    }
    if (!('fieldId' in a)) {
      return ACTION_LABELS[a.type] // next_step / previous_step / end_form — no target
    }
    const label = fieldLabel(a.fieldId)
    if (a.type === 'set_value') return `${ACTION_LABELS[a.type]} "${label}" to "${a.value}"`
    return `${ACTION_LABELS[a.type]} "${label}"`
  }

  const openNewRule = () => { setEditingRule(null); setCycleError(null); setModalOpen(true) }
  const openEditRule = (rule: ConditionalRule) => { setEditingRule(rule); setCycleError(null); setModalOpen(true); setOpenMenuId(null) }

  const handleSaveRule = (rule: ConditionalRule) => {
    const isNew = !rules.some((r) => r.id === rule.id)
    const nextRules = isNew ? [...rules, rule] : rules.map((r) => (r.id === rule.id ? rule : r))

    const cycle = findRuleCycle(nextRules)
    if (cycle) {
      const path = cycle.map((id) => fieldsById[id]?.label ?? id).join(' → ')
      setCycleError(`This rule creates a circular dependency: ${path}. Remove or adjust a condition/action to break the loop.`)
      return
    }
    const selfLoop = findStepSelfLoopRule(nextRules)
    if (selfLoop) {
      const step = stepsById[selfLoop.fromStepId ?? '']
      setCycleError(`This rule routes "${step?.title ?? 'a step'}" back to itself — a visitor would never be able to move forward. Pick a different step.`)
      return
    }
    onChange(nextRules)
    setModalOpen(false)
    setEditingRule(null)
    setCycleError(null)
  }

  const handleToggleEnabled = (rule: ConditionalRule) => {
    onChange(rules.map((r) => (r.id === rule.id ? { ...r, enabled: !r.enabled } : r)))
  }

  const handleDuplicate = (rule: ConditionalRule) => {
    const copy: ConditionalRule = {
      ...rule,
      id: `rule_${nanoid(8)}`,
      name: rule.name ? `${rule.name} (copy)` : undefined,
      group: { ...rule.group, conditions: rule.group.conditions.map((c) => ({ ...c, id: `cond_${nanoid(6)}` })) },
      actions: rule.actions.map((a) => ({ ...a, id: `act_${nanoid(6)}` })),
    }
    onChange([...rules, copy])
    setOpenMenuId(null)
  }

  const handleDelete = (rule: ConditionalRule) => { setDeleteTarget(rule); setOpenMenuId(null) }
  const confirmDelete = () => {
    if (!deleteTarget) return
    onChange(rules.filter((r) => r.id !== deleteTarget.id))
    setDeleteTarget(null)
  }

  const moveRule = (index: number, direction: -1 | 1) => {
    const target = index + direction
    if (target < 0 || target >= rules.length) return
    const next = [...rules]
    ;[next[index], next[target]] = [next[target], next[index]]
    onChange(next)
  }

  // Multi-step navigation cycles are a WARNING, not a hard block (see
  // findStepNavCycle) — mutually exclusive conditions often make a "go back
  // and review" pattern perfectly safe even though a graph-only check can't
  // prove that, so this is surfaced as a caution banner rather than
  // something that stops the admin from saving.
  const navCycle = findStepNavCycle(rules, steps)

  // Best-effort, non-blocking hints — see findPossibleConflicts. Priority
  // (which rule wins) is already visible via the numbered badge on each
  // card below; this just calls out the pairs where that ordering actually
  // matters.
  const conflicts = findPossibleConflicts(rules)
  const ruleIndexById = new Map(rules.map((r, i) => [r.id, i + 1]))
  const ruleNameOrIndex = (id: string) => {
    const rule = rules.find((r) => r.id === id)
    return rule?.name ? `"${rule.name}"` : `Rule ${ruleIndexById.get(id)}`
  }

  return (
    <div className="flex-1 overflow-y-auto bg-gray-50">
      <div className="mx-auto max-w-4xl p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-50">
              <GitBranch size={17} className="text-indigo-600" />
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-800">Logic</p>
              <p className="text-xs text-gray-400 mt-0.5">
                IF conditions match, THEN change fields or send the visitor to a different step. Rules run in order — the number badge shows priority.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={openNewRule}
            disabled={fields.length === 0}
            className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-700 disabled:opacity-40 shrink-0"
            title={fields.length === 0 ? 'Add some fields in Build first' : undefined}
          >
            <Plus size={13} />
            New rule
          </button>
        </div>

        {navCycle && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 flex items-start gap-2">
            <AlertTriangle size={14} className="text-amber-500 mt-0.5 shrink-0" />
            <p className="text-xs text-amber-700">
              Steps can route back and forth: {navCycle.map((id) => `"${stepsById[id]?.title ?? id}"`).join(' → ')}. If this isn't
              a deliberate "go back and review" pattern, double-check a visitor always has a way to move forward.
            </p>
          </div>
        )}

        {conflicts.length > 0 && (
          <div className="rounded-xl border border-blue-200 bg-blue-50 p-3 flex items-start gap-2">
            <AlertTriangle size={14} className="text-blue-500 mt-0.5 shrink-0" />
            <div className="text-xs text-blue-700 space-y-0.5">
              {conflicts.map((c, i) => (
                <p key={i}>{ruleNameOrIndex(c.ruleAId)} and {ruleNameOrIndex(c.ruleBId)} {c.description}.</p>
              ))}
            </div>
          </div>
        )}

        {rules.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-gray-200 bg-white px-6 py-10 text-center">
            <GitBranch size={28} className="mx-auto text-gray-300 mb-2" />
            <p className="text-sm font-medium text-gray-500">No rules yet</p>
            <p className="text-xs text-gray-400 mt-1 max-w-sm mx-auto">
              {fields.length === 0
                ? 'Add fields to this form in the Build tab first, then come back here to make them conditional.'
                : 'Create a rule to show or hide fields, change what\'s required, fill in values automatically, or send visitors down a different path.'}
            </p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {rules.map((rule, i) => (
              <div
                key={rule.id}
                className={`rounded-xl border bg-white p-3.5 transition-colors ${rule.enabled ? 'border-gray-200' : 'border-gray-100 bg-gray-50/60'}`}
              >
                <div className="flex items-start gap-3">
                  {/* Priority badge */}
                  <div
                    title={`Priority ${i + 1} — rules are checked in this order`}
                    className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${rule.enabled ? 'bg-indigo-100 text-indigo-600' : 'bg-gray-100 text-gray-400'}`}
                  >
                    {i + 1}
                  </div>

                  {/* Enable/disable toggle */}
                  <button
                    type="button"
                    onClick={() => handleToggleEnabled(rule)}
                    title={rule.enabled ? 'Disable this rule' : 'Enable this rule'}
                    className={`relative mt-0.5 w-9 h-5 shrink-0 rounded-full transition-colors ${rule.enabled ? 'bg-indigo-500' : 'bg-gray-300'}`}
                  >
                    <div className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${rule.enabled ? 'translate-x-4' : ''}`} />
                  </button>

                  <div className="min-w-0 flex-1">
                    {rule.name && <p className={`text-sm font-semibold mb-1 ${rule.enabled ? 'text-gray-800' : 'text-gray-400'}`}>{rule.name}</p>}
                    <p className={`text-xs leading-relaxed ${rule.enabled ? 'text-gray-600' : 'text-gray-400'}`}>
                      <span className="font-bold text-indigo-500">IF</span>{' '}
                      {rule.group.conditions.map(describeCondition).join(rule.group.logic === 'AND' ? ' AND ' : ' OR ')}
                      {'  '}
                      <span className="font-bold text-emerald-600">THEN</span>{' '}
                      {rule.actions.map(describeAction).join(', ')}
                    </p>
                  </div>

                  <div className="flex items-center gap-0.5 shrink-0">
                    <button type="button" onClick={() => moveRule(i, -1)} disabled={i === 0} className="p-1 text-gray-300 hover:text-gray-600 disabled:opacity-30">
                      <ChevronUp size={14} />
                    </button>
                    <button type="button" onClick={() => moveRule(i, 1)} disabled={i === rules.length - 1} className="p-1 text-gray-300 hover:text-gray-600 disabled:opacity-30">
                      <ChevronDown size={14} />
                    </button>
                    <button type="button" onClick={() => openEditRule(rule)} title="Edit" className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg">
                      <Pencil size={13} />
                    </button>
                    <button type="button" onClick={() => handleDuplicate(rule)} title="Duplicate" className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg">
                      <Copy size={13} />
                    </button>
                    <div className="relative">
                      <button
                        type="button"
                        onClick={() => setOpenMenuId((id) => (id === rule.id ? null : rule.id))}
                        title="More"
                        className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg"
                      >
                        <MoreVertical size={13} />
                      </button>
                      {openMenuId === rule.id && (
                        <>
                          <div className="fixed inset-0 z-10" onClick={() => setOpenMenuId(null)} />
                          <div className="absolute right-0 top-full mt-1 z-20 w-32 rounded-lg border border-gray-200 bg-white shadow-lg py-1">
                            <button
                              type="button"
                              onClick={() => handleDelete(rule)}
                              className="flex w-full items-center gap-2 px-3 py-1.5 text-xs text-red-500 hover:bg-red-50"
                            >
                              <Trash2 size={12} /> Delete
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        <RuleTester fields={fields} steps={steps} rules={rules.filter((r) => r.enabled)} />
      </div>

      <RuleEditorModal
        open={modalOpen}
        onClose={() => { setModalOpen(false); setEditingRule(null); setCycleError(null) }}
        onSave={handleSaveRule}
        fields={fields}
        steps={steps}
        fieldLabel={fieldLabel}
        initialRule={editingRule}
        cycleError={cycleError}
      />

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={confirmDelete}
        title="Delete rule"
        message={deleteTarget ? `Delete "${deleteTarget.name || 'this rule'}"? This can't be undone.` : ''}
        confirmLabel="Delete"
        danger
      />
    </div>
  )
}
