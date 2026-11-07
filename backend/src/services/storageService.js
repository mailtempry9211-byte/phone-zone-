/**
 * Local filesystem storage (replaces Supabase Storage).
 * Binaries live on disk; SQLite stores metadata + relative path only.
 */
import fs from "node:fs";
import path from "node:path";
import { getDb } from "../db/index.js";
import { newId, badRequest, notFound } from "../lib/errors.js";
import { PATHS, resolveStoragePath } from "../config/paths.js";
import { SERVER } from "../config/business.js";
import { logger } from "../lib/logger.js";
import { getSupabaseConfig } from "./supabaseSyncService.js";

// NOTE: text/html is deliberately NOT accepted. An uploaded HTML file served
// inline would be stored XSS against the admin session.
const ALLOWED = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "application/pdf": ".pdf",
};

/**
 * Detect the real file type from its leading bytes.
 *
 * The browser-supplied MIME type is attacker-controlled (`text/html` renamed to
 * `photo.jpg` used to be stored and then served inline), so the stored type is
 * decided HERE and the client's value is ignored.
 */
export function sniffMimeType(buffer) {
  if (!buffer || buffer.length < 12) return null;
  const bytes = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer);
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (
    bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47 &&
    bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a
  ) return "image/png";
  if (bytes.slice(0, 4).toString("latin1") === "RIFF" && bytes.slice(8, 12).toString("latin1") === "WEBP") return "image/webp";
  if (bytes.slice(0, 4).toString("latin1") === "%PDF") return "application/pdf";
  return null;
}

/** Owner type -> storage sub-folder. Private trees are never served publicly. */
const LAYOUT = {
  seller: (id, category) => `sellers/${id}/${category}`,
  customer: (id, category) => `customers/${id}/${category}`,
  phone: (id, category) => (category === "payment_proof" ? `purchases/${id}/payment_proof` : `phones/${id}/${category}`),
  repair: (id, category) => `repairs/${id}/${category}`,
  repair_customer: (id, category) => `repair_customers/${id}/${category}`,
  invoice: (id, category) => `invoices/${category}`,
  // App-level business assets (logo/signature) - served publicly for invoices/homepage.
  admin: (id, category) => `admin/${category}`,
  // Compatibility bucket for admin screens that still use the Supabase storage API shape.
  bucket: (id, category) => `buckets/${id}/${path.dirname(category || "misc")}`,
};

const PUBLIC_CATEGORIES = new Set([
  "images",
  "logo",
  "signature",
  "seller-photos",
  "seller-signatures",
  "dealer-photos",
  "dealer-signatures",
  "sale-documents",
  "sales-documents",
]);

/**
 * Top-level folders of the compatibility bucket that are PUBLIC.
 *
 * Product photos are shown on the customer homepage (and on invoices), so they
 * must stay readable while nobody is signed in. Invoices and Sapath Patra also
 * embed purchase documents, sale documents, seller photos and signatures so customers and sellers
 * can view their receipts.
 */
const PUBLIC_BUCKET_FOLDERS = new Set([
  "product-photos",
  "images",
  "logo",
  "signature",
  "purchase-documents",
  "sale-documents",
  "sales-documents",
  "payment-proof",
  "seller-photos",
  "seller-signatures",
  "dealer-photos",
  "dealer-signatures",
  "documents",
]);

/** The top-level folder of a bucket object path ("product-photos/a.jpg"). */
export const bucketFolder = (path) => String(path || "").split("/")[0].trim().toLowerCase();

export function sanitizeFilename(name) {
  return String(name || "file")
    .replace(/[^\w.\- ]+/g, "_")
    .replace(/\s+/g, "-")
    .slice(-80);
}

