import { Plus, X } from 'lucide-react'
import type { FormField } from '../../types'

interface FieldEditorProps {
  field: FormField | null
  onChange: (patch: Partial<FormField>) => void
}

function LabeledInput({
  label, value, onChange, type = 'text', placeholder = '',
}: {
  label: string; value: string; onChange: (v: string) => void; type?: string; placeholder?: string
}) {
  return (
    <div>
      <label className="block text-xs font-semibold text-gray-600 mb-1">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full px-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-300"
      />
    </div>
  )
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center gap-3 cursor-pointer">
      <div
        className={`relative w-9 h-5 rounded-full transition-colors ${checked ? 'bg-indigo-500' : 'bg-gray-300'}`}
        onClick={() => onChange(!checked)}
      >
        <div className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${checked ? 'translate-x-4' : ''}`} />
      </div>
      <span className="text-sm text-gray-700">{label}</span>
    </label>
  )
}

export default function FieldEditor({ field, onChange }: FieldEditorProps) {
  if (!field) {
    return (
      <div className="w-64 shrink-0 border-l border-gray-200 bg-white flex flex-col items-center justify-center text-center p-6">
        <div className="w-12 h-12 rounded-xl bg-gray-100 flex items-center justify-center mb-3">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-gray-400">
            <path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>
          </svg>
        </div>
        <p className="text-sm font-medium text-gray-500">Select a field</p>
        <p className="text-xs text-gray-400 mt-1">Click any field to edit its properties</p>
      </div>
    )
  }

  const hasOptions = ['dropdown', 'radio', 'checkbox'].includes(field.type)

  return (
    <div className="w-64 shrink-0 border-l border-gray-200 bg-white flex flex-col">
      <div className="px-4 py-3 border-b border-gray-200">
        <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">Edit Field</p>
        <p className="text-sm font-medium text-gray-700 mt-0.5 capitalize">{field.type} Field</p>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Label */}
        <LabeledInput
          label="Label"
          value={field.label}
          onChange={(v) => onChange({ label: v })}
          placeholder="Field label"
        />

        {/* Placeholder (not for checkbox/radio/file/hidden) */}
        {!['checkbox', 'radio', 'file', 'hidden', 'date'].includes(field.type) && (
          <LabeledInput
            label="Placeholder"
            value={field.placeholder ?? ''}
            onChange={(v) => onChange({ placeholder: v })}
            placeholder="Placeholder text"
          />
        )}

        {/* Help text */}
        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1">Help Text</label>
          <textarea
            value={field.helpText ?? ''}
            onChange={(e) => onChange({ helpText: e.target.value })}
            placeholder="Optional description shown below the field"
            rows={2}
            className="w-full px-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-300 resize-none"
          />
        </div>

        {/* Default value (text-like fields only) */}
        {['text', 'email', 'phone', 'textarea', 'hidden'].includes(field.type) && (
          <LabeledInput
            label="Default Value"
            value={field.defaultValue ?? ''}
            onChange={(v) => onChange({ defaultValue: v })}
            placeholder="Pre-filled value"
          />
        )}

        {/* Required toggle */}
        {field.type !== 'hidden' && (
          <Toggle
            label="Required"
            checked={field.required ?? false}
            onChange={(v) => onChange({ required: v })}
          />
        )}

        {/* Width toggle */}
        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-2">Width</label>
          <div className="flex gap-2">
            {(['full', 'half'] as const).map((w) => (
              <button
                key={w}
                type="button"
                onClick={() => onChange({ width: w })}
                className={`flex-1 py-1.5 text-xs rounded-lg border font-medium transition-colors ${
                  field.width === w
                    ? 'bg-indigo-500 text-white border-indigo-500'
                    : 'border-gray-200 text-gray-600 hover:border-gray-300'
                }`}
              >
                {w === 'full' ? 'Full Width' : 'Half Width'}
              </button>
            ))}
          </div>
        </div>

        {/* Options (dropdown / radio / checkbox) */}
        {hasOptions && (
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-2">Options</label>
            <div className="space-y-1.5">
              {(field.options ?? []).map((opt, i) => (
                <div key={i} className="flex items-center gap-1.5">
                  <input
                    value={opt}
                    onChange={(e) => {
                      const options = [...(field.options ?? [])]
                      options[i] = e.target.value
                      onChange({ options })
                    }}
                    className="flex-1 px-2 py-1 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-300"
                    placeholder={`Option ${i + 1}`}
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const options = (field.options ?? []).filter((_, idx) => idx !== i)
                      onChange({ options })
                    }}
                    className="text-gray-300 hover:text-red-400 transition-colors shrink-0"
                  >
                    <X size={14} />
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={() => onChange({ options: [...(field.options ?? []), ''] })}
                className="flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-700 mt-1"
              >
                <Plus size={13} /> Add option
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
