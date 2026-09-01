-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 019 — Password reset OTPs
--
-- Self-service "Forgot password" flow: a user requests a reset, we email a
-- 6-digit OTP, and they submit it back along with a new password. One row
-- per request; passwordResetService.js supersedes any earlier unconsumed
-- OTP for the same user when a fresh one is requested, so at most one OTP
-- is ever valid at a time.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS password_resets (
  id           SERIAL       PRIMARY KEY,
  user_id      INTEGER      NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  otp_hash     TEXT         NOT NULL,           -- bcrypt hash of the 6-digit OTP — never stored plain
  expires_at   TIMESTAMPTZ  NOT NULL,
  attempts     INTEGER      NOT NULL DEFAULT 0,  -- failed verify attempts against this OTP
  consumed_at  TIMESTAMPTZ,                      -- set once the OTP is successfully used
  created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_password_resets_user_id ON password_resets(user_id);
