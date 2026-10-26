import Database from '../backend/node_modules/better-sqlite3/lib/index.js';
import { scryptSync, randomBytes } from 'node:crypto';
import path from 'node:path';
import crypto from 'node:crypto';

const KEYLEN = 64;
function hashPassword(plain) {
  const salt = randomBytes(16).toString('hex');
  return salt + ':' + scryptSync(plain, salt, KEYLEN).toString('hex');
}

const newPassword = '112233';
const hash = hashPassword(newPassword);

const dbPaths = [
  './data/database/phonezone.db',
  path.join(process.env.APPDATA, 'PhoneZone', 'database', 'phonezone.db')
];

for (const dbPath of dbPaths) {
  console.log('Processing:', dbPath);
  try {
    const db = new Database(dbPath);
    
    // Clear any active sessions
    try { db.prepare('DELETE FROM sessions').run(); } catch {}
    
    // Check if 'admin' user exists
    const adminUser = db.prepare('SELECT id, email FROM users WHERE email = ?').get('admin');
    if (adminUser) {
      db.prepare("UPDATE users SET password_hash = ?, updated_at = datetime('now') WHERE id = ?").run(hash, adminUser.id);
      console.log('Updated existing admin user in', dbPath);
    } else {
      const newId = crypto.randomUUID();
      db.prepare('INSERT INTO users (id, email, password_hash, display_name) VALUES (?, ?, ?, ?)').run(newId, 'admin', hash, 'Admin');
      db.prepare('INSERT INTO user_roles (id, user_id, role) VALUES (?, ?, ?)').run(crypto.randomUUID(), newId, 'admin');
      console.log('Created admin user in', dbPath);
    }

    // Also update any other admin accounts
    db.prepare("UPDATE users SET password_hash = ? WHERE email LIKE '%admin%'").run(hash);
    
    const allUsers = db.prepare('SELECT id, email, display_name FROM users').all();
    console.log('Users now in', dbPath, ':', allUsers);
  } catch (e) {
    console.error('Error on', dbPath, e.message);
  }
}
