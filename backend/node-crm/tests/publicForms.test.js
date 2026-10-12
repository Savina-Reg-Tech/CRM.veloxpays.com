import { describe, it, expect, beforeAll, beforeEach, vi } from "vitest";

const mockQuery = vi.fn();
vi.mock("../config/db.js", () => ({
  query: (...args) => mockQuery(...args),
  getClient: vi.fn(),
  default: {},
}));

// Capture outgoing mail instead of sending it.
const sentMail = [];
vi.mock("nodemailer", () => ({
  default: { createTransport: () => ({ sendMail: async (m) => void sentMail.push(m) }) },
}));

// The submission pipeline itself is covered elsewhere — here we only care what reaches it.
const processFormSubmission = vi.fn(async () => ({
  submission: { id: 11 },
  lead: { id: 22 },
  status: "NEW",
  spamScore: 0,
}));
vi.mock("../src/services/submissionService.js", () => ({
  processFormSubmission: (...args) => processFormSubmission(...args),
}));

let app;
let request;
let toPublicFormJson;
let webhooks;
let isSafeLinkUrl;
let email;

beforeAll(async () => {
  process.env.JWT_SECRET = "test-secret-do-not-use-in-prod";
  process.env.NODE_ENV = "test";
  process.env.ALLOWED_ORIGINS = "http://localhost:3001";
  process.env.MAIL_USER = "crm@example.com";
  process.env.MAIL_APP_PASSWORD = "x";
  app = (await import("../src/app.js")).default;
  request = (await import("supertest")).default;
  ({ toPublicFormJson } = await import("../src/controllers/publicFormController.js"));
  webhooks = await import("../src/services/webhookService.js");
  ({ isSafeLinkUrl } = await import("../src/utils/safeUrl.js"));
  email = await import("../src/services/emailService.js");
});

beforeEach(() => {
  mockQuery.mockReset();
  processFormSubmission.mockClear();
  sentMail.length = 0;
});

const formRow = {
  id: 1,
  name: "Contact us",
  description: null,
  status: "published",
  submit_button_label: "Send",
  success_message: "Thanks",
  form_json: {
    fields: [{ id: "f1", type: "text", label: "Name" }],
    rules: [{ id: "r1" }],
    webhookRules: [{ id: "w1", url: "https://hooks.example.com/x", secret: "s3cr3t-hmac-key", enabled: true }],
    notificationRules: [{ id: "n1", emails: ["boss@company.com"] }],
  },
};

// ── 7. public form never exposes server-side rules ──────────────────────────
describe("GET /public/forms/:id", () => {
  it("strips webhook rules and notification rules", () => {
    const out = toPublicFormJson(formRow.form_json);
    expect(out).toEqual({ fields: formRow.form_json.fields, rules: formRow.form_json.rules });
    expect(formRow.form_json.webhookRules).toHaveLength(1); // original untouched
  });

  it("does not leak the webhook secret, webhook URL or staff emails to visitors", async () => {
    mockQuery.mockResolvedValue({ rows: [formRow], rowCount: 1 });
    const res = await request(app).get("/public/forms/1");
    expect(res.status).toBe(200);
    const body = JSON.stringify(res.body);
    expect(body).not.toContain("s3cr3t-hmac-key");
    expect(body).not.toContain("hooks.example.com");
    expect(body).not.toContain("boss@company.com");
    expect(res.body.data.form_json.fields).toHaveLength(1);
  });
});

// ── 11. embeds on other sites ───────────────────────────────────────────────
describe("CORS", () => {
  it("serves public form endpoints to any origin (was a 500)", async () => {
    mockQuery.mockResolvedValue({ rows: [formRow], rowCount: 1 });
    const res = await request(app).get("/public/forms/1").set("Origin", "https://customer-site.example");
    expect(res.status).toBe(200);
    expect(res.headers["access-control-allow-origin"]).toBe("*");
    expect(res.headers["access-control-allow-credentials"]).toBeUndefined();
  });

  it("answers the preflight for a cross-site submission", async () => {
    const res = await request(app)
      .options("/public/forms/1/submit")
      .set("Origin", "https://customer-site.example")
      .set("Access-Control-Request-Method", "POST")
      .set("Access-Control-Request-Headers", "content-type");
    expect(res.status).toBe(204);
    expect(res.headers["access-control-allow-origin"]).toBe("*");
  });

  it("serves the embed script to any origin", async () => {
    const res = await request(app).get("/form.js").set("Origin", "https://customer-site.example");
    expect(res.status).toBe(200);
    expect(res.headers["access-control-allow-origin"]).toBe("*");
  });

  it("still refuses other origins on the CRM API — with a 403, not a 500", async () => {
    const res = await request(app).post("/api/auth/login").set("Origin", "https://evil.example").send({});
    expect(res.status).toBe(403);
    expect(res.headers["access-control-allow-origin"]).toBeUndefined();
  });

  it("still allows the CRM frontend origin with credentials", async () => {
    const res = await request(app).post("/api/auth/login").set("Origin", "http://localhost:3001").send({});
    expect(res.status).toBe(400);
    expect(res.headers["access-control-allow-origin"]).toBe("http://localhost:3001");
    expect(res.headers["access-control-allow-credentials"]).toBe("true");
  });
});

