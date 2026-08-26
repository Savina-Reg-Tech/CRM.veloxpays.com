import { useEffect, useState } from 'react'
import { nanoid } from 'nanoid'
import { AlertTriangle } from 'lucide-react'
import type { FormField, RuleCondition, WebhookRule } from '../../types'
import ConditionGroupEditor from './ConditionGroupEditor'

interface WebhookRuleEditorModalProps {
  open: boolean
  onClose: () => void
  onSave: (rule: WebhookRule) => void
  fields: FormField[]
  fieldLabel: (fieldId: string) => string
  initialRule: WebhookRule | null
}

/** A URL is "plausible" here purely for immediate UI feedback (valid
 * http/https URL). The real SSRF-safety check — resolving the hostname and
 * refusing loopback/private/link-local/cloud-metadata IPs — only happens
 * server-side at send time, since a hostname's resolved IP can change after
 * this rule is saved. See backend webhookService.js. */
function isPlausibleUrl(url: string): boolean {
  try {
    const parsed = new URL(url)
    return parsed.protocol === 'http:' || parsed.protocol === 'https:'
  } catch {
    return false
  }
}

export default function WebhookRuleEditorModal({ open, onClose, onSave, fields, fieldLabel, initialRule }: WebhookRuleEditorModalProps) {
  const [name, setName] = useState('')
  const [logic, setLogic] = useState<'AND' | 'OR'>('AND')
  const [conditions, setConditions] = useState<RuleCondition[]>([])
  const [url, setUrl] = useState('')
  const [secret, setSecret] = useState('')

  useEffect(() => {
    if (!open) return
    if (initialRule) {
      setName(initialRule.name ?? '')
      setLogic(initialRule.group.logic)
      setConditions(initialRule.group.conditions)
      setUrl(initialRule.url)
      setSecret(initialRule.secret ?? '')
    } else {
      setName('')
      setLogic('AND')
      const first = fields[0]
      setConditions(first ? [{ id: `cond_${nanoid(6)}`, fieldId: first.id, operator: 'equals' }] : [])
      setUrl('')
      setSecret('')
    }
  }, [open, initialRule, fields])

  const trimmedUrl = url.trim()
  const urlValid = trimmedUrl.length === 0 || isPlausibleUrl(trimmedUrl)
  const canSave = conditions.length > 0 && conditions.every((c) => c.fieldId) && trimmedUrl.length > 0 && isPlausibleUrl(trimmedUrl)

  const handleSave = () => {
    if (!canSave) return
    onSave({
      id: initialRule?.id ?? `webhook_${nanoid(8)}`,
      name: name.trim() || undefined,
      enabled: initialRule?.enabled ?? true,
      group: { logic, conditions },
      url: trimmedUrl,
      secret: secret.trim() || undefined,
    })
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-xl bg-white rounded-2xl shadow-xl z-10 flex flex-col max-h-[calc(100vh-2rem)]">
        <div className="flex items-start justify-between p-6 border-b border-gray-100 shrink-0">
          <div>
            <h2 className="text-base font-semibold text-gray-900">{initialRule ? 'Edit webhook' : 'New webhook'}</h2>
            <p className="text-sm text-gray-500 mt-0.5">WHEN a submission matches, POST it as JSON to this URL.</p>
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
            <label className="block text-xs font-semibold text-gray-600 mb-1">Webhook name (optional)</label>
            <input
              value={name} onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Notify Zapier"
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
            <label className="block text-xs font-semibold text-gray-600 mb-1">Webhook URL</label>
            <input
              value={url} onChange={(e) => setUrl(e.target.value)}
              placeholder="https://hooks.example.com/velox-crm"
              className={`w-full rounded-lg border px-3 py-1.5 text-sm font-mono focus:outline-none focus:ring-2 ${
                urlValid ? 'border-gray-200 focus:ring-indigo-200' : 'border-red-300 focus:ring-red-200'
              }`}
            />
            <p className="text-xs text-gray-400 mt-1">
              Must be a public http(s) URL. Requests to internal/private addresses (localhost, 169.254.169.254, 10.x.x.x, etc.) are blocked server-side for security.
            </p>
            {!urlValid && <p className="text-xs text-red-500 mt-1">Enter a valid http(s) URL.</p>}
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Signing secret (optional)</label>
            <input
              value={secret} onChange={(e) => setSecret(e.target.value)}
              placeholder="Used to sign the request"
              className="w-full rounded-lg border border-gray-200 px-3 py-1.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-200"
            />
            <p className="text-xs text-gray-400 mt-1">
              If set, each request includes an <code className="bg-gray-100 px-1 rounded">X-Velox-Signature: sha256=...</code> header (HMAC-SHA256 of the JSON body) so your receiver can verify it came from us.
            </p>
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
            Save webhook
          </button>
        </div>
      </div>
    </div>
  )
}
