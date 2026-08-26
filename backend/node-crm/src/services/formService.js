import Form from "../models/Form.js";
import crypto from "crypto";
import { validateRules, validateConditionGroup, validateNotificationRules, validateWebhookRules } from "./ruleEngine.js";

const VALID_ON_SUBMIT_ACTIONS = ["message", "redirect_page", "redirect_url", "redirect_meeting", "redirect_payment"];
const ON_SUBMIT_URL_FIELD_BY_ACTION = {
  redirect_page: "pageUrl",
  redirect_url: "externalUrl",
  redirect_meeting: "meetingUrl",
  redirect_payment: "paymentUrl",
};
const ON_SUBMIT_NEW_TAB_FIELD_BY_ACTION = {
  redirect_page: "pageOpenInNewTab",
  redirect_url: "externalOpenInNewTab",
  redirect_meeting: "meetingOpenInNewTab",
  redirect_payment: "paymentOpenInNewTab",
};

/**
 * Validates the action/message/url/newTab fields shared by the base
 * on-submit config AND each conditional outcome's own resolved config (see
 * frontend types.ts OnSubmitOutcomeConfig) — one schema, reused for both so
 * they can never drift apart. `conditionalOutcomes` itself (only present on
 * the base config) is validated separately by the caller, since an
 * outcome's own config can't recursively have further nested outcomes.
 */
function validateOnSubmitOutcomeConfig(cfg, label) {
  if (!cfg || typeof cfg !== "object" || !VALID_ON_SUBMIT_ACTIONS.includes(cfg.action)) {
    throw { status: 400, message: `${label} has an invalid action` };
  }
  const urlField = ON_SUBMIT_URL_FIELD_BY_ACTION[cfg.action];
  if (urlField && cfg[urlField] !== undefined && typeof cfg[urlField] !== "string") {
    throw { status: 400, message: `${label}.${urlField} must be a string` };
  }
  // Validate every "open in new tab" flag that's present, not just the one
  // for the currently-selected action — they're preserved independently
  // across redirect types, same as the URL fields.
  for (const newTabField of Object.values(ON_SUBMIT_NEW_TAB_FIELD_BY_ACTION)) {
    if (cfg[newTabField] !== undefined && typeof cfg[newTabField] !== "boolean") {
      throw { status: 400, message: `${label}.${newTabField} must be a boolean` };
    }
  }
  if (cfg.message !== undefined && typeof cfg.message !== "string") {
    throw { status: 400, message: `${label}.message must be a string` };
  }
}

/** Convert a form name to a URL-safe slug */
function slugify(name) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .substring(0, 80);
}

/** Generate a unique slug based on the form name */
async function generateUniqueSlug(name, excludeId = null) {
  const base = slugify(name) || "form";
  let slug = base;
  let attempt = 0;

  while (await Form.slugExists(slug, excludeId)) {
    attempt++;
    const suffix = attempt === 1 ? `-${crypto.randomBytes(3).toString("hex")}` : `-${attempt}`;
    slug = `${base}${suffix}`;
  }
  return slug;
}

// ── Theme validation ──────────────────────────────────────────────
// Mirrors frontend/src/features/forms/utils/theme.ts `validateThemeShape`
// and frontend/src/features/forms/types.ts constants exactly, so a form
// (or template) rejected here would also have been flagged in the builder
// UI — the server check exists because the client one can't be trusted.
const THEME_HEX_RE = /^[0-9a-fA-F]{6}$/;
const THEME_BORDER_RADIUS_PRESETS = ["none", "sm", "md", "lg", "full"];
const THEME_FONT_FAMILY_OPTIONS = ["system", "inter", "roboto", "georgia", "mono"];
const THEME_COLOR_FIELDS = [
  "buttonColor", "buttonTextColor", "headerBgColor", "headerTextColor",
  "formBgColor", "cardBgColor", "labelColor", "inputBorderColor",
  "inputBgColor", "inputTextColor",
];

/**
 * Validate a (possibly partial) form theme object. Throws { status, message }
 * on the first violation, same shape as the rest of this file's validators.
 * Used both for `form_json.theme` (via validateFormJson) and for
 * `form_templates.theme` payloads (via formTemplateService.js) — one schema,
 * two call sites.
 */
