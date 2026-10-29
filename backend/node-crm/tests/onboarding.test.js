import { describe, it, expect, beforeAll, beforeEach, afterEach, vi } from "vitest";
import jwt from "jsonwebtoken";
import { sessionVersion } from "../src/utils/generateToken.js";

// Welcome-tour state: GET /api/auth/me returns it, PATCH /api/auth/me/onboarding saves the
// caller's own result. Postgres is stubbed; each test routes queries by their SQL text.

const mockQuery = vi.fn();
vi.mock("../config/db.js", () => ({ query: (...a) => mockQuery(...a), getClient: vi.fn(), default: {} }));

const SECRET = "test-secret-do-not-use-in-prod";
let app;
let request;

beforeAll(async () => {
  process.env.JWT_SECRET = SECRET;
  process.env.NODE_ENV = "test";
  app = (await import("../src/app.js")).default;
  request = (await import("supertest")).default;
});

const HASH = "hash-1";
const staff = { id: 7, name: "Sam", email: "sam@example.com", role: "admin", is_active: true, account_status: "active", password: HASH };
const token = jwt.sign({ id: 7, role: "admin", sv: sessionVersion(HASH) }, SECRET, { algorithm: "HS256", expiresIn: "1h" });
const SEEN_AT = "2026-10-29T10:00:00.000Z";

/** Answers the auth lookup with `staff`, the tour SELECT with `tour` (or throws `tourError`), and the tour UPDATE by echoing its params. */
function db({ tour = { tour_status: null, tour_version: null, tour_seen_at: null }, tourError } = {}) {
  mockQuery.mockImplementation(async (sql, params) => {
    if (/^\s*UPDATE users\s+SET tour_status/i.test(sql)) {
      return { rows: [{ tour_status: params[1], tour_version: params[2], tour_seen_at: SEEN_AT }], rowCount: 1 };
    }
    if (/SELECT tour_status/i.test(sql)) {
      if (tourError) throw tourError;
      return { rows: [tour], rowCount: 1 };
    }
    return { rows: [staff], rowCount: 1 };
  });
}

const patch = (body, auth = true) => {
  const req = request(app).patch("/api/auth/me/onboarding");
  return (auth ? req.set("Authorization", `Bearer ${token}`) : req).send(body);
};
const tourUpdates = () => mockQuery.mock.calls.filter(([sql]) => /SET tour_status/i.test(sql));

let info;
beforeEach(() => {
  mockQuery.mockReset();
  info = vi.spyOn(console, "info").mockImplementation(() => {});
});
afterEach(() => info.mockRestore());

describe("GET /api/auth/me — tour fields", () => {
  it("includes tour_status, tour_version and tour_seen_at", async () => {
    db({ tour: { tour_status: "completed", tour_version: 1, tour_seen_at: SEEN_AT } });
    const res = await request(app).get("/api/auth/me").set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ id: 7, tour_status: "completed", tour_version: 1, tour_seen_at: SEEN_AT });
    expect(JSON.stringify(res.body)).not.toContain(HASH);
  });

  it("still answers before migration 022 has been run, and never offers the tour then", async () => {
    db({ tourError: Object.assign(new Error('column "tour_status" does not exist'), { code: "42703" }) });
    const res = await request(app).get("/api/auth/me").set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ id: 7, tour_status: "not_offered", tour_version: null, tour_seen_at: null });
  });
});

describe("PATCH /api/auth/me/onboarding", () => {
  it("401 without a session, and saves nothing", async () => {
    db();
    const res = await patch({ tourStatus: "completed", tourVersion: 1 }, false);
    expect(res.status).toBe(401);
    expect(tourUpdates()).toHaveLength(0);
  });

  it.each(["completed", "dismissed"])("saves '%s' for the caller", async (tourStatus) => {
    db();
    const res = await patch({ tourStatus, tourVersion: 2 });
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ tour_status: tourStatus, tour_version: 2, tour_seen_at: SEEN_AT });
    expect(tourUpdates()).toHaveLength(1);
    expect(tourUpdates()[0][1]).toEqual([7, tourStatus, 2]);
  });

  it.each([
    ["not_offered", 1],
    ["started", 1],
    [undefined, 1],
    ["completed", 0],
    ["completed", -1],
    ["completed", 1.5],
    ["completed", "1"],
    ["completed", undefined],
  ])("400 for tourStatus=%s tourVersion=%s", async (tourStatus, tourVersion) => {
    db();
    const res = await patch({ tourStatus, tourVersion });
    expect(res.status).toBe(400);
    expect(tourUpdates()).toHaveLength(0);
  });

  it("refuses any other field, including another user's id", async () => {
    db();
    for (const extra of [{ id: 99 }, { userId: 99 }, { role: "super_admin" }, { tourSeenAt: SEEN_AT }]) {
      const res = await patch({ tourStatus: "completed", tourVersion: 1, ...extra });
      expect(res.status).toBe(400);
    }
    expect(tourUpdates()).toHaveLength(0);
  });

  it("always updates the session's own user", async () => {
    db();
    await patch({ tourStatus: "dismissed", tourVersion: 1 });
    expect(tourUpdates()[0][1][0]).toBe(7);
  });

  it("logs the field names only, never their values", async () => {
    db();
    await patch({ tourStatus: "dismissed", tourVersion: 3 });
    const lines = info.mock.calls.map((args) => args.join(" ")).filter((l) => l.includes("[onboarding]"));
    expect(lines).toHaveLength(1);
    expect(lines[0]).toContain("tourStatus");
    expect(lines[0]).toContain("tourVersion");
    expect(lines[0]).not.toContain("dismissed");
    expect(lines[0]).not.toMatch(/\b3\b/);
  });
});
