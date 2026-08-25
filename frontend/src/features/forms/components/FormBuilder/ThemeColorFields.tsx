// Shared between DesignPanel (this form's own theme) and TemplateCard
// (editing a saved template's theme) — kept in one place so both stay in
// sync rather than drifting into two slightly different field lists.
import { useState } from 'react'
import type { FormTheme } from '../../types'
import { HEX_COLOR_RE } from '../../types'

export const COLOR_FIELDS: { key: keyof FormTheme; label: string; help: string }[] = [
  { key: 'headerBgColor', label: 'Header background', help: 'The color band behind the form title.' },
  { key: 'headerTextColor', label: 'Header text', help: 'Form title and description text.' },
  { key: 'buttonColor', label: 'Button color', help: 'Next / Submit button background. Hover is auto-derived from this.' },
  { key: 'buttonTextColor', label: 'Button text', help: 'Text on the Next / Submit button.' },
  { key: 'formBgColor', label: 'Page background', help: 'The area behind the form card.' },
  { key: 'cardBgColor', label: 'Form background', help: 'The form card itself.' },
  { key: 'labelColor', label: 'Label text', help: 'Field labels and body text.' },
  { key: 'inputBorderColor', label: 'Input border', help: 'Border around text fields, dropdowns, and file uploads — keep it visibly distinct from the form background.' },
  { key: 'inputBgColor', label: 'Input background', help: 'Fill color inside text fields, dropdowns, and text areas — set this dark for a dark-mode form.' },
  { key: 'inputTextColor', label: 'Input text', help: 'Color of text typed or selected inside the fields — pair with a light input background for dark text, or a light color for a dark input background.' },
]

/** COLOR_FIELDS grouped into logical sections for the Design tab — same
 * underlying field list and ColorField control, just organized so a large
 * flat list of 10 color pickers doesn't read as an undifferentiated wall of
 * inputs. TemplateCard's compact inline editor still uses the flat
 * COLOR_FIELDS list (space is tighter there and templates are edited less
 * often than a form's own live theme). */
export const COLOR_FIELD_GROUPS: { title: string; keys: (keyof FormTheme)[] }[] = [
  { title: 'Header & button', keys: ['headerBgColor', 'headerTextColor', 'buttonColor', 'buttonTextColor'] },
  { title: 'Page & card', keys: ['formBgColor', 'cardBgColor', 'labelColor'] },
  { title: 'Fields & inputs', keys: ['inputBorderColor', 'inputBgColor', 'inputTextColor'] },
]

export function ColorField({
  label,
  help,
  value,
  onChange,
}: {
  label: string
  help: string
  value: string
  onChange: (hex: string) => void
}) {
  const [draft, setDraft] = useState(value)
  const isValid = HEX_COLOR_RE.test(draft)

  const commit = () => {
    if (isValid) onChange(draft)
    else setDraft(value) // revert invalid typed input
  }

  return (
    <div className="flex items-center gap-3 py-2">
      <label className="relative shrink-0">
        <input
          type="color"
          value={`#${isValid ? draft : value}`}
          onChange={(e) => {
            const hex = e.target.value.replace('#', '')
            setDraft(hex)
            onChange(hex)
          }}
          className="h-8 w-8 cursor-pointer rounded-md border border-gray-200 p-0"
        />
      </label>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-700">{label}</p>
        <p className="text-xs text-gray-400">{help}</p>
      </div>
      <div className="flex items-center gap-1 shrink-0">
        <span className="text-xs text-gray-400">#</span>
        <input
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value.replace(/[^0-9a-fA-F]/g, '').slice(0, 6))}
          onBlur={commit}
          onKeyDown={(e) => e.key === 'Enter' && commit()}
          maxLength={6}
          className={`w-20 rounded-md border px-2 py-1 text-xs font-mono uppercase focus:outline-none focus:ring-2 ${
            isValid ? 'border-gray-200 focus:ring-indigo-200' : 'border-red-300 focus:ring-red-200'
          }`}
        />
      </div>
    </div>
  )
}
