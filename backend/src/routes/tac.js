/**
 * /api/tac routes (Step 1) - all behind the `staff` auth middleware.
 *
 *   GET  /api/tac/stats        totals + counts by source
 *   GET  /api/tac/export       PhoneZone_TAC_<date>.xlsx (TAC kept as text)
 *   POST /api/tac/import       multipart .xlsx, streamed with ExcelJS
 *   POST /api/tac/learn        remember a TAC the shop actually sold
 *   GET  /api/tac/keys         list Hicelltek keys (masked, Step 2/6)
 *   POST /api/tac/keys         add a key
 *   POST /api/tac/keys/reorder new key order (array of ids)
 *   PATCH/DELETE /api/tac/keys/:id
 *   POST /api/tac/fetch        force an online lookup for one TAC
 *   GET  /api/tac/:value       lookup an 8-digit TAC or 15-digit IMEI
 */
import express from "express";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import multer from "multer";
import * as tac from "../services/tacService.js";
import * as hct from "../services/hicelltekService.js";
import { getSettings } from "../services/settingsService.js";
import { badRequest, AppError } from "../lib/errors.js";

/** hicelltek {code,message} -> HTTP status (message is user-facing). */
const HCT_STATUS = { NO_KEY: 400, QUOTA_EXHAUSTED: 429, NETWORK: 502, BAD_RESPONSE: 502 };

const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

export function buildTacRouter(staff) {
  const r = express.Router();

  // Own multer instance: the Excel dump is ~10 MB / 250k rows.
  const maxBytes = Number(process.env.PHONEZONE_MAX_TAC_UPLOAD_BYTES || 100 * 1024 * 1024);
  const upload = multer({
    storage: multer.diskStorage({
      destination: os.tmpdir(),
      filename: (_req, file, cb) =>
        cb(null, `tac-upload-${Date.now()}-${Math.random().toString(36).slice(2)}${path.extname(file.originalname || ".xlsx")}`),
    }),
    limits: { fileSize: maxBytes },
  });

  r.get("/stats", staff, wrap(async (_req, res) => {
    res.json(tac.getStats());
  }));

  r.get("/export", staff, wrap(async (_req, res) => {
    const stamp = new Date().toISOString().slice(0, 10);
    const name = `PhoneZone_TAC_${stamp}.xlsx`;
    const out = path.join(os.tmpdir(), `phonezone-tac-export-${Date.now()}.xlsx`);
    try {
      await tac.exportDatabase(out);
    } catch (err) {
      fs.unlink(out, () => {});
      throw err;
    }
    res.on("finish", () => fs.unlink(out, () => {}));
    res.download(out, name);
  }));

  r.post("/import", staff, upload.single("file"), wrap(async (req, res) => {
    if (!req.file) throw badRequest("Choose an .xlsx file to import.");
    try {
      const overwrite = req.body?.overwrite === "true" || req.body?.overwrite === true;
      const report = await tac.importWorkbook(req.file.path, { overwrite });
      res.json(report);
    } finally {
      fs.unlink(req.file.path, () => {});
    }
  }));

  r.post("/learn", staff, wrap(async (req, res) => {
    res.json(tac.learnTac(req.body || {}));
  }));

  r.post("/auto-learn", staff, wrap(async (req, res) => {
    const result = tac.autoLearnTac(req.body || {});
    res.json({ ok: true, learned: !!result, data: result });
  }));

  // ---------------- Hicelltek keys (never leave the backend) -------------
  r.get("/keys", staff, wrap(async (_req, res) => {
    res.json(hct.listKeys());
  }));

  r.post("/keys", staff, wrap(async (req, res) => {
    res.status(201).json(hct.addKey(req.body || {}));
  }));

  r.post("/keys/reorder", staff, wrap(async (req, res) => {
    res.json(hct.reorderKeys(Array.isArray(req.body?.ids) ? req.body.ids : []));
  }));

  r.patch("/keys/:id", staff, wrap(async (req, res) => {
    res.json(hct.patchKey(req.params.id, req.body || {}));
  }));

  r.delete("/keys/:id", staff, wrap(async (req, res) => {
    res.json(hct.deleteKey(req.params.id));
  }));

  // Force an online lookup (the `ask` button / `auto` mode). Saves the answer
  // as source='api' so the free quota is spent at most once per TAC.
  r.post("/fetch", staff, wrap(async (req, res) => {
    const value = String(req.body?.value || "");
    if (!/^\d{6,15}$/.test(value)) throw badRequest("Enter a 6-8 digit TAC or a 15-digit IMEI.");
    const local = tac.lookupTac(value);
    if (local.found) return res.json({ ...local, fetched: false });

    try {
      const hit = await hct.fetchTacFromApi(value, { force: req.body?.force === true });
      tac.storeApiResult({ tac: value, ...hit });
      res.json({ ...tac.lookupTac(value), fetched: true });
    } catch (err) {
      if (err?.code === "NOT_FOUND") return res.json({ found: false, error: { code: "NOT_FOUND", message: err.message } });
      if (err?.code) throw new AppError(err.message, HCT_STATUS[err.code] || 400, err.code.toLowerCase());
      throw err;
    }
  }));

  // Numeric lookup - keep LAST so it cannot shadow the routes above.
  // fetchMode tells the UI what to do on a local miss (ask/auto/off, Step 2).
  r.get("/:value", staff, wrap(async (req, res) => {
    const value = String(req.params.value || "");
    // 6..15 digits: 6/7-digit TACs are left-padded to 8 (Excel drops zeros).
    if (!/^\d{6,15}$/.test(value)) throw badRequest("Enter a 6-8 digit TAC or a 15-digit IMEI.");
    const found = tac.lookupTac(value);
    res.json({ ...found, fetchMode: getSettings().tacFetchMode, hasKeys: hct.listKeys().some((k) => k.isEnabled) });
  }));

  return r;
}
