import { describe, it, expect, beforeAll, beforeEach, vi } from "vitest";
import os from "os";
import path from "path";
import { promises as fs } from "fs";
import jwt from "jsonwebtoken";
import { sessionVersion } from "../src/utils/generateToken.js";

const mockQuery = vi.fn();
vi.mock("../config/db.js", () => ({
  query: (...args) => mockQuery(...args),
  getClient: vi.fn(),
  default: {},
}));

const SECRET = "test-secret-do-not-use-in-prod";
let keys;
let localStorage;
let app;
let request;
let root;
let isCustomDocType;
let describeS3Error;

beforeAll(async () => {
  root = await fs.mkdtemp(path.join(os.tmpdir(), "crm-storage-"));
  process.env.STORAGE_LOCAL_DIR = root;
  process.env.JWT_SECRET = SECRET;
  process.env.NODE_ENV = "test";
  delete process.env.S3_BUCKET;
  keys = await import("../src/storage/keys.js");
  ({ localStorage } = await import("../src/storage/localStorage.js"));
  ({ isCustomDocType } = await import("../src/config/verificationDocs.js"));
  ({ describeS3Error } = await import("../src/storage/s3Storage.js"));
  app = (await import("../src/app.js")).default;
  request = (await import("supertest")).default;
});

beforeEach(() => mockQuery.mockReset());

const PDF = Buffer.from("%PDF-1.4\n...");
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0]);
const JPG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0]);
const DOCX = Buffer.from([0x50, 0x4b, 0x03, 0x04, 0, 0]);
const EXE = Buffer.from("MZ\x90\x00 this is a program");

describe("storage keys", () => {
  it.each(["verification/user-3/passport-abc.pdf", "form-submissions/12/9f.png", "storage-check/x.pdf"])("accepts %s", (key) => {
    expect(keys.assertSafeKey(key)).toBe(key);
  });

  it.each(["../etc/passwd", "verification/../../x", "/etc/passwd", "a//b", "a/./b", "a\\b", "", "a\0b", "a\nb", null, 42])(
    "rejects %j",
    (key) => {
      expect(() => keys.assertSafeKey(key)).toThrow(/Invalid storage path/);
    }
  );

  it("local disk never writes or reads outside its folder", async () => {
    await expect(localStorage.put({ key: "../outside.txt", buffer: PDF })).rejects.toThrow(/Invalid storage path/);
    await expect(localStorage.read("../../etc/passwd")).rejects.toThrow(/Invalid storage path/);
    await localStorage.put({ key: "verification/user-1/a.pdf", buffer: PDF });
    expect((await localStorage.read("verification/user-1/a.pdf")).equals(PDF)).toBe(true);
    await localStorage.remove("verification/user-1/a.pdf");
    await expect(localStorage.read("verification/user-1/a.pdf")).rejects.toThrow();
  });
});

describe("file content must match its claimed type", () => {
  it("accepts real PDF / PNG / JPG / DOCX content", () => {
    expect(keys.contentMatchesType(PDF, "application/pdf")).toBe(true);
    expect(keys.contentMatchesType(PNG, "image/png")).toBe(true);
    expect(keys.contentMatchesType(JPG, "image/jpeg")).toBe(true);
    expect(keys.contentMatchesType(DOCX, "application/vnd.openxmlformats-officedocument.wordprocessingml.document")).toBe(true);
  });

  it("rejects a program (or anything else) labelled as a PDF or image", () => {
    expect(keys.contentMatchesType(EXE, "application/pdf")).toBe(false);
    expect(keys.contentMatchesType(Buffer.from("<html><script>alert(1)</script>"), "image/png")).toBe(false);
    expect(keys.contentMatchesType(PDF, "image/jpeg")).toBe(false);
    expect(keys.contentMatchesType(PDF, "text/html")).toBe(false);
    expect(keys.contentMatchesType(Buffer.alloc(0), "application/pdf")).toBe(false);
  });
});

describe("download file names", () => {
  it("keeps the original name and can't break out of the header", () => {
    expect(keys.contentDisposition("passport.pdf")).toBe(`inline; filename="passport.pdf"; filename*=UTF-8''passport.pdf`);
    const tricky = keys.contentDisposition('a"b\r\nSet-Cookie: x=1.pdf');
    expect(tricky).not.toMatch(/[\r\n]/);
    expect(tricky).not.toContain('a"b');
    expect(keys.contentDisposition("पासपोर्ट.pdf")).toContain("filename*=UTF-8''%E0%A4");
    expect(keys.contentDisposition("")).toContain('filename="file"');
  });
});

