import {
  createForm,
  updateForm,
  getForm,
  listForms,
  deleteForm,
  generateIframeEmbed,
  generateJsEmbed,
} from "../services/formService.js";
import FormSubmission from "../models/FormSubmission.js";
import Lead from "../models/Lead.js";
import Form from "../models/Form.js";
import { sendSuccess, sendError } from "../utils/response.js";

const parsePagination = (req) => {
  const rawLimit  = parseInt(req.query.limit, 10);
  const rawOffset = parseInt(req.query.offset, 10);
  const limit  = Math.min(Math.max(Number.isFinite(rawLimit)  ? rawLimit  : 20, 1), 100);
  const offset = Math.max(Number.isFinite(rawOffset) ? rawOffset : 0, 0);
  return { limit, offset };
};

// ── Form CRUD ─────────────────────────────────────────────────────

export const handleCreateForm = async (req, res) => {
  try {
    const form = await createForm(req.body, req.user);
    return sendSuccess(res, form, "Form created successfully", 201);
  } catch (err) {
    return sendError(res, err.message, err.status || 500, err.errors);
  }
};

export const handleListForms = async (req, res) => {
  try {
    const { limit, offset } = parsePagination(req);
    const status = req.query.status || null;
    const result = await listForms({ limit, offset, status });
    return sendSuccess(res, result, "Forms fetched");
  } catch (err) {
    return sendError(res, err.message, err.status || 500);
  }
};

export const handleGetForm = async (req, res) => {
  try {
    const form = await getForm(parseInt(req.params.id, 10));
    return sendSuccess(res, form, "Form fetched");
  } catch (err) {
    return sendError(res, err.message, err.status || 500);
  }
};

export const handleUpdateForm = async (req, res) => {
  try {
    const form = await updateForm(parseInt(req.params.id, 10), req.body);
    return sendSuccess(res, form, "Form updated");
  } catch (err) {
    return sendError(res, err.message, err.status || 500, err.errors);
  }
};

export const handleDeleteForm = async (req, res) => {
  try {
    await deleteForm(parseInt(req.params.id, 10));
    return sendSuccess(res, null, "Form deleted");
  } catch (err) {
    return sendError(res, err.message, err.status || 500);
  }
};

// ── Embed codes ───────────────────────────────────────────────────

export const handleGetEmbedCodes = async (req, res) => {
  try {
    const formId = parseInt(req.params.id, 10);
    const form = await getForm(formId);
    const baseUrl = `${req.protocol}://${req.get("host")}`;

    return sendSuccess(res, {
      iframe: generateIframeEmbed(formId, baseUrl),
      javascript: generateJsEmbed(formId, baseUrl),
      formUrl: `${baseUrl}/embed/${formId}`,
    }, "Embed codes generated");
  } catch (err) {
    return sendError(res, err.message, err.status || 500);
  }
};

// ── Form submissions (admin view) ─────────────────────────────────

export const handleListFormSubmissions = async (req, res) => {
  try {
    const formId = parseInt(req.params.id, 10);
    const { limit, offset } = parsePagination(req);
    const status = req.query.status || null;

    const [items, total] = await Promise.all([
      FormSubmission.listByForm(formId, { limit, offset, status }),
      FormSubmission.countByForm(formId, { status }),
    ]);
    return sendSuccess(res, { items, total, limit, offset }, "Submissions fetched");
  } catch (err) {
    return sendError(res, err.message, err.status || 500);
  }
};

export const handleGetFormAnalytics = async (req, res) => {
  try {
    const formId = parseInt(req.params.id, 10);
    const [daily, globalStats] = await Promise.all([
      FormSubmission.getDailyStats(formId),
      FormSubmission.getGlobalStats(),
    ]);
    return sendSuccess(res, { daily, globalStats }, "Analytics fetched");
  } catch (err) {
    return sendError(res, err.message, err.status || 500);
  }
};

// ── CSV export ────────────────────────────────────────────────────

export const handleExportSubmissions = async (req, res) => {
  try {
    const formId = parseInt(req.params.id, 10);
    const form = await getForm(formId);
    const rows = await FormSubmission.exportByForm(formId, { status: req.query.status || null });

    // Collect all unique data keys across rows
    const dataKeys = new Set();
    rows.forEach((r) => {
      if (r.submission_data && typeof r.submission_data === "object") {
        Object.keys(r.submission_data).forEach((k) => dataKeys.add(k));
      }
    });
    const extraCols = [...dataKeys];

    // Build CSV
    const escape = (v) => {
      if (v === null || v === undefined) return "";
      const s = Array.isArray(v) ? v.join("; ") : String(v);
      return s.includes(",") || s.includes('"') || s.includes("\n")
        ? `"${s.replace(/"/g, '""')}"`
        : s;
    };

    const header = ["id", "email", "status", "spam_score", "time_taken_seconds", "ip_address", "submitted_at", ...extraCols];
    const lines = [header.join(",")];
    rows.forEach((r) => {
      const data = r.submission_data ?? {};
      const base = [r.id, r.email, r.status, r.spam_score, r.time_taken_seconds, r.ip_address, r.created_at];
      const extra = extraCols.map((k) => data[k]);
      lines.push([...base, ...extra].map(escape).join(","));
    });

    const csv = lines.join("\n");
    const filename = `${form.slug}-submissions-${new Date().toISOString().slice(0, 10)}.csv`;

    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    return res.send(csv);
  } catch (err) {
    return sendError(res, err.message, err.status || 500);
  }
};

// ── Global analytics ──────────────────────────────────────────────

export const handleGetGlobalStats = async (req, res) => {
  try {
    const [formStats, submissionStats, leadStats] = await Promise.all([
      Form.getStats(),
      FormSubmission.getGlobalStats(),
      Lead.getStats(),
    ]);
    return sendSuccess(res, { forms: formStats, submissions: submissionStats, leads: leadStats }, "Stats fetched");
  } catch (err) {
    return sendError(res, err.message, err.status || 500);
  }
};
