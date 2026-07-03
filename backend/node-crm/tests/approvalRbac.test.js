import { describe, it, expect } from "vitest";
import {
  canSubmitApprovalRequest,
  canApproveOrRejectUserOnboarding,
  canModerateGenericApproval,
  canViewApprovalQueues,
  canAssignReviewer,
  isLegalStatusTransition,
  isTerminalApprovalStatus,
  resolveSubjectUserRoleForRbac,
  canApplyApprovalTransition,
  TERMINAL_APPROVAL_STATUSES,
  roleRequiresOnboardingApproval,
  ROLES_REQUIRING_ONBOARDING_APPROVAL,
} from "../src/config/approvalRbac.js";

describe("approvalRbac — submit", () => {
  it("allows employee/agent/affiliate to submit generic requests", () => {
    expect(canSubmitApprovalRequest("employee", "generic")).toBe(true);
    expect(canSubmitApprovalRequest("agent", "generic")).toBe(true);
    expect(canSubmitApprovalRequest("affiliate", "generic")).toBe(true);
  });

  it("denies admin from submitting generic requests (moderators, not submitters)", () => {
    expect(canSubmitApprovalRequest("admin", "generic")).toBe(false);
    expect(canSubmitApprovalRequest("super_admin", "generic")).toBe(false);
  });

  it("allows super_admin, admin, employee to submit user_onboarding", () => {
    expect(canSubmitApprovalRequest("super_admin", "user_onboarding")).toBe(true);
    expect(canSubmitApprovalRequest("admin", "user_onboarding")).toBe(true);
    expect(canSubmitApprovalRequest("employee", "user_onboarding")).toBe(true);
  });

  it("denies agent/affiliate from opening user_onboarding tickets", () => {
    expect(canSubmitApprovalRequest("agent", "user_onboarding")).toBe(false);
    expect(canSubmitApprovalRequest("affiliate", "user_onboarding")).toBe(false);
  });
});

describe("approvalRbac — approve user onboarding by subject role", () => {
  it("only super_admin may approve onboarding for admin or super_admin subjects", () => {
    expect(canApproveOrRejectUserOnboarding("super_admin", "admin")).toBe(true);
    expect(canApproveOrRejectUserOnboarding("admin", "admin")).toBe(false);
    expect(canApproveOrRejectUserOnboarding("super_admin", "super_admin")).toBe(true);
    expect(canApproveOrRejectUserOnboarding("admin", "super_admin")).toBe(false);
  });

  it("super_admin and admin may approve employee subjects", () => {
    expect(canApproveOrRejectUserOnboarding("super_admin", "employee")).toBe(true);
    expect(canApproveOrRejectUserOnboarding("admin", "employee")).toBe(true);
    expect(canApproveOrRejectUserOnboarding("employee", "employee")).toBe(false);
  });

  it("super_admin and admin may approve agent / affiliate subjects", () => {
    expect(canApproveOrRejectUserOnboarding("admin", "agent")).toBe(true);
    expect(canApproveOrRejectUserOnboarding("admin", "affiliate")).toBe(true);
    expect(canApproveOrRejectUserOnboarding("employee", "agent")).toBe(false);
  });
});

describe("approvalRbac — moderators", () => {
  it("grants queue / assign / generic moderation to super_admin and admin only", () => {
    expect(canViewApprovalQueues("super_admin")).toBe(true);
    expect(canViewApprovalQueues("admin")).toBe(true);
    expect(canViewApprovalQueues("employee")).toBe(false);
    expect(canAssignReviewer("admin")).toBe(true);
    expect(canModerateGenericApproval("super_admin")).toBe(true);
    expect(canModerateGenericApproval("employee")).toBe(false);
  });
});

