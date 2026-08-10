/**
 * FormBuilder — full drag-and-drop form builder.
 *
 * Layout:  [ Field Palette | Canvas | Field Editor ]
 *
 * DnD strategy (HTML5, no library):
 *   • Dragging a type from the palette → drops a new field onto the canvas.
 *   • Dragging an existing canvas field → reorders it within the canvas.
 */

import { useReducer, useEffect, useRef, useState } from 'react'
import { nanoid } from 'nanoid'
import FieldPalette from './FieldPalette'
import FieldCanvas from './FieldCanvas'
import FieldEditor from './FieldEditor'
import StepTabs from './StepTabs'
import StepButtonsModal from './StepButtonsModal'
import type { FormField, FormJson, FormStep, FieldType } from '../../types'

/** Build a default step */
function buildDefaultStep(index: number): FormStep {
  return { id: `step_${nanoid(6)}`, title: `Step ${index + 1}`, fieldIds: [] }
}

// ── Reducer ───────────────────────────────────────────────────────
type Action =
  | { type: 'ADD_FIELD'; fieldType: FieldType; atIndex?: number }
  | { type: 'REMOVE_FIELD'; id: string }
  | { type: 'UPDATE_FIELD'; id: string; patch: Partial<FormField> }
  | { type: 'MOVE_FIELD'; fromIndex: number; toIndex: number }
  | { type: 'SELECT'; id: string | null }
  | { type: 'SET_FORM'; formJson: FormJson }
  | { type: 'ADD_STEP' }
  | { type: 'REMOVE_STEP'; stepIndex: number }
  | { type: 'RENAME_STEP'; stepIndex: number; title: string }
  | { type: 'MOVE_STEP'; from: number; to: number }
  | { type: 'SET_ACTIVE_STEP'; stepIndex: number }
  | { type: 'SET_STEP_BUTTONS'; stepIndex: number; buttons: FormStep['buttons'] }

interface State {
  fields: FormField[]
  selectedId: string | null
  steps: FormStep[]          // empty array = single-step mode (no step UI shown)
  activeStepIndex: number
}

function buildDefaultField(type: FieldType): FormField {
  const base: FormField = {
    id: `field_${nanoid(8)}`,
    type,
    label: labelForType(type),
    required: false,
    placeholder: '',
    helpText: '',
    width: 'full',
  }
  if (['dropdown', 'radio', 'checkbox'].includes(type)) {
    base.options = ['Option 1', 'Option 2', 'Option 3']
  }
  return base
}

