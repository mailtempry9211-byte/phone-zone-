-- Migration 002 - Business settings (open-source / multi-business friendly).
--
-- admin_settings already holds the core business identity (business_name,
-- address, phone_primary, email, instagram, udyam_number, signature_url...).
-- This migration ONLY adds nullable columns for the extra fields the
-- first-run setup wizard and Settings screens expose, plus a single-row
-- "setup completed" flag. It never touches or deletes existing data.
--
-- Pre-existing rows that already carry a business_name are treated as
-- "already configured" (e.g. an upgraded PhoneZone install) so the first-run
-- wizard is NOT shown for them - their data is preserved verbatim.

ALTER TABLE admin_settings ADD COLUMN owner_name             TEXT;
ALTER TABLE admin_settings ADD COLUMN logo_url               TEXT;
ALTER TABLE admin_settings ADD COLUMN whatsapp_number        TEXT;
ALTER TABLE admin_settings ADD COLUMN google_business_url    TEXT;
ALTER TABLE admin_settings ADD COLUMN business_hours         TEXT;  -- JSON object
ALTER TABLE admin_settings ADD COLUMN terms_and_conditions   TEXT;
ALTER TABLE admin_settings ADD COLUMN invoice_prefix_purchase TEXT;
ALTER TABLE admin_settings ADD COLUMN invoice_prefix_sale     TEXT;
ALTER TABLE admin_settings ADD COLUMN invoice_prefix_return   TEXT;
ALTER TABLE admin_settings ADD COLUMN currency_code           TEXT;
ALTER TABLE admin_settings ADD COLUMN setup_completed         INTEGER NOT NULL DEFAULT 0;

-- Mark every row that already has business data as "setup already done".
-- Fresh installs (empty business_name) keep setup_completed = 0 so the
-- first-run wizard is shown.
UPDATE admin_settings
   SET setup_completed = 1
 WHERE business_name IS NOT NULL
   AND business_name <> '';
