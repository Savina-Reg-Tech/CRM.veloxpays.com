import jwt from "jsonwebtoken";

/**
 * VeloxVerse "form pass" check (VELOX-CRM country availability §5).
 *
 * The VeloxVerse app only issues a pass when the customer's country may use a form, and adds it
 * to the embed URL; the embed page sends it back as `X-VV-Form-Pass`. A valid pass is therefore
 * all the CRM needs — it never stores or evaluates country rules itself.
 *
 * VV_FORM_PASS_MODE: off (default) · monitor (check + record, always accept) · enforce.
 */

const MIN_SECRET_LENGTH = 32;
const MODES = new Set(["off", "monitor", "enforce"]);

export function vvFormPassMode(env = process.env) {
  const mode = String(env.VV_FORM_PASS_MODE ?? "").trim().toLowerCase();
  return MODES.has(mode) ? mode : "off";
}

/** Forms that stay open without a pass (e.g. also embedded on a website): VV_FORM_PASS_EXEMPT_FORM_IDS=12,13 */
export function isVvFormPassExempt(formId, env = process.env) {
  return String(env.VV_FORM_PASS_EXEMPT_FORM_IDS ?? "")
    .split(",")
    .map((s) => Number(s.trim()))
    .some((id) => Number.isFinite(id) && id > 0 && id === Number(formId));
}

/** → { status: 'valid' | 'missing' | 'invalid' | 'expired' | 'wrong_form', claims? } — never throws. */
export function checkVvFormPass(pass, formId, env = process.env) {
  const secret = env.FORM_PASS_SECRET;
  if (!pass) return { status: "missing" };
  if (!secret || secret.length < MIN_SECRET_LENGTH) return { status: "invalid" };
  try {
    const claims = jwt.verify(pass, secret, { algorithms: ["HS256"], issuer: "veloxverse", clockTolerance: 60 });
    if (claims.typ !== "vv_form_pass") return { status: "invalid" };
    if (claims.crmFormId != null && Number(claims.crmFormId) !== Number(formId)) return { status: "wrong_form", claims };
    return { status: "valid", claims };
  } catch (err) {
    return { status: err.name === "TokenExpiredError" ? "expired" : "invalid" };
  }
}

const REFUSALS = {
  expired: {
    code: "FORM_PASS_EXPIRED",
    message: "This page has been open too long. Please open the form again.",
  },
  refused: {
    code: "FORM_NOT_AVAILABLE_IN_COUNTRY",
    message: "This form isn't available in your country.",
  },
};

/**
 * Runs the check for one submission.
 * → { record: { status, country, userId } | null, refusal: { code, message } | null }
 * `record` is what to store on the submission (null when the mode is off / the form is exempt);
 * `refusal` is set only in enforce mode when the pass isn't valid. The pass itself is never logged.
 */
export function evaluateVvFormPass(pass, formId, env = process.env) {
  const mode = vvFormPassMode(env);
  if (mode === "off" || isVvFormPassExempt(formId, env)) return { record: null, refusal: null };

  const { status, claims } = checkVvFormPass(pass, formId, env);
  console.log(`vv-form-pass ${status} form=${formId} mode=${mode}`);
  const record = {
    status,
    country: typeof claims?.country === "string" ? claims.country.slice(0, 2).toUpperCase() : null,
    userId: typeof claims?.sub === "string" ? claims.sub.slice(0, 64) : null,
  };

  if (mode === "enforce" && status !== "valid") {
    return { record, refusal: status === "expired" ? REFUSALS.expired : REFUSALS.refused };
  }
  return { record, refusal: null };
}
