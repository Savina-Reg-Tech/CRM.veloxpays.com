import { Plus, Trash2, ChevronLeft, ChevronRight, CheckCircle2 } from 'lucide-react'
import type { FormStep } from '../../types'

interface StepTabsProps {
  steps: FormStep[]
  activeStepIndex: number
  onSelect: (index: number) => void
  onAdd: () => void
  onRemove: (index: number) => void
  onRename: (index: number, title: string) => void
  onMove: (from: number, to: number) => void
}

export default function StepTabs({
  steps, activeStepIndex,
  onSelect, onAdd, onRemove, onRename, onMove,
}: StepTabsProps) {
  // The reserved on-submit step is always last (an invariant the reducer
  // enforces) — split it out so "+ Add Step" can render between the
  // fillable form steps and it, instead of after everything. That keeps it
  // from ever looking like just one more step you'd add/reorder.
  const onSubmitIndex = steps.findIndex((s) => s.isOnSubmit)
  const fieldStepEntries = steps
    .map((step, i) => [step, i] as const)
    .filter(([step]) => !step.isOnSubmit)

  const renderTab = (step: FormStep, i: number) => {
    const isOnSubmit = !!step.isOnSubmit
    return (
          <div
            key={step.id}
            className={`group flex items-center gap-1 px-3 py-1.5 rounded-lg border text-xs font-medium cursor-pointer transition-all whitespace-nowrap ${
              i === activeStepIndex
                ? isOnSubmit
                  ? 'bg-emerald-50 border-emerald-300 text-emerald-700'
                  : 'bg-indigo-50 border-indigo-300 text-indigo-700'
                : isOnSubmit
                  ? 'border-emerald-200 text-emerald-600 hover:border-emerald-300 bg-emerald-50/40'
                  : 'border-gray-200 text-gray-600 hover:border-gray-300'
            }`}
            onClick={() => onSelect(i)}
          >
            {/* Step number — kept for the on-submit step too (it's still
                "Step N" positionally, e.g. Step 2 becomes Step 3 once a new
                field step is inserted before it), plus a checkmark accent
                so it reads as visually distinct from a fillable page. */}
            {isOnSubmit ? (
              <span className="flex items-center gap-0.5 shrink-0">
                <span className="w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-bold bg-emerald-500 text-white">
                  {i + 1}
                </span>
                <CheckCircle2 size={12} className="text-emerald-500" />
              </span>
            ) : (
              <span className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 ${
                i === activeStepIndex ? 'bg-indigo-500 text-white' : 'bg-gray-200 text-gray-500'
              }`}>{i + 1}</span>
            )}

            {/* Editable title — locked (plain text) for the reserved on-submit step */}
            {isOnSubmit ? (
              <span className="w-24 text-xs truncate" title={step.title}>{step.title}</span>
            ) : (
              <input
                value={step.title}
                onChange={(e) => onRename(i, e.target.value)}
                onClick={(e) => e.stopPropagation()}
                className="bg-transparent border-none outline-none w-20 text-xs"
              />
            )}

            {/* Reorder + delete (only visible on hover) — not offered for the
                reserved on-submit step, which is always pinned last. */}
            {!isOnSubmit && (
              <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity ml-1">
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); onMove(i, i - 1) }}
                  disabled={i === 0}
                  className="p-0.5 text-gray-400 hover:text-gray-600 disabled:opacity-20"
                  title="Move left"
                >
                  <ChevronLeft size={12} />
                </button>
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); onMove(i, i + 1) }}
                  disabled={i >= steps.length - 2}
                  className="p-0.5 text-gray-400 hover:text-gray-600 disabled:opacity-20"
                  title="Move right"
                >
                  <ChevronRight size={12} />
                </button>
                {steps.filter((s) => !s.isOnSubmit).length > 1 && (
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); onRemove(i) }}
                    className="p-0.5 text-gray-300 hover:text-red-400 transition-colors"
                    title="Delete step"
                  >
                    <Trash2 size={11} />
                  </button>
                )}
              </div>
            )}
          </div>
    )
  }

  const onSubmitStep = onSubmitIndex !== -1 ? steps[onSubmitIndex] : null

  return (
    <div className="flex items-center gap-1 px-4 py-2 bg-white border-b border-gray-200 overflow-x-auto shrink-0">
      <span className="text-xs font-semibold text-gray-400 mr-2 whitespace-nowrap">Steps:</span>

      {fieldStepEntries.map(([step, i]) => renderTab(step, i))}

      {/* Sits between the fillable form steps and the reserved "On Form
          Submit" tab, so it's clear new steps get added there — never
          after/around the protected step. */}
      <button
        type="button"
        onClick={onAdd}
        className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-dashed border-gray-300 text-gray-400 hover:border-indigo-300 hover:text-indigo-500 text-xs transition-colors whitespace-nowrap"
      >
        <Plus size={12} /> Add Step
      </button>

      {onSubmitStep && (
        <>
          <span className="text-gray-300 text-xs px-0.5 select-none">→</span>
          {renderTab(onSubmitStep, onSubmitIndex)}
        </>
      )}
    </div>
  )
}
