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

// Character sets exclude visually-ambiguous glyphs (I/O/0/1) so generated
// passwords are easy for an admin to read aloud or retype.
const GEN_UPPER = "ABCDEFGHJKLMNPQRSTUVWXYZ";
const GEN_LOWER = "abcdefghijkmnpqrstuvwxyz";
const GEN_DIGITS = "23456789";
const GEN_SPECIAL = "!@#$%^&*_-+=";

const randomChar = (set) => set[Math.floor(Math.random() * set.length)];

/**
 * Generates a random password that satisfies {@link validatePassword}.
 * Used for admin-triggered password resets when no specific password is supplied.
 *
 * @param {number} [length=14]
 * @returns {string}
 */
export function generateStrongPassword(length = 14) {
  const required = [
    randomChar(GEN_UPPER),
    randomChar(GEN_LOWER),
    randomChar(GEN_DIGITS),
    randomChar(GEN_SPECIAL),
  ];
  const all = GEN_UPPER + GEN_LOWER + GEN_DIGITS + GEN_SPECIAL;
  const rest = Array.from({ length: Math.max(length - required.length, 0) }, () =>
    randomChar(all)
  );
  const chars = [...required, ...rest];

  // Fisher–Yates shuffle so the required characters aren't always up front.
  for (let i = chars.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join("");
}
