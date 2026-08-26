import { useState } from 'react'
import { Plus, Pencil, Trash2, ChevronUp, ChevronDown } from 'lucide-react'
import type { FormField, FormStep, NotificationRule } from '../../types'
import { VALUELESS_OPERATORS } from '../../types'
import { buildFieldLabeler } from '../../utils/fieldLabels'
import { OPERATOR_LABELS } from './RuleEditorModal'
import NotificationRuleEditorModal from './NotificationRuleEditorModal'
import ConfirmDialog from '@/components/ui/ConfirmDialog'

interface NotificationRulesSectionProps {
  fields: FormField[]
  steps: FormStep[]
  rules: NotificationRule[]
  onChange: (rules: NotificationRule[]) => void
}

/** Conditional overrides for who gets notified on submission — e.g. "if
 * deal size > $10k, notify the sales lead instead of the default inbox."
 * The master notify_on_submission toggle (rendered by the caller) still
 * decides whether ANY notification fires; this only changes who, and only
 * for a submission that actually matches one of these rules. */
export default function NotificationRulesSection({ fields, steps, rules, onChange }: NotificationRulesSectionProps) {
  const fieldLabel = buildFieldLabeler(fields, steps)
  const [modalOpen, setModalOpen] = useState(false)
  const [editingRule, setEditingRule] = useState<NotificationRule | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<NotificationRule | null>(null)

  const describeCondition = (c: NotificationRule['group']['conditions'][number]): string => {
    const label = fieldLabel(c.fieldId)
    const op = OPERATOR_LABELS[c.operator]
    if (VALUELESS_OPERATORS.includes(c.operator)) return `${label} ${op}`
    return `${label} ${op} "${c.value ?? ''}"`
  }

  const openNew = () => { setEditingRule(null); setModalOpen(true) }
  const openEdit = (rule: NotificationRule) => { setEditingRule(rule); setModalOpen(true) }

  const handleSave = (rule: NotificationRule) => {
    const isNew = !rules.some((r) => r.id === rule.id)
    onChange(isNew ? [...rules, rule] : rules.map((r) => (r.id === rule.id ? rule : r)))
    setModalOpen(false)
    setEditingRule(null)
  }

  const handleToggle = (rule: NotificationRule) => onChange(rules.map((r) => (r.id === rule.id ? { ...r, enabled: !r.enabled } : r)))

  const confirmDelete = () => {
    if (!deleteTarget) return
    onChange(rules.filter((r) => r.id !== deleteTarget.id))
    setDeleteTarget(null)
  }

  const move = (index: number, direction: -1 | 1) => {
    const target = index + direction
    if (target < 0 || target >= rules.length) return
    const next = [...rules]
    ;[next[index], next[target]] = [next[target], next[index]]
    onChange(next)
  }

  return (
    <div className="space-y-2 pl-12">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-gray-600">Conditional recipients</p>
        <button
          type="button"
          onClick={openNew}
          disabled={fields.length === 0}
          className="flex items-center gap-1 text-xs font-medium text-indigo-600 hover:text-indigo-700 disabled:opacity-40"
        >
          <Plus size={11} /> New rule
        </button>
      </div>

      {rules.length === 0 ? (
        <p className="text-xs text-gray-400">Everyone gets notified at the email(s) above. Add a rule to route specific submissions elsewhere.</p>
      ) : (
        <div className="space-y-1.5">
          {rules.map((rule, i) => (
            <div key={rule.id} className={`rounded-lg border p-2.5 ${rule.enabled ? 'border-gray-200 bg-gray-50/60' : 'border-gray-100 bg-gray-50/30'}`}>
              <div className="flex items-start gap-2">
                <button
                  type="button"
                  onClick={() => handleToggle(rule)}
                  className={`relative mt-0.5 w-7 h-4 shrink-0 rounded-full transition-colors ${rule.enabled ? 'bg-indigo-500' : 'bg-gray-300'}`}
                >
                  <div className={`absolute top-0.5 left-0.5 w-3 h-3 rounded-full bg-white shadow transition-transform ${rule.enabled ? 'translate-x-3' : ''}`} />
                </button>
                <div className="min-w-0 flex-1">
                  {rule.name && <p className={`text-xs font-semibold mb-0.5 ${rule.enabled ? 'text-gray-700' : 'text-gray-400'}`}>{rule.name}</p>}
                  <p className={`text-xs leading-relaxed ${rule.enabled ? 'text-gray-500' : 'text-gray-400'}`}>
                    <span className="font-bold text-indigo-500">WHEN</span>{' '}
                    {rule.group.conditions.map(describeCondition).join(rule.group.logic === 'AND' ? ' AND ' : ' OR ')}
                    {'  '}
                    <span className="font-bold text-emerald-600">→</span>{' '}
                    {rule.emails.join(', ')}
                  </p>
                </div>
                <div className="flex items-center gap-0.5 shrink-0">
                  <button type="button" onClick={() => move(i, -1)} disabled={i === 0} className="p-0.5 text-gray-300 hover:text-gray-600 disabled:opacity-30">
                    <ChevronUp size={12} />
                  </button>
                  <button type="button" onClick={() => move(i, 1)} disabled={i === rules.length - 1} className="p-0.5 text-gray-300 hover:text-gray-600 disabled:opacity-30">
                    <ChevronDown size={12} />
                  </button>
                  <button type="button" onClick={() => openEdit(rule)} className="p-1 text-gray-400 hover:text-indigo-600">
                    <Pencil size={11} />
                  </button>
                  <button type="button" onClick={() => setDeleteTarget(rule)} className="p-1 text-gray-400 hover:text-red-500">
                    <Trash2 size={11} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <NotificationRuleEditorModal
        open={modalOpen}
        onClose={() => { setModalOpen(false); setEditingRule(null) }}
        onSave={handleSave}
        fields={fields}
        fieldLabel={fieldLabel}
        initialRule={editingRule}
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
