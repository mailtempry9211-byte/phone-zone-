/**
 * Evolution API / WPPConnect Integration Service
 * Lightweight, 100% Free & Open-Source Cloud WhatsApp Gateway.
 * Does not require Puppeteer or Chromium on the local device/phone.
 */
import { getRawSettings } from "./settingsService.js";
import { logger } from "../lib/logger.js";

function getEvolutionConfig() {
  const row = getRawSettings() || {};
  return {
    apiUrl: (row.evolution_api_url || "").replace(/\/+$/, "").trim(),
    apiKey: (row.evolution_api_key || "").trim(),
    instanceName: (row.evolution_instance_name || "phonezone").trim(),
  };
}

export function formatWhatsAppPhone(phone) {
  const clean = String(phone || "").replace(/\D/g, "");
  if (!clean) return "";
  if (clean.length === 10) return "91" + clean;
  if (clean.startsWith("0")) return "91" + clean.substring(1);
  return clean;
}

export async function checkEvolutionStatus() {
  const { apiUrl, apiKey, instanceName } = getEvolutionConfig();
  if (!apiUrl || !apiKey) {
    return { configured: false, connected: false, message: "Evolution API not configured" };
  }

  try {
    const res = await fetch(`${apiUrl}/instance/connectionState/${encodeURIComponent(instanceName)}`, {
      method: "GET",
      headers: {
        "apikey": apiKey,
      },
    });

    if (!res.ok) {
      return { configured: true, connected: false, status: res.status, message: `Server returned HTTP ${res.status}` };
    }

    const data = await res.json().catch(() => ({}));
    const state = data?.instance?.state || data?.state || "unknown";
    return {
      configured: true,
      connected: state === "open" || state === "connected",
      state,
      raw: data,
    };
  } catch (err) {
    logger.warn("[EvolutionAPI] Status check failed", err);
    return { configured: true, connected: false, message: err.message || "Network error reaching Evolution API" };
  }
}

export async function sendEvolutionText({ phone, message }) {
  const { apiUrl, apiKey, instanceName } = getEvolutionConfig();
  if (!apiUrl || !apiKey) {
    throw new Error("Evolution API Server URL and API Key are required in Settings");
  }

  const cleanPhone = formatWhatsAppPhone(phone);
  if (!cleanPhone) throw new Error("Invalid recipient phone number");

  const res = await fetch(`${apiUrl}/message/sendText/${encodeURIComponent(instanceName)}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "apikey": apiKey,
    },
    body: JSON.stringify({
      number: cleanPhone,
      text: message,
    }),
  });

  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(body?.response?.message?.[0] || body?.message || `Evolution API error (${res.status})`);
  }

  return { ok: true, data: body };
}

export async function sendEvolutionMedia({ phone, mediaBase64, filename = "document.pdf", caption = "" }) {
  const { apiUrl, apiKey, instanceName } = getEvolutionConfig();
  if (!apiUrl || !apiKey) {
    throw new Error("Evolution API Server URL and API Key are required in Settings");
  }

  const cleanPhone = formatWhatsAppPhone(phone);
  if (!cleanPhone) throw new Error("Invalid recipient phone number");

  let base64 = String(mediaBase64 || "");
  if (base64.includes("base64,")) {
    base64 = base64.split("base64,")[1];
  }

  const res = await fetch(`${apiUrl}/message/sendMedia/${encodeURIComponent(instanceName)}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "apikey": apiKey,
    },
    body: JSON.stringify({
      number: cleanPhone,
      media: base64,
      mediatype: "document",
      mimetype: "application/pdf",
      fileName: filename,
      caption: caption || "",
    }),
  });

  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(body?.response?.message?.[0] || body?.message || `Evolution API error (${res.status})`);
  }

  return { ok: true, data: body };
}
