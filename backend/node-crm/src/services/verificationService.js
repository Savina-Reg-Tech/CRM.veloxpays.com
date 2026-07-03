import { randomUUID } from "crypto";
import User from "../models/User.js";
import ApprovalRequest from "../models/ApprovalRequest.js";
import VerificationDocument from "../models/VerificationDocument.js";
import { getClient } from "../../config/db.js";
import { storage, MIME_EXTENSION } from "../storage/index.js";
import {
  getRoleDocumentSpec,
  isDocTypeAllowedForRole,
  isCustomDocType,
  docLabel,
  CUSTOM_DOC_PREFIX,
} from "../config/verificationDocs.js";
import {
  canModerateDocumentVerification,
  canViewApprovalQueues,
  canApproveOrRejectUserOnboarding,
} from "../config/approvalRbac.js";
import { notify } from "./notificationService.js";

/** Per-document review statuses surfaced to clients (subset of approval statuses). */
export const DOCUMENT_STATUSES = Object.freeze([
  "pending",
  "in_review",
  "approved",
  "rejected",
]);

/** Derived per-user verification status (review-portal filter values). */
export const VERIFICATION_STATUSES = Object.freeze([
  "pending",
  "under_review",
  "approved",
  "rejected",
  "activated",
  "suspended",
  "expired",
]);

// ── Helpers ──────────────────────────────────────────────────────────────────

const reqMetaFrom = (actor, req) => ({
  ipAddress: req?.ip || req?.headers?.["x-forwarded-for"] || null,
  actorRole: actor?.role || null,
});

/**
 * Compute verification progress for a user from their live documents.
 *
 * @param {string} role
 * @param {Array} liveDocs — VerificationDocument rows joined with status
 * @param {string} [accountStatus]
 */
export const computeProgress = (role, liveDocs, accountStatus) => {
  const spec = getRoleDocumentSpec(role);
  const required = spec.required;
  const optional = spec.optional;

  const byTypeStatus = new Map();
  for (const d of liveDocs) byTypeStatus.set(d.doc_type, d.status);

  const approvedRequired = required.filter(
    (t) => byTypeStatus.get(t) === "approved"
  ).length;

  const uploaded = liveDocs.length;
  const requiredTotal = required.length;
  const allRequiredApproved = requiredTotal > 0 && approvedRequired === requiredTotal;

  // Per-required-type table rows (shows "not uploaded" placeholders too).
  const docTable = [...required, ...optional].map((t) => {
    const doc = liveDocs.find((d) => d.doc_type === t);
    return {
      doc_type: t,
      label: docLabel(t),
      required: required.includes(t),
      status: doc ? doc.status : "not_uploaded",
      review_note: doc?.review_note ?? null,
      document_id: doc?.id ?? null,
    };
  });

  // Append any custom (additional) documents the user uploaded.
  const knownTypes = new Set([...required, ...optional]);
  for (const d of liveDocs) {
    if (isCustomDocType(d.doc_type) && !knownTypes.has(d.doc_type)) {
      docTable.push({
        doc_type: d.doc_type,
        label: d.custom_label || d.doc_type,
        required: false,
        status: d.status,
        review_note: d.review_note ?? null,
        document_id: d.id ?? null,
      });
    }
  }

  // Derived overall status.
  let overall;
  if (accountStatus === "active") overall = "activated";
  else if (accountStatus === "expired") overall = "expired";
  else if (accountStatus === "suspended") overall = "suspended";
  else if (allRequiredApproved) overall = "approved";
  else if (required.some((t) => byTypeStatus.get(t) === "rejected")) overall = "rejected";
  else if (liveDocs.some((d) => d.status === "in_review")) overall = "under_review";
  else overall = "pending";

  const totalDocs = docTable.length;          // required + optional + custom
  const customCount = docTable.filter(
    (d) => d.doc_type && d.doc_type.startsWith("custom_")
  ).length;

  return {
    role,
    uploaded,
    total_docs: totalDocs,
    custom_count: customCount,
    required_total: requiredTotal,
    required_approved: approvedRequired,
    documents_uploaded_label: `${uploaded}/${totalDocs}`,
    can_activate: allRequiredApproved,
    overall_status: overall,
    documents: docTable,
  };
};

