/**
 * SQLite connection + automatic migration runner.
 * Nothing else in the codebase opens the database file.
 */
import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import { PATHS, DATABASE_DEF_DIR, ensureDirs } from "../config/paths.js";
import { logger } from "../lib/logger.js";

let db = null;

export function getDb() {
  if (!db) throw new Error("Database not initialized - call initDatabase() first");
  return db;
}

export function initDatabase() {
  ensureDirs();
  db = new Database(PATHS.databaseFile);
  db.pragma("journal_mode = WAL");   // corruption-safe, atomic writes
  db.pragma("synchronous = FULL");
  db.pragma("foreign_keys = OFF");   // Disabled during DDL migrations
  db.pragma("busy_timeout = 5000");

  db.exec(`CREATE TABLE IF NOT EXISTS schema_migrations (
    version    TEXT PRIMARY KEY,
    applied_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`);

  runMigrations();
  try {
    db.prepare("ALTER TABLE phones ADD COLUMN imei2_number TEXT").run();
  } catch {}
  try {
    db.prepare("ALTER TABLE admin_settings ADD COLUMN evolution_api_url TEXT").run();
  } catch {}
  try {
    db.prepare("ALTER TABLE admin_settings ADD COLUMN evolution_api_key TEXT").run();
  } catch {}
  try {
    db.prepare("ALTER TABLE admin_settings ADD COLUMN evolution_instance_name TEXT").run();
  } catch {}
  try {
    db.prepare("ALTER TABLE admin_settings ADD COLUMN supabase_url TEXT").run();
  } catch {}
  try {
    db.prepare("ALTER TABLE admin_settings ADD COLUMN supabase_anon_key TEXT").run();
  } catch {}
  try {
    db.prepare("ALTER TABLE admin_settings ADD COLUMN ocr_engine TEXT DEFAULT 'auto'").run();
  } catch {}
  try {
    db.prepare("ALTER TABLE admin_settings ADD COLUMN hicelltek_api_key TEXT").run();
  } catch {}
  try {
    db.prepare("ALTER TABLE sellers ADD COLUMN bank_account_number TEXT").run();
  } catch {}
  try {
    db.prepare("ALTER TABLE sellers ADD COLUMN bank_ifsc TEXT").run();
  } catch {}
  try {
    db.prepare("ALTER TABLE sellers ADD COLUMN bank_name TEXT").run();
  } catch {}
  try {
    db.prepare("ALTER TABLE sellers ADD COLUMN account_holder_name TEXT").run();
  } catch {}
  try {
    db.prepare("ALTER TABLE users ADD COLUMN active_shop_id TEXT").run();
  } catch {}
  try {
    db.prepare("ALTER TABLE users ADD COLUMN security_question TEXT").run();
  } catch {}
  try {
    db.prepare("ALTER TABLE users ADD COLUMN security_answer_hash TEXT").run();
  } catch {}
  runSeed();
  db.pragma("foreign_keys = ON");    // Enforce for runtime operations
  logger.info("Database ready", { file: PATHS.databaseFile });
  return db;
}

function runMigrations() {
  const dir = path.join(DATABASE_DEF_DIR, "migrations");
  if (!fs.existsSync(dir)) return;
  const applied = new Set(db.prepare("SELECT version FROM schema_migrations").all().map((r) => r.version));
  const files = fs.readdirSync(dir).filter((f) => f.endsWith(".sql")).sort();

  for (const file of files) {
    const version = file.replace(/\.sql$/, "");
    if (applied.has(version)) continue;
    const sql = fs.readFileSync(path.join(dir, file), "utf8");
    const tx = db.transaction(() => {
      try {
        db.exec(sql);
      } catch (err) {
        if (!err.message.includes("duplicate column name")) {
          throw err;
        }
      }
      db.prepare("INSERT INTO schema_migrations (version) VALUES (?)").run(version);
    });
    try {
      tx();
      logger.info("Migration applied", { version });
    } catch (err) {
      logger.error("Migration failed - startup aborted", err);
      throw new Error(`Migration ${version} failed: ${err.message}`);
    }
  }
}

function runSeed() {
  const seed = path.join(DATABASE_DEF_DIR, "seed.sql");
  if (fs.existsSync(seed)) db.exec(fs.readFileSync(seed, "utf8"));
}

/** Run fn inside a transaction; any throw rolls the whole thing back. */
export function transaction(fn) {
  return getDb().transaction(fn)();
}

export function closeDatabase() {
  if (db) {
    db.close();
    db = null;
  }
}
