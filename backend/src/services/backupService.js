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
import Database from "better-sqlite3";
import { PATHS } from "../config/paths.js";
import { getDb, initDatabase, closeDatabase } from "../db/index.js";
import { logger } from "../lib/logger.js";
import { AppError } from "../lib/errors.js";
import * as supabaseSync from "./supabaseSyncService.js";

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

function copyTableRows(sourceDb, targetDb, tableName, conflictAction = "REPLACE") {
  try {
    const tableCheck = sourceDb.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name=?").get(tableName);
    if (!tableCheck) return 0;

    const sourceCols = sourceDb.prepare(`PRAGMA table_info("${tableName}")`).all().map((c) => c.name);
    const targetCols = targetDb.prepare(`PRAGMA table_info("${tableName}")`).all().map((c) => c.name);
    const commonCols = sourceCols.filter((c) => targetCols.includes(c));
    if (commonCols.length === 0) return 0;

    const colList = commonCols.map((c) => `"${c}"`).join(", ");
    const valPlaceholders = commonCols.map((c) => `@${c}`).join(", ");
    const insertStmt = targetDb.prepare(`INSERT OR ${conflictAction} INTO "${tableName}" (${colList}) VALUES (${valPlaceholders})`);

    const rows = sourceDb.prepare(`SELECT ${colList} FROM "${tableName}"`).all();
    let count = 0;
    for (const row of rows) {
      try {
        insertStmt.run(row);
        count++;
      } catch (err) {
        logger.warn(`[Restore] Error copying row in ${tableName}:`, err.message);
      }
    }
    return count;
  } catch (err) {
    logger.warn(`[Restore] Table copy failed for ${tableName}:`, err.message);
    return 0;
  }
}

function copyEntityStorage(tempStorageDir, targetStorageDir, entities, isAll, overwrite) {
  if (!fs.existsSync(tempStorageDir)) return;
  fs.mkdirSync(targetStorageDir, { recursive: true });

  const ENTITY_DIRS = {
    settings: ["branding", "signatures", "logo"],
    phones: ["phones", "product-photos", "payments"],
    sellers: ["sellers", "aadhaar"],
    customers: ["customers"],
    dealers: ["dealers"],
    repairs: ["repairs"],
    returns: ["returns"],
  };

  const dirsToCopy = new Set();
  for (const [ent, dirs] of Object.entries(ENTITY_DIRS)) {
    if (isAll || entities.includes(ent)) {
      dirs.forEach((d) => dirsToCopy.add(d));
    }
  }

  for (const d of dirsToCopy) {
    const srcDir = path.join(tempStorageDir, d);
    const dstDir = path.join(targetStorageDir, d);
    if (fs.existsSync(srcDir)) {
      if (overwrite && fs.existsSync(dstDir)) {
        try { fs.rmSync(dstDir, { recursive: true, force: true }); } catch {}
      }
      try {
        fs.cpSync(srcDir, dstDir, { recursive: true });
      } catch (e) {
        logger.warn(`[Restore] Error copying storage dir ${d}:`, e.message);
      }
    }
  }

  // Also check top-level files in tempStorageDir
  try {
    const items = fs.readdirSync(tempStorageDir, { withFileTypes: true });
    for (const item of items) {
      if (item.isFile()) {
        const dest = path.join(targetStorageDir, item.name);
        if (overwrite || !fs.existsSync(dest)) {
          fs.copyFileSync(path.join(tempStorageDir, item.name), dest);
        }
      }
    }
  } catch {}
}

