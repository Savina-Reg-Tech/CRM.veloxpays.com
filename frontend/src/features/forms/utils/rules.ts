// Conditional logic ("IF conditions THEN actions") — shared evaluation
// engine used by the builder's Logic tab (rule editor + test simulator),
// the live public form, and mirrored in the backend at submission time
// (backend/node-crm/src/services/formService.js / submissionService.js)
// so a hidden-but-required field can never be wrongly enforced — or
// bypassed — depending on which side is asked.
import type { ConditionGroup, ConditionOperator, ConditionalRule, FieldType, FormField, NotificationRule, OnSubmitConfig, OnSubmitOutcomeConfig, RuleCondition } from '../types'

// ── Operator applicability ─────────────────────────────────────────
// Which comparison operators make sense for a given field type — used by
// the rule editor to only offer relevant choices. The evaluator itself
// (below) is generic and doesn't enforce this; it's purely a UI affordance.
export function operatorsForFieldType(type: FieldType): ConditionOperator[] {
  switch (type) {
    case 'checkbox':
      return ['equals', 'not_equals', 'contains', 'not_contains', 'is_empty', 'is_not_empty']
    case 'dropdown':
    case 'radio':
      return ['equals', 'not_equals', 'is_empty', 'is_not_empty']
    case 'date':
      return ['equals', 'not_equals', 'is_empty', 'is_not_empty', 'greater_than', 'less_than', 'greater_or_equal', 'less_or_equal']
    case 'text':
    case 'email':
    case 'phone':
    case 'textarea':
    case 'hidden':
      return ['equals', 'not_equals', 'contains', 'not_contains', 'is_empty', 'is_not_empty', 'greater_than', 'less_than', 'greater_or_equal', 'less_or_equal']
    default:
      return ['is_empty', 'is_not_empty']
  }
}

// ── Value helpers ────────────────────────────────────────────────────
function isEmptyValue(raw: unknown): boolean {
  if (raw === undefined || raw === null) return true
  if (Array.isArray(raw)) return raw.length === 0
  return String(raw).trim() === ''
}

function toComparable(raw: unknown): string {
  if (Array.isArray(raw)) return raw.join(', ')
  return raw === undefined || raw === null ? '' : String(raw)
}

