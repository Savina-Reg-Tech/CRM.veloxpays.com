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
  "is_empty", "is_not_empty",
  "greater_than", "less_than", "greater_or_equal", "less_or_equal",
];

const RULE_ACTION_TYPES = [
  "show_field", "hide_field",
  "require_field", "unrequire_field",
  "set_value", "clear_value",
];

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
  }
}

/** Throws { status: 400, message } on the first violation — same shape as
 * every other validator in formService.js. */
function validateRules(rules, fieldIds, label = "form_json.rules") {
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
    for (const [k, action] of rule.actions.entries()) {
      const actLabel = `${ruleLabel}.actions[${k}]`;
      if (!RULE_ACTION_TYPES.includes(action.type)) {
        throw { status: 400, message: `${actLabel} has an invalid type: ${action.type}` };
      }
      if (!action.fieldId || !fieldIds.has(action.fieldId)) {
        throw { status: 400, message: `${actLabel} references an unknown field id: ${action.fieldId}` };
      }
      if (action.type === "set_value" && typeof action.value !== "string") {
        throw { status: 400, message: `${actLabel} (set_value) must have a string 'value'` };
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
}

// ── Circular dependency detection (mirrors utils/rules.ts) ──────────
function buildDependencyGraph(rules) {
  const adjacency = new Map();
  for (const rule of rules) {
    const sources = (rule.group?.conditions ?? []).map((c) => c.fieldId);
    const targets = (rule.actions ?? []).map((a) => a.fieldId);
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
  const adjacency = buildDependencyGraph(rules);
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
    case "greater_than":
      return compare(toComparable(raw), condition.value ?? "") > 0;
    case "less_than":
      return compare(toComparable(raw), condition.value ?? "") < 0;
    case "greater_or_equal":
      return compare(toComparable(raw), condition.value ?? "") >= 0;
    case "less_or_equal":
      return compare(toComparable(raw), condition.value ?? "") <= 0;
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
};
