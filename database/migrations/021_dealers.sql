-- Migration 021: Dealers Tab, B2B Multi-phone Purchase, and Enhanced Campaigns

CREATE TABLE IF NOT EXISTS dealers (
  id              TEXT PRIMARY KEY,
  shop_name       TEXT NOT NULL,
  proprietor_name TEXT NOT NULL,
  phone           TEXT NOT NULL,
  alternate_phone TEXT,
  email           TEXT,
  address         TEXT,
  city            TEXT DEFAULT 'Sitapur',
  state           TEXT DEFAULT 'Uttar Pradesh',
  pincode         TEXT DEFAULT '261001',
  gst_number      TEXT,
  pan_number      TEXT,
  photo_url       TEXT,
  signature_url   TEXT,
  notes           TEXT,
  is_active       INTEGER DEFAULT 1,
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS dealer_batches (
  id              TEXT PRIMARY KEY,
  dealer_id       TEXT NOT NULL REFERENCES dealers(id),
  invoice_number  TEXT NOT NULL,
  purchase_date   TEXT DEFAULT (date('now')),
  total_phones    INTEGER NOT NULL DEFAULT 1,
  total_amount    NUMERIC NOT NULL DEFAULT 0,
  payment_method  TEXT DEFAULT 'UPI',
  payment_status  TEXT DEFAULT 'completed',
  notes           TEXT,
  created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

ALTER TABLE phones ADD COLUMN dealer_id TEXT REFERENCES dealers(id);
ALTER TABLE phones ADD COLUMN is_dealer INTEGER DEFAULT 0;
ALTER TABLE phones ADD COLUMN batch_purchase_id TEXT;

ALTER TABLE wa_campaigns ADD COLUMN audience_type TEXT DEFAULT 'all';
ALTER TABLE wa_campaigns ADD COLUMN media_url TEXT;
ALTER TABLE wa_campaigns ADD COLUMN media_type TEXT;
ALTER TABLE wa_campaigns ADD COLUMN delay_min INTEGER DEFAULT 25;
ALTER TABLE wa_campaigns ADD COLUMN delay_max INTEGER DEFAULT 60;

