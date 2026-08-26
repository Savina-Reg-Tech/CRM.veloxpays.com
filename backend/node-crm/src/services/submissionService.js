import Form from "../models/Form.js";
import FormSubmission from "../models/FormSubmission.js";
import Lead from "../models/Lead.js";
import WebhookDelivery from "../models/WebhookDelivery.js";
import { calculateSpamScore, validateEmail } from "./spamService.js";
import { sendSubmissionNotification, sendAutoResponder } from "./emailService.js";
import { evaluateRules, resolveNotificationRecipients, resolveMatchingWebhooks } from "./ruleEngine.js";
import { sendWebhook } from "./webhookService.js";

/**
 * Fields actually reachable by a visitor filling out the form — i.e.
 * rendered somewhere in its step flow.
 *
 * Multi-step forms can end up with orphaned field definitions sitting in
 * `form_json.fields` (leftover from builder edits — a field moved between
 * steps, a step removed and its fields not fully reassigned, etc.) that no
 * step's `fieldIds` references anymore. Those are never rendered in the
 * public form, so a value for them can never be submitted. Validating or
 * extracting contact info against the full `fields[]` pool instead of this
 * reachable subset produces false "X is required" errors for fields the
 * visitor never even saw, and can silently pick up an orphaned duplicate
 * (always empty) instead of the real field when extracting name/email/phone.
 */
function getReachableFields(form) {
  const fields = form.form_json?.fields ?? [];
  const steps = form.form_json?.steps ?? [];
  if (steps.length === 0) return fields; // single-step forms: fields[] IS the whole form

  const reachableIds = new Set();
  for (const step of steps) {
    if (step.isOnSubmit) continue; // the reserved on-submit step never holds fields
    for (const fid of step.fieldIds ?? []) reachableIds.add(fid);
  }
  return fields.filter((f) => reachableIds.has(f.id));
}

/**
 * Extract a value for a field type from submission data.
 * Looks for common keys: the field label (lower+snake), field id, or the type.
 */
function extractFromData(data, field) {
  const candidates = [
    field.id,
    field.label?.toLowerCase().replace(/\s+/g, "_"),
    field.type,
  ];
  for (const key of candidates) {
    if (key && data[key] !== undefined) return data[key];
  }
  return null;
}

/**
 * Build a { fieldId: value } map from raw submitted data — same
 * field.id-or-label-key lookup used throughout this file, just keyed
 * consistently by id so it can feed straight into the rule engine (rule
 * conditions/actions always reference fields by id).
 */
function buildValuesByFieldId(fields, rawData) {
  const values = {};
  for (const field of fields) {
    const labelKey = field.label?.toLowerCase().replace(/\s+/g, "_");
    const value = rawData[field.id] ?? (labelKey ? rawData[labelKey] : undefined);
    if (value !== undefined) values[field.id] = value;
  }
  return values;
}

/**
 * Re-evaluate this form's conditional-logic rules (see ruleEngine.js)
 * against the actually-submitted data. This is NOT optional even though the
 * browser already applied the same rules live: a conditionally-hidden
 * required field must not block submission just because a rule made it
 * hidden, AND — more importantly — a direct/tampered API request that skips
 * the browser entirely must not be able to bypass a hidden-required-field
 * rule by simply omitting that field. The server re-deriving hidden/
 * required state itself, from the submitted values, is what actually
 * enforces that; trusting a client-sent "this field was hidden" flag would
 * defeat the purpose.
 */
function evaluateSubmissionRules(form, fields, rawData) {
  const values = buildValuesByFieldId(fields, rawData);
  return evaluateRules(form.form_json?.rules, values);
}

/**
 * Validate a submission against the form schema.
 * Throws 400 with a list of human-readable field errors.
 */
