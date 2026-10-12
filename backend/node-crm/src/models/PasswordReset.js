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

  /**
   * Spend one guess on a pending OTP row. Counted in a single statement BEFORE the code is
   * compared, so any number of parallel requests can never get more than `maxAttempts`
   * guesses between them. Returns false when the row has no guesses left (or is gone).
   */
  claimAttempt: async (id, maxAttempts) => {
    const { rowCount } = await query(
      `UPDATE password_resets
          SET attempts = attempts + 1
        WHERE id = $1 AND attempts < $2 AND consumed_at IS NULL AND expires_at > NOW()`,
      [id, maxAttempts]
    );
    return rowCount === 1;
  },

  /** Mark an OTP row as used. Returns false if it was already used (single-use, race-safe). */
  markConsumed: async (id) => {
    const { rowCount } = await query(
      `UPDATE password_resets SET consumed_at = NOW() WHERE id = $1 AND consumed_at IS NULL`,
      [id]
    );
    return rowCount === 1;
  },
};

export default PasswordReset;
