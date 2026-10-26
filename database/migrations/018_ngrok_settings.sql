-- Migration 018 - Ngrok embedded tunnel configuration
--
-- Saves auth token, claimed domain, and tunnel status so that the shop
-- can be brought online with 1-click in the portable EXE.

CREATE TABLE IF NOT EXISTS ngrok_config (
  id TEXT PRIMARY KEY,
  authtoken TEXT,
  claimed_domain TEXT,
  is_enabled INTEGER NOT NULL DEFAULT 0,
  last_url TEXT,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

INSERT OR IGNORE INTO ngrok_config (id, authtoken, claimed_domain, is_enabled)
VALUES ('default', '', '', 0);

