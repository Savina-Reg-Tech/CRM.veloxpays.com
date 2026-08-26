/**
 * Conditional logic ("IF conditions THEN actions") — server-side mirror of
 * frontend/src/features/forms/utils/rules.ts. Two call sites:
 *   - formService.js validateFormJson(): structural validation + circular-
 *     dependency detection at save time (the client already checks this,
 *     but the client can't be trusted — same reasoning as theme validation).
 *   - submissionService.js processFormSubmission(): re-evaluates rules
 *     against the actually-submitted data so a conditionally-hidden
 *     required field isn't wrongly enforced, and so a tampered/direct API
 *     request can't bypass hidden-required-field logic by skipping the
 *     browser entirely.
 *
 * Keep this in sync with utils/rules.ts if the evaluation logic changes —
 * there's no shared package between frontend/backend in this repo, so it's
 * duplicated deliberately rather than silently drifting.
 */

const CONDITION_OPERATORS = [
  "equals", "not_equals",
  "contains", "not_contains",
  "starts_with", "ends_with",
  "is_empty", "is_not_empty",
  "greater_than", "less_than", "greater_or_equal", "less_or_equal",
  "between",
  "one_of", "none_of",
  "domain_is",
];

const FIELD_ACTION_TYPES = [
  "show_field", "hide_field",
  "require_field", "unrequire_field",
  "set_value", "clear_value",
];

// Navigation actions decide what step a visitor sees next instead of
// changing a field — goto_step/skip_step carry a `stepId`, next_step/
// previous_step/end_form carry none (they move relative to whichever step
// the rule is attached to via `fromStepId`, or submit immediately).
const NAVIGATION_ACTION_TYPES = ["goto_step", "skip_step", "next_step", "previous_step", "end_form"];

const RULE_ACTION_TYPES = [...FIELD_ACTION_TYPES, ...NAVIGATION_ACTION_TYPES];

// ── Structural validation ────────────────────────────────────────────
/** Validates a single { logic, conditions } group — shared by rule
 * validation below and by conditional on-submit outcome validation in
 * formService.js (both use the same ConditionGroup shape). Throws
 * { status: 400, message } on the first violation. */
function validateConditionGroup(group, fieldIds, label) {
  if (!group || typeof group !== "object") {
    throw { status: 400, message: `${label} must be an object` };
  }
  if (!["AND", "OR"].includes(group.logic)) {
    throw { status: 400, message: `${label}.logic must be "AND" or "OR"` };
  }
  if (!Array.isArray(group.conditions)) {
    throw { status: 400, message: `${label}.conditions must be an array` };
  }
  for (const [j, cond] of group.conditions.entries()) {
    const condLabel = `${label}.conditions[${j}]`;
    if (!cond.fieldId || !fieldIds.has(cond.fieldId)) {
      throw { status: 400, message: `${condLabel} references an unknown field id: ${cond.fieldId}` };
    }
    if (!CONDITION_OPERATORS.includes(cond.operator)) {
      throw { status: 400, message: `${condLabel} has an invalid operator: ${cond.operator}` };
    }
    const valueless = cond.operator === "is_empty" || cond.operator === "is_not_empty";
    if (!valueless && cond.value !== undefined && typeof cond.value !== "string") {
      throw { status: 400, message: `${condLabel}.value must be a string` };
    }
    if (cond.operator === "between") {
      if (typeof cond.value !== "string" || typeof cond.value2 !== "string") {
        throw { status: 400, message: `${condLabel} (between) must have both 'value' and 'value2'` };
      }
    }
    if (cond.operator === "one_of" || cond.operator === "none_of") {
      if (!Array.isArray(cond.values) || cond.values.length === 0 || cond.values.some((v) => typeof v !== "string")) {
        throw { status: 400, message: `${condLabel} (${cond.operator}) must have a non-empty 'values' array of strings` };
      }
    }
  }
}

/** Throws { status: 400, message } on the first violation — same shape as
 * every other validator in formService.js. `stepIds` may be omitted/empty
 * for single-step forms; any rule that tries to use a navigation action on
 * such a form is rejected, since there's nowhere for it to navigate to. */
