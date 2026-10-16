import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

// In production, a missing S3 bucket or mail transport must fail loudly at the feature that needs
// it — not silently write documents to a disk the next deploy wipes, or "send" a reset code that
// never arrives.

vi.mock("../config/db.js", () => ({ query: vi.fn(), getClient: vi.fn(), default: {} }));

const findByEmail = vi.fn();
vi.mock("../src/models/User.js", () => ({ default: { findByEmail: (...a) => findByEmail(...a) } }));
vi.mock("../src/models/PasswordReset.js", () => ({
  default: { invalidatePending: vi.fn(), create: vi.fn() },
}));

const MANAGED_KEYS = [
  "NODE_ENV", "S3_BUCKET", "ALLOW_LOCAL_STORAGE",
  "SMTP_HOST", "MAIL_USER", "MAIL_APP_PASSWORD",
];
let saved;

beforeEach(() => {
  saved = Object.fromEntries(MANAGED_KEYS.map((k) => [k, process.env[k]]));
  for (const k of MANAGED_KEYS) delete process.env[k];
  vi.resetModules();
  findByEmail.mockReset();
});

afterEach(() => {
  for (const k of MANAGED_KEYS) {
    if (saved[k] === undefined) delete process.env[k];
    else process.env[k] = saved[k];
  }
});

const loadStorage = async () => (await import("../src/storage/index.js")).storage;
const loadReset = async () => (await import("../src/services/passwordResetService.js")).requestPasswordReset;

describe("document storage without S3", () => {
  it("refuses new uploads in production", async () => {
    process.env.NODE_ENV = "production";
    const storage = await loadStorage();
    await expect(
      storage.put({ key: "verification/x.pdf", buffer: Buffer.from("x"), contentType: "application/pdf" })
    ).rejects.toMatchObject({ status: 503 });
  });

  it("uses local disk in production when ALLOW_LOCAL_STORAGE=true", async () => {
    process.env.NODE_ENV = "production";
    process.env.ALLOW_LOCAL_STORAGE = "true";
    const { localStorage } = await import("../src/storage/localStorage.js");
    expect(await loadStorage()).toBe(localStorage);
  });

  it("uses local disk outside production", async () => {
    process.env.NODE_ENV = "development";
    const { localStorage } = await import("../src/storage/localStorage.js");
    expect(await loadStorage()).toBe(localStorage);
  });
});

describe("password reset without a mail transport", () => {
  it("answers 503 in production, before looking the user up", async () => {
    process.env.NODE_ENV = "production";
    const requestPasswordReset = await loadReset();
    await expect(requestPasswordReset("someone@example.com")).rejects.toMatchObject({ status: 503 });
    expect(findByEmail).not.toHaveBeenCalled();
  });

  it("works in production with Gmail credentials only", async () => {
    process.env.NODE_ENV = "production";
    process.env.MAIL_USER = "crm@example.com";
    process.env.MAIL_APP_PASSWORD = "app-password";
    findByEmail.mockResolvedValue(null);
    const requestPasswordReset = await loadReset();
    await expect(requestPasswordReset("someone@example.com")).resolves.toHaveProperty("message");
  });

  it("still works in development (mail is logged)", async () => {
    process.env.NODE_ENV = "development";
    findByEmail.mockResolvedValue(null);
    const requestPasswordReset = await loadReset();
    await expect(requestPasswordReset("someone@example.com")).resolves.toHaveProperty("message");
  });
});
