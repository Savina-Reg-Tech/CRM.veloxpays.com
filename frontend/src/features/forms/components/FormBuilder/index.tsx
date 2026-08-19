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
import OnSubmitPanel from './OnSubmitPanel'
import type { FormField, FormJson, FormStep, FieldType } from '../../types'

/** Build a default (field-collecting) step */
function buildDefaultStep(index: number): FormStep {
  return { id: `step_${nanoid(6)}`, title: `Step ${index + 1}`, fieldIds: [] }
}

/**
 * Build the reserved "On Form Submit" step — HubSpot-style: it's what the
 * visitor sees right after the real data is submitted (custom CTA buttons,
 * or the default thank-you message if none are configured). It never holds
 * fields and is always kept pinned as the last entry in `steps`.
 */
function buildOnSubmitStep(): FormStep {
  return { id: `step_${nanoid(6)}`, title: 'On Form Submit', fieldIds: [], isOnSubmit: true }
}

/** Index of the reserved on-submit step, or -1 if this step list doesn't have one. */
function findOnSubmitIndex(steps: FormStep[]): number {
  return steps.findIndex((s) => s.isOnSubmit)
}

/**
 * Build reducer state from a form's saved JSON (or nothing, for a brand new
 * form) — the single source of truth that guarantees every form the builder
 * ever shows has a valid Step 1 + reserved "On Form Submit" step, covering:
 *
 *   1. Brand new forms         — steps is empty and there are no fields yet.
 *   2. Legacy flat forms       — fields exist but `steps` was never used.
 *   3. Legacy multi-step forms — steps exist but predate the reserved
 *                                 on-submit step (added retroactively).
 *   4. Already-migrated forms  — steps + a valid on-submit step already
 *                                 exist; left completely untouched, including
 *                                 its `onSubmitConfig`, buttons, and title.
 *
 * This used to only happen inside the ADD_STEP reducer action — i.e. only
 * when the admin manually clicked "Add Step" — which is why "On Form
 * Submit" disappeared again on every reload/reopen for any form that had
 * never had that button clicked (including every brand new form). Running
 * the same scaffolding here, as part of initial state construction, means
 * it's applied unconditionally on every load, not just on that one user
 * action.
 */