function validateThemeObject(theme, label = "theme") {
  if (theme === undefined || theme === null) return;
  if (typeof theme !== "object" || Array.isArray(theme)) {
    throw { status: 400, message: `${label} must be an object` };
  }
  for (const field of THEME_COLOR_FIELDS) {
    const v = theme[field];
    if (v !== undefined && (typeof v !== "string" || !THEME_HEX_RE.test(v))) {
      throw { status: 400, message: `${label}.${field} must be a 6-digit hex color without '#'` };
    }
  }
  if (theme.borderRadius !== undefined && !THEME_BORDER_RADIUS_PRESETS.includes(theme.borderRadius)) {
    throw { status: 400, message: `${label}.borderRadius must be one of: ${THEME_BORDER_RADIUS_PRESETS.join(", ")}` };
  }
  if (theme.fontFamily !== undefined && !THEME_FONT_FAMILY_OPTIONS.includes(theme.fontFamily)) {
    throw { status: 400, message: `${label}.fontFamily must be one of: ${THEME_FONT_FAMILY_OPTIONS.join(", ")}` };
  }
}

/** Validate a form's field schema */
function validateFormJson(formJson) {
  if (!formJson || typeof formJson !== "object") {
    throw { status: 400, message: "form_json must be an object" };
  }
  if (!Array.isArray(formJson.fields)) {
    throw { status: 400, message: "form_json.fields must be an array" };
  }

  validateThemeObject(formJson.theme, "form_json.theme");

  const VALID_TYPES = new Set([
    "text", "email", "phone", "number", "textarea",
    "dropdown", "checkbox", "radio", "date", "file", "hidden", "section",
  ]);

  for (const [i, field] of formJson.fields.entries()) {
    if (!field.id || typeof field.id !== "string") {
      throw { status: 400, message: `Field at index ${i} is missing a string 'id'` };
    }
    if (!VALID_TYPES.has(field.type)) {
      throw { status: 400, message: `Field "${field.id}" has invalid type: ${field.type}` };
    }
    if (!field.label || typeof field.label !== "string") {
      throw { status: 400, message: `Field "${field.id}" is missing a label` };
    }
    if (["dropdown", "radio"].includes(field.type)) {
      if (!Array.isArray(field.options) || field.options.length === 0) {
        throw { status: 400, message: `Field "${field.id}" (${field.type}) must have at least one option` };
      }
    }
  }

  // Validate steps if present
  if (formJson.steps !== undefined) {
    if (!Array.isArray(formJson.steps)) {
      throw { status: 400, message: "form_json.steps must be an array" };
    }
    const fieldIds = new Set(formJson.fields.map((f) => f.id));
    for (const step of formJson.steps) {
      if (!step.id || !step.title) throw { status: 400, message: "Each step must have id and title" };
      if (!Array.isArray(step.fieldIds)) throw { status: 400, message: `Step "${step.title}" must have a fieldIds array` };
      for (const fid of step.fieldIds) {
        if (!fieldIds.has(fid)) throw { status: 400, message: `Step "${step.title}" references unknown field id: ${fid}` };
      }

      // Optional custom step-end buttons (replace the default "Next"/"Submit"
      // button for this step, including on the form's final step; see
      // frontend `StepButton` type).
      if (step.buttons !== undefined) {
        if (!Array.isArray(step.buttons)) {
          throw { status: 400, message: `Step "${step.title}" buttons must be an array` };
        }
        for (const btn of step.buttons) {
          if (!btn.id || !btn.label || typeof btn.label !== "string") {
            throw { status: 400, message: `Step "${step.title}" has a button missing an id or label` };
          }
          if (!["next", "submit", "external_link"].includes(btn.action)) {
            throw { status: 400, message: `Step "${step.title}" button "${btn.label}" has an invalid action: ${btn.action}` };
          }
          if (btn.action === "external_link" && (!btn.url || typeof btn.url !== "string")) {
            throw { status: 400, message: `Step "${step.title}" button "${btn.label}" is an external link but has no url` };
          }
        }
      }

      // Optional "on submission" config — only meaningful on the reserved
      // on-submit step, but validated wherever present so malformed data
      // never silently reaches the public form renderer.
      if (step.onSubmitConfig !== undefined) {
        const cfg = step.onSubmitConfig;
        validateOnSubmitOutcomeConfig(cfg, `Step "${step.title}" onSubmitConfig`);

        // Conditional outcomes — an ordered list of "WHEN <conditions> THEN
        // <a different on-submit behavior>" overrides, resolved against the
        // final submitted data at submit time (first match wins; see
        // utils/rules.ts resolveOnSubmitOutcome on the frontend). No
        // circular-dependency risk here the way ConditionalRule has: an
        // outcome only ever reads field values, it never writes one, so it
        // can't feed back into anything else's conditions.
        if (cfg.conditionalOutcomes !== undefined) {
          if (!Array.isArray(cfg.conditionalOutcomes)) {
            throw { status: 400, message: `Step "${step.title}" onSubmitConfig.conditionalOutcomes must be an array` };
          }
          const outcomeIds = new Set();
          for (const [i, outcome] of cfg.conditionalOutcomes.entries()) {
            const outcomeLabel = `Step "${step.title}" onSubmitConfig.conditionalOutcomes[${i}]`;
            if (!outcome || typeof outcome !== "object") {
              throw { status: 400, message: `${outcomeLabel} must be an object` };
            }
            if (!outcome.id || typeof outcome.id !== "string") {
              throw { status: 400, message: `${outcomeLabel} is missing a string 'id'` };
            }
            if (outcomeIds.has(outcome.id)) {
              throw { status: 400, message: `${outcomeLabel} has a duplicate outcome id: ${outcome.id}` };
            }
            outcomeIds.add(outcome.id);
            validateConditionGroup(outcome.group, fieldIds, `${outcomeLabel}.group`);
            validateOnSubmitOutcomeConfig(outcome.config, `${outcomeLabel}.config`);
          }
        }
      }
    }
  }

  // Conditional logic rules — see ruleEngine.js. Validated regardless of
  // whether steps are used (rules can target fields on any step, or a
  // single-step form's flat field list). Step navigation actions need the
  // set of valid step ids too — a single-step form simply has none, so any
  // rule that tries to use a navigation action on one is rejected.
  const allFieldIds = new Set(formJson.fields.map((f) => f.id));
  const allStepIds = new Set((formJson.steps ?? []).map((s) => s.id));
  validateRules(formJson.rules, allFieldIds, allStepIds, "form_json.rules");
  validateNotificationRules(formJson.notificationRules, allFieldIds, "form_json.notificationRules");
  validateWebhookRules(formJson.webhookRules, allFieldIds, "form_json.webhookRules");
}

