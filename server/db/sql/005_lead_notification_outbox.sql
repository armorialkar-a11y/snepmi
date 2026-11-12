-- Queue only new leads. Existing leads, catalogue and settings are not modified.
CREATE TABLE IF NOT EXISTS lead_notification_outbox (
  lead_id bigint PRIMARY KEY REFERENCES leads(id) ON DELETE CASCADE,
  attempts integer NOT NULL DEFAULT 0,
  next_attempt_at timestamptz NOT NULL DEFAULT now(),
  locked_until timestamptz,
  lease_token uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS lead_notification_outbox_due_idx
  ON lead_notification_outbox (next_attempt_at);
