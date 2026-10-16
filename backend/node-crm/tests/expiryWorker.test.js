import { describe, it, expect, beforeEach, vi } from "vitest";

// The daily sweep expires accounts that never finished verification — not accounts whose
// documents are all in and simply waiting for a moderator.

const client = { query: vi.fn(), release: vi.fn() };
vi.mock("../config/db.js", () => ({ query: vi.fn(), getClient: async () => client, default: {} }));

const candidates = vi.fn();
const setAccountStatus = vi.fn();
vi.mock("../src/models/User.js", () => ({
  default: {
    findExpiryCandidates: (...a) => candidates(...a),
    setAccountStatus: (...a) => setAccountStatus(...a),
  },
}));

const docsByUser = new Map();
vi.mock("../src/models/VerificationDocument.js", () => ({
  default: {
    findLiveByUser: async (id) => docsByUser.get(id) ?? [],
    archiveAllForUser: async () => [],
  },
}));
vi.mock("../src/models/ApprovalRequest.js", () => ({
  default: { findOpenOnboardingByUser: async () => null },
}));

const notify = vi.fn();
vi.mock("../src/services/notificationService.js", () => ({ notify: (...a) => notify(...a) }));

const { runExpirySweep, runExpiryWarnings } = await import("../src/jobs/expiryWorker.js");

const EMPLOYEE_REQUIRED = ["passport", "driving_license", "proof_of_address", "experience_letter", "police_verification"];
const docs = (status, types = EMPLOYEE_REQUIRED) => types.map((doc_type, i) => ({ id: i + 1, doc_type, status }));
const employee = (id) => ({ id, name: `U${id}`, email: `u${id}@example.com`, role: "employee" });

/** Every account is still pending when the sweep re-reads it, unless listed in `activated`. */
const dbState = ({ activated = [] } = {}) =>
  client.query.mockImplementation(async (sql, params) => {
    if (/FOR UPDATE/.test(sql)) {
      return { rows: [{ account_status: activated.includes(params[0]) ? "active" : "pending" }] };
    }
    return { rows: [] };
  });

beforeEach(() => {
  vi.clearAllMocks();
  docsByUser.clear();
  vi.spyOn(console, "error").mockImplementation(() => {});
  dbState();
});

describe("expiry sweep", () => {
  it("expires an account that never uploaded its documents", async () => {
    candidates.mockResolvedValue([employee(1)]);
    expect(await runExpirySweep()).toBe(1);
    expect(setAccountStatus).toHaveBeenCalledWith(1, "expired", { client });
  });

  it("expires an account that uploaded only some documents", async () => {
    candidates.mockResolvedValue([employee(1)]);
    docsByUser.set(1, docs("pending", ["passport"]));
    expect(await runExpirySweep()).toBe(1);
  });

  it("expires an account with a rejected document it never replaced", async () => {
    candidates.mockResolvedValue([employee(1)]);
    docsByUser.set(1, [...docs("approved").slice(1), { id: 9, doc_type: "passport", status: "rejected" }]);
    expect(await runExpirySweep()).toBe(1);
  });

  it("spares an account whose documents are all in and awaiting review", async () => {
    candidates.mockResolvedValue([employee(1)]);
    docsByUser.set(1, [...docs("in_review").slice(0, 2), ...docs("pending").slice(2)]);
    expect(await runExpirySweep()).toBe(0);
    expect(setAccountStatus).not.toHaveBeenCalled();
  });

  it("does not expire an account a moderator activated after the list was built", async () => {
    candidates.mockResolvedValue([employee(1)]);
    dbState({ activated: [1] });
    expect(await runExpirySweep()).toBe(0);
    expect(setAccountStatus).not.toHaveBeenCalled();
  });

  it("keeps going when one notification fails", async () => {
    candidates.mockResolvedValue([employee(1), employee(2)]);
    notify.mockRejectedValueOnce(new Error("notifications table locked"));
    expect(await runExpirySweep()).toBe(2);
    expect(notify).toHaveBeenCalledTimes(2);
  });
});

describe("24-hour warning", () => {
  it("is not sent to accounts only waiting on a moderator", async () => {
    candidates.mockResolvedValue([employee(1), employee(2)]);
    docsByUser.set(1, docs("in_review"));
    expect(await runExpiryWarnings()).toBe(1);
    expect(notify).toHaveBeenCalledTimes(1);
    expect(notify.mock.calls[0][0].recipient.id).toBe(2);
  });
});