/**
 * Drop field definitions that no step's `fieldIds` references anymore.
 * Builder edits (moving a field between steps, removing a step, etc.) can
 * leave inert leftovers in `fields[]` that are never rendered anywhere in
 * the public form — but public-submission validation reads that same
 * `fields[]` pool, so a stale orphan still marked `required: true` fails
 * every submission with a false "X is required" error for a field the
 * visitor never even saw. Pruning here, at save time, stops these from
 * accumulating. Single-step forms (no `steps`) are left untouched — there,
 * `fields[]` IS the whole form.
 */
function pruneOrphanedFields(formJson) {
  if (!formJson || !Array.isArray(formJson.steps) || formJson.steps.length === 0) {
    return formJson;
  }
  const reachableIds = new Set();
  for (const step of formJson.steps) {
    if (step.isOnSubmit) continue; // the reserved on-submit step never holds fields
    for (const fid of step.fieldIds ?? []) reachableIds.add(fid);
  }
  const fields = (formJson.fields ?? []).filter((f) => reachableIds.has(f.id));
  const keptIds = new Set(fields.map((f) => f.id));
  const keptStepIds = new Set(formJson.steps.map((s) => s.id));

  // A rule referencing a field that just got pruned (moved off every step,
  // deleted, etc.) would otherwise be left dangling — referencing an id
  // that no longer exists anywhere in the form. Drop the whole rule rather
  // than leave a partially-broken condition/action behind; a rule missing
  // one of its pieces has no well-defined meaning anyway. Same logic for a
  // navigation rule's fromStepId/target stepId if that step itself got
  // deleted from the builder.
  const rules = formJson.rules === undefined ? undefined : formJson.rules.filter((rule) => {
    const referencedFieldIds = [
      ...(rule.group?.conditions ?? []).map((c) => c.fieldId),
      ...(rule.actions ?? []).flatMap((a) => (a.fieldId ? [a.fieldId] : [])),
    ];
    if (!referencedFieldIds.every((id) => keptIds.has(id))) return false;

    const referencedStepIds = [
      ...(rule.fromStepId ? [rule.fromStepId] : []),
      ...(rule.actions ?? []).flatMap((a) => (a.stepId ? [a.stepId] : [])),
    ];
    return referencedStepIds.every((id) => keptStepIds.has(id));
  });

  // Same reasoning as `rules` above, applied to conditional notification
  // recipients — a rule whose condition references a pruned field is
  // dropped rather than left dangling.
  const notificationRules = formJson.notificationRules === undefined ? undefined : formJson.notificationRules.filter((rule) => {
    const referencedIds = (rule.group?.conditions ?? []).map((c) => c.fieldId);
    return referencedIds.every((id) => keptIds.has(id));
  });

  // Same reasoning again, applied to conditional webhooks.
  const webhookRules = formJson.webhookRules === undefined ? undefined : formJson.webhookRules.filter((rule) => {
    const referencedIds = (rule.group?.conditions ?? []).map((c) => c.fieldId);
    return referencedIds.every((id) => keptIds.has(id));
  });

  return { ...formJson, fields, rules, notificationRules, webhookRules };
}