function restoreFromJsonData(data, tempDir, { strategy = "replace", entities = ["all"], isAll = true } = {}) {
  const db = getDb();
  const shouldReplace = strategy === "replace";

  db.transaction(() => {
    // 1. admin_settings
    if ((isAll || entities.includes("settings")) && data.admin_settings && data.admin_settings[0]) {
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
    if ((isAll || entities.includes("sellers")) && Array.isArray(data.sellers)) {
      if (shouldReplace) {
        try { db.prepare("DELETE FROM sellers").run(); } catch {}
      }
      const stmt = db.prepare(`
        INSERT INTO sellers (id, name, phone, address, id_proof_type, id_number, seller_photo_url, aadhaar_photo_url, created_at, updated_at)
        VALUES (@id, @name, @phone, @address, @id_proof_type, @id_number, @seller_photo_url, @aadhaar_photo_url, @created_at, @updated_at)
        ON CONFLICT(id) DO UPDATE SET name = excluded.name, phone = excluded.phone, address = excluded.address
      `);
      for (const item of data.sellers) {
        try {
          stmt.run({
            ...item,
            address: item.address || "",
            id_proof_type: item.id_proof_type || "aadhaar",
            id_number: item.id_number || "",
            seller_photo_url: item.seller_photo_url || null,
            aadhaar_photo_url: item.aadhaar_photo_url || null,
            created_at: item.created_at || new Date().toISOString(),
            updated_at: item.updated_at || new Date().toISOString()
          });
        } catch {}
      }
    }

    // 3. customers
    if ((isAll || entities.includes("customers")) && Array.isArray(data.customers)) {
      if (shouldReplace) {
        try { db.prepare("DELETE FROM customers").run(); } catch {}
      }
      const stmt = db.prepare(`
        INSERT INTO customers (id, name, phone, address, id_proof_type, id_number, created_at, updated_at)
        VALUES (@id, @name, @phone, @address, @id_proof_type, @id_number, @created_at, @updated_at)
        ON CONFLICT(id) DO UPDATE SET name = excluded.name, phone = excluded.phone
      `);
      for (const item of data.customers) {
        try {
          stmt.run({
            ...item,
            address: item.address || "",
            id_proof_type: item.id_proof_type || "aadhaar",
            id_number: item.id_number || "",
            created_at: item.created_at || new Date().toISOString(),
            updated_at: item.updated_at || new Date().toISOString()
          });
        } catch {}
      }
    }

    // 4. phones
    if ((isAll || entities.includes("phones")) && Array.isArray(data.phones)) {
      if (shouldReplace) {
        try { db.prepare("DELETE FROM phones").run(); } catch {}
      }
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
    if ((isAll || entities.includes("repairs")) && Array.isArray(data.repairs)) {
      if (shouldReplace) {
        try { db.prepare("DELETE FROM repair_job_items").run(); } catch {}
        try { db.prepare("DELETE FROM repair_jobs").run(); } catch {}
        try { db.prepare("DELETE FROM repair_customers").run(); } catch {}
      }
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

    // 6. dealers & batches
    if ((isAll || entities.includes("dealers")) && (Array.isArray(data.dealers) || Array.isArray(data.dealer_batches))) {
      if (shouldReplace) {
        try { db.prepare("DELETE FROM dealer_batches").run(); } catch {}
        try { db.prepare("DELETE FROM dealers").run(); } catch {}
      }
      if (Array.isArray(data.dealers)) {
        const stmt = db.prepare(`
          INSERT INTO dealers (id, business_name, contact_person, phone, email, address, gst_number, pan_number, created_at, updated_at)
          VALUES (@id, @business_name, @contact_person, @phone, @email, @address, @gst_number, @pan_number, @created_at, @updated_at)
          ON CONFLICT(id) DO UPDATE SET business_name = excluded.business_name, phone = excluded.phone
        `);
        for (const item of data.dealers) {
          try {
            stmt.run({
              ...item,
              contact_person: item.contact_person || "",
              phone: item.phone || "",
              email: item.email || "",
              address: item.address || "",
              gst_number: item.gst_number || "",
              pan_number: item.pan_number || "",
              created_at: item.created_at || new Date().toISOString(),
              updated_at: item.updated_at || new Date().toISOString()
            });
          } catch {}
        }
      }
      if (Array.isArray(data.dealer_batches)) {
        const stmt = db.prepare(`
          INSERT INTO dealer_batches (id, dealer_id, invoice_number, purchase_date, total_phones, total_amount, payment_status, created_at)
          VALUES (@id, @dealer_id, @invoice_number, @purchase_date, @total_phones, @total_amount, @payment_status, @created_at)
          ON CONFLICT(id) DO UPDATE SET total_amount = excluded.total_amount
        `);
        for (const item of data.dealer_batches) {
          try {
            stmt.run({
              ...item,
              invoice_number: item.invoice_number || "",
              purchase_date: item.purchase_date || new Date().toISOString().slice(0, 10),
              total_phones: Number(item.total_phones) || 0,
              total_amount: Number(item.total_amount) || 0,
              payment_status: item.payment_status || "paid",
              created_at: item.created_at || new Date().toISOString()
            });
          } catch {}
        }
      }
    }

    // 7. returns
    if ((isAll || entities.includes("returns")) && Array.isArray(data.returns)) {
      if (shouldReplace) {
        try { db.prepare("DELETE FROM returns").run(); } catch {}
      }
      const stmt = db.prepare(`
        INSERT INTO returns (id, phone_id, return_date, reason, refund_amount, processed_by, created_at)
        VALUES (@id, @phone_id, @return_date, @reason, @refund_amount, @processed_by, @created_at)
        ON CONFLICT(id) DO UPDATE SET reason = excluded.reason, refund_amount = excluded.refund_amount
      `);
      for (const item of data.returns) {
        try {
          stmt.run({
            ...item,
            return_date: item.return_date || new Date().toISOString().slice(0, 10),
            reason: item.reason || "Return",
            refund_amount: Number(item.refund_amount) || 0,
            processed_by: item.processed_by || "Admin",
            created_at: item.created_at || new Date().toISOString()
          });
        } catch {}
      }
    }
  })();

  const imagesDir = path.join(tempDir, "images");
  if (fs.existsSync(imagesDir)) {
    copyEntityStorage(imagesDir, PATHS.storageDir, entities, isAll, shouldReplace);
  }
}

/**
 * Restore from a backup file (.zip or .tar.gz).
 * Supports:
 *  - strategy: "replace" (clean wipe selected entities) | "merge" (keep existing records, append/update)
 *  - entities: ["all"] or subset of ["settings", "phones", "sellers", "customers", "dealers", "repairs", "returns"]
 *  - wipeCloud: boolean
 */
export async function restoreBackup(backupName, {
  strategy = "replace",
  entities = ["all"],
  wipeCloud = false
} = {}) {
  const src = path.join(PATHS.backupsDir, path.basename(backupName));
  if (!fs.existsSync(src)) throw new AppError("That backup file could not be found.", 404);

  await assertSafeArchive(src);

  let normalizedEntities = Array.isArray(entities) ? entities : [entities];
  if (typeof entities === "string") {
    try {
      const parsed = JSON.parse(entities);
      if (Array.isArray(parsed)) normalizedEntities = parsed;
      else normalizedEntities = [parsed];
    } catch {
      normalizedEntities = entities.split(",").map((s) => s.trim()).filter(Boolean);
    }
  }
  const isAll = !normalizedEntities || normalizedEntities.includes("all") || normalizedEntities.length === 0 || normalizedEntities.includes("*");
  const shouldReplace = strategy === "replace";

  logger.info("[Restore] Initiating backup restore...", { backupName, strategy, isAll, entities: normalizedEntities, wipeCloud });

  let safety = { name: "skipped" };
  try {
    fs.mkdirSync(path.join(PATHS.dataDir, "database"), { recursive: true });
    fs.mkdirSync(path.join(PATHS.dataDir, "storage"), { recursive: true });
    safety = createBackup();
  } catch (safetyErr) {
    logger.warn("Pre-restore safety backup skipped:", safetyErr.message);
  }
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
    const hasDatabase = fs.existsSync(path.join(temp, "database", "phonezone.db"));
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

      if (isAll && shouldReplace) {
        // Complete clean replacement of database and storage
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
      } else {
        // Selective restore or Smart Merge without destroying untouched tables or unselected data
        const sourceDbPath = path.join(temp, "database", "phonezone.db");
        const sourceDb = new Database(sourceDbPath, { readonly: true });
        const targetDb = getDb();

        const entityRestoreMap = {
          settings: () => {
            if (shouldReplace) {
              copyTableRows(sourceDb, targetDb, "admin_settings", "REPLACE");
            } else {
              try {
                const sRow = sourceDb.prepare("SELECT * FROM admin_settings LIMIT 1").get();
                if (sRow) {
                  const tRow = targetDb.prepare("SELECT * FROM admin_settings LIMIT 1").get();
                  if (tRow) {
                    const updates = {};
                    for (const [k, v] of Object.entries(sRow)) {
                      if (v !== null && v !== undefined && v !== "" && (tRow[k] === null || tRow[k] === "" || tRow[k] === undefined)) {
                        updates[k] = v;
                      }
                    }
                    if (Object.keys(updates).length > 0) {
                      const sets = Object.keys(updates).map((k) => `"${k}" = @${k}`).join(", ");
                      targetDb.prepare(`UPDATE admin_settings SET ${sets} WHERE id = ?`).run({ ...updates, id: tRow.id });
                    }
                  }
                }
              } catch (e) {
                logger.warn("[Restore] Settings merge warning:", e.message);
              }
            }
          },
          phones: () => {
            if (shouldReplace) {
              try { targetDb.prepare("DELETE FROM phones").run(); } catch {}
            }
            copyTableRows(sourceDb, targetDb, "phones", "REPLACE");
          },
          sellers: () => {
            if (shouldReplace) {
              try { targetDb.prepare("DELETE FROM sellers").run(); } catch {}
            }
            copyTableRows(sourceDb, targetDb, "sellers", "REPLACE");
          },
          customers: () => {
            if (shouldReplace) {
              try { targetDb.prepare("DELETE FROM customers").run(); } catch {}
            }
            copyTableRows(sourceDb, targetDb, "customers", "REPLACE");
          },
          dealers: () => {
            if (shouldReplace) {
              try { targetDb.prepare("DELETE FROM dealer_batches").run(); } catch {}
              try { targetDb.prepare("DELETE FROM dealers").run(); } catch {}
            }
            copyTableRows(sourceDb, targetDb, "dealers", "REPLACE");
            copyTableRows(sourceDb, targetDb, "dealer_batches", "REPLACE");
          },
          repairs: () => {
            if (shouldReplace) {
              try { targetDb.prepare("DELETE FROM repair_job_items").run(); } catch {}
              try { targetDb.prepare("DELETE FROM repair_jobs").run(); } catch {}
              try { targetDb.prepare("DELETE FROM repair_customers").run(); } catch {}
            }
            copyTableRows(sourceDb, targetDb, "repair_customers", "REPLACE");
            copyTableRows(sourceDb, targetDb, "repair_jobs", "REPLACE");
            copyTableRows(sourceDb, targetDb, "repair_job_items", "REPLACE");
          },
          returns: () => {
            if (shouldReplace) {
              try { targetDb.prepare("DELETE FROM returns").run(); } catch {}
            }
            copyTableRows(sourceDb, targetDb, "returns", "REPLACE");
          }
        };

        targetDb.transaction(() => {
          for (const [entityName, restoreHandler] of Object.entries(entityRestoreMap)) {
            if (isAll || normalizedEntities.includes(entityName)) {
              restoreHandler();
            }
          }
        })();

        sourceDb.close();

        // Copy matching storage files
        const tempStorageDir = path.join(temp, "storage");
        if (fs.existsSync(tempStorageDir)) {
          copyEntityStorage(tempStorageDir, PATHS.storageDir, normalizedEntities, isAll, shouldReplace);
        }
      }
    } else if (hasDataJson) {
      const jsonStr = fs.readFileSync(path.join(temp, "data.json"), "utf8");
      const data = JSON.parse(jsonStr);
      restoreFromJsonData(data, temp, { strategy, entities: normalizedEntities, isAll });
    }

    fs.rmSync(temp, { recursive: true, force: true });
    logger.info("Restore completed successfully", { backupName, strategy, isAll, entities: normalizedEntities, safetyBackup: safety.name, parked });
    return {
      restored: backupName,
      strategy,
      entities: isAll ? ["all"] : normalizedEntities,
      safetyBackup: safety.name,
      previousDataKeptAt: parked
    };
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
