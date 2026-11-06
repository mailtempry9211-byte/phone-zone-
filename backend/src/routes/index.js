/** All HTTP routes. Thin layer: parse -> call service -> JSON. */
import express from "express";
import fs from "node:fs";
import path from "node:path";
import multer from "multer";
import { PATHS } from "../config/paths.js";
import { SERVER, businessConfig } from "../config/business.js";
import { login, logout, logoutAll, sessionUser, changePassword, createUser, listUsers, updateUser, adminSetUserPassword, deleteUser, listUserSessions, revokeSession, hashToken, getSecurityQuestion, recoverPasswordWithSecurityQuestion, setSecurityQuestion } from "../services/authService.js";
import { unauthorized, forbidden, badRequest, AppError } from "../lib/errors.js";
import * as people from "../services/peopleService.js";
import * as inventory from "../services/inventoryService.js";
import * as repairs from "../services/repairService.js";
import * as reports from "../services/reportService.js";
import * as invoices from "../services/invoiceService.js";
import * as backups from "../services/backupService.js";
import * as storage from "../services/storageService.js";
import * as settings from "../services/settingsService.js";
import * as dealers from "../services/dealerService.js";
import * as financialYears from "../services/financialYearService.js";
import * as dashboardService from "../services/dashboardService.js";
import * as ngrokService from "../services/ngrokService.js";
import * as googleDrive from "../services/googleDriveService.js";
import * as retention from "../services/dataRetentionService.js";
import * as supabaseSync from "../services/supabaseSyncService.js";
import { getLiveQuotaMetrics } from "../services/quotaService.js";
import * as licenseService from "../services/licenseService.js";
import { getDeviceInfo } from "../services/hardwareId.js";
import { getDb } from "../db/index.js";
import { newId } from "../lib/errors.js";
import { listAuditLogs, audit } from "../services/auditService.js";
import { makeLimiter } from "../lib/rateLimit.js";
import { buildCompatRouter } from "./compat.js";
import { buildTacRouter } from "./tac.js";
import { buildRepairsRouter } from "./repairs.js";
import { buildWaRouter } from "./wa.js";
import { buildAiRouter } from "./ai.js";
import { buildOcrRouter } from "./ocr.js";
import { logger } from "../lib/logger.js";

/** Simple in-memory rate limiter for the login endpoint.
 * Allows at most 10 FAILED login attempts per email + caller IP per 15 minutes.
 * Resets on server restart (fine for an offline/local app).
 *
 * Only FAILURES increment the counter: checkLoginRateLimit() is a pure read so a
 * blocked attempt (or a successful login) never consumes quota on its own.
 */
const loginAttempts = new Map(); // "email|ip" -> { count, firstAttemptAt }
// PHONEZONE_LOGIN_WINDOW_MS exists so the automated verification run can prove
// that a correct login works again once the window has elapsed, without waiting
// 15 real minutes. Production behaviour is unchanged when it is not set.
const MAX_LOGIN_ATTEMPTS = Number(process.env.PHONEZONE_LOGIN_ATTEMPTS || 10);
const LOGIN_WINDOW_MS = Number(process.env.PHONEZONE_LOGIN_WINDOW_MS || 15 * 60 * 1000);

const attemptKey = (email, ip) => `${String(email || "").trim().toLowerCase()}|${String(ip || "")}`;

function checkLoginRateLimit(email, ip) {
  const record = loginAttempts.get(attemptKey(email, ip));
  const now = Date.now();
  if (!record || now - record.firstAttemptAt > LOGIN_WINDOW_MS) {
    return { allowed: true, remaining: MAX_LOGIN_ATTEMPTS };
  }
  if (record.count >= MAX_LOGIN_ATTEMPTS) {
    return {
      allowed: false,
      remaining: 0,
      retryAfter: Math.max(1, Math.ceil((record.firstAttemptAt + LOGIN_WINDOW_MS - now) / 1000)),
    };
  }
  return { allowed: true, remaining: MAX_LOGIN_ATTEMPTS - record.count };
}

function recordFailedLogin(email, ip) {
  const key = attemptKey(email, ip);
  const now = Date.now();
  const existing = loginAttempts.get(key);
  if (!existing || now - existing.firstAttemptAt > LOGIN_WINDOW_MS) {
    loginAttempts.set(key, { count: 1, firstAttemptAt: now });
  } else {
    existing.count++;
  }
}

function resetLoginAttempts(email, ip) {
  loginAttempts.delete(attemptKey(email, ip));
}

/**
 * Fields that may be read WITHOUT signing in (the public homepage needs them).
 * Bank details, the TAC fetch mode and message templates are deliberately NOT
 * here - they are only served by the authenticated GET /api/settings.
 */
const PUBLIC_CONFIG_KEYS = [
  "businessName", "businessTagline", "ownerName", "address",
  "primaryPhone", "secondaryPhone", "email", "instagram", "whatsappNumber",
  "googleBusinessUrl", "googleBusinessVerified", "showGoogleBusiness",
  "logoUrl", "signatureUrl", "businessHours", "invoicePrefixes",
  "currency", "currencySymbol", "showUdyam", "udyamNumber",
  "termsAndConditions", "termsAndConditionsSale", "termsAndConditionsPurchase",
  "repairServices", "setupCompleted", "homepageTheme", "homepageConfig",
];

/** Public projection of the business settings - never leaks private fields. */
export function publicConfig() {
  const all = settings.getSettings();
  const out = {};
  for (const key of PUBLIC_CONFIG_KEYS) out[key] = all[key];
  // The Udyam number is only published once the owner has verified it.
  if (!all.showUdyam) out.udyamNumber = "";
  return out;
}

/**
 * The first-run wizard may only be driven from the machine running the server:
 * the request must come from loopback AND must not carry a proxy header. This
 * stops the very first visitor of a tunnel/ngrok URL from claiming the install.
 */
function isLocalDirectRequest(req) {
  const forwarded = req.get("x-forwarded-for") || req.get("x-real-ip");
  if (forwarded) return false;
  const ip = String(req.ip || "");
  return ip === "127.0.0.1" || ip === "::1" || ip === "::ffff:127.0.0.1";
}

function requireLocalSetup(req) {
  // If running in cloud hosting (Render, Docker, or Remote Mode enabled), allow setup via browser
  if (process.env.RENDER || process.env.CLOUD_HOSTED || isRemoteMode()) {
    return;
  }
  if (!isLocalDirectRequest(req)) {
    throw forbidden("Setup can only be completed on the computer that runs PhoneZone. Open the app on that computer and try again.");
  }
}

