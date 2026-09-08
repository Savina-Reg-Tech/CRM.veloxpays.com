import { useState } from 'react'
import {
  Palette, RotateCcw, Save, AlertTriangle, PanelTop, Layers, Type, LayoutTemplate, SlidersHorizontal,
} from 'lucide-react'
import type { FormTheme, FormTemplate, BorderRadiusPreset, FontFamilyOption } from '../../types'
import { BORDER_RADIUS_PRESETS, FONT_FAMILY_OPTIONS } from '../../types'
import { resolveTheme, contrastWarning, borderVisibilityWarning } from '../../utils/theme'
import {
  useFormTemplates,
  useCreateFormTemplate,
  useUpdateFormTemplate,
  useDeleteFormTemplate,
} from '../../hooks/useForms'
import { COLOR_FIELDS, COLOR_FIELD_GROUPS, ColorField } from './ThemeColorFields'
import TemplateCard from './TemplateCard'
import ThemePreviewCard from './ThemePreview'
import ConfirmDialog from '@/components/ui/ConfirmDialog'

interface PendingConfirm {
  title: string
  message: string
  confirmLabel?: string
  danger?: boolean
  onConfirm: () => void
}

interface DesignPanelProps {
  theme: FormTheme | undefined
  onChange: (theme: FormTheme) => void
  /** Applying a whole template is more than a color change — if the form
   * has no fields yet, it also seeds a starter field set (see
   * buildStarterFields in FormBuilder/index.tsx), so this is kept separate
   * from `onChange` (used for single color/radius/font tweaks, which never
   * touch fields). */
  onApplyTemplate: (theme: FormTheme) => void
  /** Switches the builder back to the Build tab — used when a template is
   * applied, so picking a design flows straight into adding/editing fields
   * instead of leaving the admin stranded on the Design tab. */
  onSwitchToBuild: () => void
}

// One icon per COLOR_FIELD_GROUPS section (see ThemeColorFields.tsx) —
// matched by title rather than index so the two lists can't silently drift
// out of sync if a section is ever reordered.
const SECTION_ICONS: Record<string, typeof PanelTop> = {
  'Header & button': PanelTop,
  'Page & card': Layers,
  'Fields & inputs': Type,
}