export function saveFile({ ownerType, ownerId, category, buffer, originalName, mimeType: _declaredMimeType }) {
  if (!LAYOUT[ownerType]) throw badRequest("Unknown file owner type.");
  if (!buffer?.length) throw badRequest("The uploaded file is empty.");
  if (buffer.length > SERVER.maxUploadBytes) {
    throw badRequest(`File is too large. Maximum size is ${Math.round(SERVER.maxUploadBytes / 1024 / 1024)} MB.`);
  }

  // Type comes from the file's own bytes, never from the request.
  const mimeType = sniffMimeType(buffer);
  if (!mimeType) {
    throw badRequest("That file is not a real JPG, PNG, WEBP or PDF. Please upload a photo or a PDF.");
  }

  const folder = LAYOUT[ownerType](ownerId, category);
  const filename = `${Date.now()}-${sanitizeFilename(path.parse(originalName || "file").name)}${ALLOWED[mimeType]}`;
  const relativePath = `${folder}/${filename}`;
  const absolute = resolveStoragePath(relativePath);

  fs.mkdirSync(path.dirname(absolute), { recursive: true });
  // atomic write: temp file then rename
  const tmp = `${absolute}.tmp`;
  fs.writeFileSync(tmp, buffer);
  fs.renameSync(tmp, absolute);

  // Public or private is decided by the server, from the destination folder -
  // never by the caller.
  const isPublic = ownerType === "bucket"
    ? PUBLIC_BUCKET_FOLDERS.has(bucketFolder(category))
    : PUBLIC_CATEGORIES.has(category);

  const record = {
    id: newId(),
    owner_type: ownerType,
    owner_id: ownerId,
    category,
    relative_path: relativePath,
    original_name: originalName || filename,
    mime_type: mimeType,
    size_bytes: buffer.length,
    is_public: isPublic ? 1 : 0,
  };
  getDb()
    .prepare(
      `INSERT INTO files (id, owner_type, owner_id, category, relative_path, original_name, mime_type, size_bytes, is_public)
       VALUES (@id, @owner_type, @owner_id, @category, @relative_path, @original_name, @mime_type, @size_bytes, @is_public)`,
    )
    .run(record);

  // Asynchronously replicate file to Supabase Storage Bucket so it survives Render disk resets
  setImmediate(async () => {
    try {
      const { url, key, isConfigured } = getSupabaseConfig();
      if (!isConfigured) return;
      await fetch(`${url}/storage/v1/object/phonezone-uploads/${record.id}`, {
        method: "POST",
        headers: {
          "apikey": key,
          "Authorization": `Bearer ${key}`,
          "Content-Type": record.mime_type || "application/octet-stream",
          "x-upsert": "true",
        },
        body: buffer,
      });
    } catch {}
  });

  return record;
}

export function getFileRecord(id) {
  const row = getDb().prepare("SELECT * FROM files WHERE id = ?").get(id);
  if (!row) throw notFound("That file could not be found.");
  return row;
}

