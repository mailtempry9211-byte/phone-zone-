/**
 * PhoneZone Native WhatsApp Engine (powered by @whiskeysockets/baileys)
 *
 * Lightweight, 100% In-Process WhatsApp Web API.
 * - Zero external Chrome/Chromium required (takes only ~25-35MB RAM).
 * - Runs seamlessly on Render Cloud, Linux VPS, Termux, and Windows PC.
 * - Persists session credentials to disk (no re-scanning on restart).
 * - Full support for Text, PDF Invoices, Sapath Patra, and Pairing Codes.
 */
import fs from "node:fs";
import path from "node:path";
import makeWASocket, {
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion,
} from "@whiskeysockets/baileys";
import pino from "pino";
import qrcode from "qrcode";
import { PATHS } from "../config/paths.js";
import { logger } from "../lib/logger.js";
import { badRequest } from "../lib/errors.js";

let sock = null;
let currentQr = null;
let connectionState = "disconnected"; // "disconnected" | "connecting" | "qr_ready" | "connected"
let connectedUser = null;
let reconnectTimer = null;
let isInitializing = false;

function getAuthDir() {
  const dir = path.join(PATHS.dataDir, "baileys_auth");
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

export function formatJid(phone) {
  let clean = String(phone || "").replace(/\D/g, "");
  if (!clean) return null;
  if (clean.length === 10) clean = "91" + clean;
  if (clean.startsWith("0")) clean = "91" + clean.slice(1);
  return `${clean}@s.whatsapp.net`;
}

export function isConnected() {
  return connectionState === "connected" && !!sock;
}

export function getStatus() {
  return {
    connected: isConnected(),
    state: connectionState,
    qr: currentQr,
    user: connectedUser
      ? {
          id: connectedUser.id?.split(":")[0] || connectedUser.id,
          name: connectedUser.name || connectedUser.notify || "PhoneZone WhatsApp",
        }
      : null,
  };
}

export async function initBaileys(force = false) {
  if (isInitializing) return;
  if (sock && !force && isConnected()) return;

  isInitializing = true;
  connectionState = "connecting";

  try {
    const authDir = getAuthDir();
    const { state, saveCreds } = await useMultiFileAuthState(authDir);

    let version = [2, 3000, 1015901307];
    try {
      const v = await fetchLatestBaileysVersion().catch(() => null);
      if (v?.version) version = v.version;
    } catch {}

    sock = makeWASocket({
      version,
      auth: state,
      printQRInTerminal: false,
      logger: pino({ level: "silent" }),
      browser: ["PhoneZone ERP", "Chrome", "20.0.0"],
      connectTimeoutMs: 60000,
      defaultQueryTimeoutMs: 60000,
      keepAliveIntervalMs: 15000,
      emitOwnEvents: false,
    });

    sock.ev.on("creds.update", saveCreds);

    sock.ev.on("connection.update", async (update) => {
      const { connection, lastDisconnect, qr } = update;

      if (qr) {
        try {
          currentQr = await qrcode.toDataURL(qr);
          connectionState = "qr_ready";
          logger.info("[Baileys] QR code ready for scanning");
        } catch (e) {
          logger.warn("[Baileys] Failed to convert QR to DataURL", e);
        }
      }

      if (connection === "open") {
        connectionState = "connected";
        currentQr = null;
        connectedUser = sock.user;
        logger.info("[Baileys] WhatsApp connected successfully!", { user: sock.user?.id });
      }

      if (connection === "close") {
        const statusCode = lastDisconnect?.error?.output?.statusCode;
        const reason = lastDisconnect?.error?.message || "connection closed";
        logger.warn("[Baileys] Connection closed", { statusCode, reason });

        const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
        connectionState = "disconnected";
        currentQr = null;
        connectedUser = null;

        if (shouldReconnect) {
          clearTimeout(reconnectTimer);
          reconnectTimer = setTimeout(() => {
            initBaileys(true).catch(() => {});
          }, 3000);
        } else {
          // Logged out: wipe credentials
          try {
            fs.rmSync(authDir, { recursive: true, force: true });
          } catch {}
          clearTimeout(reconnectTimer);
          reconnectTimer = setTimeout(() => {
            initBaileys(true).catch(() => {});
          }, 2000);
        }
      }
    });
  } catch (err) {
    logger.error("[Baileys] Init error", err);
    connectionState = "disconnected";
  } finally {
    isInitializing = false;
  }
}

/**
 * Request an 8-character pairing code instead of scanning QR
 */
export async function requestPairingCode(phone) {
  if (!sock) {
    await initBaileys(true);
  }
  let clean = String(phone || "").replace(/\D/g, "");
  if (!clean) throw badRequest("Valid phone number required for pairing code.");
  if (clean.length === 10) clean = "91" + clean;
  if (clean.startsWith("0")) clean = "91" + clean.slice(1);

  try {
    const code = await sock.requestPairingCode(clean);
    return { ok: true, code, phone: clean };
  } catch (err) {
    throw badRequest(`Failed to request pairing code: ${err.message || err}`);
  }
}

/**
 * Send text message via Baileys
 */
export async function sendTextMessage({ phone, message }) {
  if (!isConnected()) {
    throw badRequest("WhatsApp is not connected. Scan the QR code in WhatsApp Marketing to connect.");
  }
  const jid = formatJid(phone);
  if (!jid) throw badRequest("Invalid phone number.");

  try {
    const res = await sock.sendMessage(jid, { text: String(message) });
    return { ok: true, messageId: res?.key?.id, jid };
  } catch (err) {
    logger.error("[Baileys] sendTextMessage error", err);
    throw badRequest(`WhatsApp delivery failed: ${err.message}`);
  }
}

/**
 * Send PDF invoice or document with optional caption
 */
export async function sendDocumentMessage({ phone, pdfBuffer, filename, caption = "" }) {
  if (!isConnected()) {
    throw badRequest("WhatsApp is not connected. Scan the QR code in WhatsApp Marketing to connect.");
  }
  const jid = formatJid(phone);
  if (!jid) throw badRequest("Invalid phone number.");

  let buffer = pdfBuffer;
  if (typeof pdfBuffer === "string") {
    const cleanB64 = pdfBuffer.replace(/^data:application\/pdf;base64,/, "");
    buffer = Buffer.from(cleanB64, "base64");
  }

  if (!Buffer.isBuffer(buffer)) {
    throw badRequest("Invalid PDF document buffer.");
  }

  try {
    const res = await sock.sendMessage(jid, {
      document: buffer,
      mimetype: "application/pdf",
      fileName: filename || "PhoneZone_Invoice.pdf",
      caption: caption || "",
    });
    return { ok: true, messageId: res?.key?.id, jid };
  } catch (err) {
    logger.error("[Baileys] sendDocumentMessage error", err);
    throw badRequest(`WhatsApp document delivery failed: ${err.message}`);
  }
}

/**
 * Logout and clear session
 */
export async function logout() {
  if (sock) {
    try {
      await sock.logout();
    } catch {}
  }
  try {
    const authDir = getAuthDir();
    fs.rmSync(authDir, { recursive: true, force: true });
  } catch {}
  connectionState = "disconnected";
  currentQr = null;
  connectedUser = null;
  // Reinitialize so a fresh QR is ready immediately
  setTimeout(() => {
    initBaileys(true).catch(() => {});
  }, 1000);
  return { ok: true, message: "Logged out from WhatsApp. New QR code is ready." };
}
