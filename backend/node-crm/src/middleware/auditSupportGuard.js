import { decodeProxyPath } from "./veloxverseProxy.js";

/**
 * Support staff get read-only access to the VeloxVerse customer-journey audit log
 * (VeloxVerse maps the CRM role claim "support" to SUPPORT and masks customer email,
 * name, IP and browser itself). They may never change settings, manage alert
 * recipients or export — VeloxVerse enforces this too; this is the CRM's own check
 * so those requests never leave the CRM.
 */
export const AUDIT_SUPPORT_ROLE = "support";

// Matched against the DECODED path, case-insensitively — VeloxVerse's router ignores case.
const ADMIN_ONLY_PATHS = /^\/(settings|alert-recipients|export\.csv)(\/|$)/i;

/** Mount under /api/vv-admin/admin/audit, after authenticate + authorizeRoles. */
export function auditSupportGuard(req, res, next) {
  if (req.user?.role !== AUDIT_SUPPORT_ROLE) return next();

  // The proxy's HTTP client resolves dot segments, so "/%2e%2e/users" would leave this mount and
  // reach any VeloxVerse admin endpoint. Judge the path the upstream will actually see, and
  // refuse anything that isn't a plain path.
  const path = decodeProxyPath(req.path);
  if (req.method !== "GET" || path === null || ADMIN_ONLY_PATHS.test(path)) {
    return res.status(403).json({
      success: false,
      message: "You do not have permission to access this resource.",
    });
  }
  return next();
}
