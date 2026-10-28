/**
 * Central path service. EVERY filesystem path in the backend comes from here.
 *
 * Data location precedence:
 *   1. PHONEZONE_DATA_DIR env var (set by Electron main process / start scripts)
 *   2. Windows : %APPDATA%\PhoneZone
 *      macOS   : ~/Library/Application Support/PhoneZone
 *      Linux   : $XDG_DATA_HOME/PhoneZone or ~/.local/share/PhoneZone
 *
 * The data directory is NEVER inside the install folder (Program Files), so an
 * EXE reinstall/update can never destroy business data.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));

/** Repo/install root (read-only at runtime in a packaged EXE). */
export const APP_ROOT = process.env.PHONEZONE_APP_ROOT
  ? path.resolve(process.env.PHONEZONE_APP_ROOT)
  : path.resolve(here, "..", "..", "..");
export const BACKEND_ROOT = path.resolve(here, "..", "..");
export const DATABASE_DEF_DIR = path.join(APP_ROOT, "database");
export const CONFIG_DIR = path.join(APP_ROOT, "config");

/** The platform's stock data directory (what an install uses when nothing overrides it). */
export function defaultDataDir() {
  const app = "PhoneZone";
  if (process.platform === "win32") {
    return path.join(process.env.APPDATA || path.join(os.homedir(), "AppData", "Roaming"), app);
  }
  if (process.platform === "darwin") {
    return path.join(os.homedir(), "Library", "Application Support", app);
  }
  return path.join(process.env.XDG_DATA_HOME || path.join(os.homedir(), ".local", "share"), app);
}

function resolveAppDataDir() {
  if (process.env.PHONEZONE_DATA_DIR) {
    const candidate = path.resolve(process.env.PHONEZONE_DATA_DIR);
    if (fs.existsSync(path.join(candidate, "database", "phonezone.db"))) {
      return candidate;
    }
    const def = defaultDataDir();
    if (fs.existsSync(path.join(def, "database", "phonezone.db")) && !process.env.PHONEZONE_FORCE_EMPTY_DIR) {
      return def;
    }
    return candidate;
  }
  return defaultDataDir();
}

export const APP_DATA_DIR = resolveAppDataDir();

export const PATHS = {
  dataDir: APP_DATA_DIR,
  databaseDir: path.join(APP_DATA_DIR, "database"),
  databaseFile: path.join(APP_DATA_DIR, "database", "phonezone.db"),
  storageDir: path.join(APP_DATA_DIR, "storage"),
  backupsDir: path.join(APP_DATA_DIR, "backups"),
  exportsDir: path.join(APP_DATA_DIR, "exports"),
  logsDir: path.join(APP_DATA_DIR, "logs"),
  configDir: path.join(APP_DATA_DIR, "config"),
};

/** Storage sub-trees. Values are relative to PATHS.storageDir. */
export const STORAGE_BUCKETS = {
  sellers: "sellers",
  customers: "customers",
  phones: "phones",
  purchases: "purchases",
  repairs: "repairs",
  repair_customers: "repair_customers",
  invoices: "invoices",
};

export function ensureDirs() {
  // databaseFile is a file, not a directory - never mkdir it.
  for (const [key, dir] of Object.entries(PATHS)) {
    if (key === "databaseFile") continue;
    fs.mkdirSync(dir, { recursive: true });
  }
  for (const bucket of Object.values(STORAGE_BUCKETS)) {
    fs.mkdirSync(path.join(PATHS.storageDir, bucket), { recursive: true });
  }
  fs.mkdirSync(path.join(PATHS.storageDir, "invoices", "purchase"), { recursive: true });
  fs.mkdirSync(path.join(PATHS.storageDir, "invoices", "sale"), { recursive: true });
  fs.mkdirSync(path.join(PATHS.storageDir, "invoices", "return"), { recursive: true });
  return PATHS;
}

/**
 * Resolve a storage-relative path to an absolute one, refusing traversal.
 * Every file read/write in the app goes through this guard.
 */
export function resolveStoragePath(relativePath) {
  const normalized = path
    .normalize(String(relativePath || "").replace(/\\/g, "/"))
    .replace(/^([/.]+)/, "");
  const abs = path.resolve(PATHS.storageDir, normalized);
  const root = path.resolve(PATHS.storageDir) + path.sep;
  if (abs !== path.resolve(PATHS.storageDir) && !abs.startsWith(root)) {
    throw new Error("Path traversal blocked");
  }
  return abs;
}
