import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

// Bad input must come back as a 4xx with a plain message, and an unexpected failure must not
// show a raw database error to the client in production.

const poolQuery = vi.fn();
vi.mock("pg", () => ({
  default: {
    Pool: class {
      query(...a) {
        return poolQuery(...a);
      }
      on() {}
    },
  },
}));

const pgError = (code, message) => Object.assign(new Error(message), { code });

describe("query() — Postgres errors caused by the request", () => {
  let query;
  beforeEach(async () => {
    vi.spyOn(console, "log").mockImplementation(() => {});
    ({ query } = await import("../config/db.js"));
    poolQuery.mockReset();
  });

  it("turns an invalid id into a 400 without Postgres' wording", async () => {
    poolQuery.mockRejectedValue(pgError("22P02", 'invalid input syntax for type integer: "abc"'));
    await expect(query("SELECT 1 WHERE id = $1", ["abc"])).rejects.toMatchObject({
      status: 400,
      message: "Invalid input",
      code: "22P02",
    });
  });

  it("turns a unique violation into a 409 and keeps the code for services that map it", async () => {
    poolQuery.mockRejectedValue(pgError("23505", 'duplicate key value violates unique constraint "x"'));
    await expect(query("INSERT …")).rejects.toMatchObject({ status: 409, code: "23505" });
  });

  it("leaves other errors alone", async () => {
    poolQuery.mockRejectedValue(pgError("57P01", "terminating connection due to administrator command"));
    const err = await query("SELECT 1").catch((e) => e);
    expect(err.status).toBeUndefined();
  });
});

describe("sendError — unexpected failures", () => {
  let sendError;
  let savedEnv;
  const res = () => {
    const r = { req: { method: "GET", originalUrl: "/api/x" } };
    r.status = vi.fn(() => r);
    r.json = vi.fn(() => r);
    return r;
  };

  beforeEach(async () => {
    savedEnv = process.env.NODE_ENV;
    vi.spyOn(console, "error").mockImplementation(() => {});
    ({ sendError } = await import("../src/utils/response.js"));
  });
  afterEach(() => {
    process.env.NODE_ENV = savedEnv;
  });

  it("hides a 500's message in production", () => {
    process.env.NODE_ENV = "production";
    const r = res();
    sendError(r, 'relation "users" does not exist', 500);
    expect(r.json.mock.calls[0][0].message).not.toContain("relation");
  });

  it("keeps deliberate 4xx and 503 messages in production", () => {
    process.env.NODE_ENV = "production";
    const r = res();
    sendError(r, "Email is required", 400);
    sendError(r, "Password reset by email is temporarily unavailable.", 503);
    expect(r.json.mock.calls.map((c) => c[0].message)).toEqual([
      "Email is required",
      "Password reset by email is temporarily unavailable.",
    ]);
  });

  it("shows the real message outside production", () => {
    process.env.NODE_ENV = "development";
    const r = res();
    sendError(r, 'relation "users" does not exist', 500);
    expect(r.json.mock.calls[0][0].message).toContain("relation");
  });
});
