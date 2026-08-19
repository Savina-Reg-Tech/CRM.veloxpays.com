import Form from "../models/Form.js";
import crypto from "crypto";

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

/** Validate a form's field schema */
function validateFormJson(formJson) {
  if (!formJson || typeof formJson !== "object") {
    throw { status: 400, message: "form_json must be an object" };
  }
  if (!Array.isArray(formJson.fields)) {
    throw { status: 400, message: "form_json.fields must be an array" };
  }

  const VALID_TYPES = new Set([
    "text", "email", "phone", "textarea",
    "dropdown", "checkbox", "radio", "date", "file", "hidden",
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
        const VALID_ON_SUBMIT_ACTIONS = ["message", "redirect_page", "redirect_url", "redirect_meeting", "redirect_payment"];
        if (!cfg || typeof cfg !== "object" || !VALID_ON_SUBMIT_ACTIONS.includes(cfg.action)) {
          throw { status: 400, message: `Step "${step.title}" has an invalid onSubmitConfig action` };
        }
        const urlFieldByAction = {
          redirect_page: "pageUrl",
          redirect_url: "externalUrl",
          redirect_meeting: "meetingUrl",
          redirect_payment: "paymentUrl",
        };
        const urlField = urlFieldByAction[cfg.action];
        if (urlField && cfg[urlField] !== undefined && typeof cfg[urlField] !== "string") {
          throw { status: 400, message: `Step "${step.title}" onSubmitConfig.${urlField} must be a string` };
        }
        if (cfg.message !== undefined && typeof cfg.message !== "string") {
          throw { status: 400, message: `Step "${step.title}" onSubmitConfig.message must be a string` };
        }
      }
    }
  }
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
  return { ...formJson, fields: (formJson.fields ?? []).filter((f) => reachableIds.has(f.id)) };
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
};
