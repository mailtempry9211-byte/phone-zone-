/**
 * WhatsApp Marketing API routes.
 * Mounted at /api/wa.
 * Queue dispatch endpoints accept extension bearer tokens.
 * Management endpoints require staff or admin authentication.
 */
import express from "express";
import { unauthorized, badRequest } from "../lib/errors.js";
import { sessionUser } from "../services/authService.js";
import * as waService from "../services/waService.js";
import * as openWaService from "../services/openWaService.js";

const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

export function buildWaRouter(staffAuth, adminAuth) {
  const r = express.Router();

  // Extension auth middleware: allows valid extension token OR logged-in staff session
  function extensionAuth(req, res, next) {
    const authHeader = req.get("authorization") || "";
    const token = authHeader.replace(/^Bearer\s+/i, "").trim();

    if (token && waService.verifyToken(token)) {
      req.isExtension = true;
      return next();
    }

    const session = sessionUser(req.cookies?.pz_session || token);
    if (session) {
      req.user = session;
      return next();
    }

    return next(unauthorized("Invalid or revoked WhatsApp extension token."));
  }

  // Dispatch endpoints (used by Chrome Extension)
  r.get("/next", extensionAuth, wrap((req, res) => {
    const ignoreHours = req.query?.ignoreHours === "true";
    const minGap = req.query?.minGapMs ? Number(req.query.minGapMs) : undefined;
    res.json(waService.getNextQueueItem({ ignoreHours, minGapMs: minGap }));
  }));

  r.post("/result", extensionAuth, wrap((req, res) => {
    const { queueId, status, error } = req.body || {};
    if (!queueId) throw badRequest("queueId is required.");
    res.json(waService.recordResult(queueId, { status, error }));
  }));

  // Opt-out endpoint
  r.post("/opt-out", wrap((req, res) => {
    const { phone } = req.body || {};
    res.json(waService.optOut(phone));
  }));

  // Staff endpoints
  r.get("/queue/status", staffAuth, wrap((_req, res) => {
    res.json(waService.getQueueStatus());
  }));

  r.get("/campaigns", staffAuth, wrap((_req, res) => {
    res.json(waService.listCampaigns());
  }));

  r.post("/campaigns", staffAuth, wrap((req, res) => {
    res.status(201).json(waService.createCampaign(req.body || {}));
  }));

  r.get("/templates", staffAuth, wrap((_req, res) => {
    res.json(waService.listTemplates());
  }));

  r.post("/templates", staffAuth, wrap((req, res) => {
    res.status(201).json(waService.createTemplate(req.body || {}));
  }));

  // Token management (admin only)
  r.get("/tokens", adminAuth, wrap((_req, res) => {
    res.json(waService.listTokens());
  }));

  r.post("/tokens", adminAuth, wrap((req, res) => {
    const { description } = req.body || {};
    res.status(201).json(waService.createToken(description));
  }));

  r.post("/tokens/:id/revoke", adminAuth, wrap((req, res) => {
    res.json(waService.revokeToken(req.params.id));
  }));

  // ---------------- OpenWA REST Gateway Dual Sessions ----------------
  r.get("/gateway/config", staffAuth, wrap((_req, res) => {
    res.json(openWaService.getOpenWaConfig());
  }));

  r.post("/gateway/config", adminAuth, wrap((req, res) => {
    openWaService.saveOpenWaConfig(req.body || {});
    res.json({ ok: true, config: openWaService.getOpenWaConfig() });
  }));

  r.get("/gateway/session/:channel", staffAuth, wrap(async (req, res) => {
    const channel = req.params.channel || "sales";
    res.json(await openWaService.getSessionStatus(channel));
  }));

  r.post("/gateway/send-text", staffAuth, wrap(async (req, res) => {
    const { phone, message, channel } = req.body || {};
    if (!phone || !message) throw badRequest("phone and message are required.");
    res.json(await openWaService.sendTextMessage({ phone, message, channel: channel || "sales" }));
  }));

  r.post("/gateway/send-invoice-pdf", staffAuth, wrap(async (req, res) => {
    const { phone, invoiceId, invoiceHtml, filename, caption, channel } = req.body || {};
    if (!phone) throw badRequest("phone is required.");
    const { getInvoicePdf, htmlToPdfBuffer, attachPdf } = await import("../services/invoiceService.js");

    let pdfBuf = null;
    if (invoiceId) {
      pdfBuf = getInvoicePdf(invoiceId);
    }

    if (!pdfBuf && invoiceHtml) {
      pdfBuf = htmlToPdfBuffer(invoiceHtml);
      if (pdfBuf && invoiceId) {
        try { attachPdf(invoiceId, pdfBuf); } catch {}
      }
    }

    if (pdfBuf) {
      const result = await openWaService.sendDocumentMessage({
        phone,
        pdfBuffer: pdfBuf,
        filename: filename || (invoiceId ? `Invoice_${invoiceId.slice(0, 8)}.pdf` : "PhoneZone_Invoice.pdf"),
        caption: caption || "Thank you for your business with PhoneZone! Here is your official invoice.",
        channel: channel || "sales",
      });
      return res.json({ ok: true, type: "pdf", result });
    }

    // Fallback: If PDF could not be generated, send clean text invoice
    if (caption) {
      const textResult = await openWaService.sendTextMessage({
        phone,
        message: caption,
        channel: channel || "sales",
      });
      return res.json({ ok: true, type: "text_fallback", result: textResult });
    }

    throw badRequest("Could not generate invoice PDF buffer.");
  }));

  return r;
}

