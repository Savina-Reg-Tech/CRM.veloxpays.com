import {
  DOCUMENT_STATUSES,
  VERIFICATION_STATUSES,
  uploadDocument,
  getMyDocuments,
  getMyProgress,
  reviewDocument,
  listForReview,
  getUserVerificationDetail,
  activateAccount,
  suspendAccount,
  rejectVerification,
  getDocumentForDownload,
  getPendingVerificationCount,
} from "../services/verificationService.js";
import { getRoleDocumentSpec } from "../config/verificationDocs.js";
import { sendSuccess, sendError } from "../utils/response.js";

const parsePagination = (req) => {
  const rawLimit = parseInt(req.query.limit, 10);
  const rawOffset = parseInt(req.query.offset, 10);
  const limit = Math.min(Math.max(Number.isFinite(rawLimit) ? rawLimit : 20, 1), 100);
  const offset = Math.max(Number.isFinite(rawOffset) ? rawOffset : 0, 0);
  return { limit, offset };
};

export const handleGetMeta = (req, res) => {
  return sendSuccess(
    res,
    {
      document_statuses: [...DOCUMENT_STATUSES],
      verification_statuses: [...VERIFICATION_STATUSES],
      required_documents: getRoleDocumentSpec(req.user.role),
    },
    "Verification metadata"
  );
};

export const handleUploadDocument = async (req, res) => {
  try {
    const docType = (req.body?.doc_type || req.body?.docType || "").trim();
    const customLabel = (req.body?.custom_label || req.body?.customLabel || "").trim() || null;
    const created = await uploadDocument(req.user, { docType, file: req.file, customLabel }, req);
    return sendSuccess(res, created, "Document uploaded", 201);
  } catch (err) {
    return sendError(res, err.message, err.status || 500);
  }
};

export const handleGetMyDocuments = async (req, res) => {
  try {
    const docs = await getMyDocuments(req.user);
    return sendSuccess(res, docs, "Your documents");
  } catch (err) {
    return sendError(res, err.message, err.status || 500);
  }
};

export const handleGetMyProgress = async (req, res) => {
  try {
    const progress = await getMyProgress(req.user);
    return sendSuccess(res, progress, "Verification progress");
  } catch (err) {
    return sendError(res, err.message, err.status || 500);
  }
};

export const handleReviewDocument = async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (!Number.isFinite(id)) return sendError(res, "Invalid id", 400);
    const { to_status, note } = req.body || {};
    const updated = await reviewDocument(req.user, id, { toStatus: to_status, note }, req);
    return sendSuccess(res, updated, "Document review updated");
  } catch (err) {
    return sendError(res, err.message, err.status || 500);
  }
};

export const handleListForReview = async (req, res) => {
  try {
    const { limit, offset } = parsePagination(req);
    const roles = req.query.role
      ? String(req.query.role).split(",").map((r) => r.trim()).filter(Boolean)
      : undefined;
    const result = await listForReview(req.user, {
      roles,
      status: req.query.status,
      search: req.query.search,
      limit,
      offset,
    });
    return sendSuccess(res, result, "Verification queue");
  } catch (err) {
    return sendError(res, err.message, err.status || 500);
  }
};

export const handleGetUserDetail = async (req, res) => {
  try {
    const userId = parseInt(req.params.userId, 10);
    if (!Number.isFinite(userId)) return sendError(res, "Invalid user id", 400);
    const detail = await getUserVerificationDetail(req.user, userId);
    return sendSuccess(res, detail, "Verification detail");
  } catch (err) {
    return sendError(res, err.message, err.status || 500);
  }
};

export const handleActivate = async (req, res) => {
  try {
    const userId = parseInt(req.params.userId, 10);
    if (!Number.isFinite(userId)) return sendError(res, "Invalid user id", 400);
    const updated = await activateAccount(req.user, userId, req);
    return sendSuccess(res, updated, "Account activated");
  } catch (err) {
    return sendError(res, err.message, err.status || 500);
  }
};

export const handleSuspend = async (req, res) => {
  try {
    const userId = parseInt(req.params.userId, 10);
    if (!Number.isFinite(userId)) return sendError(res, "Invalid user id", 400);
    const updated = await suspendAccount(req.user, userId, { note: req.body?.note }, req);
    return sendSuccess(res, updated, "Account suspended");
  } catch (err) {
    return sendError(res, err.message, err.status || 500);
  }
};

export const handleRejectVerification = async (req, res) => {
  try {
    const userId = parseInt(req.params.userId, 10);
    if (!Number.isFinite(userId)) return sendError(res, "Invalid user id", 400);
    const updated = await rejectVerification(req.user, userId, { note: req.body?.note }, req);
    return sendSuccess(res, updated, "Verification rejected");
  } catch (err) {
    return sendError(res, err.message, err.status || 500);
  }
};

export const handleGetPendingVerificationCount = async (req, res) => {
  try {
    const count = await getPendingVerificationCount(req.user);
    return sendSuccess(res, { count }, "Pending verification count");
  } catch (err) {
    return sendError(res, err.message, err.status || 500);
  }
};

export const handleDownloadDocument = async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (!Number.isFinite(id)) return sendError(res, "Invalid id", 400);
    const result = await getDocumentForDownload(req.user, id);
    if (result.redirectUrl) {
      return res.redirect(result.redirectUrl);
    }
    res.setHeader("Content-Type", result.doc.mime_type);
    res.setHeader(
      "Content-Disposition",
      `inline; filename="${result.doc.original_file_name.replace(/"/g, "")}"`
    );
    return res.send(result.buffer);
  } catch (err) {
    return sendError(res, err.message, err.status || 500);
  }
};
