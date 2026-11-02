-- 025_sale_documents_and_dealer_ledger.sql
-- Adds dedicated sale_documents column to phones table and creates dealer_ledger table

-- 1. Ensure sale_documents column exists on phones
ALTER TABLE phones ADD COLUMN sale_documents TEXT DEFAULT '[]';

-- 2. Ensure balance column exists on dealers
ALTER TABLE dealers ADD COLUMN balance REAL NOT NULL DEFAULT 0;

-- 3. Create dealer_ledger table for B2B accounting & tracking
CREATE TABLE IF NOT EXISTS dealer_ledger (
  id              TEXT PRIMARY KEY,
  dealer_id       TEXT NOT NULL REFERENCES dealers(id) ON DELETE CASCADE,
  type            TEXT NOT NULL CHECK(type IN ('debit', 'credit')),
  amount          REAL NOT NULL,
  balance_after   REAL NOT NULL DEFAULT 0,
  payment_mode    TEXT DEFAULT 'cash',
  description     TEXT,
  reference_id    TEXT,
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  created_by      TEXT,
  shop_id         TEXT
);

CREATE INDEX IF NOT EXISTS idx_dealer_ledger_dealer ON dealer_ledger(dealer_id, created_at DESC);
