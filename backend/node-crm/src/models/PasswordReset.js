import { query } from "../../config/db.js";

/**
 * Self-service "Forgot password" OTP requests — see migration
 * 019_password_reset_otp.sql. One unconsumed row per user at a time:
 * `invalidatePending` clears any earlier pending row before a fresh OTP is
 * issued, so at most one OTP is ever valid.
 */
const PasswordReset = {
  /** Delete any unconsumed OTP rows for this user (called right before issuing a new one). */
  invalidatePending: async (userId) => {
    await query(
      `DELETE FROM password_resets WHERE user_id = $1 AND consumed_at IS NULL`,
      [userId]
    );
  },

  /** Insert a new OTP row. `otpHash` is a bcrypt hash — the plain OTP is never stored. */
  create: async ({ userId, otpHash, expiresAt }) => {
    const { rows } = await query(
      `INSERT INTO password_resets (user_id, otp_hash, expires_at)
       VALUES ($1, $2, $3)
       RETURNING id, user_id, expires_at, attempts, created_at`,
      [userId, otpHash, expiresAt]
    );
    return rows[0];
  },

  /** Most recent unconsumed, unexpired OTP row for this user (if any). */
  findLatestValid: async (userId) => {
    const { rows } = await query(
      `SELECT id, user_id, otp_hash, expires_at, attempts
         FROM password_resets
        WHERE user_id = $1 AND consumed_at IS NULL AND expires_at > NOW()
        ORDER BY created_at DESC
        LIMIT 1`,
      [userId]
    );
    return rows[0] || null;
  },

  /** Bump the failed-attempt counter on a pending OTP row. */
  incrementAttempts: async (id) => {
    await query(`UPDATE password_resets SET attempts = attempts + 1 WHERE id = $1`, [id]);
  },

  /** Mark an OTP row as used, once the password has actually been changed. */
  markConsumed: async (id) => {
    await query(`UPDATE password_resets SET consumed_at = NOW() WHERE id = $1`, [id]);
  },
};

export default PasswordReset;
