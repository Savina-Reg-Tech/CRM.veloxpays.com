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
import WebhookDelivery from "../models/WebhookDelivery.js";
import { sendSuccess, sendError } from "../utils/response.js";
import { storage } from "../storage/index.js";

/** Shape written by publicFormController's file-upload handling — see FORM_UPLOAD_* in
 * middleware/upload.js. Distinguishes an actual uploaded-file answer from a plain string/array
 * answer sharing the same submission_data bag. */
function isFileDescriptor(v) {
  return !!v && typeof v === "object" && v.__type === "file" && typeof v.storagePath === "string";
}

/** Stream (local disk) or redirect (S3 signed URL) a stored form-upload file — mirrors
 * verificationController.handleDownloadDocument's local-vs-S3 branch. */
async function sendStoredFile(res, descriptor) {
  const signedUrl = await storage.getSignedUrl(descriptor.storagePath);
  if (signedUrl) return res.redirect(signedUrl);
  const buffer = await storage.read(descriptor.storagePath);
  res.setHeader("Content-Type", descriptor.mimeType || "application/octet-stream");
  res.setHeader(
    "Content-Disposition",
    `inline; filename="${(descriptor.originalName || "file").replace(/"/g, "")}"`
  );
  return res.send(buffer);
}

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

// ── Uploaded-file downloads (admin-only, gated by the router's authorizeRoles) ─────
// Two entry points because a Lead's submission_data is its own independent JSONB copy taken
// at submit time (see models/Lead.js), not a live join to form_submissions — so a file
// attached on a lead (e.g. surfaced in VeloxCRM's VeloxAssist Meet & Greet tab) is looked up
// straight off the lead row, not through its originating submission.

export const handleDownloadSubmissionFile = async (req, res) => {
  try {
    const formId = parseInt(req.params.formId, 10);
    const submissionId = parseInt(req.params.submissionId, 10);
    const submission = await FormSubmission.findById(submissionId);
    if (!submission || submission.form_id !== formId) {
      return sendError(res, "File not found", 404);
    }
    const descriptor = submission.submission_data?.[req.params.fieldId];
    if (!isFileDescriptor(descriptor)) return sendError(res, "File not found", 404);
    return sendStoredFile(res, descriptor);
  } catch (err) {
    return sendError(res, err.message, err.status || 500);
  }
};

export const handleDownloadLeadFile = async (req, res) => {
  try {
    const leadId = parseInt(req.params.leadId, 10);
    const lead = await Lead.findById(leadId);
    if (!lead) return sendError(res, "File not found", 404);
    const descriptor = lead.submission_data?.[req.params.fieldId];
    if (!isFileDescriptor(descriptor)) return sendError(res, "File not found", 404);
    return sendStoredFile(res, descriptor);
  } catch (err) {
    return sendError(res, err.message, err.status || 500);
  }
};

// ── Webhook delivery log (admin-visible, see webhookService.js) ────

export const handleListWebhookDeliveries = async (req, res) => {
  try {
    const formId = parseInt(req.params.id, 10);
    const { limit, offset } = parsePagination(req);

    const [items, total] = await Promise.all([
      WebhookDelivery.listByForm(formId, { limit, offset }),
      WebhookDelivery.countByForm(formId),
    ]);
    return sendSuccess(res, { items, total, limit, offset }, "Webhook deliveries fetched");
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
      const extra = extraCols.map((k) => {
        const v = data[k];
        return isFileDescriptor(v) ? v.originalName : v;
      });
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