// ── Upload ───────────────────────────────────────────────────────────────────

/**
 * Upload (or re-upload) a verification document for the acting user.
 * Re-uploading a type archives the prior live row and opens a fresh review.
 */
export const uploadDocument = async (actor, { docType, file, customLabel }, req) => {
  if (!file) throw { status: 400, message: "A file is required" };

  // Custom documents require a label.
  if (isCustomDocType(docType) && !(customLabel && customLabel.trim())) {
    throw { status: 400, message: "A label is required for custom documents" };
  }
  if (!isDocTypeAllowedForRole(actor.role, docType)) {
    throw {
      status: 400,
      message: `'${docType}' is not a valid document for role '${actor.role}'`,
    };
  }

  const resolvedLabel = isCustomDocType(docType) ? customLabel.trim().slice(0, 100) : null;

  const ext = MIME_EXTENSION[file.mimetype] || "bin";
  const key = `user-${actor.id}/${docType}-${randomUUID()}.${ext}`;
  const { storagePath, fileUrl } = await storage.put({
    key,
    buffer: file.buffer,
    contentType: file.mimetype,
  });

  const meta = reqMetaFrom(actor, req);
  const client = await getClient();
  try {
    await client.query("BEGIN");

    // Archive any prior live document of this type (keeps audit history).
    const prior = await VerificationDocument.findLiveByType(actor.id, docType, {
      client,
      forUpdate: true,
    });
    if (prior) {
      await VerificationDocument.archiveById(prior.id, { client });
    }

    // One approval_request drives this document's review lifecycle.
    const displayLabel = resolvedLabel || docLabel(docType);
    const request = await ApprovalRequest.insert(client, {
      kind: "document_verification",
      title: `${displayLabel} — ${actor.name}`,
      body: { doc_type: docType, subject_user_id: actor.id, custom_label: resolvedLabel },
      requesterId: actor.id,
      subjectUserId: actor.id,
      assignedToId: null,
      subjectUserRoleSnapshot: actor.role,
    });
    await ApprovalRequest.insertAction(client, {
      requestId: request.id,
      actorId: actor.id,
      fromStatus: null,
      toStatus: "pending",
      note: prior ? "Re-uploaded document" : "Document uploaded",
      metadata: { event: "document_uploaded", doc_type: docType },
      ...meta,
    });

    const doc = await VerificationDocument.insert(client, {
      userId: actor.id,
      docType,
      approvalRequestId: request.id,
      fileName: key.split("/").pop(),
      originalFileName: file.originalname,
      storagePath,
      fileUrl,
      mimeType: file.mimetype,
      fileSize: file.size,
      customLabel: resolvedLabel,
    });

    await client.query("COMMIT");

    // Notifications (outside the txn): confirm to user, alert moderators.
    await notify({
      recipient: actor,
      event: "document_uploaded",
      title: `Document received: ${displayLabel}`,
      body: "Your document was uploaded and is awaiting review.",
      metadata: { doc_type: docType, document_id: doc.id },
      email: false,
    });
    const moderators = await User.findModerators();
    await Promise.all(
      moderators.map((m) =>
        notify({
          recipient: m,
          event: "document_uploaded",
          title: `New document to review: ${actor.name}`,
          body: `${actor.name} (${actor.role}) uploaded ${displayLabel}.`,
          metadata: { subject_user_id: actor.id, doc_type: docType, document_id: doc.id },
          email: false,
        })
      )
    );

    return { ...doc, status: "pending", review_note: null };
  } catch (err) {
    await client.query("ROLLBACK");
    // Compensate: remove the just-stored object so we don't orphan it.
    await storage.remove(storagePath).catch(() => {});
    if (err.code === "23505") {
      throw { status: 409, message: "A document of this type is already under review" };
    }
    throw err;
  } finally {
    client.release();
  }
};

