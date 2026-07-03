import { Plus, Trash2, ChevronLeft, ChevronRight } from 'lucide-react'
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
  return (
    <div className="flex items-center gap-1 px-4 py-2 bg-white border-b border-gray-200 overflow-x-auto shrink-0">
      <span className="text-xs font-semibold text-gray-400 mr-2 whitespace-nowrap">Steps:</span>

      {steps.map((step, i) => (
        <div
          key={step.id}
          className={`group flex items-center gap-1 px-3 py-1.5 rounded-lg border text-xs font-medium cursor-pointer transition-all whitespace-nowrap ${
            i === activeStepIndex
              ? 'bg-indigo-50 border-indigo-300 text-indigo-700'
              : 'border-gray-200 text-gray-600 hover:border-gray-300'
          }`}
          onClick={() => onSelect(i)}
        >
          {/* Step number */}
          <span className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 ${
            i === activeStepIndex ? 'bg-indigo-500 text-white' : 'bg-gray-200 text-gray-500'
          }`}>{i + 1}</span>

          {/* Editable title */}
          <input
            value={step.title}
            onChange={(e) => onRename(i, e.target.value)}
            onClick={(e) => e.stopPropagation()}
            className="bg-transparent border-none outline-none w-20 text-xs"
          />

          {/* Reorder + delete (only visible on hover) */}
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
              disabled={i === steps.length - 1}
              className="p-0.5 text-gray-400 hover:text-gray-600 disabled:opacity-20"
              title="Move right"
            >
              <ChevronRight size={12} />
            </button>
            {steps.length > 1 && (
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
        </div>
      ))}

      <button
        type="button"
        onClick={onAdd}
        className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-dashed border-gray-300 text-gray-400 hover:border-indigo-300 hover:text-indigo-500 text-xs transition-colors whitespace-nowrap"
      >
        <Plus size={12} /> Add Step
      </button>
    </div>
  )
}
