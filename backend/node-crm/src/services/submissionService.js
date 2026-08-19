import Form from "../models/Form.js";
import FormSubmission from "../models/FormSubmission.js";
import Lead from "../models/Lead.js";
import { calculateSpamScore, validateEmail } from "./spamService.js";
import { sendSubmissionNotification, sendAutoResponder } from "./emailService.js";

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
 * Validate a submission against the form schema.
 * Returns a map of { fieldId: value } or throws 400.
 */
function validateSubmission(form, rawData) {
  const fields = getReachableFields(form);
  const errors = [];

  for (const field of fields) {
    if (field.type === "hidden") continue;

    const value = rawData[field.id] ?? rawData[field.label?.toLowerCase().replace(/\s+/g, "_")];
    const isEmpty = value === undefined || value === null || String(value).trim() === "";

    if (field.required && isEmpty) {
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
async function processFormSubmission({ formId, data, formLoadedAt, ipAddress, userAgent }) {
  // ── Load form ─────────────────────────────────────────────────
  const form = await Form.findById(formId);
  if (!form) throw { status: 404, message: "Form not found" };
  if (form.status !== "published") throw { status: 403, message: "Form is not accepting submissions" };

  // ── Validate required fields ──────────────────────────────────
  validateSubmission(form, data);

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
  console.log(`[submission] notify_on_submission=${form.notify_on_submission}, emails=${JSON.stringify(form.notify_emails)}, auto_respond=${form.auto_respond}, lead_email=${lead.email}`);

  if (form.notify_on_submission && form.notify_emails?.length > 0) {
    sendSubmissionNotification({
      form,
      submission: { ...submission, submission_data: data },
      lead,
      notifyEmails: form.notify_emails,
    }).catch((err) => console.error("[submission] Notification email failed:", err.message));
  }

  if (form.auto_respond && lead.email) {
    sendAutoResponder({ form, lead, data })
      .catch((err) => console.error("[submission] Auto-responder email failed:", err.message));
  }

  return { submission, lead, status, spamScore };
}

export { processFormSubmission };
