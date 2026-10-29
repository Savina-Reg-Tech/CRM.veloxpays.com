import { loginUser } from "../services/authService.js";
import { requestPasswordReset, resetPasswordWithOtp } from "../services/passwordResetService.js";
import { sendSuccess, sendError } from "../utils/response.js";
import User from "../models/User.js";

// Auth cookie config. The token never leaves the cookie jar — keeping it
// httpOnly means even a successful XSS attack cannot read or exfiltrate it.
// SameSite=Lax + the CORS allowlist together protect against CSRF.
export const AUTH_COOKIE_NAME = "velox_token";

// `Secure` (cookie only ever sent over HTTPS) is ON by default in production, so a deployment
// can't ship the session cookie over plain HTTP just because nobody set a flag. COOKIE_SECURE
// overrides it either way: "false" for a local docker stack that runs NODE_ENV=production on
// http://localhost (docker-compose.yml does this), "true" to force it on elsewhere.
export function resolveCookieSecure(env = process.env) {
  const flag = String(env.COOKIE_SECURE ?? "").trim().toLowerCase();
  if (flag === "true") return true;
  if (flag === "false") return false;
  return env.NODE_ENV === "production";
}
const isSecureCookie = resolveCookieSecure();

const cookieOptions = () => ({
  httpOnly: true,
  secure: isSecureCookie,
  sameSite: "lax",
  path: "/",
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days — keep aligned with JWT_EXPIRES_IN
});

/**
 * POST /api/auth/login
 *
 * On success we set the JWT as an httpOnly cookie and return ONLY the user
 * payload in the response body. The token is never exposed to the browser's
 * JavaScript context, eliminating the XSS-token-theft class of attacks.
 */
export const login = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return sendError(res, "Email and password are required", 400);
    }

    const { token, user } = await loginUser(email, password);
    res.cookie(AUTH_COOKIE_NAME, token, cookieOptions());
    return sendSuccess(res, { user }, "Login successful");
  } catch (err) {
    return sendError(res, err.message, err.status || 500);
  }
};

/**
 * POST /api/auth/logout
 *
 * Clears the auth cookie. Safe to call when not logged in (idempotent).
 */
export const logout = async (_req, res) => {
  res.clearCookie(AUTH_COOKIE_NAME, {
    httpOnly: true,
    secure: isSecureCookie,
    sameSite: "lax",
    path: "/",
  });
  return sendSuccess(res, null, "Logged out");
};

/**
 * POST /api/auth/forgot-password
 *
 * Public — anyone can request a reset code for any email. The response is
 * always the same generic message, whether or not that email has an
 * account, so this endpoint cannot be used to enumerate users.
 */
export const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return sendError(res, "Email is required", 400);
    const result = await requestPasswordReset(email);
    return sendSuccess(res, null, result.message);
  } catch (err) {
    return sendError(res, err.message, err.status || 500);
  }
};

/**
 * POST /api/auth/reset-password
 *
 * Public — verifies the emailed OTP and sets the new password in one call.
 */
export const resetPassword = async (req, res) => {
  try {
    const { email, otp, newPassword } = req.body;
    const result = await resetPasswordWithOtp({ email, otp, newPassword });
    return sendSuccess(res, null, result.message);
  } catch (err) {
    return sendError(res, err.message, err.status || 500);
  }
};

/**
 * GET /api/auth/me — returns the currently authenticated user.
 *
 * The frontend hits this on every full-page load to confirm the session
 * cookie is still valid; a 401 here drives the client to its login screen.
 */
export const getMe = async (req, res) => {
  try {
    const tour = await User.getTourState(req.user.id);
    return sendSuccess(res, { ...req.user, ...tour }, "Authenticated user fetched");
  } catch (err) {
    return sendError(res, err.message, 500);
  }
};

const TOUR_RESULTS = ["completed", "dismissed"];
const TOUR_FIELDS = ["tourStatus", "tourVersion"];

/**
 * PATCH /api/auth/me/onboarding — saves the caller's own welcome-tour result.
 * Body: { tourStatus: "completed" | "dismissed", tourVersion: positive integer }. Any other
 * field is refused. Only the field names are logged, never their values.
 */
export const updateOnboarding = async (req, res) => {
  try {
    const body = req.body && typeof req.body === "object" && !Array.isArray(req.body) ? req.body : {};
    const unknown = Object.keys(body).filter((key) => !TOUR_FIELDS.includes(key));
    if (unknown.length) return sendError(res, "Only tourStatus and tourVersion can be updated", 400);

    const { tourStatus, tourVersion } = body;
    if (!TOUR_RESULTS.includes(tourStatus)) {
      return sendError(res, "tourStatus must be 'completed' or 'dismissed'", 400);
    }
    if (!Number.isInteger(tourVersion) || tourVersion < 1 || tourVersion > 1000) {
      return sendError(res, "tourVersion must be a positive integer", 400);
    }

    const saved = await User.setTourState(req.user.id, { status: tourStatus, version: tourVersion });
    if (!saved) return sendError(res, "User not found", 404);

    console.info(`[onboarding] user ${req.user.id} updated fields: ${TOUR_FIELDS.join(", ")}`);
    return sendSuccess(res, saved, "Onboarding saved");
  } catch (err) {
    return sendError(res, err.message, 500);
  }
};
