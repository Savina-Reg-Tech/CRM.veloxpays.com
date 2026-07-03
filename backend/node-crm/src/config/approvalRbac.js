/**
 * Approval workflow RBAC (see `approval_flow.md` / product spec).
 *
 * Single source of truth for:
 *   • Who may submit an approval request (by kind).
 *   • Who may approve / reject user-onboarding for a given subject role.
 *   • Who may moderate generic (operational) requests.
 *   • Which status transitions are legal.
 *
 * Controllers/services should call these helpers instead of duplicating role strings.
 */

import { isKnownRole } from "./crmRoles.js";

/** @typedef {'user_onboarding' | 'generic' | 'document_verification'} ApprovalRequestKind */

/** @typedef {'pending' | 'in_review' | 'approved' | 'completed' | 'rejected' | 'cancelled'} ApprovalRequestStatus */

/** Statuses that cannot be transitioned out of (AF-5). */
export const TERMINAL_APPROVAL_STATUSES = Object.freeze([
  "completed",
  "rejected",
  "cancelled",
]);

/**
 * @param {ApprovalRequestStatus | string | null | undefined} status
 * @returns {boolean}
 */
export function isTerminalApprovalStatus(status) {
  return TERMINAL_APPROVAL_STATUSES.includes(status);
}

/**
 * Role used for RBAC on user_onboarding — snapshot at open, else live join fallback.
 *
 * @param {{ subject_user_role_snapshot?: string | null; subject_user_role?: string | null }} row
 * @returns {string | undefined}
 */
export function resolveSubjectUserRoleForRbac(row) {
  const snapshot = row?.subject_user_role_snapshot;
  if (typeof snapshot === "string" && snapshot.length > 0) return snapshot;
  const live = row?.subject_user_role;
  if (typeof live === "string" && live.length > 0) return live;
  return undefined;
}

/**
 * From approval_flow.md: "Approve Agent" for Employee is marked Optional.
 * Default false; set true if product enables employee-as-approver for agents.
 * @type {boolean}
 */
export const EMPLOYEE_MAY_APPROVE_AGENT = false;

/** Who may submit `generic` (operational) approval requests. */
const GENERIC_SUBMIT_ROLES = Object.freeze(["employee", "agent", "affiliate"]);

/** Who may open a `user_onboarding` ticket (e.g. after creating a CRM user). */
const USER_ONBOARDING_SUBMIT_ROLES = Object.freeze([
  "super_admin",
  "admin",
  "employee",
]);

/**
 * New CRM users in these roles get an automatic user_onboarding approval ticket.
 * (super_admin seed script bypasses userService.createUser.)
 */
export const ROLES_REQUIRING_ONBOARDING_APPROVAL = Object.freeze([
  "super_admin",
  "admin",
  "employee",
  "agent",
  "affiliate",
]);

/**
 * @param {string | undefined} role
 * @returns {boolean}
 */
export function roleRequiresOnboardingApproval(role) {
  return (
    typeof role === "string" &&
    ROLES_REQUIRING_ONBOARDING_APPROVAL.includes(role)
  );
}

/** Roles that act as org-wide moderators for approval queues (v1). */
const APPROVAL_QUEUE_MODERATOR_ROLES = Object.freeze(["super_admin", "admin"]);

/**
 * @param {string | undefined} actorRole
 * @param {ApprovalRequestKind} kind
 * @returns {boolean}
 */
export function canSubmitApprovalRequest(actorRole, kind) {
  if (!isKnownRole(actorRole)) return false;
  if (kind === "generic") return GENERIC_SUBMIT_ROLES.includes(actorRole);
  if (kind === "user_onboarding") return USER_ONBOARDING_SUBMIT_ROLES.includes(actorRole);
  return false;
}

/**
 * May this actor approve or reject **user-onboarding**, based on the subject user's CRM role?
 *
 * | Subject role   | Approvers (default)        |
 * |----------------|----------------------------|
 * | admin, super_admin | super_admin only      |
 * | employee       | super_admin, admin         |
 * | agent, affiliate | super_admin, admin (+ optional employee → agent) |
 *
 * @param {string | undefined} actorRole
 * @param {string | undefined} subjectUserRole
 * @returns {boolean}
 */
