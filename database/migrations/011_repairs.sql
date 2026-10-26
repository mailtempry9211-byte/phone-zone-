-- ---------------------------------------------------------------------------
-- Migration 011: Dedicated Private Repairs Module
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS repair_customers (
  id                   TEXT PRIMARY KEY,
  shop_id              TEXT,
  name                 TEXT NOT NULL,
  phone                TEXT NOT NULL UNIQUE,
  address              TEXT,
  id_proof_type        TEXT CHECK (id_proof_type IN ('aadhaar','pan','driving_license','voter_id')),
  id_number            TEXT,
  photo_file_id        TEXT,
  aadhaar_photo_file_id TEXT,
  whatsapp_opt_in      INTEGER DEFAULT 0,
  deleted_at           TEXT,
  created_at           TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at           TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS repair_jobs (
  id                   TEXT PRIMARY KEY,
  job_no               TEXT NOT NULL UNIQUE,
  shop_id              TEXT,
  repair_customer_id   TEXT NOT NULL REFERENCES repair_customers(id),
  device_brand         TEXT,
  device_model         TEXT,
  imei                 TEXT NOT NULL,
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

CREATE TABLE IF NOT EXISTS repair_job_items (
  id          TEXT PRIMARY KEY,
  job_id      TEXT NOT NULL REFERENCES repair_jobs(id),
  kind        TEXT NOT NULL CHECK (kind IN ('part','labour')),
  description TEXT NOT NULL,
  qty         REAL DEFAULT 1,
  unit_price  REAL NOT NULL DEFAULT 0,
  is_board    INTEGER DEFAULT 0,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS repair_status_log (
  id      TEXT PRIMARY KEY,
  job_id  TEXT NOT NULL REFERENCES repair_jobs(id),
  status  TEXT NOT NULL,
  note    TEXT,
  user_id TEXT,
  at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS repair_job_counters (
  shop_code   TEXT NOT NULL,
  fiscal_year TEXT NOT NULL,
  last_number INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (shop_code, fiscal_year)
);

CREATE INDEX IF NOT EXISTS idx_repair_jobs_imei ON repair_jobs(imei);
CREATE INDEX IF NOT EXISTS idx_repair_jobs_status ON repair_jobs(status);
CREATE INDEX IF NOT EXISTS idx_repair_jobs_customer ON repair_jobs(repair_customer_id);
CREATE INDEX IF NOT EXISTS idx_repair_customers_phone ON repair_customers(phone);
CREATE INDEX IF NOT EXISTS idx_repair_job_items_job ON repair_job_items(job_id);
CREATE INDEX IF NOT EXISTS idx_repair_status_log_job ON repair_status_log(job_id);

CREATE TRIGGER IF NOT EXISTS trg_repair_customers_updated AFTER UPDATE ON repair_customers FOR EACH ROW BEGIN UPDATE repair_customers SET updated_at = datetime('now') WHERE id = OLD.id; END;
CREATE TRIGGER IF NOT EXISTS trg_repair_jobs_updated AFTER UPDATE ON repair_jobs FOR EACH ROW BEGIN UPDATE repair_jobs SET updated_at = datetime('now') WHERE id = OLD.id; END;

