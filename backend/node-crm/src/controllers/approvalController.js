import {
  APPROVAL_KINDS,
  APPROVAL_STATUSES,
  assignApprovalRequest,
  createApprovalRequest,
  getApprovalRequestDetail,
  getPendingApprovalsCount,
  listApprovalRequests,
  transitionApprovalRequest,
} from "../services/approvalService.js";
import { sendSuccess, sendError } from "../utils/response.js";

export const handleListApprovalMetaKinds = async (_req, res) => {
  return sendSuccess(res, [...APPROVAL_KINDS], "Approval kinds");
};

export const handleListApprovalMetaStatuses = async (_req, res) => {
  return sendSuccess(res, [...APPROVAL_STATUSES], "Approval statuses");
};

export const handleGetPendingApprovalsCount = async (req, res) => {
  try {
    const count = await getPendingApprovalsCount(req.user);
    return sendSuccess(res, { count }, "Pending approvals count");
  } catch (err) {
    return sendError(res, err.message, err.status || 500);
  }
};

const parsePagination = (req) => {
  const rawLimit = parseInt(req.query.limit, 10);
  const rawOffset = parseInt(req.query.offset, 10);
  const limit = Math.min(
    Math.max(Number.isFinite(rawLimit) ? rawLimit : 20, 1),
    100
  );
  const offset = Math.max(Number.isFinite(rawOffset) ? rawOffset : 0, 0);
  return { limit, offset };
};

export const handleCreateApprovalRequest = async (req, res) => {
  try {
    const created = await createApprovalRequest(req.user, req.body);
    return sendSuccess(res, created, "Approval request created", 201);
  } catch (err) {
    return sendError(res, err.message, err.status || 500);
  }
};

export const handleListApprovalRequests = async (req, res) => {
  try {
    const { limit, offset } = parsePagination(req);
    const mine = req.query.mine === "1" || req.query.mine === "true";
    const result = await listApprovalRequests(req.user, {
      mine,
      status: req.query.status,
      kind: req.query.kind,
      limit,
      offset,
    });
    return sendSuccess(res, result, "Approval requests fetched");
  } catch (err) {
    return sendError(res, err.message, err.status || 500);
  }
};

export const handleGetApprovalRequestById = async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (!Number.isFinite(id)) {
      return sendError(res, "Invalid id", 400);
    }
    const detail = await getApprovalRequestDetail(req.user, id);
    return sendSuccess(res, detail, "Approval request fetched");
  } catch (err) {
    return sendError(res, err.message, err.status || 500);
  }
};

export const handleTransitionApprovalRequest = async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (!Number.isFinite(id)) {
      return sendError(res, "Invalid id", 400);
    }
    const { to_status, note } = req.body || {};
    const updated = await transitionApprovalRequest(req.user, id, {
      to_status,
      note,
    });
    return sendSuccess(res, updated, "Approval request updated");
  } catch (err) {
    return sendError(res, err.message, err.status || 500);
  }
};

export const handleAssignApprovalRequest = async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (!Number.isFinite(id)) {
      return sendError(res, "Invalid id", 400);
    }
    const { assigned_to_id } = req.body || {};
    const updated = await assignApprovalRequest(req.user, id, { assigned_to_id });
    return sendSuccess(res, updated, "Approval request assigned");
  } catch (err) {
    return sendError(res, err.message, err.status || 500);
  }
};
