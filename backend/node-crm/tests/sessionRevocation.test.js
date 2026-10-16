import { describe, it, expect, beforeAll, beforeEach, vi } from "vitest";
import jwt from "jsonwebtoken";
import { sessionVersion } from "../src/utils/generateToken.js";

// A session token is only good while the password it was issued under is still the current one.

const mockQuery = vi.fn();
vi.mock("../config/db.js", () => ({ query: (...a) => mockQuery(...a), getClient: vi.fn(), default: {} }));

const SECRET = "test-secret-do-not-use-in-prod";
let app;
let request;
let signBridgeToken;

beforeAll(async () => {
  process.env.JWT_SECRET = SECRET;
  process.env.NODE_ENV = "test";
  process.env.ALLOWED_ORIGINS = "http://localhost:3001";
  app = (await import("../src/app.js")).default;
  request = (await import("supertest")).default;
  ({ signBridgeToken } = await import("../src/middleware/veloxverseProxy.js"));
});

const user = (password) => ({
  id: 7, name: "Sam", email: "sam@example.com", role: "admin",
  is_active: true, account_status: "active", password,
});
const actAs = (row) => mockQuery.mockResolvedValue({ rows: [row], rowCount: 1 });
const sign = (claims) => jwt.sign(claims, SECRET, { algorithm: "HS256", expiresIn: "1h" });
const me = (token) => request(app).get("/api/auth/me").set("Authorization", `Bearer ${token}`);

beforeEach(() => mockQuery.mockReset());

describe("session revocation", () => {
  it("accepts a token issued under the current password", async () => {
    actAs(user("hash-1"));
    const res = await me(sign({ id: 7, role: "admin", sv: sessionVersion("hash-1") }));
    expect(res.status).toBe(200);
    expect(JSON.stringify(res.body)).not.toContain("hash-1"); // the hash never reaches a response
  });

  it("rejects a token issued before the password changed", async () => {
    actAs(user("hash-2"));
    const res = await me(sign({ id: 7, role: "admin", sv: sessionVersion("hash-1") }));
    expect(res.status).toBe(401);
  });

  it("rejects a token with no session version", async () => {
    actAs(user("hash-1"));
    expect((await me(sign({ id: 7, role: "admin" }))).status).toBe(401);
  });

  it("does not accept a VeloxVerse bridge token as a CRM session", async () => {
    actAs(user("hash-1"));
    const bridge = signBridgeToken({ id: 7, role: "admin", email: "sam@example.com" });
    expect((await me(bridge)).status).toBe(401);
  });
});
