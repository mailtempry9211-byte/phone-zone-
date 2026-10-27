/** All HTTP routes. Thin layer: parse -> call service -> JSON. */
import express from "express";
import path from "node:path";
import multer from "multer";
import { SERVER, businessConfig } from "../config/business.js";
import { login, logout, logoutAll, sessionUser, changePassword, createUser, listUsers, updateUser, adminSetUserPassword, deleteUser, listUserSessions, revokeSession, hashToken } from "../services/authService.js";
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
import * as ngrokService from "../services/ngrokService.js";
import { getDb } from "../db/index.js";
import { newId } from "../lib/errors.js";
import { listAuditLogs, audit } from "../services/auditService.js";
import { makeLimiter } from "../lib/rateLimit.js";
import { buildCompatRouter } from "./compat.js";
import { buildTacRouter } from "./tac.js";
import { buildRepairsRouter } from "./repairs.js";
import { buildWaRouter } from "./wa.js";
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
  "repairServices", "setupCompleted",
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
const restoreUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 500 * 1024 * 1024 } });
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

      // ---------------- public (no auth) ----------------
  r.get("/health", (_req, res) => res.json({ ok: true, offline: true, host: SERVER.host, port: SERVER.port }));
    r.get("/config", (_req, res) => {
    // PUBLIC projection only. Single source of truth = admin_settings (DB); the
    // full object (bank details, TAC mode, message templates) is served by the
    // authenticated GET /api/settings.
    res.json(publicConfig());
  });

  // ---------------- first-run setup (public, pre-login) ----------------
  r.get("/setup/status", (_req, res) => {
    const s = settings.getSettings();
    res.json({
      setupCompleted: s.setupCompleted,
      configured: {
        businessName: !!s.businessName,
        primaryPhone: !!s.primaryPhone,
        address: !!s.address,
        email: !!s.email,
      },
      requiredConfigured: !!(s.businessName && s.primaryPhone && s.address && s.email),
    });
  });
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
        createUser(profile.email, profile.password, profile.ownerName || profile.businessName);
        return settings.completeSetup(profile);
      })();
    } catch (err) {
      if (/UNIQUE constraint failed: users\.email/i.test(String(err?.message))) {
        throw badRequest("An account with this email already exists. Use a different email.");
      }
      throw err;
    }
    res.json({ setupCompleted: result.setupCompleted });
  }));

  // Restore from backup file (public, pre-login, only when setup not complete)
  r.post("/setup/restore", restoreUpload.single("backup"), wrap(async (req, res) => {
    enforce(restoreLimiter, req);
    requireLocalSetup(req);
    if (settings.isSetupComplete()) throw badRequest("Setup is already complete.");
    if (!req.file) throw badRequest("Please upload a backup file.");
    const { restoreBackup } = await import("../services/backupService.js");
    const { PATHS } = await import("../config/paths.js");
    const fs = await import("node:fs");
    const path = await import("node:path");
    const backupsDir = PATHS.backupsDir;
    fs.mkdirSync(backupsDir, { recursive: true });
    const ext = req.file.originalname.endsWith(".tar.gz") ? "tar.gz" : "zip";
    const targetPath = path.join(backupsDir, `uploaded_restore_${Date.now()}.${ext}`);
    fs.writeFileSync(targetPath, req.file.buffer);
    logger.info("Restore request received", { backupName: path.basename(targetPath), sizeBytes: req.file.size });
    const result = restoreBackup(path.basename(targetPath));
    logger.info("Restore succeeded", { result });
    res.json({ restored: true, backupName: path.basename(targetPath), ...result });
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

  // ---------------- dealers (B2B Phone Suppliers) ----------------
  r.get("/dealers", staff, wrap((req, res) => res.json(dealers.listDealers({ search: req.query.search }))));
  r.get("/dealers/batches/:batchId", staff, wrap((req, res) => res.json(dealers.getBatchPurchase(req.params.batchId))));
  r.get("/dealers/:id", staff, wrap((req, res) => res.json(dealers.getDealer(req.params.id))));
  r.post("/dealers", staff, wrap((req, res) => res.status(201).json(dealers.createDealer(req.body, req.user.id))));
  r.put("/dealers/:id", staff, wrap((req, res) => res.json(dealers.updateDealer(req.params.id, req.body, req.user.id))));
  r.delete("/dealers/:id", staff, wrap((req, res) => res.json(dealers.deleteDealer(req.params.id, req.user.id))));
  r.post("/dealers/batch-purchase", staff, wrap((req, res) => res.status(201).json(dealers.createBatchPurchase(req.body, req.user.id))));

  // ---------------- settings (Admin > Settings, editable anytime) ----------------
  r.get("/settings", staff, wrap((_req, res) => res.json(settings.getSettings())));
  r.put("/settings", staff, upload.none(), wrap((req, res) => res.json(settings.saveSettings(req.body || {}, req.user.id))));
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
  r.get("/ngrok/status", staff, wrap((_req, res) => res.json(ngrokService.getNgrokConfig())));
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
  r.get("/invoices", staff, wrap((req, res) => res.json(invoices.listInvoices(req.query.type))));
  r.post("/invoices", staff, wrap((req, res) => res.status(201).json(invoices.createInvoice({ ...req.body, shopId: req.body?.shopId || req.user?.shopId }))));
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

  // ---------------- reports / exports ----------------
  r.get("/dashboard", staff, wrap((req, res) => res.json(reports.dashboard(req.query))));
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
    res.status(201).json(backups.createBackup());
  }));
  r.post("/backups/restore", requireAuth, requireRole("admin"), wrap((req, res) => {
    enforce(restoreLimiter, req);
    res.json(backups.restoreBackup(req.body?.name));
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
    const fsMod = await import("node:fs");
    const pathMod = await import("node:path");
    const { PATHS } = await import("../config/paths.js");
    fsMod.mkdirSync(PATHS.backupsDir, { recursive: true });
    const safeName = (req.file.originalname || "backup").replace(/[^a-zA-Z0-9._-]/g, "_");
    const name = `uploaded_restore_${Date.now()}_${safeName}`;
    const target = pathMod.join(PATHS.backupsDir, name);
    fsMod.writeFileSync(target, req.file.buffer);
    res.json(backups.restoreBackup(pathMod.basename(target)));
  }));

  // ---------------- database maintenance (admin) ----------------
  r.post("/system/optimize", requireAuth, requireRole("admin"), wrap((_req, res) => {
    getDb().exec("VACUUM; ANALYZE;");
    res.json({ ok: true, message: "Database vacuumed and analyzed successfully." });
  }));

  // ---------------- audit note endpoint ----------------
  r.post("/audit/note", staff, wrap((req, res) => {
    const { action, entity, entityId, details } = req.body || {};
    audit(req.user?.id, action || "note", entity || null, entityId || null, details || null);
    res.status(201).json({ ok: true });
  }));

  // ---------------- WhatsApp Marketing module ----------------
  r.use("/wa", buildWaRouter(staff, admin));

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