function validateSubmission(fields, rawData, ruleResult) {
  const errors = [];

  for (const field of fields) {
    if (field.type === "hidden") continue;
    if (ruleResult.hidden.has(field.id)) continue; // conditionally hidden — never enforced, regardless of what the client sent

    const value = rawData[field.id] ?? rawData[field.label?.toLowerCase().replace(/\s+/g, "_")];
    const isEmpty = value === undefined || value === null || String(value).trim() === "";
    const effectiveRequired = ruleResult.requiredOverride.has(field.id)
      ? ruleResult.requiredOverride.get(field.id)
      : field.required;

    if (effectiveRequired && isEmpty) {
      errors.push(`"${field.label}" is required`);
    }
  }

  if (errors.length > 0) {
    const err = new Error(errors.join("; "));
    err.status = 400;
    err.errors = errors;
    throw err;
  }
}

/**
 * Find email + name + phone from the submitted data based on field types.
 */
function extractContactFields(form, rawData) {
  const fields = getReachableFields(form);
  let email = null;
  let name = null;
  let phone = null;

  for (const field of fields) {
    const value = rawData[field.id] || rawData[field.label?.toLowerCase().replace(/\s+/g, "_")] || null;
    if (!value) continue;

    if (field.type === "email" && !email) email = String(value).trim().toLowerCase();
    if (field.type === "phone" && !phone) phone = String(value).trim();
    if (field.type === "text" && !name) {
      const lbl = field.label?.toLowerCase() ?? "";
      if (lbl.includes("name")) name = String(value).trim();
    }
  }
  return { email, name, phone };
}

/**
 * Main submission handler. Called by the public form route.
 *
 * @param {object} opts
 * @param {number} opts.formId
 * @param {object} opts.data           - raw submission key-value pairs
 * @param {string} opts.formLoadedAt   - ISO timestamp sent by the frontend
 * @param {string} opts.ipAddress
 * @param {string} opts.userAgent
 */
