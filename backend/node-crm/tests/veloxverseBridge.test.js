import { describe, it, expect, beforeAll, beforeEach, vi } from "vitest";
import jwt from "jsonwebtoken";
import { sessionVersion } from "../src/utils/generateToken.js";

const mockQuery = vi.fn();
vi.mock("../config/db.js", () => ({
  query: (...args) => mockQuery(...args),
  getClient: vi.fn(),
  default: {},
}));

// Capture what the proxy sends to VeloxVerse, and script what VeloxVerse answers.
const upstream = vi.fn();
vi.mock("axios", () => ({ default: (config) => upstream(config) }));

const SECRET = "test-secret-do-not-use-in-prod";
let app;
let request;

beforeAll(async () => {
  process.env.JWT_SECRET = SECRET;
  process.env.NODE_ENV = "test";
  delete process.env.VELOXVERSE_BRIDGE_USER_EMAIL;
  delete process.env.VELOXVERSE_BRIDGE_EMAIL_MAP;
  app = (await import("../src/app.js")).default;
  request = (await import("supertest")).default;
});

beforeEach(() => {
  mockQuery.mockReset();
  upstream.mockReset();
  upstream.mockResolvedValue({ status: 200, data: { success: true, data: {} }, headers: {} });
});

const dbUser = (over = {}) => ({ id: 7, name: "Sam", email: "sam@crm.example", role: "admin", is_active: true, account_status: "active", password: "hash", ...over });
const actAs = (user) => mockQuery.mockResolvedValue({ rows: [user], rowCount: 1 });
/** The session cookie as the browser holds it — its role claim may be days old. */
const sessionCookie = (claims) => `velox_token=${jwt.sign({ sv: sessionVersion("hash"), ...claims }, SECRET, { algorithm: "HS256", expiresIn: "7d" })}`;
const forwarded = () => {
  const config = upstream.mock.calls[0][0];
  const token = config.headers.Authorization.replace(/^Bearer /, "");
  return { config, claims: jwt.verify(token, SECRET, { algorithms: ["HS256"] }) };
};

describe("VeloxVerse bridge — who the CRM says is acting", () => {
  it("sends the user's CURRENT role from the database, not the role in an old session cookie", async () => {
    // Was a super admin when they logged in; has since been made an admin in the CRM.
    actAs(dbUser({ role: "admin" }));
    await request(app)
      .patch("/api/vv-admin/admin/users/u-1/role")
      .set("Cookie", sessionCookie({ id: 7, role: "super_admin" }))
      .send({ role: "SUPER_ADMIN" });

    const { claims, config } = forwarded();
    expect(claims.role).toBe("admin");
    expect(claims.id).toBe(7);
    // …and it is not the browser's own cookie being passed along.
    expect(config.headers.Authorization).not.toContain(sessionCookie({ id: 7, role: "super_admin" }).split("=")[1]);
    expect(claims.exp - claims.iat).toBe(900);
  });

  it("takes the acting email from the CRM session only — never from the browser", async () => {
    actAs(dbUser());
    await request(app)
      .patch("/api/vv-admin/admin/users/u-1/status?email=boss@crm.example&x-crm-user-email=boss@crm.example")
      .set("Cookie", sessionCookie({ id: 7, role: "admin" }))
      .set("X-CRM-User-Email", "boss@crm.example")
      .send({ isActive: false, email: "boss@crm.example", crmUserEmail: "boss@crm.example" });

    const { config } = forwarded();
    expect(config.headers["X-CRM-User-Email"]).toBe("sam@crm.example");
    // The body is passed on untouched; it just can't change who is acting.
    expect(config.data).toEqual({ isActive: false, email: "boss@crm.example", crmUserEmail: "boss@crm.example" });
  });

  it("works for a Bearer-token API client too, with the same database-backed role", async () => {
    actAs(dbUser({ role: "super_admin" }));
    await request(app)
      .get("/api/vv-admin/admin/users")
      .set("Authorization", `Bearer ${jwt.sign({ id: 7, role: "admin", sv: sessionVersion("hash") }, SECRET, { algorithm: "HS256" })}`);
    expect(forwarded().claims.role).toBe("super_admin");
  });
});

describe("VeloxVerse bridge — refusals reach the admin unchanged", () => {
  it.each([
    [403, "Only a super admin can change a user's role."],
    [403, "Only a super admin can activate or deactivate an admin, super admin or support account."],
    [400, "This is the last active super admin. Make another account a super admin first."],
    [400, "You cannot change your own status or role."],
  ])("passes %i \"%s\" through with its status and message", async (status, message) => {
    actAs(dbUser());
    upstream.mockResolvedValue({ status, data: { success: false, message }, headers: {} });
    const res = await request(app)
      .patch("/api/vv-admin/admin/users/u-1/role")
      .set("Cookie", sessionCookie({ id: 7, role: "admin" }))
      .send({ role: "ADMIN" });
    expect(res.status).toBe(status);
    expect(res.body.message).toBe(message);
  });

  it("still never forwards a VeloxVerse 401 as 401 (that would log the admin out of the CRM)", async () => {
    actAs(dbUser());
    upstream.mockResolvedValue({ status: 401, data: { success: false, message: "Invalid or expired token." }, headers: {} });
    const res = await request(app).get("/api/vv-admin/admin/users").set("Cookie", sessionCookie({ id: 7, role: "admin" }));
    expect(res.status).toBe(502);
  });
});

