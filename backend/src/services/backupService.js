/**
 * Backup / restore. A backup is a single .zip containing database/, storage/
 * and manifest.json. Restore always snapshots current data first and rolls
 * back if anything fails.
 */
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import tar from "tar";
import { PATHS } from "../config/paths.js";
import { getDb, initDatabase, closeDatabase } from "../db/index.js";
import { logger } from "../lib/logger.js";
import { AppError } from "../lib/errors.js";

const stamp = () => new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);

/**
 * Archive paths handed to `tar` must be RELATIVE to the data directory.
 *
 * A Windows path like `C:/Users/.../backup.tar.gz` is read by GNU tar (the one
 * that ships with Git for Windows, and it often wins on PATH) as a REMOTE
 * "host:path" specification, so every backup/restore failed with a confusing
 * "Command failed" error and no file was ever written. Running tar with
 * cwd = data dir and passing "backups/<name>" works with both GNU tar and the
 * bsdtar that ships with Windows 10+.
 */
const tarPath = (absolute) => {
  const relative = path.relative(PATHS.dataDir, absolute) || ".";
  return relative.split(path.sep).join("/");
};

function zip(sourceDirs, outFile) {
  // Write a real cross-platform archive of the given data-dir-relative paths.
  const outRel = tarPath(outFile);
  //
  // We deliberately DON'T depend on the external `zip` / `unzip` binaries,
  // which are almost never installed on Windows (only `tar` ships with the OS).
  // bsdtar (Windows 10+, macOS) can both READ and WRITE standard .zip archives,
  // so create + restore share a single code path. GNU tar (Linux) cannot write
  // zip, so it falls back to .tar.gz — restore auto-detects either format.
  //
  // Return the path actually written so the reported extension is always real.
  try {
    // bsdtar:  tar -a -cf out.zip dir1 dir2   (format picked from extension)
    // Exclude SQLite WAL sidecar files: the main .db is complete after the
    // checkpoint (see createBackup) and stale -wal/-shm corrupt restores.
    execFileSync("tar", ["-a", "-cf", outRel, "--exclude=*.db-wal", "--exclude=*.db-shm", ...sourceDirs], {
      cwd: PATHS.dataDir,
      stdio: "ignore",
    });
    if (fs.existsSync(outFile) && fs.statSync(outFile).size > 0) return outFile;
  } catch {
    /* bsdtar/GNU tar may not support -a + zip; drop through to tar.gz */
  }
  const gz = outFile.replace(/\.zip$/, ".tar.gz");
  execFileSync("tar", ["-czf", tarPath(gz), "--exclude=*.db-wal", "--exclude=*.db-shm", ...sourceDirs], {
    cwd: PATHS.dataDir,
    stdio: "ignore",
  });
  return gz;
}

export function createBackup() {
  fs.mkdirSync(PATHS.backupsDir, { recursive: true });
  const db = getDb();
  db.pragma("wal_checkpoint(TRUNCATE)"); // flush WAL so the .db file is complete

  const desiredName = `PhoneZone_Backup_${stamp()}.tar.gz`;
  const desiredFile = path.join(PATHS.backupsDir, desiredName);

  let dbHash = null;
  if (fs.existsSync(PATHS.databaseFile)) {
    const dbBytes = fs.readFileSync(PATHS.databaseFile);
    dbHash = crypto.createHash("sha256").update(dbBytes).digest("hex");
  }

  const manifest = {
    createdAt: new Date().toISOString(),
    app: "PhoneZone",
    dbSha256: dbHash,
    schemaVersions: db.prepare("SELECT version FROM schema_migrations ORDER BY version").all().map((r) => r.version),
    counts: Object.fromEntries(
      ["sellers", "customers", "phones", "returns", "repairs", "invoices", "files", "messages"].map((t) => {
        try {
          return [t, db.prepare(`SELECT COUNT(*) AS n FROM ${t}`).get().n];
        } catch {
          return [t, 0];
        }
      }),
    ),
  };
  const manifestFile = path.join(PATHS.dataDir, "manifest.json");
  fs.writeFileSync(manifestFile, JSON.stringify(manifest, null, 2));

  try {
    tar.c(
      {
        gzip: true,
        file: desiredFile,
        cwd: PATHS.dataDir,
        sync: true,
        filter: (p) => !p.endsWith("-wal") && !p.endsWith("-shm") && !p.endsWith("-journal"),
      },
      ["database", "storage", "manifest.json"],
    );
  } finally {
    fs.rmSync(manifestFile, { force: true });
  }

  if (!fs.existsSync(desiredFile) || fs.statSync(desiredFile).size === 0) {
    throw new AppError("The backup file could not be written. Check that this folder can be written to.", 500);
  }
  logger.info("Backup created", { outFile: desiredFile });
  return { file: desiredFile, name: path.basename(desiredFile), manifest, sizeBytes: fs.statSync(desiredFile).size };
}