function labelForType(t: FieldType): string {
  const map: Record<FieldType, string> = {
    text: 'Text Input', email: 'Email Address', phone: 'Phone Number',
    textarea: 'Message', dropdown: 'Select Option', checkbox: 'Checkboxes',
    radio: 'Radio Buttons', date: 'Date', file: 'File Upload', hidden: 'Hidden Field',
    section: 'Info Section',
  }
  return map[t] ?? t
}

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'ADD_FIELD': {
      const field = buildDefaultField(action.fieldType)
      const fields = [...state.fields]
      if (action.atIndex !== undefined) {
        fields.splice(action.atIndex, 0, field)
      } else {
        fields.push(field)
      }
      // In multi-step mode, add the field to the active step
      let steps = state.steps
      if (steps.length > 0) {
        steps = steps.map((s, i) =>
          i === state.activeStepIndex
            ? { ...s, fieldIds: [...s.fieldIds, field.id] }
            : s
        )
      }
      return { ...state, fields, selectedId: field.id, steps }
    }
    case 'REMOVE_FIELD': {
      const fields = state.fields.filter((f) => f.id !== action.id)
      // Also remove from all steps
      const steps = state.steps.map((s) => ({
        ...s, fieldIds: s.fieldIds.filter((fid) => fid !== action.id),
      }))
      return { ...state, fields, steps, selectedId: state.selectedId === action.id ? null : state.selectedId }
    }
    case 'UPDATE_FIELD': {
      const fields = state.fields.map((f) =>
        f.id === action.id ? { ...f, ...action.patch } : f
      )
      return { ...state, fields }
    }
    case 'MOVE_FIELD': {
      const fields = [...state.fields]
      const [moved] = fields.splice(action.fromIndex, 1)
      fields.splice(action.toIndex, 0, moved)
      // In step mode, also reorder within the active step's fieldIds
      let steps = state.steps
      if (steps.length > 0) {
        steps = steps.map((s, i) => {
          if (i !== state.activeStepIndex) return s
          const ids = [...s.fieldIds]
          const movedFieldId = state.fields[action.fromIndex]?.id
          const targetFieldId = state.fields[action.toIndex]?.id
          if (!movedFieldId || !targetFieldId) return s
          const fromIdx = ids.indexOf(movedFieldId)
          const toIdx = ids.indexOf(targetFieldId)
          if (fromIdx === -1 || toIdx === -1) return s
          const [mid] = ids.splice(fromIdx, 1)
          ids.splice(toIdx, 0, mid)
          return { ...s, fieldIds: ids }
        })
      }
      return { ...state, fields, steps }
    }
    case 'SELECT':
      return { ...state, selectedId: action.id }
    case 'SET_FORM':
      return {
        fields: action.formJson.fields ?? [],
        selectedId: null,
        steps: action.formJson.steps ?? [],
        activeStepIndex: 0,
      }
    // ── Step actions ────────────────────────────────────────────
    case 'ADD_STEP': {
      const steps = state.steps.length === 0
        ? [buildDefaultStep(0), buildDefaultStep(1)]  // first Add converts to multi-step
        : [...state.steps, buildDefaultStep(state.steps.length)]
      return { ...state, steps, activeStepIndex: steps.length - 1 }
    }
    case 'REMOVE_STEP': {
      if (state.steps.length <= 1) return state
      const removedStep = state.steps[action.stepIndex]
      const steps = state.steps.filter((_, i) => i !== action.stepIndex)
      // Fields in the removed step stay in the pool but are unassigned
      // (they'll show up as orphans — user can delete them)
      const activeStepIndex = Math.min(state.activeStepIndex, steps.length - 1)
      // Move orphaned fields to step 0 to keep them accessible
      const orphaned = removedStep.fieldIds.filter((fid) =>
        !steps.some((s) => s.fieldIds.includes(fid))
      )
      const updatedSteps = steps.map((s, i) =>
        i === 0 ? { ...s, fieldIds: [...s.fieldIds, ...orphaned] } : s
      )
      return { ...state, steps: updatedSteps, activeStepIndex }
    }
    case 'RENAME_STEP': {
      const steps = state.steps.map((s, i) =>
        i === action.stepIndex ? { ...s, title: action.title } : s
      )
      return { ...state, steps }
    }
    case 'MOVE_STEP': {
      const { from, to } = action
      if (to < 0 || to >= state.steps.length) return state
      const steps = [...state.steps]
      const [moved] = steps.splice(from, 1)
      steps.splice(to, 0, moved)
      return { ...state, steps, activeStepIndex: to }
    }
    case 'SET_ACTIVE_STEP':
      return { ...state, activeStepIndex: action.stepIndex, selectedId: null }
    case 'SET_STEP_BUTTONS': {
      const steps = state.steps.map((s, i) =>
        i === action.stepIndex ? { ...s, buttons: action.buttons } : s
      )
      return { ...state, steps }
    }
    default:
      return state
  }
}

// ── Main component ────────────────────────────────────────────────
interface FormBuilderProps {
  initialFormJson?: FormJson
  onChange: (formJson: FormJson) => void
}