// ── Read: own documents + progress ───────────────────────────────────────────

export const getMyDocuments = async (actor) => {
  const docs = await VerificationDocument.findLiveByUser(actor.id);
  return docs;
};

export const getProgressForUser = async (user) => {
  const docs = await VerificationDocument.findLiveByUser(user.id);
  return computeProgress(user.role, docs, user.account_status);
};

export const getMyProgress = (actor) => getProgressForUser(actor);

// ── Review (moderator approves / rejects a document) ─────────────────────────

export const reviewDocument = async (actor, documentId, { toStatus, note }, req) => {
  if (!canModerateDocumentVerification(actor.role)) {
    throw { status: 403, message: "You are not allowed to review documents" };
  }
  const target = ["in_review", "approved", "rejected", "pending"];
  if (!target.includes(toStatus)) {
    throw { status: 400, message: `to_status must be one of: ${target.join(", ")}` };
  }
  if (toStatus === "rejected" && !(note && note.trim())) {
    throw { status: 400, message: "A comment is required when rejecting a document" };
  }

  const meta = reqMetaFrom(actor, req);
  const client = await getClient();
  try {
    await client.query("BEGIN");

    const doc = await VerificationDocument.findById(documentId, { client });
    if (!doc || doc.archived_at) {
      throw { status: 404, message: "Document not found" };
    }

    const request = await ApprovalRequest.findById(doc.approval_request_id, {
      client,
      forUpdate: true,
    });
    if (!request) throw { status: 404, message: "Review record not found" };

    const decidedById =
      toStatus === "approved" || toStatus === "rejected" ? actor.id : null;

    await ApprovalRequest.updateStatus(client, request.id, {
      status: toStatus,
      decidedById,
      decisionNote: note ?? null,
      completedAt: null,
    });
    await ApprovalRequest.insertAction(client, {
      requestId: request.id,
      actorId: actor.id,
      fromStatus: request.status,
      toStatus,
      note: note ?? null,
      metadata: { event: `document_${toStatus}`, doc_type: doc.doc_type },
      ...meta,
    });

    await client.query("COMMIT");

    // Notify the document owner.
    const owner = await User.findById(doc.user_id);
    const reviewLabel = doc.custom_label || docLabel(doc.doc_type);
    if (toStatus === "approved") {
      await notify({
        recipient: owner,
        event: "document_approved",
        title: `Document approved: ${reviewLabel}`,
        body: "One of your verification documents was approved.",
        metadata: { doc_type: doc.doc_type, document_id: doc.id },
      });
    } else if (toStatus === "rejected") {
      await notify({
        recipient: owner,
        event: "document_rejected",
        title: `Document rejected: ${reviewLabel}`,
        body: `Reason: ${note}. Please re-upload a corrected document.`,
        metadata: { doc_type: doc.doc_type, document_id: doc.id, reason: note },
      });
      await notify({
        recipient: owner,
        event: "reupload_required",
        title: `Re-upload required: ${reviewLabel}`,
        body: "Please upload a corrected version of this document.",
        metadata: { doc_type: doc.doc_type },
        email: false,
      });
    }

    return VerificationDocument.findById(documentId);
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
};

// ── Admin review portal: list + detail ───────────────────────────────────────

const ROLE_FILTER_MAP = { employee: "employee", agent: "agent", affiliate: "affiliate" };

/**
 * List users in the verification scope with computed progress/status.
 * Status filtering is applied after derivation (depends on role→docs config),
 * so pagination is performed in-memory over the filtered set.
 */
export const listForReview = async (actor, opts) => {
  if (!canViewApprovalQueues(actor.role)) {
    throw { status: 403, message: "You are not allowed to view the verification queue" };
  }

  const roles = Array.isArray(opts.roles)
    ? opts.roles.filter((r) => ROLE_FILTER_MAP[r])
    : undefined;

  const subjects = await User.findVerificationSubjects({
    roles,
    search: opts.search,
  });

  let items = subjects.map((u) => {
    const docsApproved = Number(u.docs_approved) || 0;
    const spec = getRoleDocumentSpec(u.role);
    const requiredTotal = spec.required.length;
    let overall;
    if (u.account_status === "active") overall = "activated";
    else if (u.account_status === "expired") overall = "expired";
    else if (u.account_status === "suspended") overall = "suspended";
    else if (requiredTotal > 0 && docsApproved >= requiredTotal) overall = "approved";
    else if (Number(u.docs_rejected) > 0) overall = "rejected";
    else if (Number(u.docs_in_review) > 0) overall = "under_review";
    else overall = "pending";

    const docsUploaded = Number(u.docs_uploaded) || 0;
    return {
      id: u.id,
      name: u.name,
      email: u.email,
      role: u.role,
      account_status: u.account_status,
      verification_deadline: u.verification_deadline,
      created_at: u.created_at,
      docs_uploaded: docsUploaded,
      docs_approved: docsApproved,
      required_total: requiredTotal,
      total_expected: requiredTotal + spec.optional.length,
      can_activate: requiredTotal > 0 && docsApproved >= requiredTotal,
      verification_status: overall,
    };
  });

  if (opts.status && VERIFICATION_STATUSES.includes(opts.status)) {
    items = items.filter((i) => i.verification_status === opts.status);
  }

  const total = items.length;
  const paged = items.slice(opts.offset, opts.offset + opts.limit);
  return { items: paged, total, limit: opts.limit, offset: opts.offset };
};

/** Full verification detail for one user: progress + documents + timeline. */
export const getUserVerificationDetail = async (actor, userId) => {
  if (!canViewApprovalQueues(actor.role)) {
    throw { status: 403, message: "You are not allowed to view this" };
  }
  const user = await User.findById(userId);
  if (!user) throw { status: 404, message: "User not found" };

  const docs = await VerificationDocument.findLiveByUser(userId);
  const progress = computeProgress(user.role, docs, user.account_status);

  // Activity timeline = approval_actions across the user's document requests.
  const timeline = [];
  for (const d of docs) {
    const actions = await ApprovalRequest.findActionsByRequestId(d.approval_request_id);
    for (const a of actions) {
      timeline.push({ ...a, doc_type: d.doc_type, document_id: d.id, custom_label: d.custom_label || null });
    }
  }
  timeline.sort((x, y) => new Date(x.created_at) - new Date(y.created_at));

  return {
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      account_status: user.account_status,
      verification_deadline: user.verification_deadline,
    },
    progress,
    documents: docs,
    timeline,
  };
};

