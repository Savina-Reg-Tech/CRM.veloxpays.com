import { describe, it, expect, vi } from "vitest";
import { auditSupportGuard, AUDIT_SUPPORT_ROLE } from "../src/middleware/auditSupportGuard.js";
import { ALLOWED_ROLES, ROLE_CREATION_MATRIX } from "../src/config/crmRoles.js";
import { canApproveOrRejectUserOnboarding, ROLES_REQUIRING_ONBOARDING_APPROVAL } from "../src/config/approvalRbac.js";

function run(role, method, path) {
  const req = { user: { role }, method, path };
  const res = { status: vi.fn().mockReturnThis(), json: vi.fn().mockReturnThis() };
  const next = vi.fn();
  auditSupportGuard(req, res, next);
  return { next, res };
}

describe("auditSupportGuard (support = read-only audit log)", () => {
  it.each(["/events", "/events/abc", "/trace/c69b661dbe6e1615", "/journeys/x", "/stuck", "/errors/summary", "/funnels", "/daily-summaries", "/alerts", "/meta", "/users/u1/timeline"])(
    "lets support GET %s",
    (path) => {
      const { next, res } = run(AUDIT_SUPPORT_ROLE, "GET", path);
      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    }
  );

  it.each([
    ["GET", "/settings"],
    ["PUT", "/settings"],
    ["GET", "/alert-recipients"],
    ["POST", "/alert-recipients"],
    ["POST", "/alert-recipients/abc/test"],
    ["DELETE", "/alert-recipients/abc"],
    ["GET", "/export.csv"],
  ])("blocks support %s %s with 403", (method, path) => {
    const { next, res } = run(AUDIT_SUPPORT_ROLE, method, path);
    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(403);
  });

  it.each(["super_admin", "admin"])("never restricts %s", (role) => {
    for (const [m, p] of [["PUT", "/settings"], ["GET", "/export.csv"], ["POST", "/alert-recipients"]]) {
      expect(run(role, m, p).next).toHaveBeenCalled();
    }
  });
});

describe("support role", () => {
  it("is a known CRM role that only super admins and admins can create", () => {
    expect(ALLOWED_ROLES).toContain("support");
    expect(ROLE_CREATION_MATRIX.super_admin).toContain("support");
    expect(ROLE_CREATION_MATRIX.admin).toContain("support");
    expect(ROLE_CREATION_MATRIX.employee).not.toContain("support");
  });

  it("goes through onboarding approval by super admin / admin", () => {
    expect(ROLES_REQUIRING_ONBOARDING_APPROVAL).toContain("support");
    expect(canApproveOrRejectUserOnboarding("super_admin", "support")).toBe(true);
    expect(canApproveOrRejectUserOnboarding("admin", "support")).toBe(true);
    expect(canApproveOrRejectUserOnboarding("employee", "support")).toBe(false);
    expect(canApproveOrRejectUserOnboarding("support", "employee")).toBe(false);
  });
});
