import { describe, it, expect, beforeAll, beforeEach, afterEach, vi } from "vitest";
import jwt from "jsonwebtoken";
import { checkVvFormPass, evaluateVvFormPass, isVvFormPassExempt, vvFormPassMode } from "../src/utils/vvFormPass.js";

const SECRET = "a".repeat(64);
const env = (extra = {}) => ({ FORM_PASS_SECRET: SECRET, ...extra });

function pass(claims = {}, { secret = SECRET, expiresIn = "2h", issuer = "veloxverse" } = {}) {
  return jwt.sign(
    { typ: "vv_form_pass", formKey: "car-loan", serviceKey: "velox-credit.car-loan", crmFormId: 3, country: "AU", sub: "user-1", ...claims },
    secret,
    { algorithm: "HS256", expiresIn, issuer }
  );
}

describe("checkVvFormPass", () => {
  it("accepts a good pass for the right form", () => {
    const r = checkVvFormPass(pass(), 3, env());
    expect(r.status).toBe("valid");
    expect(r.claims.country).toBe("AU");
  });

  it("reports missing / wrong form / expired / tampered / wrong issuer / wrong typ", () => {
    expect(checkVvFormPass("", 3, env()).status).toBe("missing");
    expect(checkVvFormPass(pass(), 4, env()).status).toBe("wrong_form");
    expect(checkVvFormPass(pass({}, { expiresIn: -120 }), 3, env()).status).toBe("expired");
    expect(checkVvFormPass(pass({}, { secret: "b".repeat(64) }), 3, env()).status).toBe("invalid");
    expect(checkVvFormPass(pass({}, { issuer: "someone" }), 3, env()).status).toBe("invalid");
    expect(checkVvFormPass(pass({ typ: "other" }), 3, env()).status).toBe("invalid");
  });

  it("treats a missing or short secret as invalid", () => {
    expect(checkVvFormPass(pass(), 3, {}).status).toBe("invalid");
    expect(checkVvFormPass(pass(), 3, { FORM_PASS_SECRET: "short" }).status).toBe("invalid");
  });
});

describe("mode + exemptions", () => {
  it("defaults to off and ignores unknown values", () => {
    expect(vvFormPassMode({})).toBe("off");
    expect(vvFormPassMode({ VV_FORM_PASS_MODE: "ENFORCE" })).toBe("enforce");
    expect(vvFormPassMode({ VV_FORM_PASS_MODE: "strict" })).toBe("off");
  });

  it("reads the exempt form ids", () => {
    expect(isVvFormPassExempt(12, { VV_FORM_PASS_EXEMPT_FORM_IDS: "12, 13" })).toBe(true);
    expect(isVvFormPassExempt(14, { VV_FORM_PASS_EXEMPT_FORM_IDS: "12, 13" })).toBe(false);
  });
});

describe("evaluateVvFormPass", () => {
  beforeEach(() => vi.spyOn(console, "log").mockImplementation(() => {}));
  afterEach(() => vi.restoreAllMocks());

  it("off: records nothing, refuses nothing", () => {
    expect(evaluateVvFormPass(undefined, 3, env())).toEqual({ record: null, refusal: null });
  });

  it("monitor: always accepts and records the result", () => {
    const r = evaluateVvFormPass(undefined, 3, env({ VV_FORM_PASS_MODE: "monitor" }));
    expect(r.refusal).toBeNull();
    expect(r.record).toEqual({ status: "missing", country: null, userId: null });
  });

  it("enforce: valid passes, others are refused with the right code", () => {
    const e = env({ VV_FORM_PASS_MODE: "enforce" });
    expect(evaluateVvFormPass(pass(), 3, e)).toEqual({ record: { status: "valid", country: "AU", userId: "user-1" }, refusal: null });
    expect(evaluateVvFormPass(undefined, 3, e).refusal.code).toBe("FORM_NOT_AVAILABLE_IN_COUNTRY");
    expect(evaluateVvFormPass(pass(), 9, e).refusal.code).toBe("FORM_NOT_AVAILABLE_IN_COUNTRY");
    expect(evaluateVvFormPass(pass({}, { expiresIn: -120 }), 3, e).refusal.code).toBe("FORM_PASS_EXPIRED");
  });

  it("enforce: an exempt form stays open without a pass", () => {
    const e = env({ VV_FORM_PASS_MODE: "enforce", VV_FORM_PASS_EXEMPT_FORM_IDS: "3" });
    expect(evaluateVvFormPass(undefined, 3, e)).toEqual({ record: null, refusal: null });
  });

  it("never logs the pass itself", () => {
    const token = pass();
    evaluateVvFormPass(token, 3, env({ VV_FORM_PASS_MODE: "monitor" }));
    const logged = console.log.mock.calls.flat().join(" ");
    expect(logged).toContain("vv-form-pass valid form=3");
    expect(logged).not.toContain(token);
  });
});

// ── Through the real route ───────────────────────────────────────────────────
vi.mock("../config/db.js", () => ({ query: vi.fn(), getClient: vi.fn(), default: {} }));
const processFormSubmission = vi.fn(async () => ({ submission: { id: 11 }, lead: { id: 22 }, status: "NEW", spamScore: 0 }));
vi.mock("../src/services/submissionService.js", () => ({
  processFormSubmission: (...args) => processFormSubmission(...args),
}));

describe("POST /public/forms/:id/submit with VV_FORM_PASS_MODE=enforce", () => {
  let app;
  let request;
  beforeAll(async () => {
    process.env.JWT_SECRET = "test-secret-do-not-use-in-prod";
    process.env.NODE_ENV = "test";
    app = (await import("../src/app.js")).default;
    request = (await import("supertest")).default;
  });
  beforeEach(() => {
    process.env.FORM_PASS_SECRET = SECRET;
    process.env.VV_FORM_PASS_MODE = "enforce";
    processFormSubmission.mockClear();
    vi.spyOn(console, "log").mockImplementation(() => {});
  });
  afterEach(() => {
    delete process.env.FORM_PASS_SECRET;
    delete process.env.VV_FORM_PASS_MODE;
    vi.restoreAllMocks();
  });

  it("refuses a submission without a pass, before anything is stored", async () => {
    const res = await request(app).post("/public/forms/3/submit").set("X-Forwarded-For", "203.0.113.60").send({ data: { f1: "x" } });
    expect(res.status).toBe(403);
    expect(res.body.code).toBe("FORM_NOT_AVAILABLE_IN_COUNTRY");
    expect(processFormSubmission).not.toHaveBeenCalled();
  });

  it("accepts a valid pass and hands the result to the submission", async () => {
    const res = await request(app)
      .post("/public/forms/3/submit")
      .set("X-Forwarded-For", "203.0.113.61")
      .set("X-VV-Form-Pass", pass())
      .send({ data: { f1: "x" } });
    expect(res.status).toBe(201);
    expect(processFormSubmission.mock.calls[0][0].vvPass).toEqual({ status: "valid", country: "AU", userId: "user-1" });
  });

  it("lets the embed send the header cross-origin (CORS preflight)", async () => {
    const res = await request(app)
      .options("/public/forms/3/submit")
      .set("Origin", "https://partner.example.com")
      .set("Access-Control-Request-Method", "POST")
      .set("Access-Control-Request-Headers", "x-vv-form-pass");
    expect(String(res.headers["access-control-allow-headers"]).toLowerCase()).toContain("x-vv-form-pass");
  });
});
