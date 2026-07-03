import { describe, it, expect, beforeAll, beforeEach, vi } from "vitest";

// ─────────────────────────────────────────────────────────────────────────────
// We can't talk to a real Postgres in unit tests, so we stub the `query`
// export from config/db.js BEFORE any app code imports it. Every test here
// then controls what `query` returns by tweaking `mockQuery.mockImplementation`.
// ─────────────────────────────────────────────────────────────────────────────
const mockQuery = vi.fn();
vi.mock("../config/db.js", () => ({
  query: (...args) => mockQuery(...args),
  getClient: vi.fn(),
  default: {},
}));

let app;
let request;

beforeAll(async () => {
  process.env.JWT_SECRET = "test-secret-do-not-use-in-prod";
  process.env.NODE_ENV = "test";
  const appModule = await import("../src/app.js");
  app = appModule.default;
  const supertest = await import("supertest");
  request = supertest.default;
});

describe("POST /api/auth/login", () => {
  beforeEach(() => {
    mockQuery.mockReset();
  });

  it("returns 400 when email or password is missing", async () => {
    const res = await request(app).post("/api/auth/login").send({});
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  // This locks in the user-enumeration fix (C-2): unknown email AND wrong
  // password must produce identical 401 responses so attackers can't tell
  // which addresses are registered.
  it("returns a generic 401 for an unknown email (no user enumeration)", async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] }); // user lookup → empty

    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: "ghost@example.com", password: "Whatever123!" });

    expect(res.status).toBe(401);
    expect(res.body).toMatchObject({
      success: false,
      message: expect.stringMatching(/invalid email or password/i),
    });
  });

  it("normalizes the email (trims + lowercases) before lookup", async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });

    await request(app)
      .post("/api/auth/login")
      .send({ email: "  Foo@Bar.COM  ", password: "Anything123!" });

    // First positional arg of first call is the SQL; second is the params array.
    expect(mockQuery).toHaveBeenCalled();
    const params = mockQuery.mock.calls[0][1];
    expect(params[0]).toBe("foo@bar.com");
  });
});

describe("Protected user routes", () => {
  it("blocks GET /api/users without an auth cookie", async () => {
    const res = await request(app).get("/api/users");
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });
});