function validateRules(rules, fieldIds, stepIds = new Set(), label = "form_json.rules") {
  if (rules === undefined) return;
  if (!Array.isArray(rules)) {
    throw { status: 400, message: `${label} must be an array` };
  }
  const ruleIds = new Set();
  for (const [i, rule] of rules.entries()) {
    const ruleLabel = `${label}[${i}]`;
    if (!rule || typeof rule !== "object") {
      throw { status: 400, message: `${ruleLabel} must be an object` };
    }
    if (!rule.id || typeof rule.id !== "string") {
      throw { status: 400, message: `${ruleLabel} is missing a string 'id'` };
    }
    if (ruleIds.has(rule.id)) {
      throw { status: 400, message: `${ruleLabel} has a duplicate rule id: ${rule.id}` };
    }
    ruleIds.add(rule.id);
    if (typeof rule.enabled !== "boolean") {
      throw { status: 400, message: `${ruleLabel}.enabled must be a boolean` };
    }
    validateConditionGroup(rule.group, fieldIds, `${ruleLabel}.group`);
    if (!Array.isArray(rule.actions) || rule.actions.length === 0) {
      throw { status: 400, message: `${ruleLabel}.actions must be a non-empty array` };
    }

    let navigationActionCount = 0;
    for (const [k, action] of rule.actions.entries()) {
      const actLabel = `${ruleLabel}.actions[${k}]`;
      if (!RULE_ACTION_TYPES.includes(action.type)) {
        throw { status: 400, message: `${actLabel} has an invalid type: ${action.type}` };
      }

      if (NAVIGATION_ACTION_TYPES.includes(action.type)) {
        navigationActionCount++;
        if ((action.type === "goto_step" || action.type === "skip_step")) {
          if (!action.stepId || !stepIds.has(action.stepId)) {
            throw { status: 400, message: `${actLabel} references an unknown step id: ${action.stepId}` };
          }
          // A step routing to itself is zero forward progress, not a
          // reviewable loop — always invalid, independent of the
          // multi-step cycle check (which only warns, see findStepNavCycle).
          if (action.stepId === rule.fromStepId) {
            throw { status: 400, message: `${actLabel} routes step "${rule.fromStepId}" to itself — that traps every visitor who reaches it` };
          }
        }
      } else {
        // Field actions (show_field, hide_field, require_field, unrequire_field, set_value, clear_value)
        if (!action.fieldId || !fieldIds.has(action.fieldId)) {
          throw { status: 400, message: `${actLabel} references an unknown field id: ${action.fieldId}` };
        }
        if (action.type === "set_value" && typeof action.value !== "string") {
          throw { status: 400, message: `${actLabel} (set_value) must have a string 'value'` };
        }
      }
    }

    if (navigationActionCount > 1) {
      throw { status: 400, message: `${ruleLabel} has more than one navigation action — a rule can only send a visitor to one place` };
    }
    if (navigationActionCount === 1) {
      if (!rule.fromStepId || !stepIds.has(rule.fromStepId)) {
        throw { status: 400, message: `${ruleLabel} has a navigation action but no valid 'fromStepId' (which step does this rule fire when leaving?)` };
      }
    }
  }

  const cycle = findRuleCycle(rules);
  if (cycle) {
    throw {
      status: 400,
      message: `${label} has a circular dependency: ${cycle.join(" → ")}. Remove one of these rules to break the cycle.`,
    };
  }
  // Note: multi-step navigation cycles are intentionally NOT hard-blocked
  // here (see findStepNavCycle) — a graph-only check can't tell a genuine
  // dead end from a safe "go back and fix it" pattern guarded by mutually
  // exclusive conditions, so that's surfaced as a warning in the builder UI
  // instead of a save-time rejection.
}

// ── Generic cycle detection (shared by the field-dependency graph and the
// step-navigation graph below — mirrors utils/rules.ts findCycleInGraph) ──
function findCycleInGraph(adjacency) {
  const WHITE = 0, GRAY = 1, BLACK = 2;
  const color = new Map();
  const parent = new Map();

  function dfs(node) {
    color.set(node, GRAY);
    for (const next of adjacency.get(node) ?? []) {
      const state = color.get(next) ?? WHITE;
      if (state === WHITE) {
        parent.set(next, node);
        const found = dfs(next);
        if (found) return found;
      } else if (state === GRAY) {
        const path = [next];
        let cur = node;
        while (cur !== next) {
          path.push(cur);
          const p = parent.get(cur);
          if (!p) break;
          cur = p;
        }
        path.push(next);
        return path.reverse();
      }
    }
    color.set(node, BLACK);
    return null;
  }

  for (const node of adjacency.keys()) {
    if ((color.get(node) ?? WHITE) === WHITE) {
      const found = dfs(node);
      if (found) return found;
    }
  }
  return null;
}

