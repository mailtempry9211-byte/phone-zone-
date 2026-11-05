/**
 * Backup / restore. A backup is a single .zip containing database/, storage/
 * and manifest.json. Restore always snapshots current data first and rolls
 * back if anything fails.
 */
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { execFileSync } from "node:child_process";
import * as tar from "tar";
import unzipper from "unzipper";
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

export function createBackup({ scope = "all", financialYear = null } = {}) {
  fs.mkdirSync(PATHS.backupsDir, { recursive: true });
  const db = getDb();
  db.pragma("wal_checkpoint(TRUNCATE)"); // flush WAL so the .db file is complete

  // Resolve FY label if scope is year-based
  let fyLabel = null;
  if (scope !== "all") {
    let fys = [];
    try {
      fys = db.prepare("SELECT label, start_date FROM financial_years ORDER BY start_date DESC").all();
    } catch {}

    if (financialYear) {
      fyLabel = String(financialYear).trim();
    } else if (scope === "current_fy") {
      fyLabel = fys[0]?.label || "current";
    } else if (scope === "previous_fy_1") {
      fyLabel = fys[1]?.label || "previous_1";
    } else if (scope === "previous_fy_2" || scope === "older_fy") {
      fyLabel = fys[2]?.label || "older";
    }
  }

  const safeScope = fyLabel ? `FY_${fyLabel.replace(/[^a-zA-Z0-9_-]/g, "_")}` : "ALL_YEARS";
  const desiredName = `PhoneZone_Backup_${safeScope}_${stamp()}.tar.gz`;
  const desiredFile = path.join(PATHS.backupsDir, desiredName);

  if (scope === "all" || !fyLabel) {
    let dbHash = null;
    if (fs.existsSync(PATHS.databaseFile)) {
      const dbBytes = fs.readFileSync(PATHS.databaseFile);
      dbHash = crypto.createHash("sha256").update(dbBytes).digest("hex");
    }

    const manifest = {
      createdAt: new Date().toISOString(),
      app: "PhoneZone",
      scope: "all",
      dbSha256: dbHash,
      schemaVersions: db.prepare("SELECT version FROM schema_migrations ORDER BY version").all().map((r) => r.version),
      counts: Object.fromEntries(
        ["sellers", "customers", "dealers", "phones", "returns", "repairs", "invoices", "files", "messages"].map((t) => {
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
    logger.info("Backup created", { outFile: desiredFile, scope: "all" });
    return { file: desiredFile, name: path.basename(desiredFile), manifest, sizeBytes: fs.statSync(desiredFile).size };
  }

  // Scoped backup for a specific FY (or older)
  const scopedDir = path.join(PATHS.dataDir, `.backup_temp_${stamp()}`);
  const scopedDbDir = path.join(scopedDir, "database");
  const scopedStorageDir = path.join(scopedDir, "storage");
  fs.mkdirSync(scopedDbDir, { recursive: true });
  fs.mkdirSync(scopedStorageDir, { recursive: true });

  const scopedDbFile = path.join(scopedDbDir, "phonezone.db");
  fs.copyFileSync(PATHS.databaseFile, scopedDbFile);

  const Database = db.constructor;
  const scopedDb = new Database(scopedDbFile);

  try {
    scopedDb.pragma("journal_mode = WAL");
    // Prune transactional rows that don't belong to this financial year
    // Keep master records: sellers, customers, dealers, repair_customers, admin_settings, user_roles
    scopedDb.prepare("DELETE FROM phones WHERE (financial_year != ? AND financial_year IS NOT NULL)").run(fyLabel);
    try {
      scopedDb.prepare("DELETE FROM repair_jobs WHERE (financial_year != ? AND financial_year IS NOT NULL)").run(fyLabel);
    } catch {}
    try {
      scopedDb.prepare("DELETE FROM invoices WHERE (financial_year != ? AND financial_year IS NOT NULL)").run(fyLabel);
    } catch {}
    try {
      scopedDb.prepare("DELETE FROM returns WHERE (financial_year != ? AND financial_year IS NOT NULL)").run(fyLabel);
    } catch {}

    scopedDb.pragma("wal_checkpoint(TRUNCATE)");
    scopedDb.close();

    if (fs.existsSync(PATHS.storageDir)) {
      fs.cpSync(PATHS.storageDir, scopedStorageDir, { recursive: true });
    }

    const manifest = {
      createdAt: new Date().toISOString(),
      app: "PhoneZone",
      scope: fyLabel,
      financialYear: fyLabel,
    };
    fs.writeFileSync(path.join(scopedDir, "manifest.json"), JSON.stringify(manifest, null, 2));

    tar.c(
      {
        gzip: true,
        file: desiredFile,
        cwd: scopedDir,
        sync: true,
        filter: (p) => !p.endsWith("-wal") && !p.endsWith("-shm") && !p.endsWith("-journal"),
      },
      ["database", "storage", "manifest.json"],
    );
  } finally {
    fs.rmSync(scopedDir, { recursive: true, force: true });
  }

  if (!fs.existsSync(desiredFile) || fs.statSync(desiredFile).size === 0) {
    throw new AppError("The scoped backup file could not be written.", 500);
  }
  logger.info("Scoped backup created", { outFile: desiredFile, scope: fyLabel });
  return { file: desiredFile, name: path.basename(desiredFile), sizeBytes: fs.statSync(desiredFile).size };
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
function isZipFile(filePath) {
  try {
    const fd = fs.openSync(filePath, "r");
    const buf = Buffer.alloc(4);
    fs.readSync(fd, buf, 0, 4, 0);
    fs.closeSync(fd);
    return buf[0] === 0x50 && buf[1] === 0x4b; // 'PK'
  } catch {
    return false;
  }
}

/**
 * A valid backup only ever contains database/, storage/ and manifest.json at the
 * top level, or data.json + images/. Anything else (absolute paths, `..`, symlinks)
 * means the archive was not produced by this app and must not be extracted.
 */
const ALLOWED_ENTRY = /^(database(\/|$)|storage(\/|$)|manifest\.json$|data\.json$|images(\/|$))/i;

async function assertSafeArchive(src) {
  if (isZipFile(src)) {
    try {
      const zip = await unzipper.Open.file(src);
      if (!zip.files || zip.files.length === 0) {
        throw new AppError("The uploaded zip archive is empty or invalid.", 400);
      }
      for (const entry of zip.files) {
        const raw = entry.path.replace(/^\.\//, "");
        if (raw.startsWith("/") || raw.includes("..") || /^[a-zA-Z]:[\\/]/.test(raw)) {
          throw new AppError("This backup contains unsafe file paths and was rejected. No data was changed.", 400);
        }
      }
      return;
    } catch (err) {
      if (err instanceof AppError) throw err;
      throw new AppError("That zip file could not be read as a backup. Please use a valid PhoneZone backup file.", 400);
    }
  }

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

function restoreFromJsonData(data, tempDir) {
  const db = getDb();
  db.transaction(() => {
    // 1. admin_settings
    if (data.admin_settings && data.admin_settings[0]) {
      const s = data.admin_settings[0];
      db.prepare(`
        UPDATE admin_settings SET
          business_name = COALESCE(?, business_name),
          business_tagline = COALESCE(?, business_tagline),
          owner_name = COALESCE(?, owner_name),
          address = COALESCE(?, address),
          phone_primary = COALESCE(?, phone_primary),
          email = COALESCE(?, email),
          setup_completed = 1
        WHERE id = '00000000-0000-0000-0000-000000000001'
      `).run(s.business_name || null, s.business_tagline || null, s.owner_name || null, s.address || null, s.phone_primary || null, s.email || null);
    }
    // 2. sellers
    if (Array.isArray(data.sellers)) {
      const stmt = db.prepare(`
        INSERT INTO sellers (id, name, phone, address, id_proof_type, id_number, seller_photo_url, aadhaar_photo_url, created_at, updated_at)
        VALUES (@id, @name, @phone, @address, @id_proof_type, @id_number, @seller_photo_url, @aadhaar_photo_url, @created_at, @updated_at)
        ON CONFLICT(id) DO UPDATE SET name = excluded.name, phone = excluded.phone, address = excluded.address
      `);
      for (const item of data.sellers) {
        try { stmt.run({ ...item, address: item.address || "", id_proof_type: item.id_proof_type || "aadhaar", id_number: item.id_number || "", seller_photo_url: item.seller_photo_url || null, aadhaar_photo_url: item.aadhaar_photo_url || null, created_at: item.created_at || new Date().toISOString(), updated_at: item.updated_at || new Date().toISOString() }); } catch {}
      }
    }
    // 3. customers
    if (Array.isArray(data.customers)) {
      const stmt = db.prepare(`
        INSERT INTO customers (id, name, phone, address, id_proof_type, id_number, created_at, updated_at)
        VALUES (@id, @name, @phone, @address, @id_proof_type, @id_number, @created_at, @updated_at)
        ON CONFLICT(id) DO UPDATE SET name = excluded.name, phone = excluded.phone
      `);
      for (const item of data.customers) {
        try { stmt.run({ ...item, address: item.address || "", id_proof_type: item.id_proof_type || "aadhaar", id_number: item.id_number || "", created_at: item.created_at || new Date().toISOString(), updated_at: item.updated_at || new Date().toISOString() }); } catch {}
      }
    }
    // 4. phones
    if (Array.isArray(data.phones)) {
      const stmt = db.prepare(`
        INSERT INTO phones (id, phone_name, model, imei_number, condition, purchase_price, selling_price, is_sold, sold_date, seller_id, customer_id, product_photos, payment_proof_photos, purchase_documents, seller_signature_url, seller_photo_url, created_at, updated_at)
        VALUES (@id, @phone_name, @model, @imei_number, @condition, @purchase_price, @selling_price, @is_sold, @sold_date, @seller_id, @customer_id, @product_photos, @payment_proof_photos, @purchase_documents, @seller_signature_url, @seller_photo_url, @created_at, @updated_at)
        ON CONFLICT(id) DO UPDATE SET phone_name = excluded.phone_name, model = excluded.model, selling_price = excluded.selling_price
      `);
      for (const item of data.phones) {
        try {
          stmt.run({
            ...item,
            condition: item.condition || "good",
            purchase_price: Number(item.purchase_price) || 0,
            selling_price: Number(item.selling_price) || 0,
            is_sold: item.is_sold ? 1 : 0,
            sold_date: item.sold_date || null,
            seller_id: item.seller_id || null,
            customer_id: item.customer_id || null,
            product_photos: typeof item.product_photos === "string" ? item.product_photos : JSON.stringify(item.product_photos || []),
            payment_proof_photos: typeof item.payment_proof_photos === "string" ? item.payment_proof_photos : JSON.stringify(item.payment_proof_photos || []),
            purchase_documents: typeof item.purchase_documents === "string" ? item.purchase_documents : JSON.stringify(item.purchase_documents || []),
            seller_signature_url: item.seller_signature_url || null,
            seller_photo_url: item.seller_photo_url || null,
            created_at: item.created_at || new Date().toISOString(),
            updated_at: item.updated_at || new Date().toISOString()
          });
        } catch {}
      }
    }
    // 5. repair_jobs
    if (Array.isArray(data.repairs)) {
      const stmt = db.prepare(`
        INSERT INTO repair_jobs (id, job_no, shop_id, repair_customer_id, device_brand, device_model, problem, estimate, advance_paid, final_price, status, payment_status, warranty_days, technician, created_at, updated_at)
        VALUES (@id, @job_no, @shop_id, @repair_customer_id, @device_brand, @device_model, @problem, @estimate, @advance_paid, @final_price, @status, @payment_status, @warranty_days, @technician, @created_at, @updated_at)
        ON CONFLICT(id) DO UPDATE SET status = excluded.status, final_price = excluded.final_price
      `);
      for (const item of data.repairs) {
        try {
          stmt.run({
            id: item.id || crypto.randomUUID(),
            job_no: item.job_no || item.job_number || "RJ-001",
            shop_id: item.shop_id || "shop_1",
            repair_customer_id: item.repair_customer_id || item.customer_id || null,
            device_brand: item.device_brand || item.brand || "Device",
            device_model: item.device_model || item.model || "",
            problem: item.problem || item.problem_description || "Repair",
            estimate: Number(item.estimate || item.total_cost || 0),
            advance_paid: Number(item.advance_paid || 0),
            final_price: Number(item.final_price || item.total_cost || 0),
            status: item.status || "delivered",
            payment_status: item.payment_status || "paid",
            warranty_days: Number(item.warranty_days || 7),
            technician: item.technician || "Main Workshop",
            created_at: item.created_at || new Date().toISOString(),
            updated_at: item.updated_at || new Date().toISOString()
          });
        } catch {}
      }
    }
  })();

  const imagesDir = path.join(tempDir, "images");
  if (fs.existsSync(imagesDir)) {
    fs.cpSync(imagesDir, PATHS.storageDir, { recursive: true });
  }
}

/**
 * Restore from a backup file (.zip or .tar.gz).
 */
export async function restoreBackup(backupName) {
  const src = path.join(PATHS.backupsDir, path.basename(backupName));
  if (!fs.existsSync(src)) throw new AppError("That backup file could not be found.", 404);

  await assertSafeArchive(src);

  const safety = createBackup();
  const temp = path.join(PATHS.dataDir, `.restore-${stamp()}`);
  fs.mkdirSync(temp, { recursive: true });

  let parked = null;
  const swapped = [];

  try {
    if (isZipFile(src)) {
      const zip = await unzipper.Open.file(src);
      await zip.extract({ path: temp });
    } else {
      tar.x({
        file: src,
        cwd: temp,
        sync: true,
      });
    }

    const manifestPath = path.join(temp, "manifest.json");
    const hasDatabase = fs.existsSync(path.join(temp, "database"));
    const hasDataJson = fs.existsSync(path.join(temp, "data.json"));

    if (!hasDatabase && !hasDataJson && !fs.existsSync(manifestPath)) {
      throw new AppError(
        'This file is not a valid PhoneZone backup. Please use a file created with "Create Full Backup" or JSON Backup with Images.',
        400,
      );
    }

    if (hasDatabase) {
      for (const suffix of ["-wal", "-shm", "-journal"]) {
        fs.rmSync(path.join(temp, "database", `phonezone.db${suffix}`), { force: true });
      }

      closeDatabase();
      parked = path.join(PATHS.dataDir, `.previous-${stamp()}`);
      fs.mkdirSync(parked, { recursive: true });
      for (const dir of ["database", "storage"]) {
        const current = path.join(PATHS.dataDir, dir);
        if (fs.existsSync(current)) fs.renameSync(current, path.join(parked, dir));
        if (fs.existsSync(path.join(temp, dir))) {
          fs.renameSync(path.join(temp, dir), current);
          swapped.push(dir);
        }
      }
      initDatabase();
    } else if (hasDataJson) {
      const jsonStr = fs.readFileSync(path.join(temp, "data.json"), "utf8");
      const data = JSON.parse(jsonStr);
      restoreFromJsonData(data, temp);
    }

    fs.rmSync(temp, { recursive: true, force: true });
    logger.info("Restore completed", { backupName, safetyBackup: safety.name, parked });
    return { restored: backupName, safetyBackup: safety.name, previousDataKeptAt: parked };
  } catch (err) {
    logger.error("Restore failed - rolling back", err);
    fs.rmSync(temp, { recursive: true, force: true });

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
    } catch {}
    throw new AppError(
      `Restore failed: ${err.message || 'Unknown error'}. Existing data was preserved.`,
      500,
    );
  }
}
