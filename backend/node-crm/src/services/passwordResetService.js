/**
 * Self-service "Forgot password" flow — a user requests a reset, we email a
 * 6-digit OTP, they submit it back with a new password in one call.
 *
 * Security notes:
 *  - requestPasswordReset() always returns the same generic message whether
 *    or not the email belongs to an account (no user enumeration).
 *  - The OTP itself is never stored in plaintext — only its bcrypt hash
 *    (see models/PasswordReset.js).
 *  - A pending OTP allows a bounded number of wrong guesses (MAX_ATTEMPTS)
 *    before it's rejected outright, on top of the per-IP rate limits on the
 *    routes themselves (authRoutes.js) — defense in depth against a 6-digit
 *    code's naturally small (1,000,000) keyspace.
 */
import bcrypt from "bcrypt";
import crypto from "crypto";
import User from "../models/User.js";
import PasswordReset from "../models/PasswordReset.js";
import { validatePassword } from "../utils/passwordPolicy.js";
import { sendMail } from "../utils/mailer.js";
import { notify } from "./notificationService.js";
import { otpEmailTemplate, passwordChangedEmailTemplate } from "../utils/emailTemplates.js";

const OTP_TTL_MINUTES = 10;
const MAX_ATTEMPTS = 5;

// Same response whether the account exists, is inactive, or the email is
// simply unknown — otherwise this endpoint becomes a user-enumeration oracle.
const GENERIC_REQUEST_MESSAGE =
  "If an account exists for that email, we've sent a 6-digit code to it.";

// Same response for "no such OTP", "wrong OTP", "expired", and "too many
// attempts" — for the same reason as above (and so a caller can't tell
// which case applies).
const INVALID_OTP_ERROR = {
  status: 400,
  message: "That code is invalid or has expired. Request a new one.",
};

const generateOtp = () => crypto.randomInt(0, 1_000_000).toString().padStart(6, "0");

/**
 * Step 1 — request a reset code. Always resolves; never throws for "unknown
 * email" (that's folded into the generic message, not surfaced as an error).
 */
export const requestPasswordReset = async (email) => {
  const normalizedEmail = typeof email === "string" ? email.trim().toLowerCase() : "";
  if (!normalizedEmail) throw { status: 400, message: "Email is required" };

  const user = await User.findByEmail(normalizedEmail);
  if (!user || !user.is_active) {
    return { message: GENERIC_REQUEST_MESSAGE };
  }

  const otp = generateOtp();
  const otpHash = await bcrypt.hash(otp, 10);
  const expiresAt = new Date(Date.now() + OTP_TTL_MINUTES * 60 * 1000);

  await PasswordReset.invalidatePending(user.id);
  await PasswordReset.create({ userId: user.id, otpHash, expiresAt });

  const { subject, text, html } = otpEmailTemplate(user.name, otp, OTP_TTL_MINUTES);

  // Fire-and-forget — sendMail swallows its own errors, and a slow/failed
  // send must never make this endpoint hang or fail (would leak whether the
  // email exists via response time/status).
  void sendMail({ to: user.email, subject, text, html });

  return { message: GENERIC_REQUEST_MESSAGE };
};

/**
 * Step 2 — verify the code and set the new password in one call.
 */
export const resetPasswordWithOtp = async ({ email, otp, newPassword }) => {
  const normalizedEmail = typeof email === "string" ? email.trim().toLowerCase() : "";
  if (!normalizedEmail || !otp || !newPassword) {
    throw { status: 400, message: "Email, code, and new password are required" };
  }

  const pwdCheck = validatePassword(newPassword);
  if (!pwdCheck.valid) throw { status: 400, message: pwdCheck.message };

  const user = await User.findByEmail(normalizedEmail);
  if (!user || !user.is_active) throw INVALID_OTP_ERROR;

  const pending = await PasswordReset.findLatestValid(user.id);
  if (!pending || pending.attempts >= MAX_ATTEMPTS) throw INVALID_OTP_ERROR;

  const matches = await bcrypt.compare(String(otp).trim(), pending.otp_hash);
  if (!matches) {
    await PasswordReset.incrementAttempts(pending.id);
    throw INVALID_OTP_ERROR;
  }

  const hashedPassword = await bcrypt.hash(newPassword.trim(), 10);
  await User.setPassword(user.id, hashedPassword);
  await PasswordReset.markConsumed(pending.id);

  const changedEmail = passwordChangedEmailTemplate(user.name, {
    reason: 'You reset it yourself using the "Forgot password" link.',
  });

  // Best-effort — notification delivery must never roll back the reset itself.
  void notify({
    recipient: { id: user.id, email: user.email },
    event: "password_reset",
    title: changedEmail.subject,
    body: changedEmail.text,
    emailHtml: changedEmail.html,
    emailSubject: changedEmail.subject,
  }).catch(() => {});

  return { message: "Password reset successfully. You can now log in." };
};
