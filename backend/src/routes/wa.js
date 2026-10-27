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
  r.get("/contacts", staffAuth, wrap((req, res) => {
    res.json(waService.listAllContacts({ search: req.query.search }));
  }));

  r.get("/queue/status", staffAuth, wrap((_req, res) => {
    res.json(waService.getQueueStatus());
  }));

  r.get("/campaigns", staffAuth, wrap((_req, res) => {
    res.json(waService.listCampaigns());
  }));

  r.get("/campaigns/:id/logs", staffAuth, wrap((req, res) => {
    res.json(waService.getCampaignLogs(req.params.id));
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
  r.get("/gateway/server-status", staffAuth, wrap(async (_req, res) => {
    res.json(await openWaService.getServerStatus());
  }));

  r.post("/gateway/start-server", staffAuth, wrap(async (_req, res) => {
    res.json(await openWaService.startOpenWaServer());
  }));

  r.post("/gateway/stop-server", staffAuth, wrap(async (_req, res) => {
    res.json(await openWaService.stopOpenWaServer());
  }));

  r.post("/gateway/pairing-code", staffAuth, wrap(async (req, res) => {
    const { channel, phone } = req.body || {};
    if (!phone) throw badRequest("phone is required.");
    res.json(await openWaService.requestPairingCode({ channel: channel || "sales", phone }));
  }));

  r.get("/gateway/config", staffAuth, wrap((_req, res) => {
    res.json(openWaService.getOpenWaConfig());
  }));

  r.post("/gateway/config", adminAuth, wrap((req, res) => {
    openWaService.saveOpenWaConfig(req.body || {});
    res.json({ ok: true, config: openWaService.getOpenWaConfig() });
  }));

  // Full Session Management API
  r.get("/gateway/sessions", staffAuth, wrap(async (_req, res) => {
    res.json(await openWaService.listAllSessions());
  }));

  r.post("/gateway/sessions", staffAuth, wrap(async (req, res) => {
    const { name } = req.body || {};
    if (!name) throw badRequest("name is required.");
    res.status(201).json(await openWaService.createSession(name));
  }));

  r.post("/gateway/sessions/:id/start", staffAuth, wrap(async (req, res) => {
    res.json(await openWaService.startSession(req.params.id));
  }));

  r.post("/gateway/sessions/:id/stop", staffAuth, wrap(async (req, res) => {
    res.json(await openWaService.stopSession(req.params.id));
  }));

  r.post("/gateway/sessions/:id/logout", staffAuth, wrap(async (req, res) => {
    res.json(await openWaService.logoutSession(req.params.id));
  }));

  r.delete("/gateway/sessions/:id", staffAuth, wrap(async (req, res) => {
    res.json(await openWaService.deleteSession(req.params.id));
  }));

  r.get("/gateway/sessions/:id/qr", staffAuth, wrap(async (req, res) => {
    res.json(await openWaService.getSessionQr(req.params.id));
  }));

  r.post("/gateway/sessions/:id/pairing-code", staffAuth, wrap(async (req, res) => {
    const { phone } = req.body || {};
    if (!phone) throw badRequest("phone is required.");
    res.json(await openWaService.requestPairingCodeForSession(req.params.id, phone));
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
    const { phone, invoiceId, invoiceHtml, pdfBase64, filename, caption, message, channel } = req.body || {};
    if (!phone) throw badRequest("phone is required.");
    const { getInvoicePdf, htmlToPdfBuffer, attachPdf } = await import("../services/invoiceService.js");

    let pdfBuf = null;
    if (pdfBase64) {
      const cleanB64 = String(pdfBase64).replace(/^data:application\/pdf;base64,/, "");
      pdfBuf = Buffer.from(cleanB64, "base64");
    } else if (invoiceId) {
      pdfBuf = getInvoicePdf(invoiceId);
    }

    if (!pdfBuf && invoiceHtml) {
      pdfBuf = htmlToPdfBuffer(invoiceHtml);
      if (pdfBuf && invoiceId) {
        try { attachPdf(invoiceId, pdfBuf); } catch {}
      }
    }

    const textToSend = message || caption || "";
    let textResult = null;
    let pdfResult = null;

    // 1. Send text receipt / invoice summary first
    if (textToSend) {
      try {
        textResult = await openWaService.sendTextMessage({
          phone,
          message: textToSend,
          channel: channel || "sales",
        });
      } catch (err) {
        // If text sending had an issue, continue to attempt PDF
      }
    }

    // 2. Send PDF document
    if (pdfBuf) {
      pdfResult = await openWaService.sendDocumentMessage({
        phone,
        pdfBuffer: pdfBuf,
        filename: filename || (invoiceId ? `Invoice_${invoiceId.slice(0, 8)}.pdf` : "PhoneZone_Invoice.pdf"),
        caption: "", // text already sent cleanly above
        channel: channel || "sales",
      });
    }

    if (textResult || pdfResult) {
      return res.json({
        ok: true,
        textSent: !!textResult,
        pdfSent: !!pdfResult,
        type: pdfResult && textResult ? "text_and_pdf" : pdfResult ? "pdf" : "text",
        textResult,
        pdfResult,
      });
    }

    throw badRequest("Could not dispatch message or generate invoice PDF buffer.");
  }));

  r.post("/gateway/send", staffAuth, wrap(async (req, res) => {
    // Alias route that accepts { phone, message, pdfBase64, filename, channel }
    const { phone, message, caption, pdfBase64, filename, channel } = req.body || {};
    if (!phone) throw badRequest("phone is required.");

    const textToSend = message || caption || "";
    let textResult = null;
    let pdfResult = null;

    if (textToSend) {
      try {
        textResult = await openWaService.sendTextMessage({
          phone,
          message: textToSend,
          channel: channel || "sales",
        });
      } catch (err) {
        // Continue
      }
    }

    if (pdfBase64) {
      const cleanB64 = String(pdfBase64).replace(/^data:application\/pdf;base64,/, "");
      const pdfBuf = Buffer.from(cleanB64, "base64");
      pdfResult = await openWaService.sendDocumentMessage({
        phone,
        pdfBuffer: pdfBuf,
        filename: filename || "PhoneZone_Document.pdf",
        caption: "",
        channel: channel || "sales",
      });
    }

    return res.json({
      ok: true,
      textSent: !!textResult,
      pdfSent: !!pdfResult,
      textResult,
      pdfResult,
    });
  }));

  return r;
}

