-- 014_expand_user_roles.sql
-- Expand user_roles CHECK constraint to support dedicated specialized roles:
-- 'master_admin', 'sales_admin', 'repair_admin', 'technician', 'admin', 'staff', 'viewer'

CREATE TABLE IF NOT EXISTS user_roles_new (
  id         TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role       TEXT NOT NULL CHECK (role IN ('master_admin', 'sales_admin', 'repair_admin', 'technician', 'admin', 'staff', 'viewer')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (user_id, role)
);

INSERT OR IGNORE INTO user_roles_new (id, user_id, role, created_at, updated_at)
SELECT id, user_id, role, created_at, updated_at FROM user_roles;

DROP TABLE user_roles;
ALTER TABLE user_roles_new RENAME TO user_roles;