/** True when the request arrived over HTTPS (directly or via a TLS proxy). */
function isSecureRequest(req) {
  return !!(req.secure || String(req.get("x-forwarded-proto") || "").split(",")[0].trim() === "https");
}

/**
 * Headers that stop a stored file from being executed as a script in the
 * browser: never sniff the type, never load sub-resources, and only render
 * images/PDFs inline (everything else is offered as a download).
 */
function setSafeFileHeaders(res, mimeType) {
  const type = String(mimeType || "").toLowerCase();
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Content-Security-Policy", "default-src 'none'; sandbox");
  const inlineSafe = /^(image\/(jpeg|png|webp|gif|bmp)|application\/pdf)$/.test(type);
  res.setHeader("Content-Disposition", inlineSafe ? "inline" : "attachment");
}

/**
 * Simple anti-spam limiter for the public contact form: at most 20 submissions
 * per IP per minute. In-memory (resets on restart), which is plenty for a shop.
 */
const messageHits = new Map(); // ip -> { count, windowStart }
const MAX_MESSAGES_PER_WINDOW = 20;
const MESSAGE_WINDOW_MS = 60 * 1000;
function checkMessageRate(ip) {
  const key = String(ip || "");
  const now = Date.now();
  const record = messageHits.get(key);
  if (!record || now - record.windowStart > MESSAGE_WINDOW_MS) {
    messageHits.set(key, { count: 1, windowStart: now });
    return true;
  }
  record.count++;
  return record.count <= MAX_MESSAGES_PER_WINDOW;
}

/**
 * Rate limits for the expensive / destructive endpoints. Login has its own
 * failure-counter above; these cover everything else that used to be open to a
 * loop: first-run setup, uploads, restores and backup operations.
 */
export const setupLimiter = makeLimiter(10, 10 * 60 * 1000, "setup attempts");
export const restoreLimiter = makeLimiter(10, 60 * 60 * 1000, "restore attempts");
export const backupLimiter = makeLimiter(30, 60 * 60 * 1000, "backup operations");

/** Throw a readable 429 when a limiter refuses the caller. */
function enforce(limiter, req) {
  if (!limiter.allow(req)) throw new AppError(limiter.message, 429, "too_many_requests");
}

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: SERVER.maxUploadBytes } });

const restoreDiskStorage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    fs.mkdirSync(PATHS.backupsDir, { recursive: true });
    cb(null, PATHS.backupsDir);
  },
  filename: (_req, file, cb) => {
    const ext = file.originalname.endsWith(".tar.gz") ? "tar.gz" : (file.originalname.endsWith(".zip") ? "zip" : "bin");
    cb(null, `uploaded_restore_${Date.now()}.${ext}`);
  },
});
const restoreUpload = multer({ storage: restoreDiskStorage, limits: { fileSize: 500 * 1024 * 1024 } });
const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

function requireAuth(req, _res, next) {
  const token = req.cookies?.pz_session || req.get("authorization")?.replace(/^Bearer\s+/i, "");
  const user = sessionUser(token);
  if (!user) return next(unauthorized());
  req.user = user;
  next();
}
const requireRole = (...roles) => (req, _res, next) =>
  req.user?.roles?.some((r) => roles.includes(r)) ? next() : next(forbidden());
const staff = [requireAuth, requireRole("admin", "master_admin", "sales_admin", "repair_admin", "technician", "staff")];
const admin = [requireAuth, requireRole("admin", "master_admin")];
const canRead = [requireAuth, requireRole("admin", "master_admin", "sales_admin", "repair_admin", "technician", "staff", "viewer")];
const salesStaff = [requireAuth, requireRole("admin", "master_admin", "sales_admin", "staff")];
const repairStaff = [requireAuth, requireRole("admin", "master_admin", "repair_admin", "technician", "staff")];

let remoteModeEnabled = process.env.PHONEZONE_REMOTE_ENABLED !== "false";

export function isRemoteMode() {
  return remoteModeEnabled;
}

export function setRemoteMode(enabled) {
  remoteModeEnabled = !!enabled;
}

function isRemoteRequest(req) {
  return !!(req.get("x-forwarded-for") || req.get("forwarded") || req.get("x-real-ip"));
}

function remoteGuard(req, res, next) {
  // Pass all traffic; all admin actions are securely protected by authentication (requireAuth & requireRole)
  next();
}

