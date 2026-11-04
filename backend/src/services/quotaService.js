/**
 * Free-Tier Quota & Live Metrics Service
 *
 * Tracks live Database (500 MB limit) and File Storage (1,000 MB / 1 GB limit),
 * as well as estimated monthly bandwidth transfer for Supabase & Render/SQLite.
 */

import fs from "node:fs";
import path from "node:path";
import { getDb } from "../db/index.js";
import { PATHS } from "../config/paths.js";
import { logger } from "../lib/logger.js";

const DB_FREE_LIMIT_BYTES = 500 * 1024 * 1024; // 500 MB Supabase Free Limit
const STORAGE_FREE_LIMIT_BYTES = 1000 * 1024 * 1024; // 1 GB (1,000 MB) Supabase Free Limit
const BANDWIDTH_FREE_LIMIT_BYTES = 2000 * 1024 * 1024; // 2 GB Monthly Egress Limit

function calculateDirSize(dirPath) {
  let size = 0;
  let fileCount = 0;
  if (!fs.existsSync(dirPath)) return { size: 0, fileCount: 0 };

  const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);
    try {
      if (entry.isDirectory()) {
        const nested = calculateDirSize(fullPath);
        size += nested.size;
        fileCount += nested.fileCount;
      } else if (entry.isFile()) {
        const stats = fs.statSync(fullPath);
        size += stats.size;
        fileCount += 1;
      }
    } catch (_err) {}
  }
  return { size, fileCount };
}

export function getLiveQuotaMetrics() {
  const db = getDb();
  let dbSizeBytes = 0;
  let storageSizeBytes = 0;
  let storageFilesCount = 0;
  let isCloudSupabase = false;

  // 1. Calculate Database Size
  try {
    const dbPath = PATHS.dbFile;
    if (fs.existsSync(dbPath)) {
      const stats = fs.statSync(dbPath);
      dbSizeBytes = stats.size;

      // WAL file if exists
      const walPath = `${dbPath}-wal`;
      if (fs.existsSync(walPath)) {
        dbSizeBytes += fs.statSync(walPath).size;
      }
    } else {
      // Postgres fallback query
      const row = db.prepare("SELECT page_count * page_size as size FROM pragma_page_count(), pragma_page_size()").get();
      dbSizeBytes = row?.size || 1024 * 1024;
    }
  } catch (_e) {
    dbSizeBytes = 5 * 1024 * 1024; // default baseline estimate
  }

  // 2. Calculate File Storage Size
  try {
    const uploadsDir = PATHS.uploadsDir;
    const { size, fileCount } = calculateDirSize(uploadsDir);
    storageSizeBytes = size;
    storageFilesCount = fileCount;
  } catch (_e) {
    storageSizeBytes = 0;
  }

  // 3. Estimate monthly bandwidth egress based on transactions and audit log counts
  let estimatedMonthlyTransferBytes = 0;
  try {
    const currentMonth = new Date().toISOString().slice(0, 7); // "YYYY-MM"
    const phoneCount = db.prepare("SELECT COUNT(*) AS c FROM phones WHERE created_at >= ?").get(`${currentMonth}-01`)?.c || 0;
    const repairCount = db.prepare("SELECT COUNT(*) AS c FROM repair_jobs WHERE created_at >= ?").get(`${currentMonth}-01`)?.c || 0;
    // Estimate: Each transaction ~ 1.5MB average data transfer (photo views, invoices, API requests)
    estimatedMonthlyTransferBytes = (phoneCount + repairCount) * 1.5 * 1024 * 1024 + (storageFilesCount * 250 * 1024);
  } catch (_e) {
    estimatedMonthlyTransferBytes = 50 * 1024 * 1024;
  }

  const dbPercentage = Number(((dbSizeBytes / DB_FREE_LIMIT_BYTES) * 100).toFixed(1));
  const storagePercentage = Number(((storageSizeBytes / STORAGE_FREE_LIMIT_BYTES) * 100).toFixed(1));
  const bandwidthPercentage = Number(((estimatedMonthlyTransferBytes / BANDWIDTH_FREE_LIMIT_BYTES) * 100).toFixed(1));

  const warnings = [];
  if (dbPercentage >= 80) warnings.push("Database is over 80% of free limit. Run the 2-Year Auto-Purge.");
  if (storagePercentage >= 80) warnings.push("Storage is over 80% of free 1 GB limit. Archive old images.");
  if (bandwidthPercentage >= 85) warnings.push("Monthly bandwidth transfer approaching limit.");

  return {
    database: {
      usedBytes: dbSizeBytes,
      limitBytes: DB_FREE_LIMIT_BYTES,
      usedMb: Number((dbSizeBytes / (1024 * 1024)).toFixed(2)),
      limitMb: 500,
      percentage: Math.min(100, dbPercentage),
      status: dbPercentage > 90 ? "critical" : dbPercentage > 75 ? "warning" : "healthy",
    },
    storage: {
      usedBytes: storageSizeBytes,
      limitBytes: STORAGE_FREE_LIMIT_BYTES,
      usedMb: Number((storageSizeBytes / (1024 * 1024)).toFixed(2)),
      limitMb: 1000,
      fileCount: storageFilesCount,
      percentage: Math.min(100, storagePercentage),
      status: storagePercentage > 90 ? "critical" : storagePercentage > 75 ? "warning" : "healthy",
    },
    bandwidth: {
      usedBytes: estimatedMonthlyTransferBytes,
      limitBytes: BANDWIDTH_FREE_LIMIT_BYTES,
      usedMb: Number((estimatedMonthlyTransferBytes / (1024 * 1024)).toFixed(2)),
      limitMb: 2000,
      percentage: Math.min(100, bandwidthPercentage),
      status: bandwidthPercentage > 90 ? "critical" : bandwidthPercentage > 75 ? "warning" : "healthy",
    },
    warnings,
    isCloudSupabase,
    lastChecked: new Date().toISOString(),
  };
}
