import BlockedEmailDomain from "../models/BlockedEmailDomain.js";
import { sendSuccess, sendError } from "../utils/response.js";

export const handleListDomains = async (req, res) => {
  try {
    const limit  = Math.min(parseInt(req.query.limit, 10) || 100, 500);
    const offset = Math.max(parseInt(req.query.offset, 10) || 0, 0);
    const [items, total] = await Promise.all([
      BlockedEmailDomain.list({ limit, offset }),
      BlockedEmailDomain.count(),
    ]);
    return sendSuccess(res, { items, total }, "Blocked domains fetched");
  } catch (err) {
    return sendError(res, err.message, err.status || 500);
  }
};

export const handleAddDomain = async (req, res) => {
  try {
    const { domain } = req.body;
    if (!domain || !domain.trim()) return sendError(res, "Domain is required", 400);

    // Basic domain format check
    const clean = domain.trim().toLowerCase().replace(/^@/, "");
    if (!/^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z]{2,})+$/.test(clean)) {
      return sendError(res, "Invalid domain format", 400);
    }

    const record = await BlockedEmailDomain.create(clean);
    if (!record) return sendError(res, "Domain already blocked", 409);
    return sendSuccess(res, record, "Domain blocked successfully", 201);
  } catch (err) {
    return sendError(res, err.message, err.status || 500);
  }
};

export const handleDeleteDomain = async (req, res) => {
  try {
    const record = await BlockedEmailDomain.delete(parseInt(req.params.id, 10));
    if (!record) return sendError(res, "Domain not found", 404);
    return sendSuccess(res, record, "Domain removed from block list");
  } catch (err) {
    return sendError(res, err.message, err.status || 500);
  }
};
