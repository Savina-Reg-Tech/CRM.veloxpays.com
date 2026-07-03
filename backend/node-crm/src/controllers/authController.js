import { loginUser } from "../services/authService.js";
import { sendSuccess, sendError } from "../utils/response.js";

// Auth cookie config. The token never leaves the cookie jar — keeping it
// httpOnly means even a successful XSS attack cannot read or exfiltrate it.
// SameSite=Lax + the CORS allowlist together protect against CSRF.
export const AUTH_COOKIE_NAME = "velox_token";

// `Secure` requires HTTPS, so we keep it tied to a dedicated env flag rather
// than NODE_ENV: a local docker stack with NODE_ENV=production but http://
// localhost still needs the cookie to be sent. Set COOKIE_SECURE=true in any
// deployment that terminates HTTPS.
const isSecureCookie = String(process.env.COOKIE_SECURE || "").toLowerCase() === "true";

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
 * GET /api/auth/me — returns the currently authenticated user.
 *
 * The frontend hits this on every full-page load to confirm the session
 * cookie is still valid; a 401 here drives the client to its login screen.
 */
export const getMe = async (req, res) => {
  try {
    return sendSuccess(res, req.user, "Authenticated user fetched");
  } catch (err) {
    return sendError(res, err.message, 500);
  }
};