export default function FormBuilder({ initialFormJson, onChange }: FormBuilderProps) {
  const [state, dispatch] = useReducer(reducer, {
    fields: initialFormJson?.fields ?? [],
    selectedId: null,
    steps: initialFormJson?.steps ?? [],
    activeStepIndex: 0,
  })

  // Drag state (refs to avoid re-renders during drag)
  const dragSource = useRef<{ kind: 'palette'; fieldType: FieldType } | { kind: 'canvas'; index: number } | null>(null)
  const [dropTargetIndex, setDropTargetIndex] = useState<number | null>(null)
  const [buttonsModalOpen, setButtonsModalOpen] = useState(false)

  const selectedField = state.fields.find((f) => f.id === state.selectedId) ?? null
  const isMultiStep = state.steps.length > 0
  const activeStep: FormStep | null = isMultiStep ? state.steps[state.activeStepIndex] ?? null : null
  // Determines which button actions the editor offers for the active step:
  // non-final steps get "next"/"external_link", the final step gets
  // "submit"/"external_link" (see StepButtonsModal).
  const isFinalStep = isMultiStep && state.activeStepIndex === state.steps.length - 1

  // In multi-step mode: only show fields belonging to the active step
  const activeStepFieldIds = isMultiStep ? new Set(state.steps[state.activeStepIndex]?.fieldIds ?? []) : null
  const visibleFields = isMultiStep
    ? state.fields.filter((f) => activeStepFieldIds!.has(f.id))
    : state.fields

  // Sync every state change back up to the parent (which owns the saved
  // formJson). Reading straight from `state` here — rather than each handler
  // manually recomputing "next fields/steps" — means every action type
  // (including step add/rename/remove/move/reorder and step-button edits)
  // propagates correctly instead of only the field-mutating ones.
  useEffect(() => {
    onChange({ fields: state.fields, steps: state.steps.length > 0 ? state.steps : undefined })
  }, [state.fields, state.steps, onChange])

  // ── Step handlers ─────────────────────────────────────────────
  const handleAddStep = () => dispatch({ type: 'ADD_STEP' })
  const handleRemoveStep = (i: number) => dispatch({ type: 'REMOVE_STEP', stepIndex: i })
  const handleRenameStep = (i: number, title: string) => dispatch({ type: 'RENAME_STEP', stepIndex: i, title })
  const handleMoveStep = (from: number, to: number) => dispatch({ type: 'MOVE_STEP', from, to })
  const handleSetStepButtons = (buttons: FormStep['buttons']) =>
    dispatch({ type: 'SET_STEP_BUTTONS', stepIndex: state.activeStepIndex, buttons })

  // ── DnD handlers ─────────────────────────────────────────────
  const handlePaletteDragStart = (fieldType: FieldType) => {
    dragSource.current = { kind: 'palette', fieldType }
  }

  const handleCanvasDragStart = (index: number) => {
    dragSource.current = { kind: 'canvas', index }
  }

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault()
    setDropTargetIndex(index)
  }

  const handleDrop = (e: React.DragEvent, dropIndex: number) => {
    e.preventDefault()
    setDropTargetIndex(null)
    const src = dragSource.current
    if (!src) return

    if (src.kind === 'palette') {
      dispatch({ type: 'ADD_FIELD', fieldType: src.fieldType, atIndex: dropIndex })
    } else if (src.kind === 'canvas' && src.index !== dropIndex) {
      dispatch({ type: 'MOVE_FIELD', fromIndex: src.index, toIndex: dropIndex })
    }
    dragSource.current = null
  }

  const handleDropOnEmptyCanvas = (e: React.DragEvent) => {
    e.preventDefault()
    setDropTargetIndex(null)
    const src = dragSource.current
    if (!src) return
    if (src.kind === 'palette') {
      dispatch({ type: 'ADD_FIELD', fieldType: src.fieldType })
    }
    dragSource.current = null
  }

  const handleDragEnd = () => {
    dragSource.current = null
    setDropTargetIndex(null)
  }

  return (
    <div className="flex flex-col h-full overflow-hidden rounded-xl border border-gray-200 bg-white">
      {/* Step tabs (shown when multi-step mode is active, or to enable it) */}
      <StepTabs
        steps={state.steps}
        activeStepIndex={state.activeStepIndex}
        onSelect={(i) => dispatch({ type: 'SET_ACTIVE_STEP', stepIndex: i })}
        onAdd={handleAddStep}
        onRemove={handleRemoveStep}
        onRename={handleRenameStep}
        onMove={handleMoveStep}
      />

      {/* Custom step-end buttons — replaces the default "Next"/"Submit"
          button for this step (including the final step's Submit button). */}
      {isMultiStep && (
        <div className="flex items-center justify-between px-4 py-1.5 bg-indigo-50/60 border-b border-gray-100 shrink-0">
          <span className="text-xs text-gray-500">
            {activeStep?.buttons?.length
              ? `${activeStep.buttons.length} custom button${activeStep.buttons.length === 1 ? '' : 's'} on "${activeStep.title}"`
              : isFinalStep
                ? `Default "Submit" button on "${activeStep?.title}"`
                : `Default "Next" button on "${activeStep?.title}"`}
          </span>
          <button
            type="button"
            onClick={() => setButtonsModalOpen(true)}
            className="text-xs font-medium text-indigo-600 hover:text-indigo-700"
          >
            Customize buttons →
          </button>
        </div>
      )}

      <div className="flex flex-1 overflow-hidden">
        {/* Left: Field palette */}
        <FieldPalette onDragStart={handlePaletteDragStart} />

        {/* Center: Canvas — shows only the active step's fields */}
        <FieldCanvas
          fields={visibleFields}
          selectedId={state.selectedId}
          dropTargetIndex={dropTargetIndex}
          onSelect={(id) => dispatch({ type: 'SELECT', id })}
          onRemove={(id) => dispatch({ type: 'REMOVE_FIELD', id })}
          onDragStart={handleCanvasDragStart}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
          onDropEmpty={handleDropOnEmptyCanvas}
          onDragEnd={handleDragEnd}
        />

        {/* Right: Field editor */}
        <FieldEditor
          field={selectedField}
          onChange={(patch) => {
            if (selectedField) dispatch({ type: 'UPDATE_FIELD', id: selectedField.id, patch })
          }}
        />
      </div>

      <StepButtonsModal
        open={buttonsModalOpen}
        onClose={() => setButtonsModalOpen(false)}
        step={activeStep}
        isFinalStep={isFinalStep}
        onSave={handleSetStepButtons}
      />
    </div>
  )
}
