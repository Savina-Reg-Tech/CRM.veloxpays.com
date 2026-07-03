/**
 * Password rules for new accounts (create user / seed).
 * Login does not re-validate format — only creation.
 */

const MIN_LENGTH = 10;
const MAX_LENGTH = 128;
// At least one character from common safe special set
const SPECIAL_RE = /[!@#$%^&*()_+\-=[\]{}|;:,.<>?/\\~`"']/;

export const PASSWORD_POLICY_SUMMARY =
  `Password must be ${MIN_LENGTH}–${MAX_LENGTH} characters and include uppercase, lowercase, a number, and a special character.`;

/**
 * @param {unknown} password
 * @returns {{ valid: true } | { valid: false, message: string }}
 */
export function validatePassword(password) {
  if (password === undefined || password === null) {
    return { valid: false, message: "Password is required" };
  }
  if (typeof password !== "string") {
    return { valid: false, message: "Password is required" };
  }

  const trimmed = password.trim();
  if (trimmed.length !== password.length) {
    return { valid: false, message: "Password must not have leading or trailing spaces" };
  }
  if (trimmed.length < MIN_LENGTH || trimmed.length > MAX_LENGTH) {
    return {
      valid: false,
      message: `Password must be between ${MIN_LENGTH} and ${MAX_LENGTH} characters`,
    };
  }
  if (!/[A-Z]/.test(trimmed)) {
    return { valid: false, message: "Password must include at least one uppercase letter" };
  }
  if (!/[a-z]/.test(trimmed)) {
    return { valid: false, message: "Password must include at least one lowercase letter" };
  }
  if (!/\d/.test(trimmed)) {
    return { valid: false, message: "Password must include at least one number" };
  }
  if (!SPECIAL_RE.test(trimmed)) {
    return {
      valid: false,
      message:
        "Password must include at least one special character (e.g. ! @ # $ % ^ & * _ - + =)",
    };
  }

  return { valid: true };
}
