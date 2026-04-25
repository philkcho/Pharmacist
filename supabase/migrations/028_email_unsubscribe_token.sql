-- Migration 028: Per-subscriber unsubscribe token for one-click links
--
-- Each subscriber gets a random URL-safe token used in the
-- List-Unsubscribe header and the in-email unsubscribe link.
-- Hitting /api/unsubscribe/<token> sets unsubscribed_at and stops
-- future digest sends — no login required.

ALTER TABLE email_subscribers
  ADD COLUMN IF NOT EXISTS unsub_token TEXT UNIQUE;

-- Backfill any existing rows with a fresh token.
UPDATE email_subscribers
SET unsub_token = encode(gen_random_bytes(24), 'base64')
WHERE unsub_token IS NULL;

-- New rows must always have a token.
ALTER TABLE email_subscribers
  ALTER COLUMN unsub_token SET DEFAULT encode(gen_random_bytes(24), 'base64'),
  ALTER COLUMN unsub_token SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_email_subscribers_unsub_token
  ON email_subscribers(unsub_token);

COMMENT ON COLUMN email_subscribers.unsub_token IS
  'URL-safe random token used in /api/unsubscribe/<token> + List-Unsubscribe header.';