export function canApproveOrRejectUserOnboarding(actorRole, subjectUserRole) {
  if (!isKnownRole(actorRole) || !isKnownRole(subjectUserRole)) return false;

  if (subjectUserRole === "super_admin" || subjectUserRole === "admin") {
    return actorRole === "super_admin";
  }

  if (subjectUserRole === "employee") {
    return actorRole === "super_admin" || actorRole === "admin";
  }

  if (subjectUserRole === "agent" || subjectUserRole === "affiliate") {
    if (actorRole === "super_admin" || actorRole === "admin") return true;
    if (EMPLOYEE_MAY_APPROVE_AGENT && actorRole === "employee") return true;
    return false;
  }

  return false;
}

/**
 * Super Admin / Admin may drive generic requests through review and completion.
 * @param {string | undefined} actorRole
 * @returns {boolean}
 */
export function canModerateGenericApproval(actorRole) {
  return isKnownRole(actorRole) && APPROVAL_QUEUE_MODERATOR_ROLES.includes(actorRole);
}

/**
 * Super Admin / Admin review (approve/reject) uploaded verification documents.
 * @param {string | undefined} actorRole
 * @returns {boolean}
 */
export function canModerateDocumentVerification(actorRole) {
  return isKnownRole(actorRole) && APPROVAL_QUEUE_MODERATOR_ROLES.includes(actorRole);
}

/**
 * @param {string | undefined} actorRole
 * @returns {boolean}
 */
export function canViewApprovalQueues(actorRole) {
  return isKnownRole(actorRole) && APPROVAL_QUEUE_MODERATOR_ROLES.includes(actorRole);
}

/**
 * @param {string | undefined} actorRole
 * @returns {boolean}
 */
export function canAssignReviewer(actorRole) {
  return isKnownRole(actorRole) && APPROVAL_QUEUE_MODERATOR_ROLES.includes(actorRole);
}

/** @type {ReadonlyArray<readonly [ApprovalRequestStatus, ApprovalRequestStatus]>} */
const LEGAL_TRANSITIONS = Object.freeze([
  ["pending", "in_review"],
  ["pending", "rejected"],
  ["pending", "cancelled"],
  ["in_review", "approved"],
  ["in_review", "rejected"],
  ["in_review", "pending"],
  ["in_review", "cancelled"],
  ["approved", "completed"],
]);

const transitionKey = (from, to) => `${from}→${to}`;

const LEGAL_TRANSITION_SET = new Set(
  LEGAL_TRANSITIONS.map(([from, to]) => transitionKey(from, to))
);

/**
 * @param {ApprovalRequestStatus | null | undefined} fromStatus
 * @param {ApprovalRequestStatus} toStatus
 * @returns {boolean}
 */
export function isLegalStatusTransition(fromStatus, toStatus) {
  const from = fromStatus ?? "pending";
  return LEGAL_TRANSITION_SET.has(transitionKey(from, toStatus));
}

/**
 * Whether this actor may apply a transition. Row-level checks (assignee, ownership)
 * belong in the service layer — pass `isActorRequester` for cancel semantics.
 *
 * @param {object} params
 * @param {string | undefined} params.actorRole
 * @param {ApprovalRequestKind} params.kind
 * @param {string | undefined} [params.subjectUserRole] — subject CRM role when kind === 'user_onboarding'
 * @param {ApprovalRequestStatus | null | undefined} params.fromStatus
 * @param {ApprovalRequestStatus} params.toStatus
 * @param {boolean} [params.isActorRequester]
 * @returns {boolean}
 */
export function canApplyApprovalTransition({
  actorRole,
  kind,
  subjectUserRole,
  fromStatus,
  toStatus,
  isActorRequester = false,
}) {
  if (!isKnownRole(actorRole) || !isLegalStatusTransition(fromStatus, toStatus)) {
    return false;
  }

  if (toStatus === "cancelled") {
    return (
      isActorRequester ||
      actorRole === "super_admin" ||
      actorRole === "admin"
    );
  }

  if (kind === "generic") {
    return canModerateGenericApproval(actorRole);
  }

  if (kind === "document_verification") {
    // Document review is moderator-driven through the full lifecycle.
    return canModerateDocumentVerification(actorRole);
  }

  if (kind === "user_onboarding") {
    if (!isKnownRole(subjectUserRole)) return false;

    if (toStatus === "in_review" || toStatus === "pending") {
      return canViewApprovalQueues(actorRole);
    }

    if (toStatus === "rejected" || toStatus === "approved" || toStatus === "completed") {
      return canApproveOrRejectUserOnboarding(actorRole, subjectUserRole);
    }
  }

  return false;
}