describe("approvalRbac — transitions", () => {
  it("isLegalStatusTransition accepts documented happy path", () => {
    expect(isLegalStatusTransition("pending", "in_review")).toBe(true);
    expect(isLegalStatusTransition("in_review", "approved")).toBe(true);
    expect(isLegalStatusTransition("approved", "completed")).toBe(true);
  });

  it("isLegalStatusTransition rejects impossible jumps", () => {
    expect(isLegalStatusTransition("pending", "completed")).toBe(false);
    expect(isLegalStatusTransition("rejected", "pending")).toBe(false);
  });

  it("canApplyApprovalTransition — cancel: requester or admin tier", () => {
    expect(
      canApplyApprovalTransition({
        actorRole: "employee",
        kind: "generic",
        fromStatus: "pending",
        toStatus: "cancelled",
        isActorRequester: true,
      })
    ).toBe(true);
    expect(
      canApplyApprovalTransition({
        actorRole: "employee",
        kind: "generic",
        fromStatus: "pending",
        toStatus: "cancelled",
        isActorRequester: false,
      })
    ).toBe(false);
    expect(
      canApplyApprovalTransition({
        actorRole: "admin",
        kind: "generic",
        fromStatus: "pending",
        toStatus: "cancelled",
        isActorRequester: false,
      })
    ).toBe(true);
  });

  it("canApplyApprovalTransition — generic staff moves require moderator", () => {
    expect(
      canApplyApprovalTransition({
        actorRole: "admin",
        kind: "generic",
        fromStatus: "pending",
        toStatus: "in_review",
      })
    ).toBe(true);
    expect(
      canApplyApprovalTransition({
        actorRole: "employee",
        kind: "generic",
        fromStatus: "pending",
        toStatus: "in_review",
      })
    ).toBe(false);
  });

  it("canApplyApprovalTransition — user_onboarding: staff pulls pending → in_review", () => {
    expect(
      canApplyApprovalTransition({
        actorRole: "admin",
        kind: "user_onboarding",
        subjectUserRole: "employee",
        fromStatus: "pending",
        toStatus: "in_review",
      })
    ).toBe(true);
    expect(
      canApplyApprovalTransition({
        actorRole: "employee",
        kind: "user_onboarding",
        subjectUserRole: "employee",
        fromStatus: "pending",
        toStatus: "in_review",
      })
    ).toBe(false);
  });

  it("canApplyApprovalTransition — user_onboarding: approve uses subject role matrix", () => {
    expect(
      canApplyApprovalTransition({
        actorRole: "admin",
        kind: "user_onboarding",
        subjectUserRole: "employee",
        fromStatus: "in_review",
        toStatus: "approved",
      })
    ).toBe(true);
    expect(
      canApplyApprovalTransition({
        actorRole: "admin",
        kind: "user_onboarding",
        subjectUserRole: "admin",
        fromStatus: "in_review",
        toStatus: "approved",
      })
    ).toBe(false);
  });
});

describe("approvalRbac — terminal states (AF-5)", () => {
  it("isTerminalApprovalStatus marks completed, rejected, cancelled", () => {
    expect(isTerminalApprovalStatus("completed")).toBe(true);
    expect(isTerminalApprovalStatus("rejected")).toBe(true);
    expect(isTerminalApprovalStatus("cancelled")).toBe(true);
    expect(isTerminalApprovalStatus("pending")).toBe(false);
    expect(isTerminalApprovalStatus("in_review")).toBe(false);
    expect(isTerminalApprovalStatus("approved")).toBe(false);
  });

  it("isLegalStatusTransition rejects any move from terminal statuses", () => {
    for (const terminal of TERMINAL_APPROVAL_STATUSES) {
      expect(isLegalStatusTransition(terminal, "pending")).toBe(false);
      expect(isLegalStatusTransition(terminal, "in_review")).toBe(false);
    }
  });
});

describe("approvalRbac — auto onboarding on user create", () => {
  it("roleRequiresOnboardingApproval for staff roles", () => {
    expect(roleRequiresOnboardingApproval("admin")).toBe(true);
    expect(roleRequiresOnboardingApproval("employee")).toBe(true);
    expect(roleRequiresOnboardingApproval("agent")).toBe(true);
    expect(roleRequiresOnboardingApproval("affiliate")).toBe(true);
    expect(roleRequiresOnboardingApproval("super_admin")).toBe(true);
  });

  it("ROLES_REQUIRING_ONBOARDING_APPROVAL lists all provisioned CRM roles", () => {
    expect(ROLES_REQUIRING_ONBOARDING_APPROVAL).toEqual([
      "super_admin",
      "admin",
      "employee",
      "agent",
      "affiliate",
    ]);
  });
});

describe("approvalRbac — subject role snapshot (AF-5)", () => {
  it("resolveSubjectUserRoleForRbac prefers snapshot over live join", () => {
    expect(
      resolveSubjectUserRoleForRbac({
        subject_user_role_snapshot: "employee",
        subject_user_role: "admin",
      })
    ).toBe("employee");
  });

  it("resolveSubjectUserRoleForRbac falls back to live role when snapshot missing", () => {
    expect(
      resolveSubjectUserRoleForRbac({
        subject_user_role_snapshot: null,
        subject_user_role: "agent",
      })
    ).toBe("agent");
  });
});
