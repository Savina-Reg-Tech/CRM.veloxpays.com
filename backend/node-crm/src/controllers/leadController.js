import Lead from "../models/Lead.js";
import { sendSuccess, sendError } from "../utils/response.js";

const VALID_STATUSES = ["NEW", "REVIEW", "SPAM", "CONVERTED"];

const parsePagination = (req) => {
  const rawLimit  = parseInt(req.query.limit, 10);
  const rawOffset = parseInt(req.query.offset, 10);
  const limit  = Math.min(Math.max(Number.isFinite(rawLimit)  ? rawLimit  : 20, 1), 100);
  const offset = Math.max(Number.isFinite(rawOffset) ? rawOffset : 0, 0);
  return { limit, offset };
};

export const handleListLeads = async (req, res) => {
  try {
    const { limit, offset } = parsePagination(req);
    const { status, form_id, search } = req.query;
    const formId = form_id ? parseInt(form_id, 10) : null;

    const [items, total] = await Promise.all([
      Lead.list({ limit, offset, formId, status: status || null, search: search || null }),
      Lead.count({ formId, status: status || null, search: search || null }),
    ]);
    return sendSuccess(res, { items, total, limit, offset }, "Leads fetched");
  } catch (err) {
    return sendError(res, err.message, err.status || 500);
  }
};

export const handleGetLead = async (req, res) => {
  try {
    const lead = await Lead.findById(parseInt(req.params.id, 10));
    if (!lead) return sendError(res, "Lead not found", 404);
    return sendSuccess(res, lead, "Lead fetched");
  } catch (err) {
    return sendError(res, err.message, err.status || 500);
  }
};

export const handleUpdateLeadStatus = async (req, res) => {
  try {
    const { status } = req.body;
    if (!VALID_STATUSES.includes(status)) {
      return sendError(res, `Invalid status. Must be one of: ${VALID_STATUSES.join(", ")}`, 400);
    }
    const lead = await Lead.updateStatus(parseInt(req.params.id, 10), status);
    if (!lead) return sendError(res, "Lead not found", 404);
    return sendSuccess(res, lead, "Lead status updated");
  } catch (err) {
    return sendError(res, err.message, err.status || 500);
  }
};

export const handleGetLeadStats = async (req, res) => {
  try {
    const stats = await Lead.getStats();
    return sendSuccess(res, stats, "Lead stats fetched");
  } catch (err) {
    return sendError(res, err.message, err.status || 500);
  }
};
