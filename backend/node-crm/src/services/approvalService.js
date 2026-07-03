import User from "../models/User.js";
import ApprovalRequest from "../models/ApprovalRequest.js";
import { getClient } from "../../config/db.js";
import {
  canSubmitApprovalRequest,
  canViewApprovalQueues,
  canApplyApprovalTransition,
  canAssignReviewer,
  isTerminalApprovalStatus,
  resolveSubjectUserRoleForRbac,
  roleRequiresOnboardingApproval,
} from "../config/approvalRbac.js";

export const APPROVAL_KINDS = Object.freeze([
  "user_onboarding",
  "generic",
  "document_verification",
]);

export const APPROVAL_STATUSES = Object.freeze([
  "pending",
  "in_review",
  "approved",
  "completed",
  "rejected",
  "cancelled",
]);

const CLOSED_REQUEST_MESSAGE = "This approval request is closed and cannot be changed";

/** Actionable queue statuses for moderator notification badge. */
export const ACTIONABLE_APPROVAL_STATUSES = Object.freeze(["pending", "in_review"]);

const normalizeJsonBody = (body) => {
  if (body === undefined || body === null || body === "") return null;
  if (typeof body === "string") {
    try {
      return JSON.parse(body);
    } catch {
      throw { status: 400, message: "body must be valid JSON when sent as a string" };
    }
  }
  return body;
};

const assertNotTerminal = (row) => {
  if (isTerminalApprovalStatus(row.status)) {
    throw { status: 409, message: CLOSED_REQUEST_MESSAGE };
  }
};

const assertCanAccessRow = (actor, row) => {
  const moderator = canViewApprovalQueues(actor.role);
  if (!moderator && row.requester_id !== actor.id) {
    throw { status: 403, message: "You cannot access this approval request" };
  }
};

/**
 * Opens a user_onboarding ticket inside an existing DB transaction (user provisioning).
 *
 * @param {object} client
 * @param {{ id: number; role: string }} creator
 * @param {{ id: number; name: string; email: string; role: string }} subjectUser
 * @returns {Promise<object | null>}
 */
export const insertUserOnboardingApprovalInTransaction = async (
  client,
  creator,
  subjectUser
) => {
  if (!roleRequiresOnboardingApproval(subjectUser.role)) {
    return null;
  }

  const roleLabel = subjectUser.role.replace(/_/g, " ");
  const title = `Onboard ${subjectUser.name} (${roleLabel})`;
  const body = {
    auto: true,
    subject_email: subjectUser.email,
    created_by_user_id: creator.id,
  };

  const created = await ApprovalRequest.insert(client, {
    kind: "user_onboarding",
    title,
    body,
    requesterId: creator.id,
    subjectUserId: subjectUser.id,
    assignedToId: null,
    subjectUserRoleSnapshot: subjectUser.role,
  });

  await ApprovalRequest.insertAction(client, {
    requestId: created.id,
    actorId: creator.id,
    fromStatus: null,
    toStatus: "pending",
    note: "Auto-created when user account was provisioned",
  });

  return created;
};

/**
 * Sync subject CRM user activation with user_onboarding approval outcome.
 *
 * @param {object} client
 * @param {object} row — approval_requests row
 * @param {string} toStatus
 */
const syncSubjectUserOnboardingActivation = async (client, row, toStatus) => {
  if (row.kind !== "user_onboarding" || row.subject_user_id == null) {
    return;
  }

  if (toStatus === "rejected" || toStatus === "cancelled") {
    await User.setActive(row.subject_user_id, false, { client });
  } else if (toStatus === "approved" || toStatus === "completed") {
    await User.setActive(row.subject_user_id, true, { client });
  }
};