function toNumber(v: string): number | null {
  if (v.trim() === '') return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

/** -1 / 0 / 1 — tries numeric compare first, then date compare, else a
 * plain case-insensitive string compare. Covers "comparison" conditions
 * against date fields and free-typed numeric text without a dedicated
 * number field type existing in this form builder. */
function compare(a: string, b: string): number {
  const numA = toNumber(a)
  const numB = toNumber(b)
  if (numA !== null && numB !== null) return numA - numB
  const dateA = Date.parse(a)
  const dateB = Date.parse(b)
  if (!Number.isNaN(dateA) && !Number.isNaN(dateB)) return dateA - dateB
  return a.localeCompare(b, undefined, { sensitivity: 'base' })
}

// ── Condition / group evaluation ────────────────────────────────────
export function evaluateCondition(condition: RuleCondition, values: Record<string, unknown>): boolean {
  const raw = values[condition.fieldId]
  const target = (condition.value ?? '').toLowerCase()

  switch (condition.operator) {
    case 'is_empty':
      return isEmptyValue(raw)
    case 'is_not_empty':
      return !isEmptyValue(raw)
    case 'equals':
      return Array.isArray(raw)
        ? raw.some((v) => String(v).toLowerCase() === target)
        : toComparable(raw).toLowerCase() === target
    case 'not_equals':
      return Array.isArray(raw)
        ? !raw.some((v) => String(v).toLowerCase() === target)
        : toComparable(raw).toLowerCase() !== target
    case 'contains':
      return Array.isArray(raw)
        ? raw.some((v) => String(v).toLowerCase().includes(target))
        : toComparable(raw).toLowerCase().includes(target)
    case 'not_contains':
      return Array.isArray(raw)
        ? !raw.some((v) => String(v).toLowerCase().includes(target))
        : !toComparable(raw).toLowerCase().includes(target)
    case 'greater_than':
      return compare(toComparable(raw), condition.value ?? '') > 0
    case 'less_than':
      return compare(toComparable(raw), condition.value ?? '') < 0
    case 'greater_or_equal':
      return compare(toComparable(raw), condition.value ?? '') >= 0
    case 'less_or_equal':
      return compare(toComparable(raw), condition.value ?? '') <= 0
    default:
      return false
  }
}

export function evaluateGroup(group: ConditionGroup, values: Record<string, unknown>): boolean {
  if (!group.conditions.length) return true // an empty condition list never blocks its actions
  const results = group.conditions.map((c) => evaluateCondition(c, values))
  return group.logic === 'AND' ? results.every(Boolean) : results.some(Boolean)
}

// ── Full rule-set evaluation ─────────────────────────────────────────
export interface RuleEvaluationResult {
  /** Field ids that should currently be hidden. */
  hidden: Set<string>
  /** Explicit required-state overrides, last-matching-rule-wins. Absence
   * means "no override" — fall back to the field's own base `required`. */
  requiredOverride: Map<string, boolean>
  /** Rule ids whose condition group is true on THIS pass — feed back in as
   * `previousTriggeredRuleIds` on the next call so set_value/clear_value
   * only fire once, on the false→true transition, not on every keystroke
   * while the condition keeps holding. */
  triggeredRuleIds: Set<string>
  /** set_value/clear_value actions to actually apply this pass — already
   * filtered to rules that just transitioned to true. `value: null` means
   * clear_value. */
  valueActions: { fieldId: string; value: string | null }[]
}

/**
 * Evaluate every enabled rule against the current field values, in order.
 * Pure/stateless aside from the caller-supplied `previousTriggeredRuleIds`
 * (used only to detect set_value/clear_value transitions) — every other
 * piece of the result (hidden, requiredOverride) is fully recomputed from
 * `values` each call, so a rule automatically "un-applies" the moment its
 * condition stops being true, with no stale state to clean up.
 */
export function evaluateRules(
  rules: ConditionalRule[] | undefined,
  values: Record<string, unknown>,
  previousTriggeredRuleIds: Set<string> = new Set(),
): RuleEvaluationResult {
  const hidden = new Set<string>()
  const requiredOverride = new Map<string, boolean>()
  const triggeredRuleIds = new Set<string>()
  const valueActions: { fieldId: string; value: string | null }[] = []

  for (const rule of rules ?? []) {
    if (!rule.enabled) continue
    const isTrue = evaluateGroup(rule.group, values)
    if (isTrue) triggeredRuleIds.add(rule.id)
    const justTriggered = isTrue && !previousTriggeredRuleIds.has(rule.id)

    for (const action of rule.actions) {
      switch (action.type) {
        case 'show_field':
          if (isTrue) hidden.delete(action.fieldId)
          break
        case 'hide_field':
          if (isTrue) hidden.add(action.fieldId)
          break
        case 'require_field':
          if (isTrue) requiredOverride.set(action.fieldId, true)
          break
        case 'unrequire_field':
          if (isTrue) requiredOverride.set(action.fieldId, false)
          break
        case 'set_value':
          if (justTriggered) valueActions.push({ fieldId: action.fieldId, value: action.value })
          break
        case 'clear_value':
          if (justTriggered) valueActions.push({ fieldId: action.fieldId, value: null })
          break
      }
    }
  }

  return { hidden, requiredOverride, triggeredRuleIds, valueActions }
}

/** Effective required state for a field, folding in any rule override. */
export function isEffectivelyRequired(field: FormField, requiredOverride: Map<string, boolean>): boolean {
  return requiredOverride.has(field.id) ? requiredOverride.get(field.id)! : !!field.required
}

// ── Conditional "on submission" outcomes ─────────────────────────────
/**
 * Pick which on-submit behavior applies to a finished submission: the first
 * conditional outcome whose group evaluates true against the final
 * submitted values, or the config's own base action/message/url fields if
 * none match (or none are configured) — fully backward compatible with
 * forms that only ever had a single fixed on-submit behavior.
 */
export function resolveOnSubmitOutcome(
  config: OnSubmitConfig | undefined,
  values: Record<string, unknown>,
): OnSubmitOutcomeConfig | undefined {
  if (!config) return undefined
  for (const outcome of config.conditionalOutcomes ?? []) {
    if (evaluateGroup(outcome.group, values)) return outcome.config
  }
  return config
}

// ── Conditional notification recipients ──────────────────────────────
/**
 * Pick which email list should be notified for a finished submission: the
 * first enabled NotificationRule whose group matches the final submitted
 * values, or `defaultEmails` (the form's own notify_emails) if none match
 * or none are configured.
 */
export function resolveNotificationRecipients(
  rules: NotificationRule[] | undefined,
  values: Record<string, unknown>,
  defaultEmails: string[],
): string[] {
  for (const rule of rules ?? []) {
    if (!rule.enabled) continue
    if (evaluateGroup(rule.group, values)) return rule.emails
  }
  return defaultEmails
}

// ── Circular dependency detection ────────────────────────────────────
// Every rule adds a directed edge from each field referenced in its
// conditions to each field targeted by its actions — "condition-field
// feeds into action-field". A cycle in this graph (A → B → A) means two
// fields' states could each keep re-triggering the other with no defined
// order to settle in, so it's blocked outright rather than left to produce
// undefined runtime behavior. A field referencing only itself (e.g. "if
// this field is empty, set it to a default") is explicitly allowed — it's
// a common one-shot pattern, not a real cycle, since set_value only fires
// once per false→true transition (see evaluateRules).
export function buildDependencyGraph(rules: ConditionalRule[]): Map<string, Set<string>> {
  const adjacency = new Map<string, Set<string>>()
  for (const rule of rules) {
    const sources = rule.group.conditions.map((c) => c.fieldId)
    const targets = rule.actions.map((a) => a.fieldId)
    for (const source of sources) {
      for (const target of targets) {
        if (source === target) continue // self-reference allowed
        if (!adjacency.has(source)) adjacency.set(source, new Set())
        adjacency.get(source)!.add(target)
      }
    }
  }
  return adjacency
}

/** Returns the field-id path of the first cycle found (e.g. ['A','B','A']),
 * or null if the rule set has no circular dependency. */
export function findRuleCycle(rules: ConditionalRule[]): string[] | null {
  const adjacency = buildDependencyGraph(rules)
  const WHITE = 0, GRAY = 1, BLACK = 2
  const color = new Map<string, number>()
  const parent = new Map<string, string>()

  function dfs(node: string): string[] | null {
    color.set(node, GRAY)
    for (const next of adjacency.get(node) ?? []) {
      const state = color.get(next) ?? WHITE
      if (state === WHITE) {
        parent.set(next, node)
        const found = dfs(next)
        if (found) return found
      } else if (state === GRAY) {
        // Reconstruct the cycle: walk parents from `node` back up to `next`.
        const path = [next]
        let cur = node
        while (cur !== next) {
          path.push(cur)
          const p = parent.get(cur)
          if (!p) break // defensive — shouldn't happen given how `parent` is populated
          cur = p
        }
        path.push(next)
        return path.reverse()
      }
    }
    color.set(node, BLACK)
    return null
  }

  for (const node of adjacency.keys()) {
    if ((color.get(node) ?? WHITE) === WHITE) {
      const found = dfs(node)
      if (found) return found
    }
  }
  return null
}
