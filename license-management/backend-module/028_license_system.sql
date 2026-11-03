-- Migration 028: License System for PhoneZone
-- Stores local activation state, hardware lock, and offline license cache

CREATE TABLE IF NOT EXISTS license_state (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  software_id TEXT NOT NULL DEFAULT 'phonezone',
  license_key TEXT,
  status TEXT NOT NULL DEFAULT 'unlicensed', -- 'unlicensed', 'active', 'expired', 'suspended', 'terminated', 'god_mode'
  plan_type TEXT DEFAULT 'none',             -- 'god_mode', 'lifetime', 'yearly', 'monthly', 'trial'
  customer_name TEXT,
  customer_phone TEXT,
  shop_name TEXT,
  valid_from TEXT,
  valid_until TEXT,
  allowed_platforms TEXT DEFAULT '["all"]',   -- JSON array: ["exe"], ["apk"], ["web"], ["linux"], ["all"]
  hardware_lock_enabled INTEGER DEFAULT 1,
  bound_hardware_id TEXT,
  max_active_devices INTEGER DEFAULT 1,
  offline_grace_until TEXT,
  last_validated_at TEXT,
  signature TEXT,
  activated_at TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

INSERT OR IGNORE INTO license_state (id, software_id, status) VALUES (1, 'phonezone', 'unlicensed');