describe("VeloxVerse bridge — the token itself", () => {
  it("always expires, 15 minutes after it was issued, and is HS256", async () => {
    actAs(dbUser());
    await request(app).get("/api/vv-admin/admin/analytics/overview").set("Cookie", sessionCookie({ id: 7, role: "admin" }));
    const { claims, config } = forwarded();
    expect(claims.exp - claims.iat).toBe(900);
    expect(Math.abs(claims.iat - Math.floor(Date.now() / 1000))).toBeLessThan(5);
    const header = JSON.parse(Buffer.from(config.headers.Authorization.split(" ")[1].split(".")[0], "base64url").toString());
    expect(header).toEqual({ alg: "HS256", typ: "JWT" });
  });

  it("carries the acting user's email inside the signature — the same value as the header", async () => {
    actAs(dbUser({ email: "sam@crm.example" }));
    await request(app)
      .get("/api/vv-admin/admin/users?email=boss@crm.example")
      .set("Cookie", sessionCookie({ id: 7, role: "admin", email: "boss@crm.example" }))
      .set("X-CRM-User-Email", "boss@crm.example");
    const { claims, config } = forwarded();
    expect(claims.email).toBe("sam@crm.example");
    expect(config.headers["X-CRM-User-Email"]).toBe("sam@crm.example");
  });

  it("signs a new token for every request and never hands it to the browser", async () => {
    actAs(dbUser());
    upstream.mockResolvedValue({ status: 200, data: { success: true, data: {} }, headers: {} });
    const res = await request(app).get("/api/vv-admin/admin/users").set("Cookie", sessionCookie({ id: 7, role: "admin" }));
    await new Promise((r) => setTimeout(r, 1100));
    await request(app).get("/api/vv-admin/admin/users").set("Cookie", sessionCookie({ id: 7, role: "admin" }));
    const [first, second] = upstream.mock.calls.map((c) => c[0].headers.Authorization);
    expect(first).not.toBe(second);
    const token = first.replace("Bearer ", "");
    expect(JSON.stringify(res.body)).not.toContain(token);
    expect(JSON.stringify(res.headers)).not.toContain(token);
  });

  it("adds iss / aud only when both sides have agreed to (env set)", async () => {
    actAs(dbUser());
    await request(app).get("/api/vv-admin/admin/users").set("Cookie", sessionCookie({ id: 7, role: "admin" }));
    expect(forwarded().claims.iss).toBeUndefined();
    expect(forwarded().claims.aud).toBeUndefined();

    upstream.mockClear();
    process.env.VELOXVERSE_BRIDGE_ISSUER = "velox-crm";
    process.env.VELOXVERSE_BRIDGE_AUDIENCE = "veloxverse";
    try {
      await request(app).get("/api/vv-admin/admin/users").set("Cookie", sessionCookie({ id: 7, role: "admin" }));
      expect(forwarded().claims).toMatchObject({ iss: "velox-crm", aud: "veloxverse" });
    } finally {
      delete process.env.VELOXVERSE_BRIDGE_ISSUER;
      delete process.env.VELOXVERSE_BRIDGE_AUDIENCE;
    }
  });
});

describe("VeloxVerse bridge — a 401 from VeloxVerse", () => {
  it("re-signs and retries once; a success on the retry is returned normally", async () => {
    actAs(dbUser());
    upstream
      .mockResolvedValueOnce({ status: 401, data: { success: false, message: "Invalid or expired token." }, headers: {} })
      .mockResolvedValueOnce({ status: 200, data: { success: true, data: { ok: 1 } }, headers: {} });
    const res = await request(app).put("/api/vv-admin/admin/points/settings").set("Cookie", sessionCookie({ id: 7, role: "admin" })).send({ minRedeemPoints: 500 });
    expect(upstream).toHaveBeenCalledTimes(2);
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ ok: 1 });
    // The retry carries the same request, with a properly signed token again.
    expect(upstream.mock.calls[1][0].data).toEqual({ minRedeemPoints: 500 });
    expect(jwt.verify(upstream.mock.calls[1][0].headers.Authorization.replace("Bearer ", ""), SECRET).role).toBe("admin");
  });

  it("gives up after one retry with a clear message — no loop, no blank screen, no token in the answer or the log", async () => {
    actAs(dbUser());
    const logged = [];
    const spy = vi.spyOn(console, "error").mockImplementation((...a) => logged.push(a.join(" ")));
    upstream.mockResolvedValue({ status: 401, data: { success: false, requestId: "req-9", message: "Invalid or expired token." }, headers: {} });
    const res = await request(app).get("/api/vv-admin/admin/users").set("Cookie", sessionCookie({ id: 7, role: "admin" }));
    spy.mockRestore();

    expect(upstream).toHaveBeenCalledTimes(2);
    expect(res.status).toBe(502);
    expect(res.body).toMatchObject({
      success: false,
      code: "VELOXVERSE_BRIDGE_REJECTED",
      requestId: "req-9",
      message: "VeloxVerse rejected the CRM connection — contact the administrator",
    });
    const tokens = upstream.mock.calls.map((c) => c[0].headers.Authorization.replace("Bearer ", ""));
    for (const t of tokens) {
      expect(logged.join("\n")).not.toContain(t);
      expect(JSON.stringify(res.body)).not.toContain(t);
    }
    expect(logged.join("\n")).not.toContain(SECRET);
    expect(logged.join("\n")).toMatch(/rejected the bridge token twice/);
  });

  it("does not retry other failures", async () => {
    actAs(dbUser());
    upstream.mockResolvedValue({ status: 500, data: { success: false, message: "boom" }, headers: {} });
    await request(app).get("/api/vv-admin/admin/users").set("Cookie", sessionCookie({ id: 7, role: "admin" }));
    expect(upstream).toHaveBeenCalledTimes(1);
  });
});
