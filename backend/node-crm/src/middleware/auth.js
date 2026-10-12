import jwt from "jsonwebtoken";
import User from "../models/User.js";
import { AUTH_COOKIE_NAME } from "../controllers/authController.js";
import { roleRequiresVerification } from "../config/verificationDocs.js";

/**
 * What an account that still owes document verification may call: its own session, the
 * verification flow and its notifications. Everything else is refused until a moderator
 * activates the account — the SPA already confines these users to the Verification page
 * (routes/VerificationGate.tsx); this is the same rule where it actually counts.
 */
const UNVERIFIED_ALLOWED_PREFIXES = Object.freeze(["/api/auth", "/api/verification", "/api/notifications"]);

/** @param {{ role?: string; account_status?: string } | null | undefined} user */
export const isAwaitingVerification = (user) =>
  !!user && roleRequiresVerification(user.role) && user.account_status !== "active";

/** @param {string | undefined} originalUrl */
export const isAllowedWhileUnverified = (originalUrl) => {
  const path = String(originalUrl ?? "").split("?")[0];
  return UNVERIFIED_ALLOWED_PREFIXES.some((prefix) => path === prefix || path.startsWith(`${prefix}/`));
};

/**
 * Extracts the JWT from either the httpOnly cookie (preferred, used by the
 * browser SPA) or the Authorization: Bearer header (legacy / API clients).
 */
const extractToken = (req) => {
  const fromCookie = req.cookies?.[AUTH_COOKIE_NAME];
  if (fromCookie) return fromCookie;

  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith("Bearer ")) {
    return authHeader.slice("Bearer ".length).trim() || null;
  }
  return null;
};

/**
 * authenticate
 * Verifies the JWT (cookie or Bearer header) → attaches the user row to req.user.
 * Accounts still awaiting document verification are limited to the verification flow.
 */
export const authenticate = async (req, res, next) => {
  try {
    const token = extractToken(req);
    if (!token) {
      return res.status(401).json({ success: false, message: "Not authenticated" });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET, { algorithms: ["HS256"] });

    const user = await User.findById(decoded.id);
    if (!user || !user.is_active) {
      return res.status(401).json({ success: false, message: "Session invalid" });
    }

    if (isAwaitingVerification(user) && !isAllowedWhileUnverified(req.originalUrl)) {
      return res.status(403).json({
        success: false,
        code: "VERIFICATION_REQUIRED",
        message: "Complete document verification to access this.",
      });
    }

    req.user = user;
    next();
  } catch {
    return res.status(401).json({ success: false, message: "Invalid or expired session" });
  }
};

/**
 * authorizeRoles
 * Restricts a route to users with specific roles.
 * Usage: authorizeRoles("super_admin")
 */
export const authorizeRoles = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: `Access denied. Required role(s): ${roles.join(", ")}`,
      });
    }
    next();
  };
};
