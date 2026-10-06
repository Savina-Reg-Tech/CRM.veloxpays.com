/**
 * Support staff get read-only access to the VeloxVerse customer-journey audit log
 * (VeloxVerse maps the CRM role claim "support" to SUPPORT and masks customer email,
 * name, IP and browser itself). They may never change settings, manage alert
 * recipients or export — VeloxVerse enforces this too; this is the CRM's own check
 * so those requests never leave the CRM.
 */
export const AUDIT_SUPPORT_ROLE = "support";

const ADMIN_ONLY_PATHS = /^\/(settings|alert-recipients|export\.csv)(\/|$|\?)/;

/** Mount under /api/vv-admin/admin/audit, after authenticate + authorizeRoles. */
export function auditSupportGuard(req, res, next) {
  if (req.user?.role !== AUDIT_SUPPORT_ROLE) return next();
  if (req.method !== "GET" || ADMIN_ONLY_PATHS.test(req.path)) {
    return res.status(403).json({
      success: false,
      message: "You do not have permission to access this resource.",
    });
  }
  return next();
}
