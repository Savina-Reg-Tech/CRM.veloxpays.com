import { useState } from 'react'
import { GitBranch, Plus, Pencil, Trash2, ChevronUp, ChevronDown } from 'lucide-react'
import type { ConditionalRule, FormField, FormStep } from '../../types'
import { VALUELESS_OPERATORS } from '../../types'
import { findRuleCycle } from '../../utils/rules'
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

  const fieldsById = Object.fromEntries(fields.map((f) => [f.id, f]))
  const fieldLabel = buildFieldLabeler(fields, steps)

  const describeCondition = (c: ConditionalRule['group']['conditions'][number]): string => {
    const label = fieldLabel(c.fieldId)
    const op = OPERATOR_LABELS[c.operator]
    if (VALUELESS_OPERATORS.includes(c.operator)) return `${label} ${op}`
    return `${label} ${op} "${c.value ?? ''}"`
  }

  const describeAction = (a: ConditionalRule['actions'][number]): string => {
    const label = fieldLabel(a.fieldId)
    if (a.type === 'set_value') return `${ACTION_LABELS[a.type]} "${label}" to "${a.value}"`
    return `${ACTION_LABELS[a.type]} "${label}"`
  }

  const openNewRule = () => { setEditingRule(null); setCycleError(null); setModalOpen(true) }
  const openEditRule = (rule: ConditionalRule) => { setEditingRule(rule); setCycleError(null); setModalOpen(true) }

  const handleSaveRule = (rule: ConditionalRule) => {
    const isNew = !rules.some((r) => r.id === rule.id)
    const nextRules = isNew ? [...rules, rule] : rules.map((r) => (r.id === rule.id ? rule : r))

    const cycle = findRuleCycle(nextRules)
    if (cycle) {
      const path = cycle.map((id) => fieldsById[id]?.label ?? id).join(' → ')
      setCycleError(`This rule creates a circular dependency: ${path}. Remove or adjust a condition/action to break the loop.`)
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

  const handleDelete = (rule: ConditionalRule) => setDeleteTarget(rule)
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
                IF conditions match, THEN show/hide fields, change requirements, or set values. Rules run top to bottom — later rules can override earlier ones for the same field.
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

        {rules.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-gray-200 bg-white px-6 py-10 text-center">
            <GitBranch size={28} className="mx-auto text-gray-300 mb-2" />
            <p className="text-sm font-medium text-gray-500">No rules yet</p>
            <p className="text-xs text-gray-400 mt-1 max-w-sm mx-auto">
              {fields.length === 0
                ? 'Add fields to this form in the Build tab first, then come back here to make them conditional.'
                : 'Create a rule to show or hide fields, change what\'s required, or fill in values automatically based on what a visitor selects.'}
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
                    <button type="button" onClick={() => openEditRule(rule)} className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg">
                      <Pencil size={13} />
                    </button>
                    <button type="button" onClick={() => handleDelete(rule)} className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg">
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        <RuleTester fields={fields} rules={rules.filter((r) => r.enabled)} />
      </div>

      <RuleEditorModal
        open={modalOpen}
        onClose={() => { setModalOpen(false); setEditingRule(null); setCycleError(null) }}
        onSave={handleSaveRule}
        fields={fields}
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
