-- Migration 013: WhatsApp Marketing module and opt-in tracking

ALTER TABLE customers ADD COLUMN whatsapp_opt_in INTEGER DEFAULT 0;
ALTER TABLE customers ADD COLUMN wa_opted_out_at TEXT;
ALTER TABLE repair_customers ADD COLUMN wa_opted_out_at TEXT;

CREATE TABLE IF NOT EXISTS wa_templates (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  content     TEXT NOT NULL,
  category    TEXT DEFAULT 'general',
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS wa_campaigns (
  id           TEXT PRIMARY KEY,
  name         TEXT NOT NULL,
  template_id  TEXT REFERENCES wa_templates(id),
  status       TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'running', 'paused', 'completed')),
  total_count  INTEGER DEFAULT 0,
  sent_count   INTEGER DEFAULT 0,
  failed_count INTEGER DEFAULT 0,
  dry_run      INTEGER DEFAULT 0,
  created_at   TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at   TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS wa_queue (
  id             TEXT PRIMARY KEY,
  campaign_id    TEXT REFERENCES wa_campaigns(id),
  customer_id    TEXT,
  customer_phone TEXT NOT NULL,
  customer_name  TEXT,
  message        TEXT NOT NULL,
  status         TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed')),
  scheduled_at   TEXT NOT NULL DEFAULT (datetime('now')),
  sent_at        TEXT,
  error          TEXT,
  created_at     TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_wa_queue_status ON wa_queue(status);
CREATE INDEX IF NOT EXISTS idx_wa_queue_phone ON wa_queue(customer_phone);

CREATE TABLE IF NOT EXISTS wa_message_log (
  id             TEXT PRIMARY KEY,
  queue_id       TEXT,
  customer_phone TEXT NOT NULL,
  status         TEXT NOT NULL,
  error          TEXT,
  sent_at        TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS wa_tokens (
  id          TEXT PRIMARY KEY,
  token_hash  TEXT NOT NULL UNIQUE,
  description TEXT,
  revoked_at  TEXT,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