describe("custom document types", () => {
  it("accepts what the CRM generates", () => {
    expect(isCustomDocType("custom_bank_statement_1760000000000")).toBe(true);
    expect(isCustomDocType(`custom_${"a".repeat(40)}_1760000000000`)).toBe(true);
  });
  it.each(["custom_/../../../../tmp/x", "custom_a/b", "custom_A", "custom_", "custom_a b", "passport", `custom_${"a".repeat(90)}`])(
    "rejects %j (it ends up in the storage path)",
    (docType) => {
      expect(isCustomDocType(docType)).toBe(false);
    }
  );
});

describe("S3 setup errors are explained in plain language", () => {
  it.each([
    [{ name: "CredentialsProviderError", message: "Could not load credentials from any providers" }, /No AWS credentials/],
    [{ name: "InvalidAccessKeyId", $metadata: { httpStatusCode: 403 } }, /Access denied/],
    [{ name: "AccessDenied", $metadata: { httpStatusCode: 403 } }, /IAM policy/],
    [{ name: "NotFound", $metadata: { httpStatusCode: 404 } }, /was not found/],
    [{ name: "PermanentRedirect", $metadata: { httpStatusCode: 301 } }, /different region/],
  ])("%j", (err, expected) => {
    expect(describeS3Error(err)).toMatch(expected);
  });
});

// ── through the API ─────────────────────────────────────────────────────────
const admin = { id: 2, name: "Admin", email: "a@crm.example", role: "admin", is_active: true, account_status: "active", password: "hash" };
const employee = { ...admin, id: 5, role: "employee" };
const bearer = (id) => `Bearer ${jwt.sign({ id, sv: sessionVersion("hash") }, SECRET, { algorithm: "HS256", expiresIn: "5m" })}`;

/** Route every query by its SQL so one mock serves authenticate + the handler. */
function db({ user, submission, lead }) {
  mockQuery.mockImplementation(async (sql) => {
    if (/FROM users/i.test(sql)) return { rows: [user], rowCount: 1 };
    if (/FROM form_submissions/i.test(sql)) return { rows: submission ? [submission] : [], rowCount: submission ? 1 : 0 };
    if (/FROM leads/i.test(sql)) return { rows: lead ? [lead] : [], rowCount: lead ? 1 : 0 };
    return { rows: [], rowCount: 0 };
  });
}

describe("GET /api/storage/status", () => {
  it("tells an admin where documents are stored, and never mentions credentials", async () => {
    db({ user: admin });
    const res = await request(app).get("/api/storage/status").set("Authorization", bearer(2));
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ kind: "local", ok: true, durable: false });
    expect(JSON.stringify(res.body)).not.toMatch(/secret|access.?key/i);
  });

  it("is not available to other roles", async () => {
    db({ user: employee });
    const res = await request(app).get("/api/storage/status").set("Authorization", bearer(5));
    expect(res.status).toBe(403);
  });
});

describe("downloading a form upload from the Submissions page", () => {
  const file = { __type: "file", originalName: "my cv.pdf", storagePath: "form-submissions/12/abc.pdf", mimeType: "application/pdf", sizeBytes: PDF.length };

  it("serves the file (this route always answered 404 before)", async () => {
    await localStorage.put({ key: file.storagePath, buffer: PDF });
    db({ user: admin, submission: { id: 77, form_id: 12, submission_data: { cv: file } } });
    const res = await request(app).get("/api/forms/12/submissions/77/files/cv").set("Authorization", bearer(2)).buffer(true).parse((r, cb) => {
      const chunks = [];
      r.on("data", (c) => chunks.push(c));
      r.on("end", () => cb(null, Buffer.concat(chunks)));
    });
    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toMatch(/application\/pdf/);
    expect(res.headers["content-disposition"]).toContain('filename="my cv.pdf"');
    expect(res.headers["x-content-type-options"]).toBe("nosniff");
    expect(res.body.equals(PDF)).toBe(true);
  });

  it("is a 404 when the submission belongs to another form", async () => {
    db({ user: admin, submission: { id: 77, form_id: 99, submission_data: { cv: file } } });
    const res = await request(app).get("/api/forms/12/submissions/77/files/cv").set("Authorization", bearer(2));
    expect(res.status).toBe(404);
  });

  it("never serves a path outside form uploads, whatever a stored descriptor says", async () => {
    await localStorage.put({ key: "verification/user-9/passport.pdf", buffer: PDF });
    for (const storagePath of ["verification/user-9/passport.pdf", "../../etc/passwd"]) {
      db({ user: admin, lead: { id: 4, submission_data: { cv: { ...file, storagePath } } } });
      const res = await request(app).get("/api/forms/leads/4/files/cv").set("Authorization", bearer(2));
      expect(res.status).toBe(404);
    }
  });
});
