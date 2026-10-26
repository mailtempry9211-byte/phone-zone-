/**
 * Native Embedded Ngrok Tunnel Service for PhoneZone Portable EXE.
 * Allows store owner to put their shop online via auth token & claimed domain.
 */
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import ngrok from "@ngrok/ngrok";
import { getDb } from "../db/index.js";
import { SERVER } from "../config/business.js";
import { audit } from "./auditService.js";

let activeListener = null;
let currentUrl = null;
let lastError = null;

function getSystemNgrokDefaults() {
  const possiblePaths = [
    process.env.LOCALAPPDATA && path.join(process.env.LOCALAPPDATA, "ngrok", "ngrok.yml"),
    path.join(os.homedir(), ".config", "ngrok", "ngrok.yml"),
    path.join(os.homedir(), ".ngrok2", "ngrok.yml"),
  ].filter(Boolean);

  for (const p of possiblePaths) {
    if (fs.existsSync(p)) {
      try {
        const content = fs.readFileSync(p, "utf8");
        const tokenMatch = content.match(/authtoken:\s*([^\s\r\n]+)/);
        const urlMatch = content.match(/url:\s*(https?:\/\/[^\s\r\n]+|[^\s\r\n]+ngrok[^\s\r\n]+)/);
        return {
          authtoken: tokenMatch ? tokenMatch[1].trim() : "",
          claimedDomain: urlMatch ? urlMatch[1].trim() : "",
        };
      } catch (_e) {}
    }
  }
  return { authtoken: "", claimedDomain: "" };
}

export function cleanToken(raw) {
  if (!raw) return "";
  let t = String(raw).trim();
  t = t.replace(/^(?:ngrok\s+config\s+add-authtoken|authtoken:)\s*/i, "");
  t = t.replace(/^["']|["']$/g, "").trim();
  return t;
}

export function cleanDomain(raw) {
  if (!raw) return "";
  let d = String(raw).trim();
  d = d.replace(/^https?:\/\//i, "");
  d = d.replace(/\/+$/, "").trim();
  return d;
}

export function getNgrokConfig() {
  const db = getDb();
  const row = db.prepare("SELECT * FROM ngrok_config WHERE id = 'default'").get();
  const sys = getSystemNgrokDefaults();
  const authtoken = cleanToken(row?.authtoken || sys.authtoken || "");
  const claimedDomain = cleanDomain(row?.claimed_domain || sys.claimedDomain || "");

  return {
    authtoken,
    claimedDomain,
    isEnabled: !!row?.is_enabled,
    lastUrl: currentUrl || row?.last_url || null,
    running: !!activeListener && !!currentUrl,
    error: lastError,
  };
}

export async function startNgrokTunnel({ authtoken, claimedDomain, userId } = {}) {
  const db = getDb();
  const existing = getNgrokConfig();
  const token = cleanToken(authtoken !== undefined ? authtoken : existing.authtoken);
  const domain = cleanDomain(claimedDomain !== undefined ? claimedDomain : existing.claimedDomain);

  if (!token) {
    throw new Error("Ngrok Auth Token is required to start tunnel. Get it free from dashboard.ngrok.com");
  }

  // If already running, disconnect first
  if (activeListener) {
    try {
      await stopNgrokTunnel();
    } catch (_e) {}
  }

  try {
    lastError = null;
    const port = SERVER.port || 47713;
    const forwardOpts = {
      addr: port,
      authtoken: token,
    };

    if (domain) {
      forwardOpts.domain = domain;
    }

    activeListener = await ngrok.forward(forwardOpts);
    currentUrl = activeListener.url();

    // Persist configuration
    db.prepare(
      `UPDATE ngrok_config
       SET authtoken = ?, claimed_domain = ?, is_enabled = 1, last_url = ?, updated_at = datetime('now')
       WHERE id = 'default'`
    ).run(token, domain, currentUrl);

    if (userId) {
      audit(userId, "ngrok.started", "tunnel", "default", { url: currentUrl, domain });
    }

    return {
      ok: true,
      url: currentUrl,
      domain: domain || null,
      running: true,
    };
  } catch (err) {
    lastError = err.message || String(err);
    currentUrl = null;
    activeListener = null;
    db.prepare("UPDATE ngrok_config SET is_enabled = 0 WHERE id = 'default'").run();
    throw err;
  }
}

export async function stopNgrokTunnel(userId) {
  const db = getDb();
  if (activeListener) {
    try {
      await activeListener.close();
    } catch (_e) {}
    activeListener = null;
  }
  currentUrl = null;
  lastError = null;

  db.prepare("UPDATE ngrok_config SET is_enabled = 0 WHERE id = 'default'").run();

  if (userId) {
    audit(userId, "ngrok.stopped", "tunnel", "default");
  }

  return { ok: true, running: false };
}

export async function saveNgrokSettings({ authtoken, claimedDomain }) {
  const db = getDb();
  const token = cleanToken(authtoken);
  const domain = cleanDomain(claimedDomain);
  db.prepare(
    `UPDATE ngrok_config
     SET authtoken = ?, claimed_domain = ?, updated_at = datetime('now')
     WHERE id = 'default'`
  ).run(token, domain);
  return getNgrokConfig();
}

