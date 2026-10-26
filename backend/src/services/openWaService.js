/**
 * OpenWA REST Gateway Client for PhoneZone.
 *
 * Supports Dual Sessions:
 *   - "sales": for Sales invoices, purchase bills, and marketing.
 *   - "repairs": for Repair Job sheets, status updates, and repair invoices.
 * Or single unified session if the user toggles "Use same WhatsApp for both".
 */
import fs from "node:fs";
import path from "node:path";
import { getDb } from "../db/index.js";
import { logger } from "../lib/logger.js";

const DEFAULT_OPENWA_URL = process.env.OPENWA_SERVER_URL || "http://127.0.0.1:2785";

/**
 * Auto-detect OpenWA API key from known filesystem paths if not explicitly configured in DB
 */
function autoDetectOpenWaApiKey() {
  const candidatePaths = [
    process.env.OPENWA_API_KEY_PATH,
    "C:/Users/Kohinoor/Desktop/OpenWA/data/.api-key",
    path.resolve(process.cwd(), "../OpenWA/data/.api-key"),
    path.resolve(process.cwd(), "./OpenWA/data/.api-key"),
    path.resolve(process.env.USERPROFILE || "", "Desktop/OpenWA/data/.api-key"),
  ].filter(Boolean);

  for (const p of candidatePaths) {
    try {
      if (fs.existsSync(p)) {
        const key = fs.readFileSync(p, "utf8").trim();
        if (key && key.startsWith("owa_")) {
          return key;
        }
      }
    } catch {
      // Ignore read errors
    }
  }
  return "";
}

export function getOpenWaConfig() {
  const db = getDb();
  const row = db.prepare(
    "SELECT openwa_url, openwa_api_key, openwa_unified_mode FROM admin_settings WHERE id = '00000000-0000-0000-0000-000000000001'"
  ).get();

  let apiKey = row?.openwa_api_key || "";
  // If no valid key or placeholder key, auto-detect
  if (!apiKey || apiKey === "phonezone-master-key-2026") {
    const detected = autoDetectOpenWaApiKey();
    if (detected) {
      apiKey = detected;
      try {
        db.prepare(
          "UPDATE admin_settings SET openwa_api_key = ? WHERE id = '00000000-0000-0000-0000-000000000001'"
        ).run(apiKey);
      } catch {
        // ignore
      }
    }
  }

  return {
    serverUrl: row?.openwa_url || DEFAULT_OPENWA_URL,
    apiKey,
    unifiedMode: Boolean(row?.openwa_unified_mode ?? true), // Default to unified single session
  };
}

export function saveOpenWaConfig({ serverUrl, apiKey, unifiedMode }) {
  const db = getDb();
  db.prepare(
    `UPDATE admin_settings 
     SET openwa_url = COALESCE(?, openwa_url),
         openwa_api_key = COALESCE(?, openwa_api_key),
         openwa_unified_mode = COALESCE(?, openwa_unified_mode),
         updated_at = datetime('now')
     WHERE id = '00000000-0000-0000-0000-000000000001'`
  ).run(
    serverUrl !== undefined ? String(serverUrl).trim() : null,
    apiKey !== undefined ? String(apiKey).trim() : null,
    unifiedMode !== undefined ? (unifiedMode ? 1 : 0) : null
  );
}

/**
 * Format local Indian 10-digit number into standard WhatsApp JID (e.g. 919876543210@c.us)
 */
export function formatChatId(phone) {
  if (!phone) return null;
  const str = String(phone).trim();
  if (str.endsWith("@c.us") || str.endsWith("@g.us")) return str;

  const digits = str.replace(/\D/g, "");
  if (!digits) return null;
  const international = digits.length === 10 ? `91${digits}` : digits;
  return `${international}@c.us`;
}

/**
 * Request helper with API Key injection & fallback ports
 */
async function openWaFetch(endpoint, options = {}) {
  const { serverUrl, apiKey } = getOpenWaConfig();
  const baseUrls = [
    serverUrl.replace(/\/+$/, ""),
    "http://127.0.0.1:2785",
    "http://localhost:2785",
  ];
  // Remove duplicates
  const uniqueUrls = [...new Set(baseUrls)];

  let lastErr = null;
  for (const base of uniqueUrls) {
    const url = `${base}${endpoint}`;
    const headers = {
      "Content-Type": "application/json",
      ...(apiKey ? { "X-API-Key": apiKey } : {}),
      ...(options.headers || {}),
    };

    try {
      const res = await fetch(url, { ...options, headers });
      const isJson = res.headers.get("content-type")?.includes("application/json");
      const data = isJson ? await res.json() : await res.text();

      if (!res.ok) {
        const msg = typeof data === "object" ? data.message || data.error : data;
        throw new Error(`OpenWA Gateway error (${res.status}): ${msg}`);
      }

      return data;
    } catch (err) {
      lastErr = err;
      // If error is 4xx from OpenWA API, the server IS reachable; don't retry other urls
      if (err.message && err.message.includes("OpenWA Gateway error (4")) {
        throw err;
      }
    }
  }

  logger.warn(`[OpenWA] All request attempts failed to ${endpoint}`, { error: lastErr?.message });
  throw lastErr || new Error(`OpenWA Gateway connection failed to ${endpoint}`);
}