export function listBackups() {
  if (!fs.existsSync(PATHS.backupsDir)) return [];
  return fs
    .readdirSync(PATHS.backupsDir)
    .filter((f) => f.startsWith("PhoneZone_Backup_"))
    .map((f) => {
      const s = fs.statSync(path.join(PATHS.backupsDir, f));
      return { name: f, sizeBytes: s.size, createdAt: s.mtime.toISOString() };
    })
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

/** Resolve a backup name to a safe absolute path, refusing traversal & missing files. */
export function getBackupFilePath(name) {
  const p = path.join(PATHS.backupsDir, path.basename(name));
  if (!fs.existsSync(p)) throw new AppError("That backup file could not be found.", 404);
  return p;
}

/**
 * A valid backup only ever contains database/, storage/ and manifest.json at the
 * top level. Anything else (absolute paths, `..`, symlinks, random files) means
 * the archive was not produced by this app and must not be extracted.
 */
const ALLOWED_ENTRY = /^(database(\/|$)|storage(\/|$)|manifest\.json$)/i;

function assertSafeArchive(src) {
  let entriesCount = 0;
  try {
    tar.t({
      file: src,
      sync: true,
      onentry: (entry) => {
        entriesCount++;
        const raw = entry.path.replace(/^\.\//, "");
        if (raw.startsWith("/") || raw.includes("..") || /^[a-zA-Z]:[\\/]/.test(raw)) {
          throw new AppError("This backup contains unsafe file paths and was rejected. No data was changed.", 400);
        }
        const normalized = raw.replace(/\/+$/, "");
        if (!normalized || normalized === ".") return;
        if (!ALLOWED_ENTRY.test(normalized)) {
          throw new AppError("This backup contains unexpected files and was rejected. No data was changed.", 400);
        }
        if (entry.type === "SymbolicLink" || entry.type === "Link") {
          throw new AppError("This backup contains file links and was rejected. No data was changed.", 400);
        }
      },
    });
  } catch (err) {
    if (err instanceof AppError) throw err;
    throw new AppError(
      'That file could not be read as a backup. Please use a file created with "Create Full Backup".',
      400,
    );
  }
  if (entriesCount === 0) {
    throw new AppError('That file could not be read as a backup. Please use a file created with "Create Full Backup".', 400);
  }
}

/**
 * Restore from a backup file.
 * 1. validate the archive listing  2. safety backup of current data
 * 3. extract to temp  4. validate manifest  5. swap in  6. rollback on failure.
 *
 * The rollback is a REAL rollback: if the swap already started, the parked
 * database/ and storage/ folders are moved back before the database is reopened.
 * (Previously a failure halfway through the swap left an empty data folder and
 * reopened a brand-new database, which looked exactly like lost data.)
 */
export function restoreBackup(backupName) {
  const src = path.join(PATHS.backupsDir, path.basename(backupName));
  if (!fs.existsSync(src)) throw new AppError("That backup file could not be found.", 404);

  assertSafeArchive(src);

  const safety = createBackup();
  const temp = path.join(PATHS.dataDir, `.restore-${stamp()}`);
  fs.mkdirSync(temp, { recursive: true });

  let parked = null;
  const swapped = [];

  try {
    tar.x({
      file: src,
      cwd: temp,
      sync: true,
    });

    const manifestPath = path.join(temp, "manifest.json");
    if (!fs.existsSync(manifestPath) || !fs.existsSync(path.join(temp, "database"))) {
      throw new AppError(
        "This file is not a valid PhoneZone backup. Please use a file created with \"Create Full Backup\".",
        400,
      );
    }

    // Discard SQLite WAL sidecar files from the extracted DB so the complete
    // main .db file is restored cleanly (stale -wal/-shm would otherwise make
    // the reopened database appear empty).
    for (const suffix of ["-wal", "-shm", "-journal"]) {
      fs.rmSync(path.join(temp, "database", `phonezone.db${suffix}`), { force: true });
    }

    closeDatabase();
    parked = path.join(PATHS.dataDir, `.previous-${stamp()}`);
    fs.mkdirSync(parked, { recursive: true });
    for (const dir of ["database", "storage"]) {
      const current = path.join(PATHS.dataDir, dir);
      if (fs.existsSync(current)) fs.renameSync(current, path.join(parked, dir));
      fs.renameSync(path.join(temp, dir), current);
      swapped.push(dir);
    }
    initDatabase(); // applies any newer migrations to the restored database
    fs.rmSync(temp, { recursive: true, force: true });
    logger.info("Restore completed", { backupName, safetyBackup: safety.name, parked });
    return { restored: backupName, safetyBackup: safety.name, previousDataKeptAt: parked };
  } catch (err) {
    logger.error("Restore failed - rolling back", err);
    fs.rmSync(temp, { recursive: true, force: true });

    // Move the parked folders back BEFORE reopening the database.
    if (parked) {
      for (const dir of swapped) {
        const current = path.join(PATHS.dataDir, dir);
        const previous = path.join(parked, dir);
        try {
          if (fs.existsSync(current)) fs.rmSync(current, { recursive: true, force: true });
          if (fs.existsSync(previous)) fs.renameSync(previous, current);
        } catch (rollbackErr) {
          logger.error("Rollback could not restore a data folder", rollbackErr, { dir, previous });
        }
      }
    }

    try {
      initDatabase();
    } catch { /* surfaced below */ }
    throw new AppError(
      `Restore failed, your existing data was left in place. A safety backup was saved as ${safety.name}.`,
      500,
    );
  }
}
