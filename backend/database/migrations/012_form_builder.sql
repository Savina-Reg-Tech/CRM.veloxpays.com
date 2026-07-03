-- ============================================================
-- Migration 012: Form Builder Module
-- Tables: forms, form_submissions, leads, blocked_email_domains
-- ============================================================

-- ── Lead status enum ─────────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE lead_status AS ENUM ('NEW', 'REVIEW', 'SPAM', 'CONVERTED');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- ── Form status enum ─────────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE form_status AS ENUM ('draft', 'published', 'archived');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- ── forms ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS forms (
  id              SERIAL PRIMARY KEY,
  name            VARCHAR(255)  NOT NULL,
  slug            VARCHAR(255)  NOT NULL UNIQUE,
  description     TEXT,
  form_json       JSONB         NOT NULL DEFAULT '{"fields":[]}',
  status          form_status   NOT NULL DEFAULT 'draft',
  submit_button_label VARCHAR(100) NOT NULL DEFAULT 'Submit',
  success_message TEXT          NOT NULL DEFAULT 'Thank you! Your submission has been received.',
  total_submissions INT         NOT NULL DEFAULT 0,
  total_leads       INT         NOT NULL DEFAULT 0,
  created_by      INT           REFERENCES users(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_forms_slug        ON forms(slug);
CREATE INDEX IF NOT EXISTS idx_forms_status      ON forms(status);
CREATE INDEX IF NOT EXISTS idx_forms_created_by  ON forms(created_by);

-- ── blocked_email_domains ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS blocked_email_domains (
  id          SERIAL PRIMARY KEY,
  domain      VARCHAR(255) NOT NULL UNIQUE,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- Seed common disposable email domains
INSERT INTO blocked_email_domains (domain) VALUES
  ('mailinator.com'),
  ('10minutemail.com'),
  ('guerrillamail.com'),
  ('temp-mail.org'),
  ('throwaway.email'),
  ('yopmail.com'),
  ('sharklasers.com'),
  ('guerrillamailblock.com'),
  ('grr.la'),
  ('guerrillamail.info'),
  ('spam4.me'),
  ('trashmail.com'),
  ('trashmail.me'),
  ('maildrop.cc'),
  ('dispostable.com')
ON CONFLICT (domain) DO NOTHING;

-- ── leads ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS leads (
  id              SERIAL PRIMARY KEY,
  form_id         INT          NOT NULL REFERENCES forms(id) ON DELETE CASCADE,
  form_name       VARCHAR(255),                          -- snapshot at submission time
  email           VARCHAR(255),
  name            VARCHAR(255),
  phone           VARCHAR(100),
  submission_data JSONB        NOT NULL DEFAULT '{}',
  lead_source     VARCHAR(100) NOT NULL DEFAULT 'Website Form',
  status          lead_status  NOT NULL DEFAULT 'NEW',
  spam_score      INT          NOT NULL DEFAULT 0,
  ip_address      VARCHAR(45),
  user_agent      TEXT,
  time_taken_seconds DECIMAL(8,2),
  converted_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_leads_form_id    ON leads(form_id);
CREATE INDEX IF NOT EXISTS idx_leads_status     ON leads(status);
CREATE INDEX IF NOT EXISTS idx_leads_email      ON leads(email);
CREATE INDEX IF NOT EXISTS idx_leads_spam_score ON leads(spam_score);
CREATE INDEX IF NOT EXISTS idx_leads_created_at ON leads(created_at DESC);

-- ── form_submissions ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS form_submissions (
  id                  SERIAL PRIMARY KEY,
  form_id             INT          NOT NULL REFERENCES forms(id) ON DELETE CASCADE,
  lead_id             INT          REFERENCES leads(id) ON DELETE SET NULL,
  submission_data     JSONB        NOT NULL DEFAULT '{}',
  email               VARCHAR(255),
  ip_address          VARCHAR(45),
  user_agent          TEXT,
  time_taken_seconds  DECIMAL(8,2),
  spam_score          INT          NOT NULL DEFAULT 0,
  status              lead_status  NOT NULL DEFAULT 'NEW',
  created_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_submissions_form_id    ON form_submissions(form_id);
CREATE INDEX IF NOT EXISTS idx_submissions_email      ON form_submissions(email);
CREATE INDEX IF NOT EXISTS idx_submissions_status     ON form_submissions(status);
CREATE INDEX IF NOT EXISTS idx_submissions_created_at ON form_submissions(created_at DESC);

-- ── updated_at triggers ───────────────────────────────────────
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$ BEGIN
  CREATE TRIGGER trg_forms_updated_at
    BEFORE UPDATE ON forms
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TRIGGER trg_leads_updated_at
    BEFORE UPDATE ON leads
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
EXCEPTION WHEN duplicate_object THEN null;
END $$;