/** Create a new form */
async function createForm(body, actor) {
  const { name, description, form_json: rawFormJson, submit_button_label, success_message, status,
          notify_on_submission, notify_emails, auto_respond, auto_respond_subject, auto_respond_body } = body;

  if (!name || !name.trim()) throw { status: 400, message: "Form name is required" };
  if (rawFormJson) validateFormJson(rawFormJson);
  const form_json = rawFormJson ? pruneOrphanedFields(rawFormJson) : rawFormJson;

  const slug = await generateUniqueSlug(name);

  return Form.create({
    name: name.trim(),
    slug,
    description: description ?? null,
    formJson: form_json ?? { fields: [] },
    submitButtonLabel: submit_button_label,
    successMessage: success_message,
    status: status ?? "draft",
    createdBy: actor?.id ?? null,
    notifyOnSubmission: notify_on_submission ?? false,
    notifyEmails: notify_emails ?? [],
    autoRespond: auto_respond ?? false,
    autoRespondSubject: auto_respond_subject,
    autoRespondBody: auto_respond_body,
  });
}

/** Update an existing form */
async function updateForm(id, body) {
  const form = await Form.findById(id);
  if (!form) throw { status: 404, message: "Form not found" };

  const { name, description, form_json: rawFormJson, submit_button_label, success_message, status,
          notify_on_submission, notify_emails, auto_respond, auto_respond_subject, auto_respond_body } = body;

  if (rawFormJson) validateFormJson(rawFormJson);
  const form_json = rawFormJson ? pruneOrphanedFields(rawFormJson) : rawFormJson;

  let slug;
  if (name && name.trim() !== form.name) {
    slug = await generateUniqueSlug(name.trim(), id);
  }

  return Form.update(id, {
    name: name?.trim(),
    slug,
    description,
    formJson: form_json,
    submitButtonLabel: submit_button_label,
    successMessage: success_message,
    status,
    notifyOnSubmission: notify_on_submission,
    notifyEmails: notify_emails,
    autoRespond: auto_respond,
    autoRespondSubject: auto_respond_subject,
    autoRespondBody: auto_respond_body,
  });
}

/** Get a single form (admin – full data) */
async function getForm(id) {
  const form = await Form.findById(id);
  if (!form) throw { status: 404, message: "Form not found" };
  return form;
}

/** List forms with pagination */
async function listForms({ limit, offset, status } = {}) {
  const [items, total] = await Promise.all([
    Form.list({ limit, offset, status }),
    Form.count({ status }),
  ]);
  return { items, total, limit, offset };
}

/** Delete / archive a form */
async function deleteForm(id) {
  const form = await Form.findById(id);
  if (!form) throw { status: 404, message: "Form not found" };
  await Form.delete(id);
}

/** Get a published form for public rendering */
async function getPublicForm(formId) {
  const form = await Form.findById(formId);
  if (!form) throw { status: 404, message: "Form not found" };
  if (form.status !== "published") throw { status: 403, message: "Form is not published" };
  return form;
}

/** Generate iframe embed code for a form */
function generateIframeEmbed(formId, baseUrl) {
  const url = `${baseUrl}/embed/${formId}`;
  return `<iframe\n  src="${url}"\n  width="100%"\n  height="700"\n  frameborder="0"\n  style="border:none;"\n></iframe>`;
}

/** Generate JS embed code for a form */
function generateJsEmbed(formId, baseUrl) {
  return `<div id="crm-form-${formId}"></div>\n\n<script src="${baseUrl}/form.js"></script>\n<script>\n  CRMForm.render({\n    formId: "${formId}",\n    target: "#crm-form-${formId}"\n  });\n</script>`;
}

export {
  createForm,
  updateForm,
  getForm,
  listForms,
  deleteForm,
  getPublicForm,
  generateIframeEmbed,
  generateJsEmbed,
  validateThemeObject,
};
