-- 015_repair_jobs_optional_imei.sql
-- Allow NULL imei for dead phones or tablets without available IMEI numbers

DROP TABLE IF EXISTS repair_jobs_new;
CREATE TABLE repair_jobs_new (
  id                   TEXT PRIMARY KEY,
  job_no               TEXT NOT NULL UNIQUE,
  shop_id              TEXT,
  repair_customer_id   TEXT NOT NULL REFERENCES repair_customers(id),
  device_brand         TEXT,
  device_model         TEXT,
  imei                 TEXT,
  imei2                TEXT,
  tac                  TEXT,
  problem              TEXT NOT NULL,
  accessories_received TEXT,
  passcode_note        TEXT,
  estimate             REAL,
  advance_paid         REAL DEFAULT 0,
  parts_cost           REAL DEFAULT 0,
  labour_cost          REAL DEFAULT 0,
  final_price          REAL,
  status               TEXT NOT NULL DEFAULT 'received' CHECK (status IN ('received','diagnosing','waiting_parts','in_progress','ready','delivered','cancelled')),
  payment_status       TEXT DEFAULT 'unpaid' CHECK (payment_status IN ('unpaid','partial','paid')),
  board_replaced       INTEGER DEFAULT 0,
  warranty_days        INTEGER DEFAULT 30,
  technician           TEXT,
  received_at          TEXT DEFAULT (datetime('now')),
  ready_at             TEXT,
  delivered_at         TEXT,
  notes                TEXT,
  financial_year       TEXT,
  deleted_at           TEXT,
  created_at           TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at           TEXT NOT NULL DEFAULT (datetime('now'))
);

INSERT OR IGNORE INTO repair_jobs_new 
SELECT id, job_no, shop_id, repair_customer_id, device_brand, device_model,
       imei, imei2, tac, problem, accessories_received, passcode_note,
       estimate, advance_paid, parts_cost, labour_cost, final_price,
       status, payment_status, board_replaced, warranty_days, technician,
       received_at, ready_at, delivered_at, notes, financial_year,
       deleted_at, created_at, updated_at
FROM repair_jobs;

DROP TABLE repair_jobs;
ALTER TABLE repair_jobs_new RENAME TO repair_jobs;
CREATE INDEX IF NOT EXISTS idx_repair_jobs_imei ON repair_jobs(imei);
CREATE INDEX IF NOT EXISTS idx_repair_jobs_cust ON repair_jobs(repair_customer_id);
CREATE INDEX IF NOT EXISTS idx_repair_jobs_status ON repair_jobs(status);

