import { describe, it, expect } from "vitest";
import {
  canModerateDocumentVerification,
  canApplyApprovalTransition,
} from "../src/config/approvalRbac.js";

describe("document_verification RBAC", () => {
  it("only super_admin/admin may moderate document verification", () => {
    expect(canModerateDocumentVerification("super_admin")).toBe(true);
    expect(canModerateDocumentVerification("admin")).toBe(true);
    expect(canModerateDocumentVerification("employee")).toBe(false);
    expect(canModerateDocumentVerification("agent")).toBe(false);
    expect(canModerateDocumentVerification("affiliate")).toBe(false);
  });

  it("moderators can move a document pending → in_review", () => {
    expect(
      canApplyApprovalTransition({
        actorRole: "admin",
        kind: "document_verification",
        fromStatus: "pending",
        toStatus: "in_review",
      })
    ).toBe(true);
  });

  it("moderators can approve / reject from in_review", () => {
    for (const to of ["approved", "rejected"]) {
      expect(
        canApplyApprovalTransition({
          actorRole: "super_admin",
          kind: "document_verification",
          fromStatus: "in_review",
          toStatus: to,
        })
      ).toBe(true);
    }
  });

  it("non-moderators cannot drive document verification", () => {
    expect(
      canApplyApprovalTransition({
        actorRole: "employee",
        kind: "document_verification",
        fromStatus: "pending",
        toStatus: "approved",
      })
    ).toBe(false);
  });
});
