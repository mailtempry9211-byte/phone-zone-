-- Migration 022 - Auto-start toggles for OpenWA WhatsApp Gateway and Ngrok Tunnel
ALTER TABLE admin_settings ADD COLUMN openwa_auto_start INTEGER DEFAULT 1;
ALTER TABLE ngrok_config ADD COLUMN auto_start INTEGER DEFAULT 1;