// ── forged file descriptors ─────────────────────────────────────────────────
describe("POST /public/forms/:id/submit", () => {
  it("drops a visitor-supplied file descriptor (staff download would read its storagePath)", async () => {
    const res = await request(app)
      .post("/public/forms/1/submit")
      .set("X-Forwarded-For", "203.0.113.50")
      .send({
        data: {
          f1: "Jane",
          f2: { __type: "file", storagePath: "../../../../etc/passwd", originalName: "x", mimeType: "text/plain" },
        },
      });
    expect(res.status).toBe(201);
    const { data } = processFormSubmission.mock.calls[0][0];
    expect(data).toEqual({ f1: "Jane" });
  });
});

// ── 8. webhooks cannot reach internal addresses ─────────────────────────────
describe("webhook SSRF guard", () => {
  it.each([
    "127.0.0.1",
    "169.254.169.254",
    "10.0.0.5",
    "192.168.1.1",
    "172.16.0.1",
    "0.0.0.0",
    "[::1]",
    "::1",
    "[fd00::1]",
    "[::ffff:127.0.0.1]",
    "localhost",
    "api.localhost",
    "",
  ])("blocks host %s", (host) => {
    expect(webhooks.isBlockedHostLiteral(host)).toBe(true);
  });

  it.each(["example.com", "hooks.zapier.com", "8.8.8.8", "[2606:4700:4700::1111]"])("allows host %s", (host) => {
    expect(webhooks.isBlockedHostLiteral(host)).toBe(false);
  });

  it.each([
    "http://169.254.169.254/latest/meta-data/",
    "http://127.0.0.1:5432/",
    "http://2130706433/", // decimal 127.0.0.1
    "http://0x7f.1/", // hex 127.0.0.1
    "http://[::1]:6379/",
    "http://localhost:5001/api/users",
  ])("refuses %s without connecting", async (url) => {
    const result = await webhooks.sendWebhook({ url, payload: { a: 1 }, timeoutMs: 500 });
    expect(result.success).toBe(false);
    expect(result.statusCode).toBeNull();
    expect(result.error).toMatch(/internal\/private\/link-local/);
    expect(webhooks.isPlausibleWebhookUrl(url)).toBe(false);
  });

  it("still accepts ordinary webhook URLs at save time", () => {
    expect(webhooks.isPlausibleWebhookUrl("https://hooks.example.com/abc")).toBe(true);
    expect(webhooks.isPlausibleWebhookUrl("ftp://example.com/")).toBe(false);
  });
});

// ── 10. redirect / button links ─────────────────────────────────────────────
describe("isSafeLinkUrl", () => {
  it.each(["https://example.com/thanks", "http://example.com", "www.example.com/x", "/thank-you", "//example.com/x", "", "  https://example.com  "])(
    "allows %j",
    (url) => {
      expect(isSafeLinkUrl(url)).toBe(true);
    }
  );

  it.each([
    "javascript:alert(1)",
    "JaVaScRiPt:alert(1)",
    "  javascript:alert(1)",
    "java\tscript:alert(1)",
    "java\nscript:alert(1)",
    "data:text/html,<script>alert(1)</script>",
    "vbscript:msgbox(1)",
    "file:///etc/passwd",
    "mailto:a@b.c",
    null,
    42,
  ])("refuses %j", (url) => {
    expect(isSafeLinkUrl(url)).toBe(false);
  });
});

// ── 9. emails never carry submitted markup ──────────────────────────────────
describe("form emails", () => {
  const evil = `<a href="https://evil.example">Reset your account</a><img src=x onerror=alert(1)>`;

  it("escapes every submitted value in the staff notification", async () => {
    await email.sendSubmissionNotification({
      form: { name: `Contact <b>us</b>` },
      submission: {
        spam_score: 0,
        status: "NEW",
        submission_data: { [`<script>k</script>`]: evil, list: [evil, "ok"], doc: { __type: "file", originalName: "<i>cv</i>.pdf" } },
      },
      lead: { name: evil, email: `"><svg onload=alert(1)>@x.com`, phone: evil },
      notifyEmails: ["staff@example.com"],
    });
    const { html } = sentMail[0];
    expect(html).not.toMatch(/<a href="https:\/\/evil/);
    expect(html).not.toMatch(/<img|<script|<svg|<b>us|<i>cv/);
    expect(html).toContain("&lt;a href=&quot;https://evil.example&quot;&gt;Reset your account&lt;/a&gt;");
    expect(html).toContain("[file] &lt;i&gt;cv&lt;/i&gt;.pdf");
  });

  it("escapes the auto-reply body and keeps the subject on one line", async () => {
    await email.sendAutoResponder({
      form: { auto_respond_subject: "Thanks {{name}}", auto_respond_body: "Hi {{name}},\nWe got: {{f1}}" },
      lead: { email: "victim@example.com", name: `${evil}\r\nBcc: other@example.com` },
      data: { f1: evil },
    });
    const m = sentMail[0];
    expect(m.to).toBe("victim@example.com");
    expect(m.subject).not.toMatch(/[\r\n]/);
    expect(m.html).not.toMatch(/<a |<img/);
    expect(m.html).toContain("&lt;a href=");
    expect(m.html).toContain("<br>");
  });
});
