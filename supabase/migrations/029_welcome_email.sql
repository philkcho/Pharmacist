-- Migration 029: Welcome email tracking
--
-- Adds welcome_sent_at column so we can fire the welcome email exactly
-- once per email address — idempotent across re-subscribe / re-login
-- flows. Auth-only signups (no prior subscribe form) also land here:
-- the auth callback upserts an email_subscribers row with
-- source='signup' on first login.

ALTER TABLE email_subscribers
  ADD COLUMN IF NOT EXISTS welcome_sent_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_email_subscribers_welcome_pending
  ON email_subscribers (id)
  WHERE welcome_sent_at IS NULL AND unsubscribed_at IS NULL;

COMMENT ON COLUMN email_subscribers.welcome_sent_at IS
  'Timestamp the welcome email was successfully delivered via Resend. NULL = not yet sent.';