async function processFormSubmission({ formId, data: rawSubmittedData, formLoadedAt, ipAddress, userAgent }) {
  // ── Load form ─────────────────────────────────────────────────
  const form = await Form.findById(formId);
  if (!form) throw { status: 404, message: "Form not found" };
  if (form.status !== "published") throw { status: 403, message: "Form is not accepting submissions" };

  // ── Conditional logic: re-evaluate rules server-side ────────────
  // Re-derives hidden/required state from the submitted values themselves
  // (see evaluateSubmissionRules above) rather than trusting anything the
  // client claims about which fields were hidden. set_value/clear_value
  // actions are also folded into `data` here so the stored submission
  // reflects what a visitor using the real form would have ended up with,
  // even for a direct API call that bypassed the browser's own live
  // enforcement.
  const reachableFields = getReachableFields(form);
  const ruleResult = evaluateSubmissionRules(form, reachableFields, rawSubmittedData);
  const data = { ...rawSubmittedData };
  for (const action of ruleResult.valueActions) {
    if (action.value === null) delete data[action.fieldId];
    else data[action.fieldId] = action.value;
  }

  // ── Validate required fields ──────────────────────────────────
  validateSubmission(reachableFields, data, ruleResult);

  // ── Calculate time taken ─────────────────────────────────────
  let timeTakenSeconds = null;
  if (formLoadedAt) {
    const loadedMs = new Date(formLoadedAt).getTime();
    if (!Number.isNaN(loadedMs)) {
      timeTakenSeconds = (Date.now() - loadedMs) / 1000;
    }
  }

  // ── Reject bots that submitted in < 3 seconds ─────────────────
  if (timeTakenSeconds !== null && timeTakenSeconds < 3) {
    // We still record it, but mark immediately as SPAM
  }

  // ── Extract contact fields ────────────────────────────────────
  const { email, name, phone } = extractContactFields(form, data);

  // ── Hard email validation (reject invalid/fake emails outright) ──
  // Directly scan every email-type field by field.id so we never miss one,
  // even if extractContactFields failed to pick it up.
  const emailFields = getReachableFields(form).filter((f) => f.type === "email");
  for (const field of emailFields) {
    const rawValue =
      data[field.id] ??
      data[field.label?.toLowerCase().replace(/\s+/g, "_")] ??
      null;
    if (!rawValue) continue; // empty / not submitted — required check already handled above

    const emailValue = String(rawValue).trim().toLowerCase();
    console.log(`[submission] Validating email field "${field.label}" → ${emailValue}`);
    const emailCheck = await validateEmail(emailValue);
    console.log(`[submission] Validation result: valid=${emailCheck.valid} reason=${emailCheck.reason ?? "ok"}`);
    if (!emailCheck.valid) {
      throw { status: 400, message: emailCheck.reason ?? "Invalid email address." };
    }
  }

  // ── Spam scoring ─────────────────────────────────────────────
  const { score: spamScore, status } = await calculateSpamScore({ email, timeTakenSeconds });

  // ── Create lead ───────────────────────────────────────────────
  const lead = await Lead.create({
    formId,
    formName: form.name,
    email,
    name,
    phone,
    submissionData: data,
    leadSource: "Website Form",
    status,
    spamScore,
    ipAddress,
    userAgent,
    timeTakenSeconds,
  });

  // ── Create submission record ──────────────────────────────────
  const submission = await FormSubmission.create({
    formId,
    leadId: lead.id,
    submissionData: data,
    email,
    ipAddress,
    userAgent,
    timeTakenSeconds,
    spamScore,
    status,
  });

  // ── Update form counters ──────────────────────────────────────
  await Form.incrementCounters(formId, { submissions: 1, leads: 1 });

  // ── Email notifications (fire-and-forget, never block submission) ─
  // notify_on_submission is still the master on/off switch — a
  // notificationRules match only changes WHO gets notified, never whether
  // a notification fires at all when the switch is off. First matching
  // rule's email list wins; falls back to the form's default notify_emails
  // when nothing matches or no rules are configured.
  const notifyEmails = resolveNotificationRecipients(
    form.form_json?.notificationRules,
    buildValuesByFieldId(reachableFields, data),
    form.notify_emails ?? [],
  );
  console.log(`[submission] notify_on_submission=${form.notify_on_submission}, emails=${JSON.stringify(notifyEmails)}, auto_respond=${form.auto_respond}, lead_email=${lead.email}`);

  if (form.notify_on_submission && notifyEmails.length > 0) {
    sendSubmissionNotification({
      form,
      submission: { ...submission, submission_data: data },
      lead,
      notifyEmails,
    }).catch((err) => console.error("[submission] Notification email failed:", err.message));
  }

  if (form.auto_respond && lead.email) {
    sendAutoResponder({ form, lead, data })
      .catch((err) => console.error("[submission] Auto-responder email failed:", err.message));
  }

  // ── Conditional webhooks (fire-and-forget, never block submission) ─
  // Every enabled webhookRule whose WHEN-conditions match this submission
  // gets its own delivery attempt (not "first match wins" — see
  // resolveMatchingWebhooks). Every attempt, success or failure, is logged
  // to webhook_deliveries so admins can see what actually happened; a
  // webhook that silently fails would otherwise be invisible.
  const matchingWebhooks = resolveMatchingWebhooks(
    form.form_json?.webhookRules,
    buildValuesByFieldId(reachableFields, data),
  );
  for (const rule of matchingWebhooks) {
    sendWebhook({
      url: rule.url,
      secret: rule.secret,
      payload: {
        formId,
        formName: form.name,
        submissionId: submission.id,
        leadId: lead.id,
        submittedAt: submission.created_at,
        data,
      },
    })
      .then((result) =>
        WebhookDelivery.create({
          formId,
          submissionId: submission.id,
          ruleId: rule.id,
          ruleName: rule.name ?? null,
          url: rule.url,
          success: result.success,
          statusCode: result.statusCode,
          errorMessage: result.error,
          durationMs: result.durationMs,
        }).catch((err) => console.error("[webhook] Failed to log delivery:", err.message))
      )
      .catch((err) => console.error("[webhook] Unexpected send failure:", err.message));
  }

  return { submission, lead, status, spamScore };
}

export { processFormSubmission };
