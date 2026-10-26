-- Migration 004 - TAC (type allocation code) engine + Hicelltek API support
-- Local TAC database first; the API is only a last-resort fallback (free plan:
-- 100 lookups/month), so unknown TACs are remembered instead of re-fetched.

CREATE TABLE IF NOT EXISTS tac_codes (
  tac        TEXT PRIMARY KEY CHECK (length(tac) = 8),
  brand      TEXT NOT NULL,
  phone_name TEXT NOT NULL,                 -- cleaned marketing name, goes to the "Phone Name" field
  model      TEXT NOT NULL,                 -- model code, goes to the "Model" field
  specs      TEXT,                          -- extra info like 'Global Model, 2025'
  specs_raw  TEXT,                          -- original SPECS cell
  source     TEXT NOT NULL DEFAULT 'excel', -- excel | api | learned | manual
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_tac_brand ON tac_codes(brand);

-- Remembers TACs the API did not know so the free quota is not wasted twice.
CREATE TABLE IF NOT EXISTS tac_api_misses (
  tac TEXT PRIMARY KEY, checked_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ask | auto | off - what to do when a TAC is not in the local database.
ALTER TABLE admin_settings ADD COLUMN tac_fetch_mode TEXT NOT NULL DEFAULT 'ask';

-- Used by the IMEI auto-fill / key rotation steps; NOT part of admin_settings
-- because /api/config is public and must never expose API keys.
CREATE TABLE IF NOT EXISTS hicelltek_keys (
  id TEXT PRIMARY KEY, label TEXT, api_key TEXT NOT NULL,
  position INTEGER NOT NULL DEFAULT 0, is_enabled INTEGER NOT NULL DEFAULT 1,
  monthly_limit INTEGER NOT NULL DEFAULT 100,          -- Hicelltek free plan
  exhausted_until TEXT, last_error TEXT,
  calls_this_month INTEGER NOT NULL DEFAULT 0, usage_month TEXT,   -- 'YYYY-MM' of calls_this_month
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
