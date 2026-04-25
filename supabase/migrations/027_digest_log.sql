-- Migration 027: Digest send log for de-duplication
--
-- One row per (subscriber, item) successfully delivered. The cron uses
-- this to make sure the same article isn't sent to the same subscriber
-- within a 30-day window — even if it stays popular.

CREATE TABLE IF NOT EXISTS digest_log (
  id BIGSERIAL PRIMARY KEY,
  subscriber_id BIGINT NOT NULL REFERENCES email_subscribers(id) ON DELETE CASCADE,
  item_url TEXT NOT NULL,
  item_kind TEXT NOT NULL, -- 'trend' | 'expert' | 'analysis' | 'is-safe' | 'vs' | 'ingredient'
  item_slug TEXT,
  channel TEXT NOT NULL DEFAULT 'email', -- 'email' | 'telegram' | 'web_push'
  resend_email_id TEXT,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_digest_log_subscriber ON digest_log(subscriber_id, sent_at DESC);
CREATE INDEX IF NOT EXISTS idx_digest_log_dedupe ON digest_log(subscriber_id, item_url, sent_at DESC);

ALTER TABLE digest_log ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE digest_log IS
  'Per-send record. Cron filters candidates by NOT EXISTS in this table for the last 30 days.';
