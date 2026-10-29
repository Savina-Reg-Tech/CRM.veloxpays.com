-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 022 — Welcome tour state on staff accounts
-- tour_status   'completed' | 'dismissed' — saved by PATCH /api/auth/me/onboarding when
--               the user finishes or skips the tour; 'not_offered' — staff who existed
--               before the tour shipped (backfilled below; they are never auto-shown it).
--               NULL = not decided yet (new staff), so the tour may be offered.
-- tour_version  The tour version that status applies to; a higher CURRENT_TOUR_VERSION in
--               the frontend offers the tour again.
-- tour_seen_at  When tour_status was last saved (set by the server).
--
-- Idempotent. Run this BEFORE deploying the backend that reads these columns.
-- ─────────────────────────────────────────────────────────────────────────────

-- tour_status is added together with the backfill, so the backfill runs exactly once: when this
-- migration first adds the column. Later re-runs (the docker `migrate` service re-applies every
-- file) must not mark staff created since then as 'not_offered'.
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = current_schema() AND table_name = 'users' AND column_name = 'tour_status'
  ) THEN
    ALTER TABLE users ADD COLUMN tour_status VARCHAR(20);
    -- Existing staff: no automatic tour (the Quick Guide is still available to them).
    UPDATE users SET tour_status = 'not_offered';
  END IF;
END $$;

ALTER TABLE users ADD COLUMN IF NOT EXISTS tour_version INTEGER;
ALTER TABLE users ADD COLUMN IF NOT EXISTS tour_seen_at TIMESTAMPTZ;

DO $$ BEGIN
  ALTER TABLE users ADD CONSTRAINT users_tour_status_check
    CHECK (tour_status IN ('completed', 'dismissed', 'not_offered'));
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE users ADD CONSTRAINT users_tour_version_check
    CHECK (tour_version IS NULL OR tour_version > 0);
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