export function buildRouter() {
  const r = express.Router();
  r.use(remoteGuard);

  // ---------------- public keepalive & health (no auth) ----------------
  r.get("/health", wrap(async (_req, res) => {
    // Touch database to keep Supabase or SQLite active and prevent 7-day pause
    try {
      getDb().prepare("SELECT 1").get();
    } catch (_e) {}
    res.json({ ok: true, offline: true, host: SERVER.host, port: SERVER.port, uptime: Math.round(process.uptime()) });
  }));
  r.get("/ping", (_req, res) => res.json({ pong: true, time: Date.now() }));

  // ---------------- licensing system (public status & activation) ----------------
  r.get("/license/status", wrap((_req, res) => res.json(licenseService.getLicenseStatus())));
  r.get("/license/device-info", wrap((_req, res) => res.json(getDeviceInfo())));
  r.post("/license/activate", wrap(async (req, res) => {
    const { licenseKey, customerName, shopName } = req.body || {};
    const result = await licenseService.activateLicense({ licenseKey, customerName, shopName });
    res.json(result);
  }));
  r.post("/license/deactivate", staff, wrap(async (_req, res) => {
    const result = await licenseService.deactivateLicense();
    res.json(result);
  }));
    r.get("/config", (_req, res) => {
    // PUBLIC projection only. Single source of truth = admin_settings (DB); the
    // full object (bank details, TAC mode, message templates) is served by the
    // authenticated GET /api/settings.
    res.json(publicConfig());
  });

  // ---------------- first-run setup (public, pre-login) ----------------
  r.get("/setup/status", wrap(async (_req, res) => {
    let s = settings.getSettings();
    const cloudStatus = await supabaseSync.checkSupabaseSetupStatus();

    // If local DB says not completed, attempt to pull persistent setup from Supabase Cloud
    if (!s.setupCompleted && cloudStatus.hasCloudSetup) {
      logger.info("[SetupStatus] Ephemeral container detected! Auto-pulling store from Supabase Cloud...");
      await supabaseSync.syncFromSupabaseOnBoot().catch((e) => logger.warn("[SetupStatus] On-demand sync warning:", e));
      s = settings.getSettings();
    }

    res.json({
      setupCompleted: s.setupCompleted,
      cloudSetupDetected: cloudStatus.hasCloudSetup,
      cloudBusinessName: cloudStatus.businessName || s.businessName || null,
      businessName: s.businessName || cloudStatus.businessName || "PhoneZone",
      ownerName: s.ownerName || cloudStatus.ownerName || "",
      configured: {
        businessName: !!s.businessName,
        primaryPhone: !!s.primaryPhone,
        address: !!s.address,
        email: !!s.email,
      },
      requiredConfigured: !!(s.businessName && s.primaryPhone && s.address && s.email),
    });
  }));
  // Pre-login media upload for the wizard (only works while setup is not done).
  r.post("/setup/upload", upload.single("file"), wrap((req, res) => {
    enforce(setupLimiter, req);
    requireLocalSetup(req);
    if (settings.isSetupComplete()) throw badRequest("Setup is already complete; use Admin > Settings to change images.");
    const { category } = req.body || {};
    if (!["logo", "signature"].includes(category)) throw badRequest("Upload must be a logo or signature.");
    const saved = storage.saveFile({
      ownerType: "admin",
      ownerId: "00000000-0000-0000-0000-000000000001",
      category,
      buffer: req.file?.buffer,
      originalName: req.file?.originalname,
      mimeType: req.file?.mimetype,
    });
    // These are served publicly (invoices / homepage) without auth.
    res.status(201).json({ id: saved.id, url: `/api/public/files/${saved.id}` });
  }));
  r.post("/setup", wrap((req, res) => {
    enforce(setupLimiter, req);
    requireLocalSetup(req);
    if (settings.isSetupComplete()) throw badRequest("Setup is already complete.");
    const profile = req.body || {};
    if (!profile.businessName || !profile.primaryPhone || !profile.address || !profile.email) {
      throw badRequest("Business name, phone, address and email are required.");
    }
    if (!profile.password || profile.password.length < 6) {
      throw badRequest("Password must be at least 6 characters.");
    }
    // Account + settings are written in ONE transaction: if anything fails the
    // user is not left half-created (which used to make every retry fail).
    let result;
    try {
      result = getDb().transaction(() => {
        const u = createUser(profile.email, profile.password, profile.ownerName || profile.businessName, "all", "admin", {
          securityQuestion: profile.securityQuestion,
          securityAnswer: profile.securityAnswer,
        });
        const comp = settings.completeSetup(profile);
        return { u, comp };
      })();

      // Persist to Supabase Cloud so settings survive all future deploys!
      supabaseSync.pushSettingsToSupabase(profile).catch(() => {});
      if (result.u) {
        supabaseSync.pushUserToSupabase(result.u, "admin").catch(() => {});
      }
    } catch (err) {
      if (/UNIQUE constraint failed: users\.email/i.test(String(err?.message))) {
        throw badRequest("An account with this email already exists. Use a different email.");
      }
      throw err;
    }
    res.json({ setupCompleted: result.comp?.setupCompleted || true });
  }));

  // Reset setup flag so user can re-run first-time setup or setup a new company (protected with Master Admin Password)
  r.post("/setup/reset", wrap(async (req, res) => {
    const { masterPassword } = req.body || {};
    const db = getDb();
    
    // Check if master password is provided and verify it
    if (masterPassword) {
      const { verifyPassword } = await import("../services/authService.js");
      const adminUsers = db.prepare(`
        SELECT u.* FROM users u
        WHERE u.is_active = 1 AND (
          EXISTS (SELECT 1 FROM user_roles ur WHERE ur.user_id = u.id AND ur.role IN ('admin', 'owner'))
          OR u.email LIKE '%admin%'
        )
      `).all();

      let matched = false;
      for (const admin of adminUsers) {
        if (verifyPassword(String(masterPassword), admin.password_hash)) {
          matched = true;
          break;
        }
      }

      if (!matched && adminUsers.length > 0) {
        throw unauthorized("Master Admin Password verification failed. Incorrect password.");
      }
    } else {
      requireLocalSetup(req);
    }

    db.prepare("UPDATE admin_settings SET setup_completed = 0 WHERE id = (SELECT id FROM admin_settings LIMIT 1)").run();
    res.json({ ok: true, message: "Setup reset successfully. You can now launch the Setup Wizard to configure a new company." });
  }));

  // Unlock setup wizard for genuine admin when shop is already configured
  r.post("/setup/verify-unlock", wrap(async (req, res) => {
    const password = String(req.body?.password || "").trim();
    if (!password) throw badRequest("Password is required to unlock setup.");

    const db = getDb();
    const { verifyPassword, hashToken } = await import("../services/authService.js");
    const crypto = await import("node:crypto");

    const adminUsers = db.prepare(`SELECT * FROM users WHERE is_active = 1`).all();
    let matchedUser = null;

    for (const u of adminUsers) {
      if (verifyPassword(password, u.password_hash)) {
        matchedUser = u;
        break;
      }
    }

    if (!matchedUser && process.env.PHONEZONE_ADMIN_PASSWORD && password === process.env.PHONEZONE_ADMIN_PASSWORD.trim()) {
      matchedUser = adminUsers[0] || { id: "00000000-0000-0000-0000-000000000001", role: "admin" };
    }

    if (!matchedUser) {
      throw forbidden("Incorrect Admin Password.");
    }

    const token = crypto.randomBytes(32).toString("hex");
    const expires = new Date(Date.now() + SERVER.sessionTtlHours * 3600_000).toISOString();
    const userId = matchedUser ? matchedUser.id : "00000000-0000-0000-0000-000000000001";
    db.prepare("INSERT INTO sessions (id, user_id, expires_at) VALUES (?,?,?)").run(hashToken(token), userId, expires);

    res.cookie("pz_session", token, {
      httpOnly: true,
      sameSite: "lax",
      secure: isSecureRequest(req),
      maxAge: SERVER.sessionTtlHours * 3600_000,
    });

    res.json({ ok: true, unlocked: true });
  }));

  // Download full backup archive before wiping or reconfiguring (safety 1st)
  r.get("/setup/export-backup", wrap(async (req, res) => {
    const auth = await import("../services/authService.js");
    const token = req.cookies?.pz_session || req.get("authorization")?.replace(/^Bearer\s+/i, "");
    const user = auth.sessionUser(token);
    const adminPw = req.headers["x-admin-password"] || req.query.adminPassword;

    let isAllowed = !!(user && (user.role === "admin" || user.roles?.includes("admin")));
    if (!isAllowed && adminPw) {
      const db = getDb();
      const adminUsers = db.prepare("SELECT * FROM users WHERE is_active = 1").all();
      for (const a of adminUsers) {
        if (auth.verifyPassword(String(adminPw), a.password_hash)) {
          isAllowed = true;
          break;
        }
      }
      if (!isAllowed && process.env.PHONEZONE_ADMIN_PASSWORD && String(adminPw) === process.env.PHONEZONE_ADMIN_PASSWORD.trim()) {
        isAllowed = true;
      }
    }

    if (!isAllowed && settings.isSetupComplete()) {
      throw forbidden("Admin authorization required to export backup.");
    }

    const { createBackup } = await import("../services/backupService.js");
    const backupRes = createBackup({ scope: "all" });
    res.download(backupRes.file, path.basename(backupRes.file));
  }));

  // Clean wipe Supabase Cloud database tables, storage buckets and local SQLite
  r.post("/setup/wipe-cloud", wrap(async (req, res) => {
    const auth = await import("../services/authService.js");
    const token = req.cookies?.pz_session || req.get("authorization")?.replace(/^Bearer\s+/i, "");
    const user = auth.sessionUser(token);
    const adminPw = req.headers["x-admin-password"] || req.body?.adminPassword;

    let isAllowed = !!(user && (user.role === "admin" || user.roles?.includes("admin")));
    if (!isAllowed && adminPw) {
      const db = getDb();
      const adminUsers = db.prepare("SELECT * FROM users WHERE is_active = 1").all();
      for (const a of adminUsers) {
        if (auth.verifyPassword(String(adminPw), a.password_hash)) {
          isAllowed = true;
          break;
        }
      }
      if (!isAllowed && process.env.PHONEZONE_ADMIN_PASSWORD && String(adminPw) === process.env.PHONEZONE_ADMIN_PASSWORD.trim()) {
        isAllowed = true;
      }
    }

    if (!isAllowed && settings.isSetupComplete()) {
      throw forbidden("Admin authorization required to wipe cloud store.");
    }

    const wipeRes = await supabaseSync.wipeSupabaseCloudData();
    res.json({ ok: true, message: "Cloud and local data permanently wiped. Ready for fresh setup.", ...wipeRes });
  }));

  // Restore from backup file (.zip / .tar.gz)
  r.post("/setup/restore", restoreUpload.single("backup"), wrap(async (req, res) => {
    enforce(restoreLimiter, req);
    if (!req.file) throw badRequest("Please upload a backup file.");

    if (settings.isSetupComplete()) {
      const auth = await import("../services/authService.js");
      const token = req.cookies?.pz_session || req.get("authorization")?.replace(/^Bearer\s+/i, "");
      const user = auth.sessionUser(token);
      if (!user) {
        const adminPw = req.headers["x-admin-password"];
        let ok = false;
        if (adminPw) {
          const db = getDb();
          const adminUsers = db.prepare("SELECT * FROM users WHERE is_active = 1").all();
          for (const a of adminUsers) {
            if (auth.verifyPassword(adminPw, a.password_hash)) {
              ok = true;
              break;
            }
          }
          if (!ok && process.env.PHONEZONE_ADMIN_PASSWORD && adminPw === process.env.PHONEZONE_ADMIN_PASSWORD.trim()) {
            ok = true;
          }
        }
        if (!ok) {
          try { fs.rmSync(req.file.path, { force: true }); } catch {}
          throw forbidden("Setup is already completed. Please enter your Admin Password to unlock restore.");
        }
      }
    }

    // If wipe_existing is requested (or clean restore), wipe old Supabase records first so they don't mix
    if (req.body?.wipe_existing === "true" || req.body?.wipeExisting === "true") {
      logger.info("[Restore] Wiping old Supabase records before restoring new backup file...");
      await supabaseSync.wipeSupabaseCloudData().catch((e) => logger.warn("[Restore] Pre-restore wipe warning:", e));
    }

    const { restoreBackup } = await import("../services/backupService.js");
    logger.info("Restore request received", { backupPath: req.file.path, sizeBytes: req.file.size });
    const result = await restoreBackup(req.file.filename);
    logger.info("Restore succeeded", { result });
    await supabaseSync.pushAllToSupabase().catch((e) => logger.warn("[Restore] Post-setup Supabase sync warning:", e));
    res.json({ restored: true, backupName: req.file.filename, ...result });
  }));

  // Query available cloud backups during initial setup wizard
  r.get("/setup/cloud-backups", wrap(async (req, res) => {
    requireLocalSetup(req);
    res.json(googleDrive.getCloudBackupStatus());
  }));

  // Restore directly from Google Drive / Cloud folder during initial setup
  r.post("/setup/restore-cloud", wrap(async (req, res) => {
    enforce(restoreLimiter, req);
    requireLocalSetup(req);
    const backupName = String(req.body?.backupName || "").trim();
    if (!backupName) throw badRequest("Please select a cloud backup to restore.");
    const result = await googleDrive.restoreFromCloudBackup(backupName);
    logger.info("Setup cloud restore succeeded", { backupName, result });
    res.json({ restored: true, backupName, ...result });
  }));
  r.get("/public/inventory", wrap((_req, res) => res.json(inventory.listPublicInventory())));
  r.get("/public/repair/track", wrap((req, res) => {
    const q = String(req.query.q || "").trim();
    if (!q) throw badRequest("Search query is required.");
    const db = getDb();
    const row = db.prepare(
      `SELECT j.id, j.job_no, j.device_brand, j.device_model, j.status, j.estimate, j.problem, j.received_at,
              c.name AS customer_name
       FROM repair_jobs j
       LEFT JOIN repair_customers c ON c.id = j.repair_customer_id
       WHERE j.deleted_at IS NULL AND (j.job_no = ? OR c.phone = ? OR j.imei = ?)
       ORDER BY j.created_at DESC LIMIT 1`
    ).get(q, q, q);
    if (!row) return res.status(404).json({ error: "No repair job found." });
    res.json(row);
  }));
  r.get("/public/files/:id", wrap((req, res) => {
    const file = storage.getFileRecord(req.params.id);
    if (!file.is_public) return res.status(403).json({ error: "This file is not public." });
    setSafeFileHeaders(res, file.mime_type);
    res.type(file.mime_type).send(storage.readFile(file.relative_path));
  }));
  r.post("/public/messages", wrap((req, res) => {
    if (!checkMessageRate(req.ip)) throw new AppError("Too many messages sent. Please try again in a minute.", 429, "too_many_messages");
    const { name, email, phone, message } = req.body || {};
    if (!name || !email || !message) return res.status(400).json({ error: "Please fill in name, email and message." });
    const cap = (value, max) => String(value).slice(0, max);
    if (String(name).length > 100 || String(email).length > 150 || String(phone || "").length > 20 || String(message).length > 2000) {
      throw badRequest("Your message is too long. Please shorten it and try again.");
    }
    getDb().prepare("INSERT INTO messages (id, name, email, phone, message) VALUES (?,?,?,?,?)")
      .run(newId(), cap(name, 100), cap(email, 150), cap(phone || "", 20) || null, cap(message, 2000));
    res.status(201).json({ ok: true });
  }));

  // ---------------- auth ----------------
  r.post("/auth/login", wrap((req, res) => {
    const email = req.body?.email;
    const limit = checkLoginRateLimit(email, req.ip);
    if (!limit.allowed) {
      const minutes = Math.max(1, Math.ceil(limit.retryAfter / 60));
      throw new AppError(
        `Too many failed attempts. Please try again in ${minutes} minute${minutes === 1 ? "" : "s"}.`,
        429,
        "too_many_attempts",
      );
    }
    let result;
    try {
      result = login(email, req.body?.password);
    } catch (err) {
      recordFailedLogin(email, req.ip);
      throw err;
    }
    resetLoginAttempts(email, req.ip);
    res.cookie("pz_session", result.token, {
      httpOnly: true,
      sameSite: "lax",
      secure: isSecureRequest(req),
      maxAge: SERVER.sessionTtlHours * 3600_000,
    });
    res.json(result);
  }));
  r.post("/auth/logout", wrap((req, res) => {
    logout(req.cookies?.pz_session);
    res.clearCookie("pz_session").json({ ok: true });
  }));
  r.post("/auth/logout-all", staff, wrap((req, res) => {
    logoutAll(req.user?.id);
    res.clearCookie("pz_session").json({ ok: true });
  }));
  r.get("/auth/me", requireAuth, (req, res) => res.json(req.user));
  r.post("/auth/change-password", requireAuth, wrap((req, res) => {
    changePassword(req.user.id, req.body?.currentPassword, req.body?.newPassword);
    res.json({ ok: true });
  }));
  r.get("/auth/sessions", requireAuth, wrap((req, res) => {
    const rawToken = req.cookies?.pz_session || req.get("authorization")?.replace(/^Bearer\s+/i, "");
    const currentHash = rawToken ? hashToken(rawToken) : null;
    const sessions = listUserSessions(req.user.id).map((s) => ({
      ...s,
      isCurrent: s.id === currentHash,
    }));
    res.json(sessions);
  }));
  r.delete("/auth/sessions/:id", requireAuth, wrap((req, res) => {
    res.json(revokeSession(req.params.id, req.user.id));
  }));

  // ---------------- password recovery & security question ----------------
  r.post("/auth/recovery/question", wrap((req, res) => {
    res.json(getSecurityQuestion(req.body?.email));
  }));
  r.post("/auth/recovery/reset", wrap((req, res) => {
    const { email, answer, newPassword } = req.body || {};
    res.json(recoverPasswordWithSecurityQuestion(email, answer, newPassword));
  }));
  r.post("/auth/security-question", requireAuth, wrap((req, res) => {
    const { question, answer } = req.body || {};
    res.json(setSecurityQuestion(req.user.id, question, answer));
  }));

  // ---------------- sellers / customers ----------------
  for (const kind of ["seller", "customer"]) {
    const base = `/${kind}s`;
    r.get(base, staff, wrap((req, res) => res.json(people.listPeople(kind, { search: req.query.search }))));
    r.get(`${base}/:id`, staff, wrap((req, res) => res.json(people.getPerson(kind, req.params.id))));
    r.post(base, staff, wrap((req, res) => res.status(201).json(people.createPerson(kind, req.body, req.user.id))));
    r.put(`${base}/:id`, staff, wrap((req, res) => res.json(people.updatePerson(kind, req.params.id, req.body, req.user.id))));
    r.delete(`${base}/:id`, staff, wrap((req, res) => {
      people.archivePerson(kind, req.params.id, req.user.id);
      res.json({ ok: true, archived: true });
    }));
  }
    r.get("/customers/:id/history", staff, wrap((req, res) => res.json(people.customerHistory(req.params.id))));
  r.get("/customers/:id/aadhaar", staff, wrap((req, res) => {
    const cust = people.getPerson("customer", req.params.id);
    if (!cust) return res.status(404).json({ error: "Customer not found." });
    audit(req.user?.id, "aadhaar_view", "customer", req.params.id);
    res.json({ id: cust.id, id_proof_type: cust.id_proof_type, id_number: cust.id_number });
  }));
  r.get("/sellers/:id/history", staff, wrap((req, res) => res.json(people.sellerHistory(req.params.id))));
  r.get("/people/lookup", staff, wrap((req, res) => res.json(people.lookupUniversal(req.query.phone))));

  // ---------------- dealers (B2B Phone Suppliers) ----------------
  r.get("/dealers", staff, wrap((req, res) => res.json(dealers.listDealers({ search: req.query.search }))));
  r.get("/dealers/batches/:batchId", staff, wrap((req, res) => res.json(dealers.getBatchPurchase(req.params.batchId))));
  r.get("/dealers/:id", staff, wrap((req, res) => res.json(dealers.getDealer(req.params.id))));
  r.get("/dealers/:id/ledger", staff, wrap((req, res) => res.json(dealers.getDealerLedger(req.params.id))));
  r.post("/dealers/:id/ledger", staff, wrap((req, res) => res.status(201).json(dealers.addDealerLedgerEntry(req.params.id, req.body, req.user.id))));
  r.post("/dealers", staff, wrap((req, res) => res.status(201).json(dealers.createDealer(req.body, req.user.id))));
  r.put("/dealers/:id", staff, wrap((req, res) => res.json(dealers.updateDealer(req.params.id, req.body, req.user.id))));
  r.delete("/dealers/:id", staff, wrap((req, res) => res.json(dealers.deleteDealer(req.params.id, req.user.id))));
  r.post("/dealers/batch-purchase", staff, wrap((req, res) => res.status(201).json(dealers.createBatchPurchase(req.body, req.user.id))));

  // ---------------- settings (Admin > Settings, editable anytime) ----------------
  r.get("/settings", staff, wrap((_req, res) => res.json(settings.getSettings())));
  r.put("/settings", staff, upload.none(), wrap((req, res) => {
    const s = settings.saveSettings(req.body || {}, req.user.id);
    supabaseSync.pushSettingsToSupabase(s).catch(() => {});
    res.json(s);
  }));
  r.post("/settings", staff, upload.none(), wrap((req, res) => {
    const s = settings.saveSettings(req.body || {}, req.user.id);
    supabaseSync.pushSettingsToSupabase(s).catch(() => {});
    res.json(s);
  }));
  r.post("/settings/upload", staff, upload.single("file"), wrap((req, res) => {
    const { category } = req.body || {};
    if (!["logo", "signature"].includes(category)) throw badRequest("category must be logo or signature.");
    const saved = storage.saveFile({
      ownerType: "admin",
      ownerId: "00000000-0000-0000-0000-000000000001",
      category,
      buffer: req.file?.buffer,
      originalName: req.file?.originalname,
      mimeType: req.file?.mimetype,
    });
    res.status(201).json({ id: saved.id, url: `/api/public/files/${saved.id}` });
  }));

  // ---------------- shops ----------------
  r.get("/shops", staff, wrap((_req, res) => res.json(getDb().prepare("SELECT id, name, address, phone, email, logo_url, created_at, updated_at FROM shops ORDER BY name").all())));
  r.get("/shops/active", staff, wrap((req, res) => {
    const userShopId = req.user?.shopId;
    if (!userShopId || userShopId === "all") {
      return res.json({ id: "all", name: "All Branches (Consolidated)", isAll: true });
    }
    const shop = getDb().prepare("SELECT id, name, address, phone, email, logo_url FROM shops WHERE id = ?").get(userShopId);
    res.json(shop || { id: userShopId, name: "Main Store" });
  }));
  r.post("/shops/switch", staff, wrap((req, res) => {
    const { shopId } = req.body || {};
    const db = getDb();
    const userRow = db.prepare("SELECT shop_id FROM users WHERE id = ?").get(req.user.id);
    const assignedShop = userRow?.shop_id || "shop_1";

    if (assignedShop !== "all" && shopId !== assignedShop) {
      throw forbidden("Your account is locked to your assigned branch. You cannot switch branches.");
    }

    if (shopId && shopId !== "all") {
      const exists = db.prepare("SELECT id, name, address, phone FROM shops WHERE id = ?").get(shopId);
      if (!exists) throw badRequest("Shop not found");
      try {
        db.prepare("UPDATE users SET active_shop_id = ? WHERE id = ?").run(shopId, req.user.id);
      } catch {
        db.prepare("UPDATE users SET shop_id = ? WHERE id = ?").run(shopId, req.user.id);
      }
      res.json({ ok: true, activeShop: exists });
    } else {
      try {
        db.prepare("UPDATE users SET active_shop_id = 'all' WHERE id = ?").run(req.user.id);
      } catch {
        db.prepare("UPDATE users SET shop_id = 'all' WHERE id = ?").run(req.user.id);
      }
      res.json({ ok: true, activeShop: { id: "all", name: "All Branches" } });
    }
  }));
  r.post("/shops", staff, wrap((req, res) => {
    const { name, address, phone, email, logo_url } = req.body || {};
    if (!name || !phone) throw badRequest("Shop name and phone are required.");
    // `shops.id` is a TEXT primary key, not an autoincrement rowid - it must be
    // generated here, otherwise the first insert stores NULL and the second
    // one fails on the unique constraint.
    const id = newId();
    getDb().prepare(
      `INSERT INTO shops (id, name, address, phone, email, logo_url, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`
    ).run(id, name, address || null, phone, email || null, logo_url || null);
    res.status(201).json({ id, name, address, phone, email, logo_url });
  }));

  // ---------------- phones / inventory / purchases / sales ----------------
  r.get("/phones", staff, wrap((req, res) => res.json(inventory.listPhones(req.query))));
  r.get("/phones/:id", staff, wrap((req, res) => res.json(inventory.getPhone(req.params.id))));
  r.post("/purchases", staff, wrap((req, res) => res.status(201).json(inventory.createPurchase(req.body, req.user.id))));
  r.put("/phones/:id", staff, wrap((req, res) => res.json(inventory.updatePhone(req.params.id, req.body, req.user.id))));
  r.delete("/phones/:id", staff, wrap((req, res) => {
    inventory.archivePhone(req.params.id, req.user.id);
    res.json({ ok: true, archived: true });
  }));
  r.post("/sales", staff, wrap((req, res) =>
    res.status(201).json(inventory.sellPhone(req.body?.phone_id, req.body, req.user.id))));
  r.get("/returns", staff, wrap((_req, res) => res.json(inventory.listReturns())));
  r.post("/returns", staff, wrap((req, res) => res.status(201).json(inventory.processReturn(req.body, req.user.id))));

  // ---------------- financial years (Busy/Tally style books) ----------------
  r.get("/financial-years", staff, wrap((_req, res) => {
    const prev = financialYears.isPreviousYearActive();
    const latest = financialYears.getLatestFinancialYear();
    res.json({
      active: financialYears.getActiveFinancialYear(),
      years: financialYears.listFinancialYears(),
      isPreviousYear: prev.isPrevious,
      latestYear: latest?.label || null,
    });
  }));
  r.get("/financial-years/next", staff, wrap((_req, res) => res.json({ label: financialYears.nextFyLabel() })));
  r.get("/financial-years/pending-changes", staff, wrap((req, res) =>
    res.json(financialYears.getPendingChanges(req.query.from, req.query.to))));
  r.post("/financial-years/carry-forward", requireAuth, requireRole("admin"), wrap((req, res) =>
    res.json(financialYears.carryForwardFinancialYear({ ...(req.body || {}), userId: req.user.id }))));
  // Creating a year and switching years both require the admin's own password.
  r.post("/financial-years", requireAuth, requireRole("admin"), wrap((req, res) =>
    res.status(201).json(financialYears.createFinancialYear({ ...(req.body || {}), userId: req.user.id }))));
  r.post("/financial-years/:id/activate", requireAuth, requireRole("admin"), wrap((req, res) =>
    res.json(financialYears.activateFinancialYear({ id: req.params.id, password: req.body?.password, userId: req.user.id }))));

  // Cross-year IMEI report: full purchase/sale/return trail, no year switch needed.
  r.get("/imei-history", staff, wrap((req, res) => res.json(financialYears.imeiHistory(req.query.imei))));

  // ---------------- ngrok embedded tunnel ----------------
  r.get("/ngrok/status", staff, wrap(async (_req, res) => res.json(await ngrokService.getNgrokConfig())));
  r.get("/ngrok/public-status", wrap(async (_req, res) => {
    const cfg = await ngrokService.getNgrokConfig();
    res.json({ running: cfg.running, lastUrl: cfg.lastUrl });
  }));
  r.post("/ngrok/save", requireAuth, requireRole("admin"), wrap(async (req, res) =>
    res.json(await ngrokService.saveNgrokSettings(req.body))));
  r.post("/ngrok/start", requireAuth, requireRole("admin"), wrap(async (req, res) =>
    res.json(await ngrokService.startNgrokTunnel({ ...(req.body || {}), userId: req.user.id }))));
  r.post("/ngrok/stop", requireAuth, requireRole("admin"), wrap(async (req, res) =>
    res.json(await ngrokService.stopNgrokTunnel(req.user.id))));

  // ---------------- repairs ----------------
  r.get("/repairs", staff, wrap((req, res) => res.json(repairs.listRepairs(req.query))));
  r.get("/repairs/:id", staff, wrap((req, res) => res.json(repairs.getRepair(req.params.id))));
  r.post("/repairs", staff, wrap((req, res) => res.status(201).json(repairs.createRepair(req.body, req.user.id))));
  r.put("/repairs/:id", staff, wrap((req, res) => res.json(repairs.updateRepair(req.params.id, req.body, req.user.id))));
  r.delete("/repairs/:id", staff, wrap((req, res) => {
    repairs.archiveRepair(req.params.id, req.user.id);
    res.json({ ok: true, archived: true });
  }));

  // ---------------- files ----------------
  r.post("/files", staff, upload.single("file"), wrap((req, res) => {
    const { ownerType, ownerId, category } = req.body;
    res.status(201).json(storage.saveFile({
      ownerType, ownerId, category,
      buffer: req.file?.buffer, originalName: req.file?.originalname, mimeType: req.file?.mimetype,
    }));
  }));
  // List every stored file (admin Storage tab). `ownerType` narrows it down.
  r.get("/files", staff, wrap((req, res) =>
    res.json(storage.listFiles({ ownerType: req.query.ownerType || null, limit: req.query.limit }))));
  r.get("/files/:id", staff, wrap((req, res) => {
    const file = storage.getFileRecord(req.params.id);
    setSafeFileHeaders(res, file.mime_type);
    res.type(file.mime_type).send(storage.readFile(file.relative_path));
  }));
  r.delete("/files/:id", staff, wrap((req, res) => {
    storage.deleteFile(req.params.id);
    res.json({ ok: true });
  }));
  r.get("/storage/usage", staff, wrap((_req, res) => res.json(storage.storageUsage())));

  // ---------------- users (admin only) ----------------
  r.get("/users", admin, wrap((_req, res) => res.json(listUsers())));
  r.post("/users", admin, wrap((req, res) => {
    const { email, password, displayName, shopId, role } = req.body || {};
    if (!email || !password) throw badRequest("Email and password are required.");
    const user = createUser(email, password, displayName, shopId, role);
    res.status(201).json(user);
  }));
  r.patch("/users/:id", admin, wrap((req, res) => {
    res.json(updateUser(req.params.id, req.body || {}, req.user.id));
  }));
  r.post("/users/:id/password", admin, wrap((req, res) => {
    const { newPassword } = req.body || {};
    if (!newPassword) throw badRequest("New password is required.");
    res.json(adminSetUserPassword(req.params.id, newPassword, req.user.id));
  }));
  r.delete("/users/:id", admin, wrap((req, res) => {
    res.json(deleteUser(req.params.id, req.user.id));
  }));

  // ---------------- invoices ----------------
  r.get("/invoices/search", staff, wrap((req, res) => res.json(invoices.searchUnifiedInvoices(req.query.q || req.query.query || "", { limit: req.query.limit }))));
  r.get("/invoices", staff, wrap((req, res) => res.json(invoices.listInvoices(req.query.type))));
  r.post("/invoices", staff, wrap((req, res) => {
    const userShopId = req.user?.shopId || "shop_1";
    const isGlobal = userShopId === "all";
    const targetShopId = !isGlobal ? userShopId : (req.body?.shopId || (userShopId === "all" ? "shop_1" : userShopId));
    res.status(201).json(invoices.createInvoice({ ...req.body, shopId: targetShopId }));
  }));
  r.post("/invoices/render-pdf", staff, wrap((req, res) => {
    const { html } = req.body || {};
    if (!html) throw badRequest("html is required.");
    const buf = invoices.htmlToPdfBuffer(html);
    if (!buf) throw badRequest("Could not render PDF.");
    res.type("application/pdf").send(buf);
  }));
  r.get("/invoices/:id", staff, wrap((req, res) => res.json(invoices.getInvoice(req.params.id))));
  r.get("/invoices/:id/html", staff, wrap((req, res) => {
    const html = invoices.getInvoiceHtml(req.params.id);
    res.type("text/html").send(html);
  }));
  r.post("/invoices/:id/pdf", staff, upload.single("file"), wrap((req, res) =>
    res.json(invoices.attachPdf(req.params.id, req.file.buffer))));

  // ---------------- reports / exports / dashboard ----------------
  r.get("/dashboard/overview", admin, wrap((req, res) => {
    const range = req.query.range || "week";
    const date = req.query.date || "";
    const shop = req.query.shop || (req.user?.shopId ? String(req.user.shopId) : "");
    const fy = req.query.fy || "";
    const nocache = req.query.nocache === "1" || req.query.nocache === "true";
    const role = req.user?.roles?.includes("admin") ? "admin" : (req.user?.role || "staff");
    res.json(dashboardService.getDashboardOverview({ range, date, shop, fy, role, nocache }));
  }));
  r.get("/dashboard", admin, wrap((req, res) => res.json(reports.dashboard(req.query))));
  r.get("/exports/:entity.csv", staff, wrap((req, res) => {
    const csv = reports.exportCsv(req.params.entity);
    if (csv === null) return res.status(404).json({ error: "Unknown export." });
    res.type("text/csv").attachment(`${req.params.entity}.csv`).send(csv);
  }));
  r.get("/audit-logs", requireAuth, requireRole("admin"), wrap((_req, res) => res.json(listAuditLogs())));

  // ---------------- messages (admin) ----------------
  r.get("/messages", staff, wrap((_req, res) =>
    res.json(getDb().prepare("SELECT * FROM messages ORDER BY created_at DESC").all())));
  r.put("/messages/:id/read", staff, wrap((req, res) => {
    getDb().prepare("UPDATE messages SET is_read = 1 WHERE id = ?").run(req.params.id);
    res.json({ ok: true });
  }));

  // ---------------- backup / restore ----------------
  r.get("/backups", requireAuth, requireRole("admin"), wrap((_req, res) => res.json(backups.listBackups())));
  r.post("/backups", requireAuth, requireRole("admin"), wrap((req, res) => {
    enforce(backupLimiter, req);
    res.status(201).json(backups.createBackup(req.body || {}));
  }));
  r.post("/backups/restore", requireAuth, requireRole("admin"), wrap(async (req, res) => {
    enforce(restoreLimiter, req);
    res.json(await backups.restoreBackup(req.body?.name));
  }));

  // Download a created full backup (.zip) so the admin can save it.
  r.get("/backups/:name/download", requireAuth, requireRole("admin"), wrap((req, res) => {
    const file = backups.getBackupFilePath(req.params.name);
    res.download(file, path.basename(file));
  }));

  // Restore from a user-uploaded backup file (.zip / .tar.gz).
  r.post("/backups/restore-upload", requireAuth, requireRole("admin"), restoreUpload.single("backup"), wrap(async (req, res) => {
    enforce(restoreLimiter, req);
    if (!req.file) throw badRequest("Please upload a backup file.");
    logger.info("Admin backup restore received", { file: req.file.filename, size: req.file.size });
    const restoreRes = await backups.restoreBackup(req.file.filename);
    await supabaseSync.pushAllToSupabase().catch((e) => logger.warn("[Restore] Post-restore Supabase sync warning:", e));
    res.json(restoreRes);
  }));

  // ---------------- supabase cloud database sync ----------------
  r.get("/supabase/status", requireAuth, wrap(async (_req, res) => {
    res.json(await supabaseSync.getSupabaseSyncStatus());
  }));
  r.post("/supabase/sync-now", requireAuth, requireRole("admin"), wrap(async (_req, res) => {
    const result = await supabaseSync.pushAllToSupabase();
    res.json(result);
  }));

  // ---------------- google drive / cloud backup ----------------
  r.get("/google-drive/status", requireAuth, wrap((_req, res) => {
    res.json(googleDrive.getCloudBackupStatus());
  }));
  r.post("/google-drive/config", requireAuth, requireRole("admin"), wrap((req, res) => {
    res.json(googleDrive.configureCloudBackup(req.body || {}));
  }));
  r.post("/google-drive/sync", requireAuth, wrap((req, res) => {
    enforce(backupLimiter, req);
    res.json(googleDrive.syncToGoogleDrive());
  }));
  r.post("/google-drive/restore", requireAuth, requireRole("admin"), wrap(async (req, res) => {
    enforce(restoreLimiter, req);
    const backupName = String(req.body?.backupName || "").trim();
    if (!backupName) throw badRequest("Please select a cloud backup to restore.");
    const result = await googleDrive.restoreFromCloudBackup(backupName);
    res.json({ restored: true, backupName, ...result });
  }));

  // ---------------- database maintenance & 2+1 year retention (admin) ----------------
  r.post("/system/optimize", requireAuth, requireRole("admin"), wrap((_req, res) => {
    getDb().exec("VACUUM; ANALYZE;");
    res.json({ ok: true, message: "Database vacuumed and analyzed successfully." });
  }));

  r.get("/retention/preview", requireAuth, requireRole("admin"), wrap((_req, res) => {
    res.json(retention.previewPurge());
  }));

  r.post("/retention/purge", requireAuth, requireRole("admin"), wrap(async (req, res) => {
    enforce(backupLimiter, req);
    const result = await retention.execute2Plus1Purge({ actorUserId: req.user?.id });
    res.json(result);
  }));

  // ---------------- live cloud quota monitor (Supabase / Render / Local) ----------------
  r.get("/system/quota", requireAuth, wrap((_req, res) => {
    res.json(getLiveQuotaMetrics());
  }));

  // ---------------- live Supabase verification test ----------------
  r.get("/system/test-supabase", wrap(async (_req, res) => {
    const { url, key, isConfigured } = supabaseSync.getSupabaseConfig();
    if (!isConfigured) {
      return res.json({
        ok: false,
        configured: false,
        error: "SUPABASE_URL ya SUPABASE_ANON_KEY Render Environment ya Settings me configured nahi hai.",
        hint: "Render dashboard ke Environment me SUPABASE_URL aur SUPABASE_ANON_KEY dalein, ya Admin Settings me Supabase credentials save karein.",
      });
    }

    try {
      const restRes = await fetch(`${url.replace(/\/+$/, "")}/rest/v1/admin_settings?select=id,business_name&limit=1`, {
        headers: {
          apikey: key,
          Authorization: `Bearer ${key}`,
        },
      });

      if (!restRes.ok) {
        const text = await restRes.text().catch(() => "");
        let json = {};
        try { json = JSON.parse(text); } catch {}
        if (restRes.status === 401) {
          return res.json({
            ok: false,
            configured: true,
            status: 401,
            error: "Invalid API Key! Supabase ne key reject kar di.",
            hint: "Supabase Settings > API Keys me 'View legacy API keys' dabayein aur eyJ... se shuru hone wali anon key use karein.",
            details: json,
          });
        }
        if (restRes.status === 404 || (json.message && json.message.includes("relation") && json.message.includes("does not exist"))) {
          return res.json({
            ok: false,
            configured: true,
            status: 404,
            error: "Supabase me PhoneZone ki tables nahi mili!",
            hint: "Supabase SQL Editor me jaakar supabase/supabase_complete_schema.sql ka code Run karein.",
            details: json,
          });
        }
        return res.json({
          ok: false,
          configured: true,
          status: restRes.status,
          error: json.message || text || `HTTP ${restRes.status}`,
          hint: "Check Supabase project status.",
          details: json,
        });
      }

      const rows = await restRes.json().catch(() => []);
      return res.json({
        ok: true,
        connected: true,
        status: 200,
        message: "✅ Supabase 100% Connected & Verified! Tables exist and queries are working.",
        rowCount: Array.isArray(rows) ? rows.length : 0,
      });
    } catch (err) {
      return res.json({
        ok: false,
        error: `Supabase se connect karne me network error: ${err.message}`,
      });
    }
  }));

  // ---------------- audit note endpoint ----------------
  r.post("/audit/note", staff, wrap((req, res) => {
    const { action, entity, entityId, details } = req.body || {};
    audit(req.user?.id, action || "note", entity || null, entityId || null, details || null);
    res.status(201).json({ ok: true });
  }));

  // ---------------- WhatsApp Marketing module ----------------
  r.use("/wa", buildWaRouter(staff, admin));

  // ---------------- Jarvis AI Assistant & AI Vision module ----------------
  r.use("/ai", buildAiRouter(staff, admin));

  // ---------------- OCR recognition module (Aadhaar & IMEI) ----------------
  r.use("/ocr", buildOcrRouter(staff));

  // ---------------- private repairs module ----------------
  r.use("/repair", staff, buildRepairsRouter());

  // ---------------- TAC / IMEI engine (offline lookup) ----------------
  r.use("/tac", buildTacRouter(staff));

  // ---------------- PostgREST compatibility (offline admin UI) ----------------
  r.use("/pg", buildCompatRouter(staff, canRead));

  return r;
}
