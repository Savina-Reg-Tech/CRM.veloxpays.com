import { useState } from 'react'
import { Pencil, Trash2, Check, X } from 'lucide-react'
import type { FormTheme, FormTemplate, BorderRadiusPreset, FontFamilyOption } from '../../types'
import { BORDER_RADIUS_PRESETS, FONT_FAMILY_OPTIONS } from '../../types'
import { resolveTheme } from '../../utils/theme'
import { COLOR_FIELDS, ColorField } from './ThemeColorFields'
import ThemePreviewCard from './ThemePreview'

interface TemplateCardProps {
  template: FormTemplate
  /** Applies the template AND switches the builder to the Build tab —
   * triggered by clicking "Use this template" or double-clicking the card
   * itself, so picking a design flows straight into adding/editing fields
   * rather than leaving the admin stranded on the Design tab. */
  onApplyAndBuild: (template: FormTemplate) => void
  onUpdate: (id: number, patch: { name: string; theme: FormTheme }) => Promise<void>
  onDelete: (template: FormTemplate) => void
  saving?: boolean
}

export default function TemplateCard({ template, onApplyAndBuild, onUpdate, onDelete, saving }: TemplateCardProps) {
  const [editing, setEditing] = useState(false)
  const [draftName, setDraftName] = useState(template.name)
  const [draftTheme, setDraftTheme] = useState<FormTheme>(template.theme)

  const resolved = resolveTheme(editing ? draftTheme : template.theme)
  const updateDraft = (patch: Partial<FormTheme>) => setDraftTheme((t) => ({ ...t, ...patch }))

  const startEdit = () => {
    setDraftName(template.name)
    setDraftTheme(template.theme)
    setEditing(true)
  }
  const cancelEdit = () => setEditing(false)
  const saveEdit = async () => {
    if (!draftName.trim()) return
    await onUpdate(template.id, { name: draftName.trim(), theme: draftTheme })
    setEditing(false)
  }

  return (
    <div
      className={`rounded-xl border bg-white p-3 space-y-2.5 transition-colors ${
        editing ? 'border-gray-200' : 'border-gray-200 hover:border-indigo-300 cursor-pointer'
      }`}
      onDoubleClick={() => { if (!editing) onApplyAndBuild(template) }}
      title={editing ? undefined : 'Double-click to use this template and start building'}
    >
      <ThemePreviewCard theme={resolved} title={editing ? draftName : template.name} />

      {editing ? (
        <div className="space-y-2">
          <input
            value={draftName}
            onChange={(e) => setDraftName(e.target.value)}
            placeholder="Template name"
            className="w-full rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-indigo-200"
          />

          <div className="divide-y divide-gray-100 rounded-lg border border-gray-100 max-h-64 overflow-y-auto">
            {COLOR_FIELDS.map(({ key, label, help }) => (
              <ColorField
                key={key}
                label={label}
                help={help}
                value={(resolved[key as keyof typeof resolved] as string)}
                onChange={(hex) => updateDraft({ [key]: hex } as Partial<FormTheme>)}
              />
            ))}
          </div>

          <div className="flex gap-2">
            <div className="flex-1">
              <label className="text-[10px] text-gray-400">Radius</label>
              <select
                value={resolved.borderRadius}
                onChange={(e) => updateDraft({ borderRadius: e.target.value as BorderRadiusPreset })}
                className="w-full rounded-lg border border-gray-200 px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-200"
              >
                {(Object.keys(BORDER_RADIUS_PRESETS) as BorderRadiusPreset[]).map((p) => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </div>
            <div className="flex-1">
              <label className="text-[10px] text-gray-400">Font</label>
              <select
                value={resolved.fontFamily}
                onChange={(e) => updateDraft({ fontFamily: e.target.value as FontFamilyOption })}
                className="w-full rounded-lg border border-gray-200 px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-200"
              >
                {FONT_FAMILY_OPTIONS.map((f) => (
                  <option key={f.value} value={f.value}>{f.label}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex items-center gap-2 pt-0.5">
            <button
              type="button"
              onClick={saveEdit}
              disabled={!draftName.trim() || saving}
              className="flex-1 flex items-center justify-center gap-1 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
            >
              <Check size={12} />
              Save
            </button>
            <button
              type="button"
              onClick={cancelEdit}
              className="flex items-center justify-center gap-1 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-500 hover:bg-gray-50"
            >
              <X size={12} />
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <>
          <div>
            <p className="text-xs font-semibold text-gray-800 truncate">{template.name}</p>
            {template.description && (
              <p className="text-[11px] text-gray-400 truncate">{template.description}</p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onApplyAndBuild(template) }}
              className="flex-1 rounded-lg bg-indigo-50 px-3 py-1.5 text-xs font-medium text-indigo-700 hover:bg-indigo-100"
              title="Apply this template and start building"
            >
              Use this template
            </button>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); startEdit() }}
              className="flex items-center justify-center rounded-lg border border-gray-200 p-1.5 text-gray-500 hover:bg-gray-50"
              title="Edit template"
            >
              <Pencil size={13} />
            </button>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onDelete(template) }}
              className="flex items-center justify-center rounded-lg border border-gray-200 p-1.5 text-gray-400 hover:border-red-200 hover:text-red-500"
              title="Delete template"
            >
              <Trash2 size={13} />
            </button>
          </div>
        </>
      )}
    </div>
  )
}
