-- GDPR unsubscribe support for subscribers
-- Adds per-subscriber unsubscribe token + timestamp of opt-out.

ALTER TABLE subscribers
  ADD COLUMN IF NOT EXISTS unsubscribe_token TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS unsubscribed_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_subscribers_unsubscribe_token
  ON subscribers(unsubscribe_token);

CREATE INDEX IF NOT EXISTS idx_subscribers_unsubscribed_at
  ON subscribers(unsubscribed_at);
