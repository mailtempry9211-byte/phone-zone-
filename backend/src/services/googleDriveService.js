/**
 * Google Drive / Cloud Backup service.
 * Supports auto-detecting Google Drive desktop sync folder, custom user folder,
 * syncing archives into cloud storage, and automated logout backup.
 */
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { getDb } from "../db/index.js";
import { createBackup, getBackupFilePath, restoreBackup } from "./backupService.js";
import { PATHS } from "../config/paths.js";
import { logger } from "../lib/logger.js";
import { AppError } from "../lib/errors.js";

const CANDIDATE_DRIVES = ["G:\\", "H:\\", "I:\\", "F:\\", "D:\\"];

export function detectCloudFolder() {
  const home = os.homedir();
  const candidates = [
    // Standard Google Drive for Desktop virtual drive paths
    "G:\\My Drive",
    "H:\\My Drive",
    "I:\\My Drive",
    // User profile based Google Drive sync folders
    path.join(home, "Google Drive", "My Drive"),
    path.join(home, "Google Drive"),
    path.join(home, "GoogleDrive"),
    // Common OneDrive fallback if Google Drive is not installed
    path.join(home, "OneDrive"),
  ];

  for (const c of candidates) {
    try {
      if (fs.existsSync(c)) {
        return { path: c, type: c.toLowerCase().includes("onedrive") ? "onedrive" : "google_drive" };
      }
    } catch (_e) {}
  }

  // Check if G:\ drive exists (typical default mount on Windows for Google Drive)
  for (const drive of CANDIDATE_DRIVES) {
    try {
      if (fs.existsSync(drive)) {
        const pzFolder = path.join(drive, "PhoneZone_Cloud_Backups");
        return { path: pzFolder, type: "custom_drive" };
      }
    } catch (_e) {}
  }

  // Default fallback inside user profile
  return { path: path.join(home, "PhoneZone_Cloud_Backups"), type: "local_folder" };
}

export function getCloudBackupStatus() {
  const db = getDb();
  const row = db.prepare(
    "SELECT google_drive_folder, backup_on_logout, last_cloud_backup_at FROM admin_settings LIMIT 1"
  ).get() || {};

  const detected = detectCloudFolder();
  const configured = row.google_drive_folder ? String(row.google_drive_folder).trim() : "";
  const activeFolder = configured || detected.path;

  let backupCount = 0;
  let availableBackups = [];

  const targetDir = activeFolder.endsWith("PhoneZone_Backups") || activeFolder.endsWith("PhoneZone_Cloud_Backups")
    ? activeFolder
    : path.join(activeFolder, "PhoneZone_Backups");

  if (fs.existsSync(targetDir)) {
    try {
      availableBackups = fs
        .readdirSync(targetDir)
        .filter((f) => f.startsWith("PhoneZone_Backup_") && (f.endsWith(".tar.gz") || f.endsWith(".zip")))
        .map((f) => {
          const s = fs.statSync(path.join(targetDir, f));
          return { name: f, sizeBytes: s.size, modifiedAt: s.mtime.toISOString() };
        })
        .sort((a, b) => b.modifiedAt.localeCompare(a.modifiedAt));
      backupCount = availableBackups.length;
    } catch (_e) {}
  }

  return {
    configuredFolder: configured,
    detectedFolder: detected.path,
    folderType: detected.type,
    activeFolder,
    targetDir,
    isConnected: fs.existsSync(activeFolder),
    backupOnLogout: row.backup_on_logout !== 0,
    lastCloudBackupAt: row.last_cloud_backup_at || null,
    backupCount,
    recentBackups: availableBackups.slice(0, 5),
  };
}

