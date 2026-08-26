import type { FormField, FormStep } from '../types'

/**
 * Builds a `fieldId -> display label` lookup that annotates a field's own
 * label with which step it's on (e.g. "Company size (Step 2)") whenever the
 * form is multi-step — used anywhere a condition/action field picker lets
 * an admin choose a field that might not be on the step they're currently
 * looking at (conditional logic rules, conditional on-submit outcomes).
 * Shared so every picker names fields the same way.
 */
export function buildFieldLabeler(fields: FormField[], steps: FormStep[]): (fieldId: string) => string {
  const fieldsById = Object.fromEntries(fields.map((f) => [f.id, f]))
  const stepTitleByFieldId: Record<string, string> = {}
  if (steps.length > 0) {
    for (const step of steps) {
      if (step.isOnSubmit) continue
      for (const fid of step.fieldIds) stepTitleByFieldId[fid] = step.title
    }
  }
  return (fieldId: string): string => {
    const field = fieldsById[fieldId]
    if (!field) return '(deleted field)'
    const stepTitle = stepTitleByFieldId[fieldId]
    return stepTitle ? `${field.label} (${stepTitle})` : field.label
  }
}
