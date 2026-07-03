import jwt from "jsonwebtoken";
import User from "../models/User.js";
import { AUTH_COOKIE_NAME } from "../controllers/authController.js";

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
 */
export const authenticate = async (req, res, next) => {
  try {
    const token = extractToken(req);
    if (!token) {
      return res.status(401).json({ success: false, message: "Not authenticated" });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const user = await User.findById(decoded.id);
    if (!user || !user.is_active) {
      return res.status(401).json({ success: false, message: "Session invalid" });
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
