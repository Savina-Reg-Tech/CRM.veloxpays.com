import {
  createTemplate,
  listTemplates,
  getTemplate,
  updateTemplate,
  deleteTemplate,
} from "../services/formTemplateService.js";
import { sendSuccess, sendError } from "../utils/response.js";

export const handleCreateFormTemplate = async (req, res) => {
  try {
    const template = await createTemplate(req.body, req.user);
    return sendSuccess(res, template, "Template created successfully", 201);
  } catch (err) {
    return sendError(res, err.message, err.status || 500);
  }
};

export const handleListFormTemplates = async (req, res) => {
  try {
    const templates = await listTemplates();
    return sendSuccess(res, templates, "Templates fetched");
  } catch (err) {
    return sendError(res, err.message, err.status || 500);
  }
};

export const handleGetFormTemplate = async (req, res) => {
  try {
    const template = await getTemplate(parseInt(req.params.id, 10));
    return sendSuccess(res, template, "Template fetched");
  } catch (err) {
    return sendError(res, err.message, err.status || 500);
  }
};

export const handleUpdateFormTemplate = async (req, res) => {
  try {
    const template = await updateTemplate(parseInt(req.params.id, 10), req.body);
    return sendSuccess(res, template, "Template updated");
  } catch (err) {
    return sendError(res, err.message, err.status || 500);
  }
};

export const handleDeleteFormTemplate = async (req, res) => {
  try {
    await deleteTemplate(parseInt(req.params.id, 10));
    return sendSuccess(res, null, "Template deleted");
  } catch (err) {
    return sendError(res, err.message, err.status || 500);
  }
};