function buildInitialState(formJson?: FormJson): State {
  const fields = formJson?.fields ?? []
  let steps = formJson?.steps ?? []

  if (steps.length === 0) {
    // No steps saved yet — either a brand new form, or a legacy flat form
    // with fields but no step structure. Either way, scaffold the required
    // baseline: Step 1 (keeping any existing fields) + On Form Submit.
    steps = [
      { id: `step_${nanoid(6)}`, title: 'Step 1', fieldIds: fields.map((f) => f.id) },
      buildOnSubmitStep(),
    ]
  } else if (findOnSubmitIndex(steps) === -1) {
    // Legacy multi-step form saved before the reserved on-submit step
    // existed: promote its last step into that role, preserving whatever
    // it already had (title, buttons, etc.) rather than discarding it.
    steps = steps.map((s, i) => (i === steps.length - 1 ? { ...s, isOnSubmit: true } : s))
  }
  // Otherwise a valid on-submit step (and its onSubmitConfig) already
  // exists — left exactly as loaded, nothing recreated or reset.

  return { fields, selectedId: null, steps, activeStepIndex: 0 }
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
  | { type: 'SET_ON_SUBMIT_CONFIG'; stepIndex: number; config: FormStep['onSubmitConfig'] }

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
      return buildInitialState(action.formJson)
    // ── Step actions ────────────────────────────────────────────
    case 'ADD_STEP': {
      if (state.steps.length === 0) {
        // Defensive fallback only — buildInitialState() already guarantees
        // every form starts with Step 1 + On Form Submit, so state.steps
        // should never actually be empty by the time this fires. Kept in
        // case some future code path ends up with an empty step list: Step 1
        // must always represent the actual form fields, so the existing
        // fields move with it instead of being left behind as orphans; the
        // reserved "On Form Submit" step is created right alongside it.
        const step1: FormStep = {
          id: `step_${nanoid(6)}`,
          title: 'Step 1',
          fieldIds: state.fields.map((f) => f.id),
        }
        const steps = [step1, buildOnSubmitStep()]
        return { ...state, steps, activeStepIndex: 0 }
      }
      // Otherwise, insert the new field step right before the reserved
      // on-submit step so that step always stays last (Step 2 → Step 3 →
      // Step 4 ... as more field steps are added).
      const onSubmitIdx = findOnSubmitIndex(state.steps)
      const insertAt = onSubmitIdx === -1 ? state.steps.length : onSubmitIdx
      const steps = [
        ...state.steps.slice(0, insertAt),
        buildDefaultStep(insertAt),
        ...state.steps.slice(insertAt),
      ]
      return { ...state, steps, activeStepIndex: insertAt }
    }
    case 'REMOVE_STEP': {
      const target = state.steps[action.stepIndex]
      if (!target || target.isOnSubmit) return state // the on-submit step is permanent
      const fieldStepCount = state.steps.filter((s) => !s.isOnSubmit).length
      if (fieldStepCount <= 1) return state // must always keep at least one field step
      const removedStep = target
      const steps = state.steps.filter((_, i) => i !== action.stepIndex)
      // Fields in the removed step stay in the pool but are unassigned
      // (they'll show up as orphans — user can delete them)
      const activeStepIndex = Math.min(state.activeStepIndex, steps.length - 1)
      // Move orphaned fields to the first field step to keep them accessible
      const orphaned = removedStep.fieldIds.filter((fid) =>
        !steps.some((s) => s.fieldIds.includes(fid))
      )
      const firstFieldStepIdx = steps.findIndex((s) => !s.isOnSubmit)
      const updatedSteps = steps.map((s, i) =>
        i === firstFieldStepIdx ? { ...s, fieldIds: [...s.fieldIds, ...orphaned] } : s
      )
      return { ...state, steps: updatedSteps, activeStepIndex }
    }
    case 'RENAME_STEP': {
      const target = state.steps[action.stepIndex]
      if (!target || target.isOnSubmit) return state // title is fixed ("On Form Submit")
      const steps = state.steps.map((s, i) =>
        i === action.stepIndex ? { ...s, title: action.title } : s
      )
      return { ...state, steps }
    }
    case 'MOVE_STEP': {
      const { from, to } = action
      const moving = state.steps[from]
      if (!moving || moving.isOnSubmit) return state // on-submit step can't be reordered
      if (to < 0 || to >= state.steps.length) return state
      const onSubmitIdx = findOnSubmitIndex(state.steps)
      // Never let a field step move to or past the reserved on-submit slot.
      const clampedTo = onSubmitIdx !== -1 ? Math.min(to, onSubmitIdx - 1) : to
      if (clampedTo === from) return state
      const steps = [...state.steps]
      const [moved] = steps.splice(from, 1)
      steps.splice(clampedTo, 0, moved)
      return { ...state, steps, activeStepIndex: clampedTo }
    }
    case 'SET_ACTIVE_STEP':
      return { ...state, activeStepIndex: action.stepIndex, selectedId: null }
    case 'SET_STEP_BUTTONS': {
      const steps = state.steps.map((s, i) =>
        i === action.stepIndex ? { ...s, buttons: action.buttons } : s
      )
      return { ...state, steps }
    }
    case 'SET_ON_SUBMIT_CONFIG': {
      const target = state.steps[action.stepIndex]
      if (!target || !target.isOnSubmit) return state // only meaningful on the reserved step
      const steps = state.steps.map((s, i) =>
        i === action.stepIndex ? { ...s, onSubmitConfig: action.config } : s
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
  // Lazy initializer so the legacy on-submit-step migration in
  // buildInitialState actually runs on mount — the reducer function itself
  // is never invoked for useReducer's initial state, only for dispatched
  // actions, so this couldn't live in the (dead) SET_FORM case alone.
  const [state, dispatch] = useReducer(reducer, initialFormJson, buildInitialState)

  // Drag state (refs to avoid re-renders during drag)
  const dragSource = useRef<{ kind: 'palette'; fieldType: FieldType } | { kind: 'canvas'; index: number } | null>(null)
  const [dropTargetIndex, setDropTargetIndex] = useState<number | null>(null)
  const [buttonsModalOpen, setButtonsModalOpen] = useState(false)

  const selectedField = state.fields.find((f) => f.id === state.selectedId) ?? null
  const isMultiStep = state.steps.length > 0
  const activeStep: FormStep | null = isMultiStep ? state.steps[state.activeStepIndex] ?? null : null
  const onSubmitIndex = findOnSubmitIndex(state.steps)
  const isOnSubmitStep = !!activeStep?.isOnSubmit
  // "Final field step" = the step where the default action is Submit rather
  // than Next — i.e. the field-collecting step immediately before the
  // reserved "On Form Submit" step (or, for legacy forms without one yet,
  // the literal last step).
  const isFinalStep = isMultiStep && (
    onSubmitIndex !== -1 ? state.activeStepIndex === onSubmitIndex - 1 : state.activeStepIndex === state.steps.length - 1
  )

  // In multi-step mode: only show fields belonging to the active step
  const activeStepFieldIds = isMultiStep ? new Set(state.steps[state.activeStepIndex]?.fieldIds ?? []) : null
  const visibleFields = isMultiStep
    ? state.fields.filter((f) => activeStepFieldIds!.has(f.id))
    : state.fields

  // FieldCanvas only ever renders `visibleFields` (the active step's subset
  // in multi-step mode), so the drag/drop indices it reports are positions
  // within THAT filtered list — not the full `state.fields` array the
  // reducer's ADD_FIELD/MOVE_FIELD operate on. Translate before dispatching,
  // otherwise reordering or inserting a field on any step past the first
  // moves/deletes the wrong field (its "local" index collides with a
  // different field's position in the global array).
  const localToGlobalIndex = (localIndex: number): number => {
    if (!isMultiStep) return localIndex
    if (localIndex >= visibleFields.length) {
      const last = visibleFields[visibleFields.length - 1]
      return last ? state.fields.findIndex((f) => f.id === last.id) + 1 : state.fields.length
    }
    const target = visibleFields[localIndex]
    const globalIdx = state.fields.findIndex((f) => f.id === target.id)
    return globalIdx === -1 ? localIndex : globalIdx
  }

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
  const handleSetOnSubmitConfig = (config: FormStep['onSubmitConfig']) =>
    dispatch({ type: 'SET_ON_SUBMIT_CONFIG', stepIndex: state.activeStepIndex, config })

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

    const globalDropIndex = localToGlobalIndex(dropIndex)

    if (src.kind === 'palette') {
      dispatch({ type: 'ADD_FIELD', fieldType: src.fieldType, atIndex: globalDropIndex })
    } else if (src.kind === 'canvas') {
      const globalFromIndex = localToGlobalIndex(src.index)
      if (globalFromIndex !== globalDropIndex) {
        dispatch({ type: 'MOVE_FIELD', fromIndex: globalFromIndex, toIndex: globalDropIndex })
      }
    }
    dragSource.current = null
  }

  const handleDropOnEmptyCanvas = (e: React.DragEvent) => {
    e.preventDefault()
    setDropTargetIndex(null)
    const src = dragSource.current
    if (!src) return
    if (src.kind === 'palette') {
      dispatch({ type: 'ADD_FIELD', fieldType: src.fieldType, atIndex: isMultiStep ? localToGlobalIndex(0) : undefined })
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
          button for this field step. Not shown for the reserved "On Form
          Submit" step: its buttons are configured inline, inside the "On
          submission" panel below, alongside the message/redirect settings. */}
      {isMultiStep && !isOnSubmitStep && (
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

      {isOnSubmitStep && activeStep ? (
        /* The reserved on-submit step never holds fields — instead of the
           field palette/canvas/editor triptych, show the "On submission"
           config: thank-you message (+ optional CTA buttons) or a redirect. */
        <OnSubmitPanel
          step={activeStep}
          onChange={handleSetOnSubmitConfig}
          buttonsCount={activeStep.buttons?.length ?? 0}
          onOpenButtonsModal={() => setButtonsModalOpen(true)}
        />
      ) : (
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
      )}

      <StepButtonsModal
        open={buttonsModalOpen}
        onClose={() => setButtonsModalOpen(false)}
        step={activeStep}
        isFinalStep={isFinalStep}
        isOnSubmitStep={isOnSubmitStep}
        onSave={handleSetStepButtons}
      />
    </div>
  )
}
