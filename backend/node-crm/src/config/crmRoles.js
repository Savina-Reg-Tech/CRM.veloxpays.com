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