export function getPlaceholderSvg(label = "PhoneZone") {
  const safeLabel = String(label || "PhoneZone").replace(/[^a-zA-Z0-9 _-]/g, "").slice(0, 30);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400" viewBox="0 0 400 400" fill="none">
    <rect width="400" height="400" rx="16" fill="#0f172a"/>
    <rect x="130" y="60" width="140" height="280" rx="24" fill="#1e293b" stroke="#38bdf8" stroke-width="3"/>
    <circle cx="200" cy="85" r="4" fill="#64748b"/>
    <rect x="180" y="75" width="40" height="4" rx="2" fill="#475569"/>
    <rect x="145" y="105" width="110" height="180" rx="12" fill="#0f172a" stroke="#334155"/>
    <circle cx="200" cy="310" r="10" fill="#334155" stroke="#475569" stroke-width="2"/>
    <path d="M175 195 L225 195 M200 170 L200 220" stroke="#0ea5e9" stroke-width="3" stroke-linecap="round"/>
    <text x="200" y="370" text-anchor="middle" fill="#94a3b8" font-family="system-ui, sans-serif" font-size="14" font-weight="600" letter-spacing="1">${safeLabel}</text>
  </svg>`;
}

function findFileInTree(dir, targetName) {
  try {
    if (!fs.existsSync(dir)) return null;
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const ent of entries) {
      const full = path.join(dir, ent.name);
      if (ent.isDirectory()) {
        const found = findFileInTree(full, targetName);
        if (found) return found;
      } else if (ent.name === targetName || (targetName && targetName.length > 8 && ent.name.includes(targetName))) {
        return full;
      }
    }
  } catch {}
  return null;
}

export async function readFileSafe(id, relativePath) {
  const candidateRelPaths = [];
  if (relativePath) {
    candidateRelPaths.push(relativePath);
    if (relativePath.startsWith("buckets/phonezone-uploads/")) {
      candidateRelPaths.push(relativePath.replace("buckets/phonezone-uploads/", ""));
    } else {
      candidateRelPaths.push(`buckets/phonezone-uploads/${relativePath}`);
    }
    const baseName = path.basename(relativePath);
    candidateRelPaths.push(`product-photos/${baseName}`);
    candidateRelPaths.push(`phones/${baseName}`);
    candidateRelPaths.push(`admin/logo/${baseName}`);
    candidateRelPaths.push(`admin/signature/${baseName}`);
    candidateRelPaths.push(`dealer-photos/${baseName}`);
    candidateRelPaths.push(`seller-photos/${baseName}`);
    candidateRelPaths.push(`payment-proof/${baseName}`);
  }

  // 1. Check all candidate relative paths
  for (const rel of candidateRelPaths) {
    try {
      const abs = resolveStoragePath(rel);
      if (fs.existsSync(abs)) return fs.readFileSync(abs);
    } catch {}
  }

  // 2. Check fallback recovered location
  if (id) {
    try {
      const recoveredPath = resolveStoragePath(`recovered/${id}`);
      if (fs.existsSync(recoveredPath)) return fs.readFileSync(recoveredPath);
    } catch {}
  }

  // 3. Recursive directory search in PATHS.storageDir
  if (relativePath) {
    const baseName = path.basename(relativePath);
    const foundOnDisk = findFileInTree(PATHS.storageDir, baseName);
    if (foundOnDisk && fs.existsSync(foundOnDisk)) {
      try { return fs.readFileSync(foundOnDisk); } catch {}
    }
  }

  // 4. Cloud fallback: fetch from Supabase Storage (both public and authenticated)
  try {
    const { url, key, isConfigured } = getSupabaseConfig();
    if (isConfigured && id) {
      const headers = { apikey: key, Authorization: `Bearer ${key}` };
      const remotePaths = [id];
      if (relativePath) {
        remotePaths.push(relativePath);
        if (relativePath.startsWith("buckets/phonezone-uploads/")) {
          remotePaths.push(relativePath.replace("buckets/phonezone-uploads/", ""));
        }
      }

      for (const rPath of remotePaths) {
        try {
          let res = await fetch(`${url}/storage/v1/object/public/phonezone-uploads/${rPath}`, {
            headers,
            signal: AbortSignal.timeout(4000),
          });

          if (!res.ok) {
            res = await fetch(`${url}/storage/v1/object/authenticated/phonezone-uploads/${rPath}`, {
              headers,
              signal: AbortSignal.timeout(4000),
            });
          }

          if (res.ok) {
            const ab = await res.arrayBuffer();
            const buf = Buffer.from(ab);
            try {
              const saveRel = relativePath || `recovered/${id}`;
              const abs = resolveStoragePath(saveRel);
              fs.mkdirSync(path.dirname(abs), { recursive: true });
              fs.writeFileSync(abs, buf);

              // Index file in SQLite so next time it is instant
              const db = getDb();
              const exists = db.prepare("SELECT 1 FROM files WHERE id = ?").get(id);
              if (!exists) {
                const mime = sniffMimeType(buf) || "image/jpeg";
                db.prepare(`
                  INSERT OR IGNORE INTO files (id, owner_type, category, relative_path, original_name, mime_type, size_bytes, is_public)
                  VALUES (?, 'bucket', 'recovered', ?, ?, ?, ?, 1)
                `).run(id, saveRel, `${id}.jpg`, mime, buf.length);
              }
            } catch {}
            return buf;
          }
        } catch {}
      }
    }
  } catch {}

  return null;
}

/**
 * Uploads all local files from SQLite files table to Supabase Storage bucket 'phonezone-uploads'
 */
export async function pushAllFilesToSupabaseStorage() {
  const { url, key, isConfigured } = getSupabaseConfig();
  if (!isConfigured) return { ok: false, reason: "not_configured" };

  const db = getDb();
  let uploaded = 0;
  let skipped = 0;
  let failed = 0;

  try {
    const files = db.prepare("SELECT * FROM files").all();
    if (!files || files.length === 0) return { ok: true, count: 0 };

    logger.info(`[SupabaseStorage] Starting sync of ${files.length} local files to Supabase Storage...`);

    // Ensure bucket exists
    try {
      await fetch(`${url}/storage/v1/bucket`, {
        method: "POST",
        headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
        body: JSON.stringify({ id: "phonezone-uploads", name: "phonezone-uploads", public: true }),
      });
    } catch {}

    for (const f of files) {
      try {
        const abs = resolveStoragePath(f.relative_path);
        if (!fs.existsSync(abs)) {
          skipped++;
          continue;
        }
        const buffer = fs.readFileSync(abs);
        if (!buffer || buffer.length === 0) continue;

        const res = await fetch(`${url}/storage/v1/object/phonezone-uploads/${f.id}`, {
          method: "POST",
          headers: {
            "apikey": key,
            "Authorization": `Bearer ${key}`,
            "Content-Type": f.mime_type || "application/octet-stream",
            "x-upsert": "true",
          },
          body: buffer,
        });

        if (res.ok) {
          uploaded++;
        } else {
          failed++;
        }
      } catch {
        failed++;
      }
    }

    logger.info(`[SupabaseStorage] Sync complete: ${uploaded} uploaded, ${skipped} skipped, ${failed} failed.`);
    return { ok: true, uploaded, skipped, failed };
  } catch (err) {
    logger.error("[SupabaseStorage] Error during file push:", err);
    return { ok: false, error: err.message };
  }
}

export function readFile(relativePath) {
  try {
    const abs = resolveStoragePath(relativePath);
    if (!fs.existsSync(abs)) throw notFound("That file is missing from local storage.");
    return fs.readFileSync(abs);
  } catch (err) {
    if (err.message === "Path traversal blocked" || err.code === "not_found") {
      throw notFound("That file could not be found.");
    }
    throw err;
  }
}

export function deleteFile(id) {
  const row = getFileRecord(id);
  try {
    fs.rmSync(resolveStoragePath(row.relative_path), { force: true });
  } catch {
    /* keep going - metadata cleanup still matters */
  }
  getDb().prepare("DELETE FROM files WHERE id = ?").run(id);
}

/**
 * Permanently delete linked photo/file from local disk storage, SQLite files index,
 * and Supabase Cloud storage bucket to free maximum storage quota.
 */
export function deleteMediaByUrlOrPath(urlOrPath) {
  if (!urlOrPath || typeof urlOrPath !== "string") return;
  const s = urlOrPath.trim();
  const db = getDb();

  // 1. If it's a files table UUID: /api/files/<uuid> or /api/public/files/<uuid>
  const uuidMatch = s.match(/[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}/);
  if (uuidMatch) {
    const fileId = uuidMatch[0];
    try {
      deleteFile(fileId);
    } catch {}
    try {
      import("./supabaseSyncService.js").then((m) => m.deleteFileFromSupabaseStorage(fileId)).catch(() => {});
    } catch {}
  }

  // 2. Extract relative path or filename
  const cleanPath = s
    .replace(/^https?:\/\/[^/]+/i, "")
    .replace(/^\/?(?:api\/)?(?:pg\/)?storage\/object\/(?:public\/)?[^/]+\//i, "")
    .replace(/^\/?storage\//i, "")
    .replace(/^\/+/, "");

  if (cleanPath) {
    const filename = path.basename(cleanPath);
    // Delete candidate local files on disk
    const candidatePaths = [
      path.join(PATHS.storageDir, cleanPath),
      path.join(PATHS.storageDir, "buckets", "phonezone-uploads", cleanPath),
      path.join(PATHS.storageDir, "product-photos", filename),
      path.join(PATHS.storageDir, "phones", filename),
      path.join(PATHS.storageDir, "sellers", filename),
      path.join(PATHS.storageDir, "customers", filename),
      path.join(PATHS.storageDir, "signatures", filename),
      path.join(PATHS.storageDir, "dealers", filename),
      path.join(PATHS.storageDir, "invoices", filename),
    ];
    for (const p of candidatePaths) {
      try {
        if (fs.existsSync(p)) fs.rmSync(p, { force: true });
      } catch {}
    }

    // Delete from SQLite files index
    try {
      db.prepare("DELETE FROM files WHERE relative_path LIKE ? OR relative_path LIKE ?").run(`%${cleanPath}%`, `%${filename}%`);
    } catch {}

    // Delete from Supabase Storage
    try {
      import("./supabaseSyncService.js").then((m) => {
        m.deleteObjectFromSupabaseStorage("phonezone-uploads", [
          cleanPath,
          filename,
          `phones/${filename}`,
          `product-photos/${filename}`,
          `sellers/${filename}`,
          `customers/${filename}`,
          `dealers/${filename}`
        ]).catch(() => {});
      }).catch(() => {});
    } catch {}
  }
}

/** Delete every file belonging to a record (storage hygiene on record delete). */
export function deleteFilesFor(ownerType, ownerId) {
  const rows = getDb().prepare("SELECT id FROM files WHERE owner_type = ? AND owner_id = ?").all(ownerType, ownerId);
  for (const r of rows) deleteFile(r.id);
  return rows.length;
}

/**
 * Every stored file, newest first.
 *
 * The admin Storage tab used to list one compatibility bucket through the
 * Supabase storage API, which reported only a fraction of what the app really
 * stores. Real photos/documents live under seller/customer/phone/repair/invoice
 * trees, so the tab now reads this listing instead.
 */
export function listFiles({ ownerType = null, limit = 500 } = {}) {
  const capped = Math.min(Math.max(Number(limit) || 500, 1), 2000);
  const db = getDb();
  const sql = `SELECT id, owner_type, owner_id, category, relative_path, original_name,
                      mime_type, size_bytes, is_public, created_at
                 FROM files`;
  if (ownerType) {
    return db.prepare(`${sql} WHERE owner_type = ? ORDER BY created_at DESC, id DESC LIMIT ?`)
      .all(ownerType, capped);
  }
  return db.prepare(`${sql} ORDER BY created_at DESC, id DESC LIMIT ?`).all(capped);
}

export function storageUsage() {
  const row = getDb().prepare("SELECT COUNT(*) AS files, COALESCE(SUM(size_bytes),0) AS bytes FROM files").get();
  return { fileCount: row.files, totalBytes: row.bytes, storageDir: PATHS.storageDir };
}
