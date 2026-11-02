ALTER TABLE admin_settings ADD COLUMN homepage_theme TEXT NOT NULL DEFAULT 'modern';
ALTER TABLE admin_settings ADD COLUMN homepage_config TEXT;
ALTER TABLE admin_settings ADD COLUMN repair_services_catalog TEXT;

