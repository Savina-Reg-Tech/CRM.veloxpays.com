import { describe, it, expect, beforeAll, beforeEach, vi } from "vitest";
import jwt from "jsonwebtoken";
import { sessionVersion } from "../src/utils/generateToken.js";

// Same approach as authRoutes.test.js: stub the DB before any app code imports it.
const mockQuery = vi.fn();
const mockClient = { query: vi.fn(), release: vi.fn() };
vi.mock("../config/db.js", () => ({
  query: (...args) => mockQuery(...args),
  getClient: vi.fn(async () => mockClient),
  default: {},
}));

const SECRET = "test-secret-do-not-use-in-prod";
let app;
let request;
let parseTrustProxy;
let decodeProxyPath;
let isAwaitingVerification;
let isAllowedWhileUnverified;

beforeAll(async () => {
  process.env.JWT_SECRET = SECRET;
  process.env.NODE_ENV = "test";
  delete process.env.TRUST_PROXY;
  const appModule = await import("../src/app.js");
  app = appModule.default;
  parseTrustProxy = appModule.parseTrustProxy;
  ({ decodeProxyPath } = await import("../src/middleware/veloxverseProxy.js"));
  ({ isAwaitingVerification, isAllowedWhileUnverified } = await import("../src/middleware/auth.js"));
  request = (await import("supertest")).default;
});

beforeEach(() => {
  mockQuery.mockReset();
  mockClient.query.mockReset();
});

const tokenFor = (id) => jwt.sign({ id, sv: sessionVersion("hash") }, SECRET, { algorithm: "HS256", expiresIn: "5m" });
const userRow = (over = {}) => ({
  id: 7,
  name: "Sam",
  email: "sam@example.com",
  role: "employee",
  is_active: true,
  account_status: "active",
  password: "hash",
  ...over,
});
/** Every query resolves to the acting user (authenticate's lookup) unless a test says otherwise. */
const actAs = (user) => mockQuery.mockImplementation(async () => ({ rows: [user], rowCount: 1 }));

// ── 1. user_onboarding tickets cannot be opened by hand ─────────────────────
describe("POST /api/approvals — user_onboarding", () => {
  it.each(["employee", "admin", "super_admin"])(
    "refuses a hand-opened user_onboarding ticket from %s (was: deactivate anyone by cancelling it)",
    async (role) => {
      actAs(userRow({ role }));
      const res = await request(app)
        .post("/api/approvals")
        .set("Authorization", `Bearer ${tokenFor(7)}`)
        .send({ kind: "user_onboarding", title: "x", subject_user_id: 1 });

      expect(res.status).toBe(403);
      // Nothing was written.
      expect(mockClient.query).not.toHaveBeenCalled();
    }
  );
});

// ── 2. proxy path handling ──────────────────────────────────────────────────
describe("decodeProxyPath", () => {
  it("returns the decoded path for ordinary paths", () => {
    expect(decodeProxyPath("/admin/audit/events")).toBe("/admin/audit/events");
    expect(decodeProxyPath("/admin/audit/bookings/payment/ORD%20123")).toBe("/admin/audit/bookings/payment/ORD 123");
  });

  it.each(["/admin/audit/%2e%2e/users", "/admin/audit/../users", "/a/./b", "/a%2fb", "/a%5cb", "/a//b", "/a/%zz", "/a/%00", "admin"])(
    "rejects %s",
    (path) => {
      expect(decodeProxyPath(path)).toBeNull();
    }
  );
});

describe("VeloxVerse proxy — path tricks", () => {
  it("support cannot leave the audit log through dot segments", async () => {
    actAs(userRow({ role: "support" }));
    const res = await request(app)
      .get("/api/vv-admin/admin/audit/%2e%2e/users")
      .set("Authorization", `Bearer ${tokenFor(7)}`);
    expect(res.status).toBe(403);
  });

  it("support cannot reach other VeloxVerse admin endpoints directly either", async () => {
    actAs(userRow({ role: "support" }));
    const res = await request(app).get("/api/vv-admin/admin/users").set("Authorization", `Bearer ${tokenFor(7)}`);
    expect(res.status).toBe(403);
  });
});

