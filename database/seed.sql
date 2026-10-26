-- Application seed data. Idempotent: safe to run on every boot.
--
-- IMPORTANT (open-source / multi-business): admin_settings MUST start EMPTY on a
-- fresh installation so no previous business's data is ever pre-filled.
-- Existing installations keep their already-configured row (INSERT OR IGNORE)
-- and migration 002 marks any row that already has a business_name as
-- "setup completed" - so existing data is preserved and never overwritten.

INSERT OR IGNORE INTO admin_settings (id, business_name, business_tagline, setup_completed)
VALUES ('00000000-0000-0000-0000-000000000001', '', '', 0);

INSERT OR IGNORE INTO invoice_counters (invoice_type, fiscal_year, last_number) VALUES
  ('purchase', strftime('%Y', 'now'), 0),
  ('sale',     strftime('%Y', 'now'), 0),
  ('return',   strftime('%Y', 'now'), 0);
