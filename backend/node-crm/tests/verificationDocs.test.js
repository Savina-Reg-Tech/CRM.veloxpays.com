import { describe, it, expect } from "vitest";
import {
  ROLE_REQUIRED_DOCUMENTS,
  roleRequiresVerification,
  getRoleDocumentSpec,
  getAllowedDocTypes,
  isDocTypeAllowedForRole,
  docLabel,
  VERIFICATION_WINDOW_DAYS,
} from "../src/config/verificationDocs.js";

describe("verificationDocs — role requirements", () => {
  it("requires verification for employee/agent/affiliate only", () => {
    expect(roleRequiresVerification("employee")).toBe(true);
    expect(roleRequiresVerification("agent")).toBe(true);
    expect(roleRequiresVerification("affiliate")).toBe(true);
    expect(roleRequiresVerification("admin")).toBe(false);
    expect(roleRequiresVerification("super_admin")).toBe(false);
    expect(roleRequiresVerification(undefined)).toBe(false);
  });

  it("employees need the 5 documents from the spec", () => {
    expect(ROLE_REQUIRED_DOCUMENTS.employee.required).toEqual([
      "passport",
      "driving_license",
      "proof_of_address",
      "experience_letter",
      "police_verification",
    ]);
  });

  it("agents need personal + business documents", () => {
    const required = ROLE_REQUIRED_DOCUMENTS.agent.required;
    expect(required).toContain("business_registration");
    expect(required).toContain("trade_license");
    expect(required).toContain("passport");
    expect(required.length).toBe(10);
  });

  it("affiliate business document is optional, not required", () => {
    expect(ROLE_REQUIRED_DOCUMENTS.affiliate.required).not.toContain("business_account_details");
    expect(ROLE_REQUIRED_DOCUMENTS.affiliate.optional).toContain("business_account_details");
  });

  it("admins/super-admins require no documents", () => {
    expect(getRoleDocumentSpec("admin").required).toEqual([]);
    expect(getRoleDocumentSpec("super_admin").required).toEqual([]);
  });
});

describe("verificationDocs — doc-type validation", () => {
  it("accepts allowed types for a role and rejects others", () => {
    expect(isDocTypeAllowedForRole("employee", "passport")).toBe(true);
    expect(isDocTypeAllowedForRole("employee", "trade_license")).toBe(false);
    expect(isDocTypeAllowedForRole("affiliate", "business_account_details")).toBe(true); // optional allowed
    expect(isDocTypeAllowedForRole("agent", "not_a_doc")).toBe(false);
  });

  it("getAllowedDocTypes includes both required and optional", () => {
    const allowed = getAllowedDocTypes("affiliate");
    expect(allowed).toContain("passport");
    expect(allowed).toContain("business_account_details");
  });

  it("docLabel falls back to the raw key", () => {
    expect(docLabel("passport")).toBe("Passport");
    expect(docLabel("mystery")).toBe("mystery");
  });

  it("exposes a 7-day verification window", () => {
    expect(VERIFICATION_WINDOW_DAYS).toBe(7);
  });
});
