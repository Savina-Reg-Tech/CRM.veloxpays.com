/**
 * Canonical CRM role names and who may create which role.
 * Single source of truth for user provisioning (see userService.createUser).
 */

/** @type {readonly string[]} */
export const ALLOWED_ROLES = Object.freeze([
  "super_admin",
  "admin",
  "employee",
  "agent",
  "affiliate",
]);

/**
 * @type {Readonly<Record<string, readonly string[]>>}
 * Maps creator role → roles they may create.
 */
export const ROLE_CREATION_MATRIX = Object.freeze({
  super_admin: ["super_admin", "admin", "employee", "agent", "affiliate"],
  admin: ["employee", "agent", "affiliate"],
  employee: ["agent", "affiliate"],
});

/**
 * @param {string | undefined} role
 * @returns {boolean}
 */
export function isKnownRole(role) {
  return typeof role === "string" && ALLOWED_ROLES.includes(role);
}

/**
 * Email of the primary/seed super-admin account. This account is the
 * fallback for regaining access to the CRM, so it can never be deactivated —
 * not even by another super admin. (No user-delete feature exists in the
 * CRM today; only activate/deactivate — see userService.toggleUserStatus.)
 */
export const PROTECTED_SUPER_ADMIN_EMAIL = "admin@crm.com";

/**
 * @param {string | undefined | null} email
 * @returns {boolean}
 */
export function isProtectedAccount(email) {
  return (
    typeof email === "string" &&
    email.trim().toLowerCase() === PROTECTED_SUPER_ADMIN_EMAIL
  );
}
