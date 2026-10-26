-- PhoneZone offline database - initial schema
-- Derived 1:1 from the live Supabase/Postgres schema (public schema).
-- Postgres enums are represented as TEXT + CHECK constraints.
-- Postgres uuid defaults are generated in the application layer (crypto.randomUUID()).

PRAGMA foreign_keys = ON;

-- ---------------------------------------------------------------------------
-- admin_settings : single-row business configuration
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS admin_settings (
  id                TEXT PRIMARY KEY,
  signature_url     TEXT,
  business_name     TEXT    NOT NULL DEFAULT '',
  business_tagline  TEXT    NOT NULL DEFAULT '',
  address           TEXT    NOT NULL DEFAULT '',
  phone_primary     TEXT    NOT NULL DEFAULT '',
  phone_secondary   TEXT    NOT NULL DEFAULT '',
  email             TEXT    NOT NULL DEFAULT '',
  instagram         TEXT    NOT NULL DEFAULT '',
  udyam_number      TEXT    NOT NULL DEFAULT '',
  created_at        TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at        TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- ---------------------------------------------------------------------------
-- Local authentication (replaces Supabase Auth)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
  id            TEXT PRIMARY KEY,
  email         TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,          -- scrypt: <salt-hex>:<hash-hex>
  display_name  TEXT,
  is_active     INTEGER NOT NULL DEFAULT 1,
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Mirrors public.user_roles + app_role enum (admin | staff | viewer)
CREATE TABLE IF NOT EXISTS user_roles (
  id         TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role       TEXT NOT NULL CHECK (role IN ('admin','staff','viewer')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (user_id, role)
);

CREATE TABLE IF NOT EXISTS sessions (
  id         TEXT PRIMARY KEY,          -- opaque random token
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  expires_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);

-- ---------------------------------------------------------------------------
-- sellers  (mirrors public.sellers)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sellers (
  id                TEXT PRIMARY KEY,
  name              TEXT NOT NULL,
  phone             TEXT NOT NULL,
  address           TEXT NOT NULL,
  id_proof_type     TEXT NOT NULL CHECK (id_proof_type IN ('aadhaar','pan','driving_license','voter_id')),
  id_number         TEXT NOT NULL,
  seller_photo_url  TEXT,
  aadhaar_photo_url TEXT,
  deleted_at        TEXT,
  created_at        TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at        TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_sellers_phone ON sellers(phone);
CREATE INDEX IF NOT EXISTS idx_sellers_name  ON sellers(name);

-- ---------------------------------------------------------------------------
-- customers (mirrors public.customers)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS customers (
  id                 TEXT PRIMARY KEY,
  name               TEXT NOT NULL,
  phone              TEXT NOT NULL,
  address            TEXT NOT NULL,
  id_proof_type      TEXT NOT NULL CHECK (id_proof_type IN ('aadhaar','pan','driving_license','voter_id')),
  id_number          TEXT NOT NULL,
  customer_photo_url TEXT,
  aadhaar_photo_url  TEXT,
  deleted_at         TEXT,
  created_at         TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at         TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_customers_phone ON customers(phone);
CREATE INDEX IF NOT EXISTS idx_customers_name  ON customers(name);

-- ---------------------------------------------------------------------------
-- phones : purchase record + inventory item (same single table as Supabase)
-- Postgres ARRAY columns are stored as JSON arrays of storage-relative paths.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS phones (
  id                    TEXT PRIMARY KEY,
  phone_name            TEXT    NOT NULL,
  model                 TEXT    NOT NULL,
  imei_number           TEXT    NOT NULL,
  condition             TEXT    NOT NULL CHECK (condition IN ('excellent','good','fair','poor')),
  purchase_price        REAL    NOT NULL,
  selling_price         REAL    NOT NULL,
  purchase_date         TEXT    NOT NULL,
  rating                REAL,
  bill_available        INTEGER NOT NULL DEFAULT 0,
  box_available         INTEGER NOT NULL DEFAULT 0,
  charger_available     INTEGER NOT NULL DEFAULT 0,
  features              TEXT    NOT NULL DEFAULT '[]',  -- JSON array
  product_photos        TEXT    NOT NULL DEFAULT '[]',  -- JSON array of paths
  payment_proof_photos  TEXT    NOT NULL DEFAULT '[]',  -- JSON array of paths (PRIVATE)
  purchase_documents    TEXT    NOT NULL DEFAULT '[]',  -- JSON array of paths (PRIVATE)
  payment_method        TEXT    NOT NULL CHECK (payment_method IN ('cash','upi','bank_transfer','card')),
  seller_id             TEXT    NOT NULL REFERENCES sellers(id),
  customer_id           TEXT    REFERENCES customers(id),
  is_sold               INTEGER NOT NULL DEFAULT 0,
  sold_date             TEXT,
  return_status         TEXT,
  return_reason         TEXT,
  return_date           TEXT,
  return_amount         REAL,
  return_processed_date TEXT,
  return_type           TEXT,
  deleted_at            TEXT,
  created_at            TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at            TEXT    NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_phones_is_sold   ON phones(is_sold);
CREATE INDEX IF NOT EXISTS idx_phones_imei      ON phones(imei_number);
CREATE INDEX IF NOT EXISTS idx_phones_seller    ON phones(seller_id);
CREATE INDEX IF NOT EXISTS idx_phones_customer  ON phones(customer_id);
CREATE INDEX IF NOT EXISTS idx_phones_purchased ON phones(purchase_date);

-- ---------------------------------------------------------------------------
-- returns (mirrors public.returns)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS returns (
  id                        TEXT PRIMARY KEY,
  phone_id                  TEXT NOT NULL REFERENCES phones(id),
  return_type               TEXT NOT NULL CHECK (return_type IN ('sales_return','purchase_return')),
  return_amount             REAL NOT NULL,
  return_reason             TEXT NOT NULL,
  return_date               TEXT NOT NULL DEFAULT (datetime('now')),
  processed_by              TEXT,
  customer_id               TEXT REFERENCES customers(id),
  seller_id                 TEXT REFERENCES sellers(id),
  original_transaction_date TEXT,
  notes                     TEXT,
  created_at                TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at                TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_returns_phone ON returns(phone_id);

-- ---------------------------------------------------------------------------
-- messages : public contact-form enquiries (mirrors public.messages)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS messages (
  id         TEXT PRIMARY KEY,
  name       TEXT NOT NULL,
  email      TEXT NOT NULL,
  phone      TEXT,
  message    TEXT NOT NULL,
  is_read    INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_messages_read ON messages(is_read);

-- ---------------------------------------------------------------------------
-- invoices : local replacement for on-the-fly HTML invoices (now persisted)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS invoices (
  id             TEXT PRIMARY KEY,
  invoice_number TEXT NOT NULL UNIQUE,
  invoice_type   TEXT NOT NULL CHECK (invoice_type IN ('purchase','sale','return')),
  phone_id       TEXT REFERENCES phones(id),
  seller_id      TEXT REFERENCES sellers(id),
  customer_id    TEXT REFERENCES customers(id),
  amount         REAL NOT NULL,
  html_path      TEXT,
  pdf_path       TEXT,
  issued_at      TEXT NOT NULL DEFAULT (datetime('now')),
  created_at     TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_invoices_type ON invoices(invoice_type);

-- Monotonic per-type invoice counters (prevents duplicate invoice numbers)
CREATE TABLE IF NOT EXISTS invoice_counters (
  invoice_type TEXT PRIMARY KEY,
  fiscal_year  TEXT NOT NULL,
  last_number  INTEGER NOT NULL DEFAULT 0
);

-- ---------------------------------------------------------------------------
-- repairs : repair-service jobs (new offline module, was WhatsApp-only)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS repairs (
  id                  TEXT PRIMARY KEY,
  customer_id         TEXT REFERENCES customers(id),
  customer_name       TEXT NOT NULL,
  customer_phone      TEXT NOT NULL,
  device              TEXT NOT NULL,
  imei_number         TEXT,
  service_type        TEXT NOT NULL,
  problem             TEXT NOT NULL,
  estimated_cost      REAL,
  final_cost          REAL,
  status              TEXT NOT NULL DEFAULT 'received'
                      CHECK (status IN ('received','in_progress','completed','delivered','cancelled')),
  payment_status      TEXT NOT NULL DEFAULT 'unpaid'
                      CHECK (payment_status IN ('unpaid','partial','paid')),
  received_date       TEXT NOT NULL DEFAULT (datetime('now')),
  expected_completion TEXT,
  warranty_days       INTEGER NOT NULL DEFAULT 30,
  notes               TEXT,
  photos              TEXT NOT NULL DEFAULT '[]',
  deleted_at          TEXT,
  created_at          TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at          TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_repairs_status ON repairs(status);

-- ---------------------------------------------------------------------------
-- files : metadata for every locally stored upload (binaries live on disk)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS files (
  id            TEXT PRIMARY KEY,
  owner_type    TEXT NOT NULL,   -- seller | customer | phone | repair | invoice
  owner_id      TEXT NOT NULL,
  category      TEXT NOT NULL,   -- photo | aadhaar | document | payment_proof | invoice
  relative_path TEXT NOT NULL UNIQUE,
  original_name TEXT,
  mime_type     TEXT,
  size_bytes    INTEGER,
  is_public     INTEGER NOT NULL DEFAULT 0,
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_files_owner ON files(owner_type, owner_id);

-- ---------------------------------------------------------------------------
-- audit_logs
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS audit_logs (
  id         TEXT PRIMARY KEY,
  user_id    TEXT,
  action     TEXT NOT NULL,
  entity     TEXT,
  entity_id  TEXT,
  details    TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_logs(created_at);

-- ---------------------------------------------------------------------------
-- updated_at triggers (replaces Postgres BEFORE UPDATE trigger functions)
-- ---------------------------------------------------------------------------
CREATE TRIGGER IF NOT EXISTS trg_sellers_updated   AFTER UPDATE ON sellers   FOR EACH ROW BEGIN UPDATE sellers   SET updated_at = datetime('now') WHERE id = OLD.id; END;
CREATE TRIGGER IF NOT EXISTS trg_customers_updated AFTER UPDATE ON customers FOR EACH ROW BEGIN UPDATE customers SET updated_at = datetime('now') WHERE id = OLD.id; END;
CREATE TRIGGER IF NOT EXISTS trg_phones_updated    AFTER UPDATE ON phones    FOR EACH ROW BEGIN UPDATE phones    SET updated_at = datetime('now') WHERE id = OLD.id; END;
CREATE TRIGGER IF NOT EXISTS trg_returns_updated   AFTER UPDATE ON returns   FOR EACH ROW BEGIN UPDATE returns   SET updated_at = datetime('now') WHERE id = OLD.id; END;
CREATE TRIGGER IF NOT EXISTS trg_repairs_updated   AFTER UPDATE ON repairs   FOR EACH ROW BEGIN UPDATE repairs   SET updated_at = datetime('now') WHERE id = OLD.id; END;
CREATE TRIGGER IF NOT EXISTS trg_settings_updated  AFTER UPDATE ON admin_settings FOR EACH ROW BEGIN UPDATE admin_settings SET updated_at = datetime('now') WHERE id = OLD.id; END;
