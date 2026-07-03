-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 011 — Document verification (KYC) on top of the approval workflow
--
-- Design (per product decision):
--   • Each uploaded document is tracked by ONE approval_request of the new kind
--     'document_verification' (subject_user_id = the document owner). The
--     document's lifecycle status (Pending / Under Review / Approved / Rejected)
--     is the approval_request.status, and its audit trail is approval_actions —
--     so we reuse the existing engine instead of a parallel state machine.
--   • verification_documents stores only FILE METADATA (never the bytes) and the
--     link to its approval_request.
--   • users gains account_status + verification_deadline + archived_at so that
--     unverified accounts can be EXPIRED and SOFT-DELETED after 7 days (no hard
--     deletes — audit/compliance history is preserved).
-- ─────────────────────────────────────────────────────────────────────────────

-- ── Extend the approval kind enum (idempotent) ──────────────────────────────
DO $$ BEGIN
  ALTER TYPE approval_request_kind ADD VALUE IF NOT EXISTS 'document_verification';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- ── Account lifecycle status on users ───────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE account_status AS ENUM ('pending', 'active', 'suspended', 'expired');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS account_status account_status NOT NULL DEFAULT 'pending';

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS verification_deadline TIMESTAMPTZ;

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ;

-- Existing rows: anything already active should reflect that in the new column.
UPDATE users SET account_status = 'active' WHERE is_active = TRUE AND account_status = 'pending';

CREATE INDEX IF NOT EXISTS idx_users_account_status ON users (account_status);

-- Expiry sweep predicate: cheap lookup of still-unverified accounts with a deadline.
CREATE INDEX IF NOT EXISTS idx_users_verification_deadline
  ON users (verification_deadline)
  WHERE account_status = 'pending' AND archived_at IS NULL;

-- ── Document metadata (bytes live in S3 / local storage, never here) ─────────
CREATE TABLE IF NOT EXISTS verification_documents (
  id                  SERIAL PRIMARY KEY,

  user_id             INTEGER      NOT NULL
                        REFERENCES users(id) ON DELETE CASCADE,

  -- Validated at the application layer against the role → required-docs config.
  doc_type            VARCHAR(64)  NOT NULL,

  -- One approval_request drives this document's status + audit trail.
  approval_request_id INTEGER      NOT NULL
                        REFERENCES approval_requests(id) ON DELETE CASCADE,

  -- File metadata (spec § Document Management System).
  file_name           VARCHAR(255) NOT NULL,  -- stored/generated name
  original_file_name  VARCHAR(255) NOT NULL,  -- as uploaded by the user
  storage_path        TEXT         NOT NULL,  -- key/path within the storage backend
  file_url            TEXT,                   -- resolvable URL (S3 or local download route)
  mime_type           VARCHAR(100) NOT NULL,
  file_size           BIGINT       NOT NULL,

  uploaded_at         TIMESTAMPTZ  NOT NULL DEFAULT NOW(),

  -- Soft-delete marker (set by the expiry worker). Row is kept for audit.
  archived_at         TIMESTAMPTZ
);

-- A user keeps at most ONE live (non-archived) document per type; re-uploads
-- replace the prior live row at the application layer.
CREATE UNIQUE INDEX IF NOT EXISTS uq_verification_docs_live_type
  ON verification_documents (user_id, doc_type)
  WHERE archived_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_verification_docs_user
  ON verification_documents (user_id)
  WHERE archived_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_verification_docs_request
  ON verification_documents (approval_request_id);

-- ── In-app notifications ─────────────────────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE notification_channel AS ENUM ('in_app', 'email');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS notifications (
  id          SERIAL PRIMARY KEY,
  user_id     INTEGER      NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  event       VARCHAR(64)  NOT NULL,  -- e.g. document_approved, account_activated
  title       VARCHAR(200) NOT NULL,
  body        TEXT,
  metadata    JSONB,
  read_at     TIMESTAMPTZ,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_unread
  ON notifications (user_id, created_at DESC)
  WHERE read_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_notifications_user_created
  ON notifications (user_id, created_at DESC);

-- ── Audit enrichment: capture IP + actor role snapshot on every action ───────
-- approval_actions is already an append-only trail; add the columns the spec's
-- audit log requires (IP address, role). actor_id already links the user.
ALTER TABLE approval_actions
  ADD COLUMN IF NOT EXISTS ip_address INET;

ALTER TABLE approval_actions
  ADD COLUMN IF NOT EXISTS actor_role VARCHAR(32);
