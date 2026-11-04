/**
 * 2+1 Year Data Purge & Archive Service
 *
 * Compliance & Optimization Policy:
 * - 2 Active Financial Years (Current FY + 1 Previous FY) remain 100% live.
 * - 1 Archival Year (2nd Previous FY) remains read-only / reference.
 * - Records older than 2+1 years (older than 3 Financial Years) are purged to
 *   keep the database lightweight, high-performance, and within free-tier limits.
 *
 * SAFETY MANDATE:
 * 1. Automatic verified backup snapshot created BEFORE any deletion.
 * 2. Unsold/In-stock phones are NEVER deleted regardless of age.
 * 3. Database VACUUM executed post-purge to reclaim storage.
 * 4. Comprehensive audit log saved.
 */

import { getDb } from "../db/index.js";
import { createBackup } from "./backupService.js";
import { uploadBackupToDrive, getCloudBackupStatus } from "./googleDriveService.js";
import { audit } from "./auditService.js";
import { logger } from "../lib/logger.js";

/**
 * Calculates cutoff date for data retention.
 * By default: Keeps exactly 2 Active Financial Years (Current FY + 1 Previous FY).
 * Any data in the 3rd year or older (before 2 completed FYs) is purged after backup.
 */
export function getPurgeCutoffDate(keepYears = 2) {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth(); // 0-indexed (April is 3)

  // Determine current financial year start (April 1st)
  const fyStartYear = currentMonth >= 3 ? currentYear : currentYear - 1;

  // Keep `keepYears` active: e.g. for keepYears = 2, cutoff is 2 years back from current FY start
  const cutoffYear = fyStartYear - keepYears;
  const cutoffDate = `${cutoffYear}-04-01T00:00:00.000Z`;
  const activeFys = `${cutoffYear}-${String(cutoffYear + 1).slice(2)} to ${fyStartYear}-${String(fyStartYear + 1).slice(2)}`;
  return { cutoffDate, cutoffYear, fyStartYear, keepYears, activeFys };
}

/**
 * Preview how many records will be purged without making any changes.
 */
export function previewPurge(keepYears = 2) {
  const db = getDb();
  const { cutoffDate, cutoffYear, activeFys } = getPurgeCutoffDate(keepYears);

  const eligibleSoldPhones = db
    .prepare(
      `SELECT COUNT(*) AS count FROM phones 
       WHERE is_sold = 1 AND (purchase_date < ? OR (purchase_date IS NULL AND created_at < ?))`
    )
    .get(cutoffDate.split("T")[0], cutoffDate)?.count || 0;

  const eligibleRepairJobs = db
    .prepare(
      `SELECT COUNT(*) AS count FROM repair_jobs 
       WHERE status IN ('delivered', 'cancelled') AND created_at < ?`
    )
    .get(cutoffDate)?.count || 0;

  const eligibleAuditLogs = db
    .prepare(`SELECT COUNT(*) AS count FROM audit_logs WHERE created_at < ?`)
    .get(cutoffDate)?.count || 0;

  const eligibleMessages = db
    .prepare(`SELECT COUNT(*) AS count FROM messages WHERE created_at < ?`)
    .get(cutoffDate)?.count || 0;

  return {
    cutoffDate,
    cutoffYear: `FY ${cutoffYear - 1}-${String(cutoffYear).slice(2)} & older (3rd Year+)`,
    activeWindow: `Keeping 2 Active Financial Years (${activeFys})`,
    retentionPolicy: "2 Active Financial Years Kept 100% Live. 3rd Year & Older Safely Backed Up & Purged.",
    counts: {
      soldPhones: eligibleSoldPhones,
      repairJobs: eligibleRepairJobs,
      auditLogs: eligibleAuditLogs,
      messages: eligibleMessages,
      total: eligibleSoldPhones + eligibleRepairJobs + eligibleAuditLogs + eligibleMessages,
    },
  };
}

/**
 * Executes verified backup first, then purges old data, and vacuums database.
 */
export async function execute2Plus1Purge({ actorUserId = null, forceCloudUpload = true, keepYears = 2 } = {}) {
  const db = getDb();
  const preview = previewPurge(keepYears);
  const { cutoffDate, activeFys } = getPurgeCutoffDate(keepYears);

  logger.info("Starting 2+1 Year Purge. Creating mandatory pre-purge backup snapshot...");

  // 1. Mandatory local verified backup
  const backupResult = createBackup();
  logger.info(`Pre-purge snapshot created: ${backupResult.name}`);

  // 2. Optional cloud backup upload to Google Drive if connected
  let cloudUploaded = false;
  try {
    const driveStatus = getCloudBackupStatus();
    if (driveStatus.connected && forceCloudUpload) {
      await uploadBackupToDrive(backupResult.name);
      cloudUploaded = true;
      logger.info(`Pre-purge snapshot uploaded to Google Drive: ${backupResult.name}`);
    }
  } catch (driveErr) {
    logger.warn("Cloud backup pre-purge upload skipped/failed:", driveErr);
  }

  // 3. Perform Purge inside Database Transaction
  let deletedPhones = 0;
  let deletedRepairs = 0;
  let deletedLogs = 0;
  let deletedMsgs = 0;

  const purgeTx = db.transaction(() => {
    // A. Delete only SOLD phones older than cutoff (In-stock inventory is NEVER purged)
    const phoneStmt = db.prepare(
      `DELETE FROM phones 
       WHERE is_sold = 1 AND (purchase_date < ? OR (purchase_date IS NULL AND created_at < ?))`
    );
    const phoneRes = phoneStmt.run(cutoffDate.split("T")[0], cutoffDate);
    deletedPhones = phoneRes.changes;

    // B. Delete repair jobs that are delivered or cancelled
    const repairStmt = db.prepare(
      `DELETE FROM repair_jobs 
       WHERE status IN ('delivered', 'cancelled') AND created_at < ?`
    );
    const repairRes = repairStmt.run(cutoffDate);
    deletedRepairs = repairRes.changes;

    // C. Clean old audit logs and message history
    deletedLogs = db.prepare(`DELETE FROM audit_logs WHERE created_at < ?`).run(cutoffDate).changes;
    deletedMsgs = db.prepare(`DELETE FROM messages WHERE created_at < ?`).run(cutoffDate).changes;
  });

  purgeTx();

  // 4. Reclaim disk space
  try {
    db.pragma("incremental_vacuum");
  } catch (vacErr) {
    logger.warn("Vacuum warning:", vacErr);
  }

  // 5. Audit log the purge action
  const auditDetails = {
    backupName: backupResult.name,
    cloudUploaded,
    deletedPhones,
    deletedRepairs,
    deletedLogs,
    deletedMsgs,
    cutoffDate,
    executedAt: new Date().toISOString(),
  };

  audit({
    userId: actorUserId,
    action: "data_purge_2plus1",
    entityType: "system",
    details: auditDetails,
  });

  return {
    success: true,
    message: "2+1 Year Data Purge completed successfully with verified backup.",
    backup: {
      name: backupResult.name,
      cloudUploaded,
    },
    purged: {
      soldPhones: deletedPhones,
      repairJobs: deletedRepairs,
      auditLogs: deletedLogs,
      messages: deletedMsgs,
      total: deletedPhones + deletedRepairs + deletedLogs + deletedMsgs,
    },
  };
}