// ── Account activation / suspension / rejection ──────────────────────────────

/** True when every REQUIRED document for the user's role is approved. */
const allRequiredApproved = async (user, client) => {
  const spec = getRoleDocumentSpec(user.role);
  if (spec.required.length === 0) return true;
  const approved = new Set(
    await VerificationDocument.approvedDocTypesForUser(user.id, { client })
  );
  return spec.required.every((t) => approved.has(t));
};

/** Move the user's open onboarding request to a status and log the action. */
const advanceOnboarding = async (client, userId, actor, toStatus, note, meta) => {
  const onboarding = await ApprovalRequest.findOpenOnboardingByUser(userId, {
    client,
    forUpdate: true,
  });
  if (!onboarding) return;
  await ApprovalRequest.updateStatus(client, onboarding.id, {
    status: toStatus,
    decidedById: actor.id,
    decisionNote: note ?? null,
    completedAt: toStatus === "completed" ? new Date().toISOString() : null,
  });
  await ApprovalRequest.insertAction(client, {
    requestId: onboarding.id,
    actorId: actor.id,
    fromStatus: onboarding.status,
    toStatus,
    note: note ?? null,
    metadata: { event: "account_" + toStatus },
    ...meta,
  });
};

/**
 * Activate a user account. Super-admins and admins may activate at their
 * discretion — document approval status does NOT gate activation.
 */
