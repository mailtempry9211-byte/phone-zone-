-- Migration 006 - Financial years (Busy / Tally style year-wise books)
--
-- Design notes
--   * Every accounting row (phone purchase/sale, return, invoice) is stamped
--     with the financial year (FY) it belongs to. Reads default to the ACTIVE
--     year, so starting a new year shows an empty book.
--   * Nothing is ever moved or deleted. Opening an older year (by switching the
--     active year) works on the SAME rows, so an edit made in the old year stays
--     in the old year and never "leaks" into the new one.
--   * Customers and sellers are intentionally NOT year-scoped: they are carried
--     forward into every new year automatically.
--
-- Indian financial year runs 1 April - 31 March, so it is labelled e.g. "2026-27".

CREATE TABLE IF NOT EXISTS financial_years (
  id         TEXT PRIMARY KEY,
  label      TEXT NOT NULL UNIQUE,          -- e.g. 2026-27
  start_date TEXT NOT NULL,                 -- YYYY-04-01
  end_date   TEXT NOT NULL,                 -- YYYY-03-31
  is_active  INTEGER NOT NULL DEFAULT 0,    -- exactly one row is 1 at a time
  is_closed  INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  closed_at  TEXT,
  closed_by  TEXT
);
CREATE INDEX IF NOT EXISTS idx_financial_years_active ON financial_years(is_active);

-- Year stamp on every accounting row (nullable so adding the column never fails).
ALTER TABLE phones   ADD COLUMN financial_year TEXT;
ALTER TABLE returns  ADD COLUMN financial_year TEXT;
ALTER TABLE invoices ADD COLUMN financial_year TEXT;

CREATE INDEX IF NOT EXISTS idx_phones_financial_year   ON phones(financial_year);
CREATE INDEX IF NOT EXISTS idx_returns_financial_year  ON returns(financial_year);
CREATE INDEX IF NOT EXISTS idx_invoices_financial_year ON invoices(financial_year);

-- Seed the current financial year if none exists yet.
INSERT INTO financial_years (id, label, start_date, end_date, is_active, is_closed)
SELECT
  'fy-00000000-0000-0000-0000-000000000001',
  (CASE WHEN CAST(strftime('%m','now') AS INTEGER) >= 4
        THEN strftime('%Y','now')
        ELSE strftime('%Y', date('now','-1 year')) END)
  || '-' ||
  substr(CAST((CASE WHEN CAST(strftime('%m','now') AS INTEGER) >= 4
        THEN CAST(strftime('%Y','now') AS INTEGER) + 1
        ELSE CAST(strftime('%Y','now') AS INTEGER) END) AS TEXT), 3),
  (CASE WHEN CAST(strftime('%m','now') AS INTEGER) >= 4
        THEN strftime('%Y','now')
        ELSE strftime('%Y', date('now','-1 year')) END) || '-04-01',
  (CASE WHEN CAST(strftime('%m','now') AS INTEGER) >= 4
        THEN CAST(CAST(strftime('%Y','now') AS INTEGER) + 1 AS TEXT)
        ELSE strftime('%Y','now') END) || '-03-31',
  1, 0
WHERE NOT EXISTS (SELECT 1 FROM financial_years);

-- Existing rows belong to the current (seeded) financial year.
UPDATE phones   SET financial_year = (SELECT label FROM financial_years WHERE is_active = 1 LIMIT 1) WHERE financial_year IS NULL;
UPDATE returns  SET financial_year = (SELECT label FROM financial_years WHERE is_active = 1 LIMIT 1) WHERE financial_year IS NULL;
UPDATE invoices SET financial_year = (SELECT label FROM financial_years WHERE is_active = 1 LIMIT 1) WHERE financial_year IS NULL;
