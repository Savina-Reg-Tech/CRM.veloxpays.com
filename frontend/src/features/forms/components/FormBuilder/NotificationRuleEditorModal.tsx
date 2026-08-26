import { useEffect, useState } from 'react'
import { nanoid } from 'nanoid'
import { AlertTriangle } from 'lucide-react'
import type { FormField, NotificationRule, RuleCondition } from '../../types'
import ConditionGroupEditor from './ConditionGroupEditor'

interface NotificationRuleEditorModalProps {
  open: boolean
  onClose: () => void
  onSave: (rule: NotificationRule) => void
  fields: FormField[]
  fieldLabel: (fieldId: string) => string
  initialRule: NotificationRule | null
}

export default function NotificationRuleEditorModal({ open, onClose, onSave, fields, fieldLabel, initialRule }: NotificationRuleEditorModalProps) {
  const [name, setName] = useState('')
  const [logic, setLogic] = useState<'AND' | 'OR'>('AND')
  const [conditions, setConditions] = useState<RuleCondition[]>([])
  const [emailsText, setEmailsText] = useState('')

  useEffect(() => {
    if (!open) return
    if (initialRule) {
      setName(initialRule.name ?? '')
      setLogic(initialRule.group.logic)
      setConditions(initialRule.group.conditions)
      setEmailsText(initialRule.emails.join(', '))
    } else {
      setName('')
      setLogic('AND')
      const first = fields[0]
      setConditions(first ? [{ id: `cond_${nanoid(6)}`, fieldId: first.id, operator: 'equals' }] : [])
      setEmailsText('')
    }
  }, [open, initialRule, fields])

  const emails = emailsText.split(',').map((e) => e.trim()).filter(Boolean)
  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  const invalidEmails = emails.filter((e) => !EMAIL_RE.test(e))
  const canSave = conditions.length > 0 && conditions.every((c) => c.fieldId) && emails.length > 0 && invalidEmails.length === 0

  const handleSave = () => {
    if (!canSave) return
    onSave({
      id: initialRule?.id ?? `notif_${nanoid(8)}`,
      name: name.trim() || undefined,
      enabled: initialRule?.enabled ?? true,
      group: { logic, conditions },
      emails,
    })
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-xl bg-white rounded-2xl shadow-xl z-10 flex flex-col max-h-[calc(100vh-2rem)]">
        <div className="flex items-start justify-between p-6 border-b border-gray-100 shrink-0">
          <div>
            <h2 className="text-base font-semibold text-gray-900">{initialRule ? 'Edit recipient rule' : 'New recipient rule'}</h2>
            <p className="text-sm text-gray-500 mt-0.5">WHEN a submission matches, notify these emails instead of the default list.</p>
          </div>
          <button type="button" onClick={onClose} className="ml-4 p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors">✕</button>
        </div>

        <div className="p-6 flex-1 min-h-0 overflow-y-auto space-y-5">
          {fields.length === 0 && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 flex items-start gap-2">
              <AlertTriangle size={14} className="text-amber-500 mt-0.5 shrink-0" />
              <p className="text-xs text-amber-700">Add some fields to this form first — a condition needs a field to check.</p>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Rule name (optional)</label>
            <input
              value={name} onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Route to sales lead"
              className="w-full rounded-lg border border-gray-200 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-200"
            />
          </div>

          <ConditionGroupEditor
            label="WHEN"
            fields={fields}
            fieldLabel={fieldLabel}
            logic={logic}
            conditions={conditions}
            onChangeLogic={setLogic}
            onChangeConditions={setConditions}
          />

          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Notify these emails</label>
            <input
              value={emailsText} onChange={(e) => setEmailsText(e.target.value)}
              placeholder="sales@example.com, alerts@example.com"
              className={`w-full rounded-lg border px-3 py-1.5 text-sm focus:outline-none focus:ring-2 ${
                invalidEmails.length > 0 ? 'border-red-300 focus:ring-red-200' : 'border-gray-200 focus:ring-indigo-200'
              }`}
            />
            <p className="text-xs text-gray-400 mt-1">Comma-separated. Replaces the form's default notification list for a matching submission.</p>
            {invalidEmails.length > 0 && (
              <p className="text-xs text-red-500 mt-1">Invalid: {invalidEmails.join(', ')}</p>
            )}
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