export const activateAccount = async (actor, userId, req) => {
  const user = await User.findById(userId);
  if (!user) throw { status: 404, message: "User not found" };
  if (!canApproveOrRejectUserOnboarding(actor.role, user.role)) {
    throw { status: 403, message: "You are not allowed to activate this account" };
  }
  if (user.account_status === "active") {
    throw { status: 409, message: "Account is already active" };
  }

  const meta = reqMetaFrom(actor, req);
  const client = await getClient();
  try {
    await client.query("BEGIN");
    await User.setAccountStatus(userId, "active", { client });
    await advanceOnboarding(client, userId, actor, "approved", "Account activated", meta);
    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }

  await notify({
    recipient: user,
    event: "account_activated",
    title: "Your account has been activated",
    body: "Verification complete — you now have full access to the CRM.",
    metadata: {},
  });
  return User.findById(userId);
};

/** Suspend an active/pending account (reversible). */
export const suspendAccount = async (actor, userId, { note } = {}, req) => {
  const user = await User.findById(userId);
  if (!user) throw { status: 404, message: "User not found" };
  if (!canApproveOrRejectUserOnboarding(actor.role, user.role)) {
    throw { status: 403, message: "You are not allowed to suspend this account" };
  }

  const meta = reqMetaFrom(actor, req);
  const client = await getClient();
  try {
    await client.query("BEGIN");
    await User.setAccountStatus(userId, "suspended", { client });
    await advanceOnboarding(client, userId, actor, "cancelled", note || "Account suspended", meta);
    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
  return User.findById(userId);
};

/** Reject a user's verification (blocks access; reversible by re-activation). */
export const rejectVerification = async (actor, userId, { note } = {}, req) => {
  const user = await User.findById(userId);
  if (!user) throw { status: 404, message: "User not found" };
  if (!canApproveOrRejectUserOnboarding(actor.role, user.role)) {
    throw { status: 403, message: "You are not allowed to reject this verification" };
  }
  if (!(note && note.trim())) {
    throw { status: 400, message: "A reason is required when rejecting verification" };
  }

  const meta = reqMetaFrom(actor, req);
  const client = await getClient();
  try {
    await client.query("BEGIN");
    await User.setAccountStatus(userId, "suspended", { client });
    await advanceOnboarding(client, userId, actor, "rejected", note, meta);
    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }

  await notify({
    recipient: user,
    event: "document_rejected",
    title: "Your verification was rejected",
    body: `Reason: ${note}`,
    metadata: {},
  });
  return User.findById(userId);
};

// ── Secure download ──────────────────────────────────────────────────────────

/**
 * Resolve a document for download. Owner or moderator only.
 * Returns either a signed URL (S3) or a buffer (local) for the controller.
 */
/**
 * Count users whose verification status is pending/under_review (needs moderator attention).
 */
export const getPendingVerificationCount = async (actor) => {
  if (!canViewApprovalQueues(actor.role)) return 0;

  const subjects = await User.findVerificationSubjects({});
  let count = 0;
  for (const u of subjects) {
    if (u.account_status === "active" || u.account_status === "expired" || u.account_status === "suspended") continue;
    const docsApproved = Number(u.docs_approved) || 0;
    const spec = getRoleDocumentSpec(u.role);
    const requiredTotal = spec.required.length;
    const allApproved = requiredTotal > 0 && docsApproved >= requiredTotal;
    if (!allApproved) count++;
  }
  return count;
};

export const getDocumentForDownload = async (actor, documentId) => {
  const doc = await VerificationDocument.findById(documentId);
  if (!doc) throw { status: 404, message: "Document not found" };

  const isOwner = doc.user_id === actor.id;
  const isModerator = canViewApprovalQueues(actor.role);
  if (!isOwner && !isModerator) {
    throw { status: 403, message: "You cannot access this document" };
  }

  const signedUrl = await storage.getSignedUrl(doc.storage_path);
  if (signedUrl) return { redirectUrl: signedUrl, doc };

  const buffer = await storage.read(doc.storage_path);
  return { buffer, doc };
};
