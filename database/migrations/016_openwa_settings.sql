-- 016_openwa_settings.sql
-- Store OpenWA gateway URL, API key, and dual session preferences

ALTER TABLE admin_settings ADD COLUMN openwa_url TEXT DEFAULT 'http://127.0.0.1:2785';
ALTER TABLE admin_settings ADD COLUMN openwa_api_key TEXT DEFAULT '';
ALTER TABLE admin_settings ADD COLUMN openwa_unified_mode INTEGER DEFAULT 0;

