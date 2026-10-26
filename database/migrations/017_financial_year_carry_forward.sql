-- Migration 017 - Financial year carry forward and previous year reflection tracking
--
-- Enables Tally / Busy style carry forward of closing stock and repair jobs,
-- and tracks changes made when operating in a previous financial year.

ALTER TABLE phones ADD COLUMN carried_to_fy TEXT;
ALTER TABLE repair_jobs ADD COLUMN carried_to_fy TEXT;
ALTER TABLE phones ADD COLUMN sold_in_fy TEXT;

CREATE INDEX IF NOT EXISTS idx_phones_carried_to_fy ON phones(carried_to_fy);
CREATE INDEX IF NOT EXISTS idx_repair_jobs_carried_to_fy ON repair_jobs(carried_to_fy);

CREATE TABLE IF NOT EXISTS financial_year_changes (
  id TEXT PRIMARY KEY,
  from_fy TEXT NOT NULL,
  to_fy TEXT NOT NULL,
  entity_type TEXT NOT NULL, -- 'phone', 'repair_job', 'stock'
  entity_id TEXT NOT NULL,
  action TEXT NOT NULL,      -- 'create', 'update', 'delete', 'sell', 'return'
  details TEXT,
  reflected INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  reflected_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_fy_changes_from_to ON financial_year_changes(from_fy, to_fy, reflected);

