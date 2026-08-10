import { useState } from 'react'
import { nanoid } from 'nanoid'
import { Plus, Trash2, MousePointerClick, Send, ExternalLink } from 'lucide-react'
import type { FormStep, StepButton, StepButtonAction } from '../../types'

interface StepButtonsModalProps {
  open: boolean
  onClose: () => void
  step: FormStep | null
  /** Whether this is the form's last step — only affects the default action
   *  given to newly-added buttons and the "can visitors finish?" warning.
   *  Every action (Continue / Submit / Link) is selectable on any step. */
  isFinalStep: boolean
  onSave: (buttons: StepButton[] | undefined) => void
}

function emptyButton(isFinalStep: boolean): StepButton {
  return { id: `btn_${nanoid(6)}`, label: '', action: isFinalStep ? 'submit' : 'next' }
}

const ACTION_OPTIONS: { value: StepButtonAction; label: string; icon: typeof MousePointerClick }[] = [
  { value: 'next', label: 'Continue', icon: MousePointerClick },
  { value: 'submit', label: 'Submit', icon: Send },
  { value: 'external_link', label: 'Open a link', icon: ExternalLink },
]

export default function StepButtonsModal({ open, onClose, step, isFinalStep, onSave }: StepButtonsModalProps) {
  const [buttons, setButtons] = useState<StepButton[]>([])
  const [seededFor, setSeededFor] = useState<string | null>(null)

  // Seed local editing state from the step whenever a *different* step is
  // opened (mirrors the pattern used by ClubBenefitsEditor's seeded-for guard).
  if (step && open && seededFor !== step.id) {
    setButtons(step.buttons ? step.buttons.map((b) => ({ ...b })) : [])
    setSeededFor(step.id)
  }

  if (!open || !step) return null

  const update = (id: string, patch: Partial<StepButton>) =>
    setButtons((prev) => prev.map((b) => (b.id === id ? { ...b, ...patch } : b)))

  const remove = (id: string) => setButtons((prev) => prev.filter((b) => b.id !== id))

  const add = () => setButtons((prev) => [...prev, emptyButton(isFinalStep)])

  const handleClose = () => {
    setSeededFor(null)
    onClose()
  }

  const handleSave = () => {
    // Drop incomplete rows: no label, or an external link with no URL.
    const clean = buttons.filter((b) => b.label.trim() && (b.action !== 'external_link' || b.url?.trim()))
    onSave(clean.length > 0 ? clean : undefined)
    handleClose()
  }

  const hasSubmitButton = buttons.some((b) => b.action === 'submit')

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
        {/* Header */}
        <div className="flex items-start justify-between px-6 py-4 border-b border-gray-200">
          <div>
            <h2 className="text-base font-semibold text-gray-800">Custom buttons — {step.title}</h2>
            <p className="text-xs text-gray-400 mt-0.5">
              Replace the default "{isFinalStep ? 'Submit' : 'Next'}" button with your own options for this step.
              Any button can submit the form — it doesn't have to be the last step.
            </p>
          </div>
          <button onClick={handleClose} className="text-gray-400 hover:text-gray-600 shrink-0">✕</button>
        </div>

        {/* Buttons list */}
        <div className="p-6 space-y-3 max-h-[60vh] overflow-y-auto">
          {buttons.length === 0 && (
            <p className="text-sm text-gray-400 text-center py-4">
              No custom buttons yet — this step will show the default "{isFinalStep ? 'Submit' : 'Next'}" button.
            </p>
          )}

          {buttons.map((b) => (
            <div key={b.id} className="border border-gray-200 rounded-xl p-3 space-y-2.5">
              <div className="flex items-center gap-2">
                <input
                  value={b.label}
                  onChange={(e) => update(b.id, { label: e.target.value })}
                  placeholder='Button label, e.g. "Continue Application"'
                  className="flex-1 px-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-300"
                />
                <button
                  type="button"
                  onClick={() => remove(b.id)}
                  className="text-gray-300 hover:text-red-400 shrink-0"
                  title="Remove button"
                >
                  <Trash2 size={15} />
                </button>
              </div>

              <div className="grid grid-cols-3 gap-1.5">
                {ACTION_OPTIONS.map(({ value, label, icon: Icon }) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => update(b.id, { action: value, url: value === 'external_link' ? b.url : undefined })}
                    className={`flex items-center justify-center gap-1 py-1.5 text-[11px] rounded-lg border font-medium transition-colors ${
                      b.action === value
                        ? 'bg-indigo-500 text-white border-indigo-500'
                        : 'border-gray-200 text-gray-600 hover:border-gray-300'
                    }`}
                  >
                    <Icon size={12} /> {label}
                  </button>
                ))}
              </div>

              {b.action === 'external_link' && (
                <input
                  value={b.url ?? ''}
                  onChange={(e) => update(b.id, { url: e.target.value })}
                  placeholder="https://calendly.com/your-link"
                  className="w-full px-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-300"
                />
              )}
            </div>
          ))}

          <button
            type="button"
            onClick={add}
            className="flex items-center gap-1.5 text-sm text-indigo-600 hover:text-indigo-700"
          >
            <Plus size={14} /> Add button
          </button>

          {isFinalStep && buttons.length > 0 && !hasSubmitButton && (
            <p className="text-xs text-amber-600 bg-amber-50 rounded-lg px-3 py-2">
              None of these buttons actually submits the form — set at least one button's action
              to "Submit," or visitors reaching this step won't be able to complete it.
            </p>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 px-6 py-4 border-t border-gray-100">
          <button
            onClick={handleClose}
            className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-50 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-2 text-sm bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium transition-colors"
          >
            Save buttons
          </button>
        </div>
      </div>
    </div>
  )
}