export const createApprovalRequest = async (actor, payload) => {
  const kind = typeof payload.kind === "string" ? payload.kind.trim() : "";
  const title = typeof payload.title === "string" ? payload.title.trim() : "";

  if (!APPROVAL_KINDS.includes(kind)) {
    throw {
      status: 400,
      message: `kind must be one of: ${APPROVAL_KINDS.join(", ")}`,
    };
  }
  if (!title) {
    throw { status: 400, message: "title is required" };
  }

  if (!canSubmitApprovalRequest(actor.role, kind)) {
    throw { status: 403, message: "You are not allowed to submit this type of approval request" };
  }

  let subjectUserId = payload.subject_user_id ?? null;
  let subjectUserRoleSnapshot = null;
  if (kind === "user_onboarding") {
    if (subjectUserId == null || !Number.isFinite(Number(subjectUserId))) {
      throw { status: 400, message: "subject_user_id is required for user_onboarding" };
    }
    subjectUserId = Number(subjectUserId);
    const subject = await User.findById(subjectUserId);
    if (!subject) {
      throw { status: 404, message: "Subject user not found" };
    }
    subjectUserRoleSnapshot = subject.role;
  } else if (subjectUserId != null) {
    throw { status: 400, message: "subject_user_id is only valid for user_onboarding" };
  }

  const bodyJson = normalizeJsonBody(payload.body);
  const assignedToId =
    payload.assigned_to_id != null && Number.isFinite(Number(payload.assigned_to_id))
      ? Number(payload.assigned_to_id)
      : null;

  if (assignedToId != null) {
    const assignee = await User.findById(assignedToId);
    if (!assignee || !assignee.is_active) {
      throw { status: 400, message: "assigned_to_id must reference an active user" };
    }
  }

  const client = await getClient();
  try {
    await client.query("BEGIN");
    const created = await ApprovalRequest.insert(client, {
      kind,
      title,
      body: bodyJson,
      requesterId: actor.id,
      subjectUserId,
      assignedToId,
      subjectUserRoleSnapshot,
    });
    await ApprovalRequest.insertAction(client, {
      requestId: created.id,
      actorId: actor.id,
      fromStatus: null,
      toStatus: "pending",
      note: null,
    });
    await client.query("COMMIT");
    return ApprovalRequest.findById(created.id);
  } catch (err) {
    await client.query("ROLLBACK");
    if (err.code === "23505") {
      throw {
        status: 409,
        message: "An open approval request already exists for this user",
      };
    }
    throw err;
  } finally {
    client.release();
  }
};

/**
 * @param {object} actor
 * @param {{ mine?: boolean; status?: string; kind?: string; limit: number; offset: number }} opts
 */
export const listApprovalRequests = async (actor, opts) => {
  const moderator = canViewApprovalQueues(actor.role);
  let requesterIdOnly = null;
  if (!moderator) {
    requesterIdOnly = actor.id;
  } else if (opts.mine === true) {
    requesterIdOnly = actor.id;
  }

  const status =
    typeof opts.status === "string" && APPROVAL_STATUSES.includes(opts.status)
      ? opts.status
      : null;
  const kind =
    typeof opts.kind === "string" && APPROVAL_KINDS.includes(opts.kind) ? opts.kind : null;

  const [items, total] = await Promise.all([
    ApprovalRequest.list({
      requesterIdOnly,
      status,
      kind,
      limit: opts.limit,
      offset: opts.offset,
    }),
    ApprovalRequest.count({ requesterIdOnly, status, kind }),
  ]);

  return { items, total, limit: opts.limit, offset: opts.offset };
};

/**
 * Count of approvals needing moderator attention (pending + in_review).
 *
 * @param {object} actor
 */
export const getPendingApprovalsCount = async (actor) => {
  const moderator = canViewApprovalQueues(actor.role);
  if (!moderator) {
    return 0;
  }
  return ApprovalRequest.count({
    statuses: [...ACTIONABLE_APPROVAL_STATUSES],
  });
};

/**
 * @param {object} actor
 * @param {number} id
 */
export const getApprovalRequestDetail = async (actor, id) => {
  const row = await ApprovalRequest.findById(id);
  if (!row) {
    throw { status: 404, message: "Approval request not found" };
  }
  assertCanAccessRow(actor, row);
  const actions = await ApprovalRequest.findActionsByRequestId(id);
  return { ...row, actions };
};

