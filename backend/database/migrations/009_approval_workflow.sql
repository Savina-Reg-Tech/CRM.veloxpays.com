-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 009 — Approval workflow (requests + append-only actions)
--
-- ── Enums (idempotent) ──────────────────────────────────────────────────────

DO $$ BEGIN
  CREATE TYPE approval_request_kind AS ENUM ('user_onboarding', 'generic');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE approval_request_status AS ENUM (
    'pending',
    'in_review',
    'approved',
    'completed',
    'rejected',
    'cancelled'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- ── Main table ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS approval_requests (
  id               SERIAL PRIMARY KEY,
  kind             approval_request_kind   NOT NULL,
  status           approval_request_status NOT NULL DEFAULT 'pending',

  title            VARCHAR(200)            NOT NULL,
  body             JSONB,

  requester_id     INTEGER                 NOT NULL
                     REFERENCES users(id) ON DELETE RESTRICT,

  -- For user_onboarding: the CRM user row awaiting activation / final approval.
  subject_user_id  INTEGER
                     REFERENCES users(id) ON DELETE CASCADE,

  -- Optional explicit queue owner for the "Review" step (nullable).
  assigned_to_id   INTEGER
                     REFERENCES users(id) ON DELETE SET NULL,

  -- Last user who approved or rejected (audit convenience; full trail is in approval_actions).
  decided_by_id    INTEGER
                     REFERENCES users(id) ON DELETE SET NULL,

  decision_note    TEXT,

  created_at       TIMESTAMPTZ             NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ             NOT NULL DEFAULT NOW(),
  completed_at     TIMESTAMPTZ,

  CONSTRAINT chk_user_onboarding_subject CHECK (
    kind <> 'user_onboarding' OR subject_user_id IS NOT NULL
  )
);

-- ── Append-only audit log (every state transition) ───────────────────────────

CREATE TABLE IF NOT EXISTS approval_actions (
  id           SERIAL PRIMARY KEY,
  request_id   INTEGER                   NOT NULL
                 REFERENCES approval_requests(id) ON DELETE CASCADE,
  actor_id     INTEGER                   NOT NULL
                 REFERENCES users(id) ON DELETE RESTRICT,

  from_status  approval_request_status,
  to_status    approval_request_status   NOT NULL,

  note         TEXT,
  metadata     JSONB,

  created_at   TIMESTAMPTZ               NOT NULL DEFAULT NOW()
);

-- ── Indexes ─────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_approval_requests_status_created
  ON approval_requests (status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_approval_requests_requester
  ON approval_requests (requester_id);

CREATE INDEX IF NOT EXISTS idx_approval_requests_assigned
  ON approval_requests (assigned_to_id)
  WHERE assigned_to_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_approval_requests_subject_user
  ON approval_requests (subject_user_id)
  WHERE subject_user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_approval_actions_request_created
  ON approval_actions (request_id, created_at ASC);

-- At most one *open* user-onboarding request per subject user (prevents duplicates).
CREATE UNIQUE INDEX IF NOT EXISTS uq_approval_open_user_onboarding
  ON approval_requests (subject_user_id)
  WHERE kind = 'user_onboarding'
    AND status NOT IN ('completed', 'rejected', 'cancelled');

-- ── Keep updated_at in sync (application layer may also set this) ───────────

CREATE OR REPLACE FUNCTION trg_set_approval_requests_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS approval_requests_set_updated_at ON approval_requests;

CREATE TRIGGER approval_requests_set_updated_at
  BEFORE UPDATE ON approval_requests
  FOR EACH ROW
  EXECUTE FUNCTION trg_set_approval_requests_updated_at();
