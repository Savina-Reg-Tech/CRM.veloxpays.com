-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 010 — Freeze subject CRM role at user_onboarding ticket open (AF-5)
--
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE approval_requests
  ADD COLUMN IF NOT EXISTS subject_user_role_snapshot user_role;

-- Existing volumes may have VARCHAR from an earlier 010; normalize to user_role.
DO $$ BEGIN
  ALTER TABLE approval_requests
    ALTER COLUMN subject_user_role_snapshot TYPE user_role
    USING subject_user_role_snapshot::user_role;
EXCEPTION
  WHEN undefined_column THEN NULL;
  WHEN duplicate_column THEN NULL;
  WHEN others THEN NULL;
END $$;

UPDATE approval_requests r
   SET subject_user_role_snapshot = u.role
  FROM users u
 WHERE r.subject_user_id = u.id
   AND r.kind = 'user_onboarding'
   AND r.subject_user_role_snapshot IS NULL;