export default function DesignPanel({ theme, onChange, onApplyTemplate, onSwitchToBuild }: DesignPanelProps) {
  const resolved = resolveTheme(theme)
  const { data: templates } = useFormTemplates()
  const createTemplate = useCreateFormTemplate()
  const updateTemplate = useUpdateFormTemplate()
  const deleteTemplate = useDeleteFormTemplate()
  const [saveOpen, setSaveOpen] = useState(false)
  const [templateName, setTemplateName] = useState('')
  const [pendingConfirm, setPendingConfirm] = useState<PendingConfirm | null>(null)

  const update = (patch: Partial<FormTheme>) => onChange({ ...theme, ...patch })

  const handleReset = () => {
    setPendingConfirm({
      title: 'Reset to defaults',
      message: 'Reset all colors to the default theme? This discards your current design changes for this form.',
      confirmLabel: 'Reset',
      danger: true,
      onConfirm: () => onChange({}),
    })
  }

  // "Use this template" (or double-clicking the card) applies its colors to
  // this form AND jumps straight to Build — picking a design is rarely the
  // end goal, it's a step on the way to adding or adjusting fields, so this
  // skips having to separately find and click "Build" afterward.
  const handleApplyTemplateAndBuild = (tpl: FormTemplate) => {
    setPendingConfirm({
      title: `Apply "${tpl.name}"?`,
      message: 'This replaces your current color settings for this form.',
      confirmLabel: 'Apply template',
      onConfirm: () => {
        onApplyTemplate({ ...tpl.theme }) // one-time copy — no live link back to the template
        onSwitchToBuild()
      },
    })
  }

  const handleUpdateTemplate = async (id: number, patch: { name: string; theme: FormTheme }) => {
    await updateTemplate.mutateAsync({ id, payload: patch })
  }

  const handleDeleteTemplate = (tpl: FormTemplate) => {
    setPendingConfirm({
      title: `Delete "${tpl.name}"?`,
      message: 'Forms that already applied it keep their current colors. This can\'t be undone.',
      confirmLabel: 'Delete',
      danger: true,
      onConfirm: () => deleteTemplate.mutate(tpl.id),
    })
  }

  const handleSaveTemplate = async () => {
    if (!templateName.trim()) return
    await createTemplate.mutateAsync({ name: templateName.trim(), theme: resolved })
    setTemplateName('')
    setSaveOpen(false)
  }

  // Advisory contrast checks — never block saving.
  const warnings = [
    contrastWarning(resolved.headerBgColor, resolved.headerTextColor, 'Header'),
    contrastWarning(resolved.buttonColor, resolved.buttonTextColor, 'Button'),
    contrastWarning(resolved.cardBgColor, resolved.labelColor, 'Labels'),
    contrastWarning(resolved.inputBgColor, resolved.inputTextColor, 'Input text'),
    borderVisibilityWarning(resolved.cardBgColor, resolved.inputBorderColor),
    borderVisibilityWarning(resolved.inputBgColor, resolved.inputBorderColor),
  ].filter((w): w is string => !!w)

  return (
    <div className="flex-1 overflow-y-auto bg-gray-50">
      <div className="mx-auto max-w-6xl p-6">
        {/* Page header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-50">
              <Palette size={17} className="text-indigo-600" />
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-800">Design</p>
              <p className="text-xs text-gray-400 mt-0.5">Colors, radius, and font for this form — changes preview live on the right.</p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleReset}
            className="flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-500 hover:border-gray-300 hover:text-gray-700 transition-colors"
          >
            <RotateCcw size={12} />
            Reset to defaults
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-6 items-start">
          {/* ── Left column: controls ─────────────────────────────── */}
          <div className="space-y-6 min-w-0">
            {/* Templates */}
            <section className="rounded-2xl border border-gray-200 bg-white overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
                <div className="flex items-center gap-2">
                  <LayoutTemplate size={15} className="text-gray-400" />
                  <p className="text-sm font-semibold text-gray-700">Templates</p>
                </div>
                {!saveOpen && (
                  <button
                    type="button"
                    onClick={() => setSaveOpen(true)}
                    className="flex items-center gap-1 text-xs font-medium text-indigo-600 hover:text-indigo-700"
                  >
                    <Save size={12} />
                    Save current colors
                  </button>
                )}
              </div>

              <div className="p-4 space-y-3">
                {saveOpen && (
                  <div className="flex items-center gap-2 rounded-xl border border-gray-200 bg-gray-50 p-3">
                    <input
                      type="text"
                      value={templateName}
                      onChange={(e) => setTemplateName(e.target.value)}
                      placeholder="Template name"
                      autoFocus
                      className="flex-1 rounded-lg border border-gray-200 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-200"
                    />
                    <button
                      type="button"
                      onClick={handleSaveTemplate}
                      disabled={!templateName.trim() || createTemplate.isPending}
                      className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-700 disabled:opacity-40"
                    >
                      Save
                    </button>
                    <button
                      type="button"
                      onClick={() => { setSaveOpen(false); setTemplateName('') }}
                      className="text-xs text-gray-400 hover:text-gray-600"
                    >
                      Cancel
                    </button>
                  </div>
                )}

                {templates && templates.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {templates.map((t) => (
                      <TemplateCard
                        key={t.id}
                        template={t}
                        onApplyAndBuild={handleApplyTemplateAndBuild}
                        onUpdate={handleUpdateTemplate}
                        onDelete={handleDeleteTemplate}
                        saving={updateTemplate.isPending}
                      />
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-gray-400 rounded-xl border border-dashed border-gray-200 px-3 py-4 text-center">
                    No saved templates yet — design a form's colors, then "Save current colors" to reuse them elsewhere.
                  </p>
                )}
              </div>
            </section>

            {/* Contrast / visibility warnings */}
            {warnings.length > 0 && (
              <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 space-y-1.5">
                {warnings.map((w) => (
                  <p key={w} className="flex items-start gap-2 text-xs text-amber-700">
                    <AlertTriangle size={13} className="mt-0.5 shrink-0" />
                    {w}
                  </p>
                ))}
              </div>
            )}

            {/* Color sections */}
            {COLOR_FIELD_GROUPS.map((group) => {
              const Icon = SECTION_ICONS[group.title] ?? Palette
              return (
                <section key={group.title} className="rounded-2xl border border-gray-200 bg-white overflow-hidden">
                  <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-100">
                    <Icon size={15} className="text-gray-400" />
                    <p className="text-sm font-semibold text-gray-700">{group.title}</p>
                  </div>
                  <div className="px-4 divide-y divide-gray-100">
                    {group.keys.map((key) => {
                      const field = COLOR_FIELDS.find((f) => f.key === key)
                      if (!field) return null
                      return (
                        <ColorField
                          key={key}
                          label={field.label}
                          help={field.help}
                          value={resolved[key as keyof typeof resolved] as string}
                          onChange={(hex) => update({ [key]: hex } as Partial<FormTheme>)}
                        />
                      )
                    })}
                  </div>
                </section>
              )
            })}

            {/* Layout */}
            <section className="rounded-2xl border border-gray-200 bg-white overflow-hidden">
              <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-100">
                <SlidersHorizontal size={15} className="text-gray-400" />
                <p className="text-sm font-semibold text-gray-700">Layout</p>
              </div>
              <div className="p-4 space-y-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm text-gray-700">Show form title &amp; description</p>
                    <p className="text-xs text-gray-400">Turn off if the page embedding this form already shows its own heading.</p>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={resolved.showHeader}
                    onClick={() => update({ showHeader: !resolved.showHeader })}
                    className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors ${
                      resolved.showHeader ? 'bg-indigo-600' : 'bg-gray-200'
                    }`}
                  >
                    <span
                      className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
                        resolved.showHeader ? 'translate-x-[1.125rem]' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>
                <div>
                  <p className="text-xs font-medium text-gray-500 mb-2">Corner radius</p>
                  <div className="flex gap-2">
                    {(Object.keys(BORDER_RADIUS_PRESETS) as BorderRadiusPreset[]).map((preset) => (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => update({ borderRadius: preset })}
                        className={`flex-1 rounded-lg border px-2 py-2 text-xs font-medium capitalize transition-colors ${
                          resolved.borderRadius === preset
                            ? 'border-indigo-400 bg-indigo-50 text-indigo-700'
                            : 'border-gray-200 text-gray-500 hover:border-gray-300'
                        }`}
                        style={{ borderRadius: preset === 'full' ? '9999px' : BORDER_RADIUS_PRESETS[preset] }}
                      >
                        {preset}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-xs font-medium text-gray-500 mb-2">Font</p>
                  <select
                    value={resolved.fontFamily}
                    onChange={(e) => update({ fontFamily: e.target.value as FontFamilyOption })}
                    className="w-full rounded-lg border border-gray-200 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-200"
                  >
                    {FONT_FAMILY_OPTIONS.map((f) => (
                      <option key={f.value} value={f.value} style={{ fontFamily: f.css }}>{f.label}</option>
                    ))}
                  </select>
                </div>
              </div>
            </section>
          </div>

          {/* ── Right column: sticky live preview ─────────────────── */}
          <div className="lg:sticky lg:top-6">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2 px-0.5">Live preview</p>
            <ThemePreviewCard theme={resolved} title="Your form" />
          </div>
        </div>
      </div>

      <ConfirmDialog
        open={!!pendingConfirm}
        onClose={() => setPendingConfirm(null)}
        onConfirm={() => {
          pendingConfirm?.onConfirm()
          setPendingConfirm(null)
        }}
        title={pendingConfirm?.title ?? ''}
        message={pendingConfirm?.message ?? ''}
        confirmLabel={pendingConfirm?.confirmLabel}
        danger={pendingConfirm?.danger}
        loading={updateTemplate.isPending || deleteTemplate.isPending}
      />
    </div>
  )
}
