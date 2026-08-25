import FormTemplate from "../models/FormTemplate.js";
import { validateThemeObject } from "./formService.js";

/**
 * Templates are global — visible and usable by every developer/admin who
 * can access the form builder (the same "super_admin"/"admin" role gate as
 * forms themselves; see formRoutes.js). This CRM has no team/org concept
 * beyond staff roles, so per-team scoping isn't meaningful here. `createdBy`
 * is still recorded for attribution, but doesn't restrict visibility.
 */

/** Create a new reusable theme template */
async function createTemplate(body, actor) {
  const { name, description, theme } = body;
  if (!name || !name.trim()) throw { status: 400, message: "Template name is required" };
  if (!theme || typeof theme !== "object") throw { status: 400, message: "Template theme is required" };
  validateThemeObject(theme, "theme");

  return FormTemplate.create({
    name: name.trim(),
    description: description ?? null,
    theme,
    createdBy: actor?.id ?? null,
  });
}

/** List all templates */
async function listTemplates() {
  return FormTemplate.list();
}

/** Get a single template */
async function getTemplate(id) {
  const template = await FormTemplate.findById(id);
  if (!template) throw { status: 404, message: "Template not found" };
  return template;
}

/**
 * Update a template's own name/description/theme. This never touches any
 * form that previously "applied" this template — applying a template
 * copies its `theme` values into that form's `form_json.theme` at that
 * moment (see formController.js `handleApplyFormTemplate`); there's no
 * live reference kept afterward, by design.
 */
async function updateTemplate(id, body) {
  const template = await FormTemplate.findById(id);
  if (!template) throw { status: 404, message: "Template not found" };

  const { name, description, theme } = body;
  if (name !== undefined && !name.trim()) throw { status: 400, message: "Template name cannot be empty" };
  if (theme !== undefined) validateThemeObject(theme, "theme");

  return FormTemplate.update(id, {
    name: name?.trim(),
    description,
    theme,
  });
}

/** Delete a template */
async function deleteTemplate(id) {
  const template = await FormTemplate.findById(id);
  if (!template) throw { status: 404, message: "Template not found" };
  await FormTemplate.delete(id);
}

export {
  createTemplate,
  listTemplates,
  getTemplate,
  updateTemplate,
  deleteTemplate,
};
