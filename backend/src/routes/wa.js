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
import * as evolutionWa from "../services/evolutionWaService.js";
import * as baileysService from "../services/baileysService.js";
import { getRawSettings } from "../services/settingsService.js";

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

  // ---------------- Native Baileys WhatsApp Engine (Render/Cloud/Zero-Config) ----------------
  r.get("/baileys/status", staffAuth, wrap(async (_req, res) => {
    let status = baileysService.getStatus();
    if (status.state === "disconnected") {
      baileysService.initBaileys().catch(() => {});
      status = baileysService.getStatus();
    }
    res.json(status);
  }));

  r.post("/baileys/init", staffAuth, wrap(async (_req, res) => {
    await baileysService.initBaileys(true);
    res.json(baileysService.getStatus());
  }));

  r.post("/baileys/pairing-code", staffAuth, wrap(async (req, res) => {
    const { phone } = req.body || {};
    if (!phone) throw badRequest("phone is required.");
    res.json(await baileysService.requestPairingCode(phone));
  }));

  r.post("/baileys/logout", staffAuth, wrap(async (_req, res) => {
    res.json(await baileysService.logout());
  }));

  r.post("/baileys/send-text", staffAuth, wrap(async (req, res) => {
    const { phone, message } = req.body || {};
    if (!phone || !message) throw badRequest("phone and message are required.");
    res.json(await baileysService.sendTextMessage({ phone, message }));
  }));

  r.post("/baileys/send-pdf", staffAuth, wrap(async (req, res) => {
    const { phone, pdfBase64, filename, caption } = req.body || {};
    if (!phone || !pdfBase64) throw badRequest("phone and pdfBase64 are required.");
    res.json(await baileysService.sendDocumentMessage({ phone, pdfBuffer: pdfBase64, filename, caption }));
  }));

  // ---------------- Native WhatsApp Engine (Baileys) Unified Gateway ----------------
  r.get("/gateway/server-status", staffAuth, wrap(async (_req, res) => {
    let bStatus = baileysService.getStatus();
    if (bStatus.state === "disconnected") {
      baileysService.initBaileys().catch(() => {});
      bStatus = baileysService.getStatus();
    }
    res.json({
      running: bStatus.connected || bStatus.state === "qr_ready" || bStatus.state === "connecting",
      connected: bStatus.connected,
      managed: true,
      engine: "baileys",
      state: bStatus.state,
      phone: bStatus.phone,
      name: bStatus.name,
    });
  }));

  r.post("/gateway/start-server", staffAuth, wrap(async (_req, res) => {
    await baileysService.initBaileys(true);
    res.json({ ok: true, message: "WhatsApp engine initialized with Baileys.", status: baileysService.getStatus() });
  }));

  r.post("/gateway/stop-server", staffAuth, wrap(async (_req, res) => {
    res.json(await baileysService.logout());
  }));

  r.post("/gateway/pairing-code", staffAuth, wrap(async (req, res) => {
    const { phone } = req.body || {};
    if (!phone) throw badRequest("phone is required.");
    const result = await baileysService.requestPairingCode(phone);
    res.json({ ok: true, pairingCode: result.code, code: result.code, status: "code_ready" });
  }));

  r.get("/gateway/config", staffAuth, wrap((_req, res) => {
    res.json({ ok: true, engine: "baileys", autoStart: true, unifiedMode: true });
  }));

  r.post("/gateway/config", adminAuth, wrap((req, res) => {
    res.json({ ok: true, engine: "baileys", config: { engine: "baileys", autoStart: true } });
  }));

  r.get("/gateway/sessions", staffAuth, wrap(async (_req, res) => {
    const bStatus = baileysService.getStatus();
    res.json({
      sessions: [
        {
          id: "baileys",
          name: "phonezone-primary",
          status: bStatus.connected ? "ready" : bStatus.state,
          phone: bStatus.phone,
          pushName: bStatus.name,
          engine: "baileys",
        },
      ],
      engine: "baileys",
    });
  }));

  r.get("/gateway/session/:channel", staffAuth, wrap(async (req, res) => {
    const channel = req.params.channel || "sales";
    const bStatus = baileysService.getStatus();
    res.json({
      channel,
      sessionId: "baileys",
      connected: bStatus.connected,
      status: bStatus.connected ? "ready" : bStatus.state,
      phone: bStatus.phone,
      pushName: bStatus.name,
      qrCode: bStatus.qr,
    });
  }));

  r.post("/gateway/send-text", staffAuth, wrap(async (req, res) => {
    const { phone, message } = req.body || {};
    if (!phone || !message) throw badRequest("phone and message are required.");
    res.json(await baileysService.sendTextMessage({ phone, message }));
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

    // 1. Native Baileys WhatsApp Engine (Highest Priority if connected)
    if (baileysService.isConnected()) {
      if (textToSend) {
        try {
          textResult = await baileysService.sendTextMessage({ phone, message: textToSend });
        } catch (_err) {}
      }
      if (pdfBuf) {
        try {
          pdfResult = await baileysService.sendDocumentMessage({
            phone,
            pdfBuffer: pdfBuf,
            filename: filename || (invoiceId ? `Invoice_${invoiceId.slice(0, 8)}.pdf` : "PhoneZone_Invoice.pdf"),
            caption: "",
          });
        } catch (_err) {}
      }
    } else {
      const currentChannel = getRawSettings()?.whatsapp_channel || "click_to_chat";
      const useEvolution = channel === "evolution_api" || currentChannel === "evolution_api";

      if (useEvolution) {
        if (textToSend) {
          try {
            textResult = await evolutionWa.sendEvolutionText({ phone, message: textToSend });
          } catch (_err) {}
        }
        if (pdfBuf) {
          try {
            pdfResult = await evolutionWa.sendEvolutionMedia({
              phone,
              mediaBase64: pdfBuf.toString("base64"),
              filename: filename || (invoiceId ? `Invoice_${invoiceId.slice(0, 8)}.pdf` : "PhoneZone_Invoice.pdf"),
              caption: "",
            });
          } catch (_err) {}
        }
      } else {
        // Fallback to attempting direct Baileys send (in case auto-reconnect needed)
        if (textToSend) {
          try {
            textResult = await baileysService.sendTextMessage({ phone, message: textToSend });
          } catch (err) {}
        }

        if (pdfBuf) {
          try {
            pdfResult = await baileysService.sendDocumentMessage({
              phone,
              pdfBuffer: pdfBuf,
              filename: filename || (invoiceId ? `Invoice_${invoiceId.slice(0, 8)}.pdf` : "PhoneZone_Invoice.pdf"),
              caption: "",
            });
          } catch (err) {}
        }
      }
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
        textResult = await baileysService.sendTextMessage({
          phone,
          message: textToSend,
        });
      } catch (err) {
        // Continue
      }
    }

    if (pdfBase64) {
      const cleanB64 = String(pdfBase64).replace(/^data:application\/pdf;base64,/, "");
      const pdfBuf = Buffer.from(cleanB64, "base64");
      try {
        pdfResult = await baileysService.sendDocumentMessage({
          phone,
          pdfBuffer: pdfBuf,
          filename: filename || "PhoneZone_Document.pdf",
          caption: "",
        });
      } catch (err) {}
    }

    return res.json({
      ok: true,
      textSent: !!textResult,
      pdfSent: !!pdfResult,
      textResult,
      pdfResult,
    });
  }));

  // ---------------- Evolution API endpoints ----------------
  r.get("/evolution/status", staffAuth, wrap(async (_req, res) => {
    res.json(await evolutionWa.checkEvolutionStatus());
  }));

  r.post("/evolution/test", staffAuth, wrap(async (req, res) => {
    const { phone, message } = req.body || {};
    if (!phone) throw badRequest("Recipient phone number is required.");
    const result = await evolutionWa.sendEvolutionText({
      phone,
      message: message || "Hello from PhoneZone! Your Evolution API / WPPConnect WhatsApp gateway is connected and active.",
    });
    res.json(result);
  }));

  return r;
}

