-- Migration 003 - Add bank details, verification flags, and separate T&C
-- Supports: bank details in setup/invoices, Udyam/Google verification,
--           separate terms for sales vs purchase

ALTER TABLE admin_settings ADD COLUMN bank_name            TEXT;
ALTER TABLE admin_settings ADD COLUMN account_holder_name   TEXT;
ALTER TABLE admin_settings ADD COLUMN account_number        TEXT;
ALTER TABLE admin_settings ADD COLUMN ifsc_code             TEXT;
ALTER TABLE admin_settings ADD COLUMN udyam_verified        INTEGER NOT NULL DEFAULT 0;
ALTER TABLE admin_settings ADD COLUMN google_business_verified INTEGER NOT NULL DEFAULT 0;
ALTER TABLE admin_settings ADD COLUMN show_google_business  INTEGER NOT NULL DEFAULT 0;
ALTER TABLE admin_settings ADD COLUMN terms_and_conditions_sale   TEXT;
ALTER TABLE admin_settings ADD COLUMN terms_and_conditions_purchase TEXT;
