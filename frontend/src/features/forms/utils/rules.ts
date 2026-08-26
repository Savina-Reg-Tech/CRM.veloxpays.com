// Conditional logic ("IF conditions THEN actions") — shared evaluation
// engine used by the builder's Logic tab (rule editor + test simulator),
// the live public form, and mirrored in the backend at submission time
// (backend/node-crm/src/services/formService.js / submissionService.js)
// so a hidden-but-required field can never be wrongly enforced — or
// bypassed — depending on which side is asked.
import type { ConditionGroup, ConditionOperator, ConditionalRule, FieldType, FormField, FormStep, NotificationRule, OnSubmitConfig, OnSubmitOutcomeConfig, RuleCondition } from '../types'
import { NAVIGATION_ACTION_TYPES } from '../types'

// ── Operator applicability ─────────────────────────────────────────
// Which comparison operators make sense for a given field type — used by
// the rule editor to only offer relevant choices, so an admin never sees an
// operator that couldn't possibly apply (e.g. "contains" on a date). The
// evaluator itself (below) is generic and doesn't enforce this; it's purely
// a UI affordance — same reasoning as before, just a richer table now.
export function operatorsForFieldType(type: FieldType): ConditionOperator[] {
  switch (type) {
    case 'number':
      return ['equals', 'not_equals', 'greater_than', 'greater_or_equal', 'less_than', 'less_or_equal', 'between', 'is_empty', 'is_not_empty']
    case 'date':
      return ['equals', 'not_equals', 'greater_than', 'greater_or_equal', 'less_than', 'less_or_equal', 'between', 'is_empty', 'is_not_empty']
    case 'email':
      return ['equals', 'contains', 'domain_is', 'is_empty', 'is_not_empty']
    case 'dropdown':
    case 'radio':
    case 'checkbox':
      return ['equals', 'not_equals', 'contains', 'not_contains', 'one_of', 'none_of', 'is_empty', 'is_not_empty']
    case 'text':
    case 'phone':
    case 'textarea':
    case 'hidden':
      return ['equals', 'not_equals', 'contains', 'not_contains', 'starts_with', 'ends_with', 'is_empty', 'is_not_empty']
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

/** Domain part of an email-shaped string ("john@company.com" → "company.com"),
 * lowercased. Empty if there's no '@' — a non-email value can never match
 * domain_is, rather than throwing or matching everything. */
function emailDomain(raw: unknown): string {
  const s = toComparable(raw)
  const at = s.lastIndexOf('@')
  return at === -1 ? '' : s.slice(at + 1).toLowerCase()
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
    case 'starts_with':
      return toComparable(raw).toLowerCase().startsWith(target)
    case 'ends_with':
      return toComparable(raw).toLowerCase().endsWith(target)
    case 'greater_than':
      return compare(toComparable(raw), condition.value ?? '') > 0
    case 'less_than':
      return compare(toComparable(raw), condition.value ?? '') < 0
    case 'greater_or_equal':
      return compare(toComparable(raw), condition.value ?? '') >= 0
    case 'less_or_equal':
      return compare(toComparable(raw), condition.value ?? '') <= 0
    case 'between': {
      // Normalize in case the admin typed the bounds in reverse order —
      // "between 10 and 5" should behave the same as "between 5 and 10"
      // rather than never matching anything.
      const a = condition.value ?? ''
      const b = condition.value2 ?? ''
      const [lo, hi] = compare(a, b) <= 0 ? [a, b] : [b, a]
      const val = toComparable(raw)
      return compare(val, lo) >= 0 && compare(val, hi) <= 0
    }
    case 'one_of': {
      const set = (condition.values ?? []).map((v) => v.toLowerCase())
      return Array.isArray(raw)
        ? raw.some((v) => set.includes(String(v).toLowerCase()))
        : set.includes(toComparable(raw).toLowerCase())
    }
    case 'none_of': {
      const set = (condition.values ?? []).map((v) => v.toLowerCase())
      return Array.isArray(raw)
        ? !raw.some((v) => set.includes(String(v).toLowerCase()))
        : !set.includes(toComparable(raw).toLowerCase())
    }
    case 'domain_is':
      return emailDomain(raw) === target.replace(/^@/, '')
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

// ── Generic cycle detection (shared by field-dependency and step-navigation
// graphs below — same DFS-with-recursion-stack-coloring approach either way,
// just built on a different adjacency map) ───────────────────────────────
/** Returns the node path of the first cycle found (e.g. ['A','B','A']), or
 * null if the graph has none. */
export function findCycleInGraph(adjacency: Map<string, Set<string>>): string[] | null {
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

// ── Field circular dependency detection ─────────────────────────────
// Every rule adds a directed edge from each field referenced in its
// conditions to each field targeted by one of its FIELD actions (navigation
// actions target a step, not a field, so they never contribute an edge
// here) — "condition-field feeds into action-field". A cycle in this graph
// (A → B → A) means two fields' states could each keep re-triggering the
// other with no defined order to settle in, so it's blocked outright rather
// than left to produce undefined runtime behavior. A field referencing only
// itself (e.g. "if this field is empty, set it to a default") is explicitly
// allowed — it's a common one-shot pattern, not a real cycle, since
// set_value only fires once per false→true transition (see evaluateRules).
function fieldTargetsOf(rule: ConditionalRule): string[] {
  return rule.actions.flatMap((a) => ('fieldId' in a ? [a.fieldId] : []))
}

export function buildDependencyGraph(rules: ConditionalRule[]): Map<string, Set<string>> {
  const adjacency = new Map<string, Set<string>>()
  for (const rule of rules) {
    const sources = rule.group.conditions.map((c) => c.fieldId)
    const targets = fieldTargetsOf(rule)
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
  return findCycleInGraph(buildDependencyGraph(rules))
}

// ── Step navigation graph ────────────────────────────────────────────
// A rule "attached" to a step (via fromStepId) with a navigation action
// describes how a visitor leaves that step. Only goto_step/skip_step name an
// explicit destination step id — next_step/previous_step/end_form move
// relative to wherever the rule fires from (or straight to submission), so
// they contribute no fixed edge to this graph. skip_step's edge points to
// whatever step comes immediately AFTER the one being skipped, since "skip
// Step 2" means "treat Step 2 as invisible," landing on Step 3 (or beyond,
// if Step 3 is itself skipped by another rule — this graph only models the
// direct edges an admin configured, not multi-hop skip chains).
export interface StepNavEdge { fromStepId: string; toStepId: string; ruleId: string }

export function buildStepNavEdges(rules: ConditionalRule[], steps: FormStep[]): StepNavEdge[] {
  const stepIndexById = new Map(steps.map((s, i) => [s.id, i]))
  const edges: StepNavEdge[] = []
  for (const rule of rules) {
    if (!rule.fromStepId) continue
    for (const action of rule.actions) {
      if (action.type === 'goto_step') {
        edges.push({ fromStepId: rule.fromStepId, toStepId: action.stepId, ruleId: rule.id })
      } else if (action.type === 'skip_step') {
        const idx = stepIndexById.get(action.stepId)
        const after = idx !== undefined ? steps[idx + 1] : undefined
        if (after) edges.push({ fromStepId: rule.fromStepId, toStepId: after.id, ruleId: rule.id })
      }
    }
  }
  return edges
}

/** A rule that routes a step to itself isn't "a loop" in the reviewable
 * sense — it's zero forward progress with no way out, so it's always
 * invalid and hard-blocked regardless of the multi-step cycle policy below. */
export function findStepSelfLoopRule(rules: ConditionalRule[]): ConditionalRule | null {
  for (const rule of rules) {
    if (!rule.fromStepId) continue
    for (const action of rule.actions) {
      if (action.type === 'goto_step' && action.stepId === rule.fromStepId) return rule
      if (action.type === 'skip_step' && action.stepId === rule.fromStepId) return rule
    }
  }
  return null
}

/**
 * Multi-step cycles (Step 3 routes back to Step 2, which routes forward to
 * Step 3) are deliberately WARNED about rather than hard-blocked: a
 * graph-only check can't see that the two rules' conditions are mutually
 * exclusive, so a perfectly safe "go back and fix your answer" pattern would
 * otherwise be indistinguishable from a genuine dead end. Returns the
 * step-id path of the first cycle found, or null.
 */
export function findStepNavCycle(rules: ConditionalRule[], steps: FormStep[]): string[] | null {
  const adjacency = new Map<string, Set<string>>()
  for (const edge of buildStepNavEdges(rules, steps)) {
    if (edge.fromStepId === edge.toStepId) continue // self-loops are handled by findStepSelfLoopRule, not here
    if (!adjacency.has(edge.fromStepId)) adjacency.set(edge.fromStepId, new Set())
    adjacency.get(edge.fromStepId)!.add(edge.toStepId)
  }
  return findCycleInGraph(adjacency)
}

// ── Best-effort conflict detection ───────────────────────────────────
// Proving two arbitrary AND/OR condition groups can never both be true at
// once isn't generally solvable, so this is deliberately a heuristic, not a
// guarantee: it flags rule PAIRS that (a) share at least one condition field
// — meaning some input could plausibly satisfy both — and (b) would then
// step on each other, either by changing the same field in opposite ways or
// by both trying to decide the same step's navigation. It's meant to prompt
// a second look, not to be exhaustive or ever block a save.
export interface RuleConflict {
  ruleAId: string
  ruleBId: string
  description: string
}

const OPPOSITE_FIELD_ACTIONS: Partial<Record<string, string>> = {
  show_field: 'hide_field', hide_field: 'show_field',
  require_field: 'unrequire_field', unrequire_field: 'require_field',
}

export function findPossibleConflicts(rules: ConditionalRule[]): RuleConflict[] {
  const conflicts: RuleConflict[] = []
  const enabled = rules.filter((r) => r.enabled)

  for (let i = 0; i < enabled.length; i++) {
    for (let j = i + 1; j < enabled.length; j++) {
      const a = enabled[i]
      const b = enabled[j]
      const sharesConditionField = a.group.conditions.some((ca) => b.group.conditions.some((cb) => cb.fieldId === ca.fieldId))
      if (!sharesConditionField) continue

      // Two navigation rules anchored to the same step compete for the same
      // decision — only the higher-priority (earlier) one actually applies
      // if both match.
      if (a.fromStepId && a.fromStepId === b.fromStepId) {
        const aIsNav = a.actions.some((x) => NAVIGATION_ACTION_TYPES.includes(x.type))
        const bIsNav = b.actions.some((x) => NAVIGATION_ACTION_TYPES.includes(x.type))
        if (aIsNav && bIsNav) {
          conflicts.push({ ruleAId: a.id, ruleBId: b.id, description: 'both navigate away from the same step — the higher rule wins if both match' })
          continue
        }
      }

      // Same field, opposite field actions (show vs hide, require vs
      // unrequire) — last-write-wins order still applies, but it's worth
      // flagging since it's easy to lose track of once a form has many rules.
      outer: for (const actA of a.actions) {
        if (!('fieldId' in actA)) continue
        const opposite = OPPOSITE_FIELD_ACTIONS[actA.type]
        if (!opposite) continue
        for (const actB of b.actions) {
          if ('fieldId' in actB && actB.fieldId === actA.fieldId && actB.type === opposite) {
            conflicts.push({ ruleAId: a.id, ruleBId: b.id, description: 'both change the same field in opposite ways — the lower rule wins if both match' })
            break outer
          }
        }
      }
    }
  }

  return conflicts
}