// ── Field circular dependency detection (mirrors utils/rules.ts) ────
function buildDependencyGraph(rules) {
  const adjacency = new Map();
  for (const rule of rules) {
    const sources = (rule.group?.conditions ?? []).map((c) => c.fieldId);
    // Navigation actions target a step (stepId), not a field, so they never
    // contribute an edge to this graph — only 'fieldId' does.
    const targets = (rule.actions ?? []).flatMap((a) => (a.fieldId ? [a.fieldId] : []));
    for (const source of sources) {
      for (const target of targets) {
        if (source === target) continue; // self-reference allowed
        if (!adjacency.has(source)) adjacency.set(source, new Set());
        adjacency.get(source).add(target);
      }
    }
  }
  return adjacency;
}

function findRuleCycle(rules) {
  return findCycleInGraph(buildDependencyGraph(rules));
}

// ── Step navigation graph (mirrors utils/rules.ts) ───────────────────
function buildStepNavEdges(rules, steps) {
  const stepIndexById = new Map(steps.map((s, i) => [s.id, i]));
  const edges = [];
  for (const rule of rules) {
    if (!rule.fromStepId) continue;
    for (const action of rule.actions ?? []) {
      if (action.type === "goto_step") {
        edges.push({ fromStepId: rule.fromStepId, toStepId: action.stepId, ruleId: rule.id });
      } else if (action.type === "skip_step") {
        const idx = stepIndexById.get(action.stepId);
        const after = idx !== undefined ? steps[idx + 1] : undefined;
        if (after) edges.push({ fromStepId: rule.fromStepId, toStepId: after.id, ruleId: rule.id });
      }
    }
  }
  return edges;
}

/** Multi-step navigation cycles are intentionally not treated as hard save
 * errors (see the note in validateRules) — exported so it's available if a
 * future admin-facing endpoint wants to surface the same warning the
 * builder UI already computes client-side from the identical rule data. */
function findStepNavCycle(rules, steps) {
  const adjacency = new Map();
  for (const edge of buildStepNavEdges(rules, steps)) {
    if (edge.fromStepId === edge.toStepId) continue; // self-loops are hard-blocked in validateRules, not warned about here
    if (!adjacency.has(edge.fromStepId)) adjacency.set(edge.fromStepId, new Set());
    adjacency.get(edge.fromStepId).add(edge.toStepId);
  }
  return findCycleInGraph(adjacency);
}

// ── Runtime evaluation (mirrors utils/rules.ts evaluateRules) ────────
function isEmptyValue(raw) {
  if (raw === undefined || raw === null) return true;
  if (Array.isArray(raw)) return raw.length === 0;
  return String(raw).trim() === "";
}

function toComparable(raw) {
  if (Array.isArray(raw)) return raw.join(", ");
  return raw === undefined || raw === null ? "" : String(raw);
}

