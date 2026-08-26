import { useState } from 'react'
import { Plus, Pencil, Trash2 } from 'lucide-react'
import type { FormField, FormStep, WebhookRule } from '../../types'
import { VALUELESS_OPERATORS } from '../../types'
import { buildFieldLabeler } from '../../utils/fieldLabels'
import { OPERATOR_LABELS } from './RuleEditorModal'
import WebhookRuleEditorModal from './WebhookRuleEditorModal'
import ConfirmDialog from '@/components/ui/ConfirmDialog'

interface WebhookRulesSectionProps {
  fields: FormField[]
  steps: FormStep[]
  rules: WebhookRule[]
  onChange: (rules: WebhookRule[]) => void
}

/** Conditional webhook triggers — "when a submission matches, POST it to
 * this URL." Unlike notification recipients (first match wins), every
 * enabled matching webhook fires independently, so there's no reorder
 * control here — order doesn't affect behavior. */
export default function WebhookRulesSection({ fields, steps, rules, onChange }: WebhookRulesSectionProps) {
  const fieldLabel = buildFieldLabeler(fields, steps)
  const [modalOpen, setModalOpen] = useState(false)
  const [editingRule, setEditingRule] = useState<WebhookRule | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<WebhookRule | null>(null)

  const describeCondition = (c: WebhookRule['group']['conditions'][number]): string => {
    const label = fieldLabel(c.fieldId)
    const op = OPERATOR_LABELS[c.operator]
    if (VALUELESS_OPERATORS.includes(c.operator)) return `${label} ${op}`
    return `${label} ${op} "${c.value ?? ''}"`
  }

  const openNew = () => { setEditingRule(null); setModalOpen(true) }
  const openEdit = (rule: WebhookRule) => { setEditingRule(rule); setModalOpen(true) }

  const handleSave = (rule: WebhookRule) => {
    const isNew = !rules.some((r) => r.id === rule.id)
    onChange(isNew ? [...rules, rule] : rules.map((r) => (r.id === rule.id ? rule : r)))
    setModalOpen(false)
    setEditingRule(null)
  }

  const handleToggle = (rule: WebhookRule) => onChange(rules.map((r) => (r.id === rule.id ? { ...r, enabled: !r.enabled } : r)))

  const confirmDelete = () => {
    if (!deleteTarget) return
    onChange(rules.filter((r) => r.id !== deleteTarget.id))
    setDeleteTarget(null)
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold text-gray-600">Conditional webhooks</p>
          <p className="text-xs text-gray-400">POST submission data to a URL when conditions match. Every matching webhook fires — not just the first.</p>
        </div>
        <button
          type="button"
          onClick={openNew}
          disabled={fields.length === 0}
          className="flex items-center gap-1 text-xs font-medium text-indigo-600 hover:text-indigo-700 disabled:opacity-40 shrink-0"
        >
          <Plus size={11} /> New webhook
        </button>
      </div>

      {rules.length === 0 ? (
        <p className="text-xs text-gray-400">No webhooks configured yet.</p>
      ) : (
        <div className="space-y-1.5">
          {rules.map((rule) => (
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
                    <span className="font-mono">{rule.url}</span>
                    {rule.secret && <span className="ml-1 text-gray-400">(signed)</span>}
                  </p>
                </div>
                <div className="flex items-center gap-0.5 shrink-0">
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

      <WebhookRuleEditorModal
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
        title="Delete webhook"
        message={deleteTarget ? `Delete "${deleteTarget.name || 'this webhook'}"? This can't be undone.` : ''}
        confirmLabel="Delete"
        danger
      />
    </div>
  )
}