/**
 * Get or create session ID by purpose ("sales" or "repairs")
 */
export async function getSessionIdForChannel(channel = "sales") {
  const { unifiedMode } = getOpenWaConfig();
  const targetChannel = unifiedMode ? "sales" : channel;
  const preferredName = `phonezone-${targetChannel}`;

  try {
    const sessions = await openWaFetch("/api/sessions");
    const list = Array.isArray(sessions) ? sessions : (sessions.data || []);

    if (list.length > 0) {
      // 1. Exact match for phonezone-sales or phonezone-repairs
      let matched = list.find((s) => s.name === preferredName);

      // 2. Exact match for generic "phonezone" created by user
      if (!matched) {
        matched = list.find((s) => s.name === "phonezone");
      }

      // 3. Fallback to unified session or if only 1 session exists
      if (!matched && (unifiedMode || list.length === 1)) {
        matched = list.find((s) => s.status === "ready" || s.status === "authenticated") || list[0];
      }

      // 4. Any ready session
      if (!matched) {
        matched = list.find((s) => s.status === "ready" || s.status === "authenticated");
      }

      if (matched) return matched.id;
    }

    // Create session if list is empty or no match
    const created = await openWaFetch("/api/sessions", {
      method: "POST",
      body: JSON.stringify({ name: preferredName }),
    });
    return created.id || created.sessionId;
  } catch (err) {
    logger.error(`[OpenWA] Failed to get session for channel ${targetChannel}`, err);
    throw err;
  }
}

/**
 * Get current session status & QR code for linking
 */
export async function getSessionStatus(channel = "sales") {
  try {
    const sessionId = await getSessionIdForChannel(channel);
    
    // Check session info first
    let sessionData = null;
    try {
      sessionData = await openWaFetch(`/api/sessions/${sessionId}`);
    } catch {
      // fallback
    }

    const isReady = sessionData?.status === "ready" || sessionData?.status === "authenticated";
    if (isReady) {
      return {
        channel,
        sessionId,
        connected: true,
        status: sessionData.status,
        phone: sessionData.phone || null,
        pushName: sessionData.pushName || null,
        qrCode: null,
      };
    }

    // If not ready, start session if stopped
    try {
      await openWaFetch(`/api/sessions/${sessionId}/start`, { method: "POST" });
    } catch {
      // already running or error
    }

    // Try to get QR code
    let qrCode = null;
    let currentStatus = sessionData?.status || "disconnected";
    try {
      const qrData = await openWaFetch(`/api/sessions/${sessionId}/qr`);
      currentStatus = qrData.status || currentStatus;
      qrCode = qrData.qrCode || qrData.qr || null;
      if (qrData.status === "ready" || qrData.status === "authenticated") {
        return {
          channel,
          sessionId,
          connected: true,
          status: qrData.status,
          phone: sessionData?.phone || null,
          pushName: sessionData?.pushName || null,
          qrCode: null,
        };
      }
    } catch (qrErr) {
      // If QR says already authenticated:
      if (qrErr.message && qrErr.message.includes("already authenticated")) {
        return {
          channel,
          sessionId,
          connected: true,
          status: "ready",
          phone: sessionData?.phone || null,
          pushName: sessionData?.pushName || null,
          qrCode: null,
        };
      }
    }

    return {
      channel,
      sessionId,
      connected: false,
      status: currentStatus,
      qrCode,
    };
  } catch (err) {
    return {
      channel,
      sessionId: null,
      connected: false,
      status: "disconnected",
      error: err.message,
    };
  }
}

/**
 * Send WhatsApp text message to customer
 */
export async function sendTextMessage({ phone, message, channel = "sales" }) {
  const chatId = formatChatId(phone);
  if (!chatId) throw new Error("Invalid recipient phone number");

  const sessionId = await getSessionIdForChannel(channel);
  return await openWaFetch(`/api/sessions/${sessionId}/messages/send-text`, {
    method: "POST",
    body: JSON.stringify({
      chatId,
      text: message,
    }),
  });
}

/**
 * Send WhatsApp PDF invoice or document with optional caption
 */
export async function sendDocumentMessage({ phone, pdfBuffer, filename, caption = "", channel = "sales" }) {
  const chatId = formatChatId(phone);
  if (!chatId) throw new Error("Invalid recipient phone number");

  const sessionId = await getSessionIdForChannel(channel);
  let base64Data = Buffer.isBuffer(pdfBuffer)
    ? pdfBuffer.toString("base64")
    : String(pdfBuffer);

  // Strip data URI prefix if present
  if (base64Data.includes("base64,")) {
    base64Data = base64Data.split("base64,")[1];
  }

  return await openWaFetch(`/api/sessions/${sessionId}/messages/send-document`, {
    method: "POST",
    body: JSON.stringify({
      chatId,
      base64: base64Data,
      mimetype: "application/pdf",
      filename: filename || "PhoneZone_Invoice.pdf",
      caption: caption || "",
    }),
  });
}
