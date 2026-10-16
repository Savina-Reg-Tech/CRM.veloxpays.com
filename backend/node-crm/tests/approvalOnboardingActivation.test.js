import { describe, it, expect, beforeEach, vi } from "vitest";

// What an onboarding ticket's outcome does to its subject's is_active flag.

const client = { query: vi.fn(async () => ({ rows: [] })), release: vi.fn() };
vi.mock("../config/db.js", () => ({ query: vi.fn(), getClient: async () => client, default: {} }));

const setActive = vi.fn();
vi.mock("../src/models/User.js", () => ({
  default: {
    setActive: (...a) => setActive(...a),
    findById: async (id) => ({ id, email: `user${id}@example.com` }),
  },
}));

let ticket;
vi.mock("../src/models/ApprovalRequest.js", () => ({
  default: {
    findById: async () => ticket,
    updateStatus: async () => ({ ...ticket }),
    insertAction: async () => ({}),
  },
}));

const { transitionApprovalRequest } = await import("../src/services/approvalService.js");

const SUBJECT_ID = 7;

describe("onboarding ticket outcomes → subject activation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    ticket = {
      id: 1,
      kind: "user_onboarding",
      status: "in_review",
      requester_id: 99,
      subject_user_id: SUBJECT_ID,
      subject_user_role_snapshot: "employee",
    };
  });

  it("an admin approving does not re-activate a deactivated subject", async () => {
    await transitionApprovalRequest({ id: 2, role: "admin" }, 1, { to_status: "approved" });
    expect(setActive).not.toHaveBeenCalled();
  });

  it("a super_admin approving activates the subject", async () => {
    await transitionApprovalRequest({ id: 3, role: "super_admin" }, 1, { to_status: "approved" });
    expect(setActive).toHaveBeenCalledWith(SUBJECT_ID, true, { client });
  });

  it("an admin cannot cancel a super_admin's onboarding ticket", async () => {
    ticket.subject_user_role_snapshot = "super_admin";
    await expect(
      transitionApprovalRequest({ id: 2, role: "admin" }, 1, { to_status: "cancelled" })
    ).rejects.toMatchObject({ status: 403 });
    expect(setActive).not.toHaveBeenCalled();
  });

  it("rejecting still deactivates the subject", async () => {
    await transitionApprovalRequest({ id: 2, role: "admin" }, 1, { to_status: "rejected" });
    expect(setActive).toHaveBeenCalledWith(SUBJECT_ID, false, { client });
  });
});