function toNumber(v) {
  if (v.trim() === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function compare(a, b) {
  const numA = toNumber(a);
  const numB = toNumber(b);
  if (numA !== null && numB !== null) return numA - numB;
  const dateA = Date.parse(a);
  const dateB = Date.parse(b);
  if (!Number.isNaN(dateA) && !Number.isNaN(dateB)) return dateA - dateB;
  return a.localeCompare(b, undefined, { sensitivity: "base" });
}

function emailDomain(raw) {
  const s = toComparable(raw);
  const at = s.lastIndexOf("@");
  return at === -1 ? "" : s.slice(at + 1).toLowerCase();
}

function evaluateCondition(condition, values) {
  const raw = values[condition.fieldId];
  const target = (condition.value ?? "").toLowerCase();

  switch (condition.operator) {
    case "is_empty":
      return isEmptyValue(raw);
    case "is_not_empty":
      return !isEmptyValue(raw);
    case "equals":
      return Array.isArray(raw)
        ? raw.some((v) => String(v).toLowerCase() === target)
        : toComparable(raw).toLowerCase() === target;
    case "not_equals":
      return Array.isArray(raw)
        ? !raw.some((v) => String(v).toLowerCase() === target)
        : toComparable(raw).toLowerCase() !== target;
    case "contains":
      return Array.isArray(raw)
        ? raw.some((v) => String(v).toLowerCase().includes(target))
        : toComparable(raw).toLowerCase().includes(target);
    case "not_contains":
      return Array.isArray(raw)
        ? !raw.some((v) => String(v).toLowerCase().includes(target))
        : !toComparable(raw).toLowerCase().includes(target);
    case "starts_with":
      return toComparable(raw).toLowerCase().startsWith(target);
    case "ends_with":
      return toComparable(raw).toLowerCase().endsWith(target);
    case "greater_than":
      return compare(toComparable(raw), condition.value ?? "") > 0;
    case "less_than":
      return compare(toComparable(raw), condition.value ?? "") < 0;
    case "greater_or_equal":
      return compare(toComparable(raw), condition.value ?? "") >= 0;
    case "less_or_equal":
      return compare(toComparable(raw), condition.value ?? "") <= 0;
    case "between": {
      const a = condition.value ?? "";
      const b = condition.value2 ?? "";
      const [lo, hi] = compare(a, b) <= 0 ? [a, b] : [b, a];
      const val = toComparable(raw);
      return compare(val, lo) >= 0 && compare(val, hi) <= 0;
    }
    case "one_of": {
      const set = (condition.values ?? []).map((v) => v.toLowerCase());
      return Array.isArray(raw)
        ? raw.some((v) => set.includes(String(v).toLowerCase()))
        : set.includes(toComparable(raw).toLowerCase());
    }
    case "none_of": {
      const set = (condition.values ?? []).map((v) => v.toLowerCase());
      return Array.isArray(raw)
        ? !raw.some((v) => set.includes(String(v).toLowerCase()))
        : !set.includes(toComparable(raw).toLowerCase());
    }
    case "domain_is":
      return emailDomain(raw) === target.replace(/^@/, "");
    default:
      return false;
  }
}

function evaluateGroup(group, values) {
  if (!group.conditions.length) return true;
  const results = group.conditions.map((c) => evaluateCondition(c, values));
  return group.logic === "AND" ? results.every(Boolean) : results.some(Boolean);
}

/**
 * Single-pass evaluation against final submitted data (no "previously
 * triggered" transition tracking needed server-side — the server only ever
 * sees the final values, not a live typing session, so set_value/clear_value
 * are applied unconditionally whenever their rule is true at submit time).
 */
function evaluateRules(rules, values) {
  const hidden = new Set();
  const requiredOverride = new Map();
  const valueActions = [];

  for (const rule of rules ?? []) {
    if (!rule.enabled) continue;
    const isTrue = evaluateGroup(rule.group, values);

    for (const action of rule.actions) {
      switch (action.type) {
        case "show_field":
          if (isTrue) hidden.delete(action.fieldId);
          break;
        case "hide_field":
          if (isTrue) hidden.add(action.fieldId);
          break;
        case "require_field":
          if (isTrue) requiredOverride.set(action.fieldId, true);
          break;
        case "unrequire_field":
          if (isTrue) requiredOverride.set(action.fieldId, false);
          break;
        case "set_value":
          if (isTrue) valueActions.push({ fieldId: action.fieldId, value: action.value });
          break;
        case "clear_value":
          if (isTrue) valueActions.push({ fieldId: action.fieldId, value: null });
          break;
      }
    }
  }

  return { hidden, requiredOverride, valueActions };
}

// ── Conditional notification recipients (mirrors utils/rules.ts) ────
/**
 * Pick which email list should be notified for a finished submission: the
 * first enabled rule whose group matches the final submitted values, or
 * `defaultEmails` (the form's own notify_emails) if none match/exist.
 */
function resolveNotificationRecipients(rules, values, defaultEmails) {
  for (const rule of rules ?? []) {
    if (!rule.enabled) continue;
    if (evaluateGroup(rule.group, values)) return rule.emails;
  }
  return defaultEmails;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Throws { status: 400, message } on the first violation. */
function validateNotificationRules(rules, fieldIds, label = "form_json.notificationRules") {
  if (rules === undefined) return;
  if (!Array.isArray(rules)) {
    throw { status: 400, message: `${label} must be an array` };
  }
  const ruleIds = new Set();
  for (const [i, rule] of rules.entries()) {
    const ruleLabel = `${label}[${i}]`;
    if (!rule || typeof rule !== "object") {
      throw { status: 400, message: `${ruleLabel} must be an object` };
    }
    if (!rule.id || typeof rule.id !== "string") {
      throw { status: 400, message: `${ruleLabel} is missing a string 'id'` };
    }
    if (ruleIds.has(rule.id)) {
      throw { status: 400, message: `${ruleLabel} has a duplicate rule id: ${rule.id}` };
    }
    ruleIds.add(rule.id);
    if (typeof rule.enabled !== "boolean") {
      throw { status: 400, message: `${ruleLabel}.enabled must be a boolean` };
    }
    validateConditionGroup(rule.group, fieldIds, `${ruleLabel}.group`);
    if (!Array.isArray(rule.emails) || rule.emails.length === 0) {
      throw { status: 400, message: `${ruleLabel}.emails must be a non-empty array` };
    }
    for (const email of rule.emails) {
      if (typeof email !== "string" || !EMAIL_RE.test(email)) {
        throw { status: 400, message: `${ruleLabel}.emails contains an invalid address: ${email}` };
      }
    }
  }
}

// ── Conditional webhooks (mirrors utils/rules.ts) ───────────────────
/**
 * Unlike notification recipients (first match wins — they're picking ONE
 * list), webhooks are independent side-effect triggers: "notify sales" and
 * "notify localization" can both legitimately fire off the same submission.
 * So every enabled rule whose group matches gets a delivery attempt, not
 * just the first.
 */
function resolveMatchingWebhooks(rules, values) {
  return (rules ?? []).filter((rule) => rule.enabled && evaluateGroup(rule.group, values));
}

/** Throws { status: 400, message } on the first violation. Only checks
 * shape/protocol here — actual reachability and SSRF-safety of the URL can
 * only be checked at send time (see webhookService.js), since a hostname's
 * resolved IP can change after the rule is saved. */
function validateWebhookRules(rules, fieldIds, label = "form_json.webhookRules") {
  if (rules === undefined) return;
  if (!Array.isArray(rules)) {
    throw { status: 400, message: `${label} must be an array` };
  }
  const ruleIds = new Set();
  for (const [i, rule] of rules.entries()) {
    const ruleLabel = `${label}[${i}]`;
    if (!rule || typeof rule !== "object") {
      throw { status: 400, message: `${ruleLabel} must be an object` };
    }
    if (!rule.id || typeof rule.id !== "string") {
      throw { status: 400, message: `${ruleLabel} is missing a string 'id'` };
    }
    if (ruleIds.has(rule.id)) {
      throw { status: 400, message: `${ruleLabel} has a duplicate rule id: ${rule.id}` };
    }
    ruleIds.add(rule.id);
    if (typeof rule.enabled !== "boolean") {
      throw { status: 400, message: `${ruleLabel}.enabled must be a boolean` };
    }
    validateConditionGroup(rule.group, fieldIds, `${ruleLabel}.group`);
    if (typeof rule.url !== "string" || !rule.url.trim()) {
      throw { status: 400, message: `${ruleLabel}.url must be a non-empty string` };
    }
    let parsed;
    try {
      parsed = new URL(rule.url);
    } catch {
      throw { status: 400, message: `${ruleLabel}.url is not a valid URL` };
    }
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      throw { status: 400, message: `${ruleLabel}.url must use http or https` };
    }
    if (rule.secret !== undefined && typeof rule.secret !== "string") {
      throw { status: 400, message: `${ruleLabel}.secret must be a string` };
    }
  }
}

export {
  validateRules, validateConditionGroup, findRuleCycle, evaluateRules, evaluateGroup,
  resolveNotificationRecipients, validateNotificationRules,
  resolveMatchingWebhooks, validateWebhookRules,
  buildStepNavEdges, findStepNavCycle,
};
