/**
 * Local authentication (replaces Supabase Auth).
 * scrypt password hashing, opaque session tokens in the sessions table.
 */
import { scryptSync, randomBytes, timingSafeEqual, createHash } from "node:crypto";
import { getDb } from "../db/index.js";
import { newId, newToken, unauthorized, badRequest } from "../lib/errors.js";
import { SERVER } from "../config/business.js";
import { audit } from "./auditService.js";

const KEYLEN = 64;

/**
 * Session tokens are stored HASHED (sha256), never in plaintext. The raw token
 * only ever exists in the client's cookie / Bearer header, so a leaked copy of
 * the database file cannot be replayed as a live login.
 */
export function hashToken(token) {
  return createHash("sha256").update(String(token || "")).digest("hex");
}

export function hashPassword(plain) {
  const salt = randomBytes(16).toString("hex");
  return `${salt}:${scryptSync(plain, salt, KEYLEN).toString("hex")}`;
}

export function verifyPassword(plain, stored) {
  const [salt, hash] = String(stored || "").split(":");
  if (!salt || !hash) return false;
  const a = Buffer.from(hash, "hex");
  const b = scryptSync(plain, salt, KEYLEN);
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * Startup account bootstrap.
 *
 * The first-run wizard (POST /api/setup) is the ONLY normal way the first admin
 * is created. This function therefore does nothing unless the operator has
 * explicitly set PHONEZONE_ADMIN_PASSWORD (unattended/server installs), and it
 * NEVER generates or prints a temporary password - a random password printed to
 * a console nobody sees (Electron hides stdout) left a permanently-valid admin
 * account behind every fresh install.
 */
export function ensureBootstrapAdmin() {
  // Opt-in only. No env password => no automatic account, ever.
  if (!process.env.PHONEZONE_ADMIN_PASSWORD) return { created: false, reason: "no_env_password" };

  const db = getDb();
  // Existing installs (and restored backups) are never touched.
  if (db.prepare("SELECT COUNT(*) AS n FROM users").get().n > 0) return { created: false, reason: "users_exist" };

  const settingsRow = db.prepare("SELECT setup_completed FROM admin_settings WHERE id = ?")
    .get("00000000-0000-0000-0000-000000000001");
  if (settingsRow?.setup_completed) return { created: false, reason: "setup_completed" };

  const email = process.env.PHONEZONE_ADMIN_EMAIL || "admin@phonezone.local";
  const id = newId();
  db.transaction(() => {
    db.prepare("INSERT INTO users (id, email, password_hash, display_name) VALUES (?,?,?,?)")
      .run(id, email, hashPassword(process.env.PHONEZONE_ADMIN_PASSWORD), "PhoneZone Admin");
    db.prepare("INSERT INTO user_roles (id, user_id, role) VALUES (?,?,?)").run(newId(), id, "admin");
  })();

  return { created: true, email };
}

/** Create a user account. */
export function createUser(email, password, displayName, shopId = "shop_1", role = "admin") {
  const db = getDb();
  const id = newId();
  db.transaction(() => {
    db.prepare("INSERT INTO users (id, email, password_hash, display_name, shop_id) VALUES (?,?,?,?,?)")
      .run(id, String(email).trim().toLowerCase(), hashPassword(password), displayName || email, shopId || "shop_1");
    db.prepare("INSERT INTO user_roles (id, user_id, role) VALUES (?,?,?)").run(newId(), id, role || "admin");
  })();
  return { id, email: String(email).trim().toLowerCase(), shopId: shopId || "shop_1", role: role || "admin" };
}

export function listUsers() {
  const db = getDb();
  const users = db.prepare("SELECT id, email, display_name, shop_id, is_active, created_at FROM users ORDER BY created_at ASC").all();
  return users.map((u) => ({
    ...u,
    roles: rolesOf(u.id),
  }));
}

export function updateUser(userId, { email, displayName, role, isActive }, adminUserId) {
  const db = getDb();
  const existing = db.prepare("SELECT * FROM users WHERE id = ?").get(userId);
  if (!existing) throw badRequest("User not found.");

  db.transaction(() => {
    const newEmail = email !== undefined ? String(email).trim().toLowerCase() : existing.email;
    const newDisplayName = displayName !== undefined ? String(displayName).trim() : existing.display_name;
    const newIsActive = isActive !== undefined ? (isActive ? 1 : 0) : existing.is_active;

    db.prepare(
      "UPDATE users SET email = ?, display_name = ?, is_active = ?, updated_at = datetime('now') WHERE id = ?"
    ).run(newEmail, newDisplayName, newIsActive, userId);

    if (role) {
      db.prepare("DELETE FROM user_roles WHERE user_id = ?").run(userId);
      db.prepare("INSERT INTO user_roles (id, user_id, role) VALUES (?,?,?)").run(newId(), userId, role);
    }
  })();

  if (adminUserId) {
    audit(adminUserId, "user.updated", "user", userId, { email, displayName, role, isActive });
  }

  return { ok: true, id: userId };
}

export function adminSetUserPassword(userId, newPassword, adminUserId) {
  if (String(newPassword || "").length < 6) {
    throw badRequest("New password must be at least 6 characters.");
  }
  const db = getDb();
  const existing = db.prepare("SELECT id FROM users WHERE id = ?").get(userId);
  if (!existing) throw badRequest("User not found.");

  db.prepare("UPDATE users SET password_hash = ?, updated_at = datetime('now') WHERE id = ?")
    .run(hashPassword(newPassword), userId);

  // Terminate any active sessions for this user so they re-login
  db.prepare("DELETE FROM sessions WHERE user_id = ?").run(userId);

  if (adminUserId) {
    audit(adminUserId, "user.password_reset_by_admin", "user", userId);
  }

  return { ok: true };
}

export function deleteUser(userId, adminUserId) {
  if (userId === adminUserId) {
    throw badRequest("You cannot delete your own logged-in admin account.");
  }
  const db = getDb();
  const existing = db.prepare("SELECT id, email FROM users WHERE id = ?").get(userId);
  if (!existing) throw badRequest("User not found.");

  db.transaction(() => {
    db.prepare("DELETE FROM sessions WHERE user_id = ?").run(userId);
    db.prepare("DELETE FROM user_roles WHERE user_id = ?").run(userId);
    db.prepare("DELETE FROM users WHERE id = ?").run(userId);
  })();

  if (adminUserId) {
    audit(adminUserId, "user.deleted", "user", userId, { email: existing.email });
  }

  return { ok: true };
}

export function login(email, password) {
  const db = getDb();
  const user = db.prepare("SELECT * FROM users WHERE email = ? AND is_active = 1").get(String(email || "").trim().toLowerCase());
  if (!user || !verifyPassword(password, user.password_hash)) {
    throw unauthorized("Incorrect email or password.");
  }
  const token = newToken();
  const expires = new Date(Date.now() + SERVER.sessionTtlHours * 3600_000).toISOString();
  // Only the hash is persisted - the raw token stays with the client.
  db.prepare("INSERT INTO sessions (id, user_id, expires_at) VALUES (?,?,?)").run(hashToken(token), user.id, expires);
  audit(user.id, "auth.login");
  return { token, expiresAt: expires, user: publicUser(user) };
}

export function logout(token) {
  if (token) getDb().prepare("DELETE FROM sessions WHERE id = ?").run(hashToken(token));
}

export function logoutAll(userId) {
  if (userId) {
    getDb().prepare("DELETE FROM sessions WHERE user_id = ?").run(userId);
    audit(userId, "auth.logout_all");
  } else {
    getDb().prepare("DELETE FROM sessions").run();
  }
}

export function sessionUser(token) {
  if (!token) return null;
  const db = getDb();
  const id = hashToken(token);
  const row = db
    .prepare(
      `SELECT u.*, s.expires_at FROM sessions s JOIN users u ON u.id = s.user_id
       WHERE s.id = ? AND u.is_active = 1`,
    )
    .get(id);
  if (!row) return null;
  if (new Date(row.expires_at) < new Date()) {
    db.prepare("DELETE FROM sessions WHERE id = ?").run(id);
    return null;
  }
  return publicUser(row);
}

export function changePassword(userId, currentPassword, newPassword) {
  const db = getDb();
  const user = db.prepare("SELECT * FROM users WHERE id = ?").get(userId);
  if (!user || !verifyPassword(currentPassword, user.password_hash)) {
    throw badRequest("Your current password is not correct.");
  }
  if (String(newPassword || "").length < 6) throw badRequest("New password must be at least 6 characters.");
  db.prepare("UPDATE users SET password_hash = ?, updated_at = datetime('now') WHERE id = ?")
    .run(hashPassword(newPassword), userId);
  db.prepare("DELETE FROM sessions WHERE user_id = ?").run(userId); // force re-login everywhere
  audit(userId, "auth.password_changed");
}

export function rolesOf(userId) {
  return getDb().prepare("SELECT role FROM user_roles WHERE user_id = ?").all(userId).map((r) => r.role);
}

function publicUser(row) {
  return {
    id: row.id,
    email: row.email,
    displayName: row.display_name,
    shopId: row.shop_id || "shop_1",
    roles: rolesOf(row.id),
  };
}

export function listUserSessions(userId) {
  const db = getDb();
  return db
    .prepare("SELECT id, expires_at, created_at FROM sessions WHERE user_id = ? AND expires_at >= datetime('now') ORDER BY created_at DESC")
    .all(userId);
}

export function revokeSession(sessionId, userId) {
  const db = getDb();
  const info = db.prepare("DELETE FROM sessions WHERE id = ? AND user_id = ?").run(sessionId, userId);
  return { ok: true, revoked: info.changes > 0 };
}

export function purgeExpiredSessions() {
  getDb().prepare("DELETE FROM sessions WHERE expires_at < datetime('now')").run();
}
