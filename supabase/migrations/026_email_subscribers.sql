-- Migration 026: Lightweight email capture for Phase 1 launch
--
-- Captures emails from the global footer form and the SubscribeSheet.
-- Phase 2 will extend this with categories, frequency, and channel
-- endpoints (Telegram chat_id, web push subscriptions). For Phase 1
-- we only need the email + source so we don't lose any leads.

CREATE TABLE IF NOT EXISTS email_subscribers (
  id BIGSERIAL PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  source TEXT NOT NULL DEFAULT 'footer', -- 'footer' | 'sheet' | 'card' | 'onboarding'
  is_confirmed BOOLEAN NOT NULL DEFAULT FALSE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  frequency TEXT NOT NULL DEFAULT 'weekly', -- 'weekly' | '3x_week' | 'daily' | 'critical_only'
  unsubscribed_at TIMESTAMPTZ,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_email_subscribers_email ON email_subscribers(email);
CREATE INDEX IF NOT EXISTS idx_email_subscribers_user_id ON email_subscribers(user_id) WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_email_subscribers_active ON email_subscribers(frequency) WHERE unsubscribed_at IS NULL;

-- RLS: only service-role can read/write (digest cron). Public form
-- writes through a server action, not direct anon Postgres access.
ALTER TABLE email_subscribers ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE email_subscribers IS
  'Phase 1 email capture for daily/weekly digest. Phase 2 will add user_interests join + channel endpoints.';
