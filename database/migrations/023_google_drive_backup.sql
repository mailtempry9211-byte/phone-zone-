ALTER TABLE admin_settings ADD COLUMN google_drive_folder TEXT NOT NULL DEFAULT '';
ALTER TABLE admin_settings ADD COLUMN backup_on_logout INTEGER NOT NULL DEFAULT 1;
ALTER TABLE admin_settings ADD COLUMN last_cloud_backup_at TEXT;