/**
 * @param {object} actor
 * @param {number} id
 * @param {{ to_status: string; note?: string }} payload
 */
export const transitionApprovalRequest = async (actor, id, payload) => {
  const toStatus =
    typeof payload.to_status === "string" ? payload.to_status.trim() : "";
  if (!APPROVAL_STATUSES.includes(toStatus)) {
    throw {
      status: 400,
      message: `to_status must be one of: ${APPROVAL_STATUSES.join(", ")}`,
    };
  }

  const client = await getClient();
  try {
    await client.query("BEGIN");
    const row = await ApprovalRequest.findById(id, { client, forUpdate: true });
    if (!row) {
      throw { status: 404, message: "Approval request not found" };
    }

    assertCanAccessRow(actor, row);
    assertNotTerminal(row);

    const subjectUserRole = resolveSubjectUserRoleForRbac(row);
    const isActorRequester = row.requester_id === actor.id;

    const allowed = canApplyApprovalTransition({
      actorRole: actor.role,
      kind: row.kind,
      subjectUserRole,
      fromStatus: row.status,
      toStatus,
      isActorRequester,
    });
    if (!allowed) {
      throw { status: 403, message: "This status change is not allowed for your role" };
    }

    const decidedById =
      toStatus === "approved" || toStatus === "rejected" ? actor.id : null;
    const completedAt = toStatus === "completed" ? new Date().toISOString() : null;

    const updated = await ApprovalRequest.updateStatus(client, id, {
      status: toStatus,
      decidedById,
      decisionNote: payload.note ?? null,
      completedAt,
    });
    if (!updated) {
      throw { status: 404, message: "Approval request not found" };
    }

    await ApprovalRequest.insertAction(client, {
      requestId: id,
      actorId: actor.id,
      fromStatus: row.status,
      toStatus,
      note: payload.note ?? null,
    });

    await syncSubjectUserOnboardingActivation(client, row, toStatus);

    await client.query("COMMIT");
    return ApprovalRequest.findById(id);
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
};

/**
 * Reassign queue owner (advisory in v1 — does not gate who may approve).
 *
 * @param {object} actor
 * @param {number} id
 * @param {{ assigned_to_id?: number | null }} payload
 */
export const assignApprovalRequest = async (actor, id, payload) => {
  if (!canAssignReviewer(actor.role)) {
    throw { status: 403, message: "You are not allowed to assign reviewers" };
  }

  let assignedToId = payload.assigned_to_id ?? null;
  if (assignedToId != null) {
    if (!Number.isFinite(Number(assignedToId))) {
      throw { status: 400, message: "assigned_to_id must be a user id or null" };
    }
    assignedToId = Number(assignedToId);
    const assignee = await User.findById(assignedToId);
    if (!assignee || !assignee.is_active) {
      throw { status: 400, message: "assigned_to_id must reference an active user" };
    }
  }

  const client = await getClient();
  try {
    await client.query("BEGIN");
    const row = await ApprovalRequest.findById(id, { client, forUpdate: true });
    if (!row) {
      throw { status: 404, message: "Approval request not found" };
    }

    assertCanAccessRow(actor, row);
    assertNotTerminal(row);

    const previousAssigneeId = row.assigned_to_id ?? null;
    if (previousAssigneeId === assignedToId) {
      await client.query("COMMIT");
      return ApprovalRequest.findById(id);
    }

    await ApprovalRequest.updateAssignee(client, id, assignedToId);

    const note =
      assignedToId == null
        ? "Reviewer unassigned"
        : `Assigned to user #${assignedToId}`;

    await ApprovalRequest.insertAction(client, {
      requestId: id,
      actorId: actor.id,
      fromStatus: row.status,
      toStatus: row.status,
      note,
      metadata: {
        type: "assign",
        previous_assigned_to_id: previousAssigneeId,
        assigned_to_id: assignedToId,
      },
    });

    await client.query("COMMIT");
    return ApprovalRequest.findById(id);
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
};