export function configureCloudBackup({ googleDriveFolder, backupOnLogout }) {
  const db = getDb();
  const updates = [];
  const params = [];

  if (googleDriveFolder !== undefined) {
    const trimmed = String(googleDriveFolder || "").trim();
    if (trimmed && !fs.existsSync(trimmed)) {
      try {
        fs.mkdirSync(trimmed, { recursive: true });
      } catch (err) {
        throw new AppError(`Could not access or create folder: ${err.message}`, 400);
      }
    }
    updates.push("google_drive_folder = ?");
    params.push(trimmed);
  }

  if (backupOnLogout !== undefined) {
    updates.push("backup_on_logout = ?");
    params.push(backupOnLogout ? 1 : 0);
  }

  if (updates.length > 0) {
    db.prepare(`UPDATE admin_settings SET ${updates.join(", ")} WHERE id = (SELECT id FROM admin_settings LIMIT 1)`).run(...params);
  }

  return getCloudBackupStatus();
}

export function syncToGoogleDrive() {
  const status = getCloudBackupStatus();
  const targetDir = status.targetDir;

  try {
    fs.mkdirSync(targetDir, { recursive: true });
  } catch (err) {
    throw new AppError(`Failed to access cloud backup directory (${targetDir}): ${err.message}`, 500);
  }

  // 1. Create latest full backup
  const backup = createBackup();
  const sourcePath = backup.file;
  const fileName = path.basename(sourcePath);
  const destinationPath = path.join(targetDir, fileName);

  // 2. Copy to Google Drive / Cloud Sync folder
  try {
    fs.copyFileSync(sourcePath, destinationPath);
  } catch (copyErr) {
    logger.error("Failed to copy backup to cloud directory", copyErr);
    throw new AppError(`Failed to copy backup to cloud directory: ${copyErr.message}`, 500);
  }

  // 3. Update last backup timestamp
  const nowIso = new Date().toISOString();
  const db = getDb();
  db.prepare("UPDATE admin_settings SET last_cloud_backup_at = ? WHERE id = (SELECT id FROM admin_settings LIMIT 1)").run(nowIso);

  // 4. Housekeeping: retain top 10 backups in cloud folder
  try {
    const files = fs
      .readdirSync(targetDir)
      .filter((f) => f.startsWith("PhoneZone_Backup_") && (f.endsWith(".tar.gz") || f.endsWith(".zip")))
      .map((f) => ({
        name: f,
        fullPath: path.join(targetDir, f),
        mtime: fs.statSync(path.join(targetDir, f)).mtimeMs,
      }))
      .sort((a, b) => b.mtime - a.mtime);

    if (files.length > 10) {
      for (const oldFile of files.slice(10)) {
        try {
          fs.unlinkSync(oldFile.fullPath);
        } catch (_e) {}
      }
    }
  } catch (_e) {}

  logger.info("Cloud backup sync completed", { destinationPath, sizeBytes: backup.sizeBytes });

  return {
    success: true,
    backupName: fileName,
    targetFile: destinationPath,
    targetDir,
    sizeBytes: backup.sizeBytes,
    syncedAt: nowIso,
  };
}

/**
 * Restores a snapshot file from Google Drive / Cloud sync folder.
 * Safely copies the archive to the local backups directory and applies it.
 */
export function restoreFromCloudBackup(backupFileName) {
  if (!backupFileName) throw new AppError("Backup file name is required.", 400);
  const status = getCloudBackupStatus();
  const targetDir = status.targetDir;
  const safeName = path.basename(backupFileName);
  const cloudFilePath = path.join(targetDir, safeName);

  if (!fs.existsSync(cloudFilePath)) {
    throw new AppError(`Backup file "${safeName}" not found in cloud folder (${targetDir}).`, 404);
  }

  // Ensure local backups folder exists
  fs.mkdirSync(PATHS.backupsDir, { recursive: true });
  const localTarget = path.join(PATHS.backupsDir, safeName);

  // Copy cloud file to local backups
  try {
    fs.copyFileSync(cloudFilePath, localTarget);
  } catch (err) {
    throw new AppError(`Failed to copy cloud backup locally: ${err.message}`, 500);
  }

  logger.info("Restoring from cloud backup", { safeName, cloudFilePath, localTarget });
  return restoreBackup(safeName);
}

export const uploadBackupToDrive = syncToGoogleDrive;