// ── 3. rate limits key on the real client address ───────────────────────────
describe("trust proxy", () => {
  it("defaults to one hop and never trusts every hop", () => {
    expect(parseTrustProxy(undefined)).toBe(1);
    expect(parseTrustProxy("")).toBe(1);
    expect(parseTrustProxy("true")).toBe(1);
    expect(parseTrustProxy("2")).toBe(2);
    expect(parseTrustProxy("0")).toBe(0);
    expect(parseTrustProxy("false")).toBe(false);
    expect(parseTrustProxy("10.0.0.0/8, 172.16.0.1")).toEqual(["10.0.0.0/8", "172.16.0.1"]);
    expect(app.get("trust proxy")).toBe(1);
  });

  it("a spoofed X-Forwarded-For no longer resets the login limit", async () => {
    mockQuery.mockResolvedValue({ rows: [], rowCount: 0 }); // unknown email → 401 each time
    const statuses = [];
    for (let i = 0; i < 12; i++) {
      // Attacker rotates the left-most entry; the load balancer appends the real address.
      const res = await request(app)
        .post("/api/auth/login")
        .set("X-Forwarded-For", `198.51.100.${i}, 203.0.113.9`)
        .send({ email: `ghost${i}@example.com`, password: "Whatever123!" });
      statuses.push(res.status);
    }
    expect(statuses.slice(0, 10).every((s) => s === 401)).toBe(true);
    expect(statuses.slice(10)).toEqual([429, 429]);
  });
});

describe("POST /api/auth/reset-password — guess limit", () => {
  it("spends the attempt atomically and stops when none are left", async () => {
    const calls = [];
    mockQuery.mockImplementation(async (sql, params) => {
      calls.push(sql);
      if (/FROM users/i.test(sql)) return { rows: [userRow()], rowCount: 1 };
      if (/FROM password_resets/i.test(sql)) {
        return { rows: [{ id: 3, user_id: 7, otp_hash: "x", attempts: 0 }], rowCount: 1 };
      }
      if (/SET attempts = attempts \+ 1/i.test(sql)) {
        expect(sql).toMatch(/attempts < \$2/);
        expect(params).toEqual([3, 5]);
        return { rows: [], rowCount: 0 }; // another request already used the last guess
      }
      return { rows: [], rowCount: 0 };
    });

    const res = await request(app)
      .post("/api/auth/reset-password")
      .set("X-Forwarded-For", "203.0.113.20")
      .send({ email: "sam@example.com", otp: "123456", newPassword: "Str0ng!Passw0rd" });

    expect(res.status).toBe(400);
    expect(calls.some((sql) => /UPDATE users/i.test(sql))).toBe(false); // password untouched
  });

  it("limits reset-code requests per account, whatever address they come from", async () => {
    mockQuery.mockResolvedValue({ rows: [], rowCount: 0 });
    const statuses = [];
    for (let i = 0; i < 4; i++) {
      const res = await request(app)
        .post("/api/auth/forgot-password")
        .set("X-Forwarded-For", `203.0.113.${100 + i}`)
        .send({ email: " Victim@Example.com " });
      statuses.push(res.status);
    }
    expect(statuses).toEqual([200, 200, 200, 429]);
  });
});

// ── 4. unverified accounts are confined to the verification flow ────────────
describe("verification gate", () => {
  it("knows who is awaiting verification", () => {
    expect(isAwaitingVerification({ role: "employee", account_status: "pending" })).toBe(true);
    expect(isAwaitingVerification({ role: "agent", account_status: "pending" })).toBe(true);
    expect(isAwaitingVerification({ role: "employee", account_status: "active" })).toBe(false);
    expect(isAwaitingVerification({ role: "admin", account_status: "pending" })).toBe(false);
    expect(isAwaitingVerification({ role: "support", account_status: "pending" })).toBe(false);
  });

  it("only opens session, verification and notification routes to them", () => {
    for (const ok of ["/api/auth/me", "/api/verification/documents?x=1", "/api/notifications", "/api/notifications/unread-count"]) {
      expect(isAllowedWhileUnverified(ok)).toBe(true);
    }
    for (const no of ["/api/customers", "/api/users/1", "/api/approvals", "/api/forms", "/api/vv-admin/admin/users", "/api/verificationx", "/api/authx/me"]) {
      expect(isAllowedWhileUnverified(no)).toBe(false);
    }
  });

  it.each(["/api/customers", "/api/users", "/api/approvals", "/api/services", "/api/forms"])(
    "refuses %s for a pending employee",
    async (path) => {
      actAs(userRow({ account_status: "pending" }));
      const res = await request(app).get(path).set("Authorization", `Bearer ${tokenFor(7)}`);
      expect(res.status).toBe(403);
      expect(res.body.code).toBe("VERIFICATION_REQUIRED");
    }
  );

  it("still lets a pending employee load their session", async () => {
    actAs(userRow({ account_status: "pending" }));
    const res = await request(app).get("/api/auth/me").set("Authorization", `Bearer ${tokenFor(7)}`);
    expect(res.status).toBe(200);
  });

  it("does not gate an activated employee", async () => {
    actAs(userRow({ account_status: "active" }));
    const res = await request(app).get("/api/approvals").set("Authorization", `Bearer ${tokenFor(7)}`);
    expect(res.body.code).not.toBe("VERIFICATION_REQUIRED");
  });
});
