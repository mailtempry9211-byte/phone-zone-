/**
 * Hicelltek TAC lookup adapter - Step 2 (rotation = Step 6).
 *
 * The local tac_codes database is ALWAYS checked first; this service is the
 * optional fallback. Free plan = 100 lookups/month per key, so:
 *   - unknown TACs are remembered in tac_api_misses (30 days),
 *   - keys rotate on quota/invalid-key, never on network errors,
 *   - keys and response bodies are never logged.
 *
 * NOTE: the real response JSON has not been captured yet (see guide Section 2A),
 * so mapResponse() accepts the common shapes and is covered by fixture tests.
 */
import { randomUUID } from "node:crypto";
import { getDb } from "../db/index.js";
import { normalizeBrand, parseSpecs } from "./tacService.js";
import { badRequest, notFound } from "../lib/errors.js";
import { logger } from "../lib/logger.js";

export const BASE_URL = "https://imei.hicelltek.com/api/v1/tac/lookup";
export const API_KEY_HEADER = "X-Api-Key";
export const FETCH_TIMEOUT_MS = 10_000;
export const MISS_TTL_DAYS = 30;

/** First moment of the next calendar month in UTC (quota reset assumption). */
export function nextQuotaResetUTC(from = new Date()) {
  return new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth() + 1, 1)).toISOString();
}

export const currentUsageMonth = (d = new Date()) =>
  `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;

const maskKey = (key) => {
  const s = String(key || "");
  if (s.length <= 8) return "****";
  return `${s.slice(0, 4)}...${s.slice(-4)}`;
};

function bumpUsage(row) {
  const db = getDb();
  const month = currentUsageMonth();
  if (row.usage_month !== month) {
    db.prepare("UPDATE hicelltek_keys SET calls_this_month = 1, usage_month = ? WHERE id = ?").run(month, row.id);
  } else {
    db.prepare("UPDATE hicelltek_keys SET calls_this_month = calls_this_month + 1 WHERE id = ?").run(row.id);
  }
}

/** Usable keys in order: enabled, not exhausted, under this month's limit. */
export function usableKeys(nowIso = new Date().toISOString()) {
  const month = currentUsageMonth();
  return getDb()
    .prepare(
      `SELECT * FROM hicelltek_keys
       WHERE is_enabled = 1
         AND (exhausted_until IS NULL OR exhausted_until <= ?)
       ORDER BY position ASC, created_at ASC`
    )
    .all(nowIso)
    .filter((k) => k.usage_month !== month || k.calls_this_month < k.monthly_limit);
}

/**
 * Turn a (still unknown) response JSON into cleaning-ready fields.
 * Returns { brand, phoneName, model, specs } or null when nothing usable.
 */
export function mapResponse(json) {
  if (json === null || typeof json !== "object") return null;
  const root =
    (json.data && typeof json.data === "object" ? json.data : null) ||
    (json.result && typeof json.result === "object" ? json.result : null) ||
    (json.tac && typeof json.tac === "object" ? json.tac : null) ||
    json;

  const brand = root.brand || root.make || root.manufacturer || root.vendor || json.brand;
  const phoneName =
    root.phone_name || root.phoneName || root.marketing_name || root.device || root.name;
  const model = root.model || root.model_code || root.modelCode || root.model_number;
  const combined =
    root.specs || root.specification || root.specifications || root.description || root.details;

  if (brand && combined && !phoneName) {
    const parsed = parseSpecs(brand, combined);
    return { brand: parsed.brand, phoneName: parsed.phoneName, model: parsed.model, specs: parsed.extra || null };
  }

  const outBrand = brand ? normalizeBrand(brand) : "";
  const outName = phoneName ? String(phoneName).trim() : "";
  const outModel = model ? String(model).trim() : "";
  if (!outBrand && !outName) return null;
  return {
    brand: outBrand || (outName.split(/\s+/)[0] ? normalizeBrand(outName.split(/\s+/)[0]) : "Unknown"),
    phoneName: outName || outModel || outBrand,
    model: outModel || outName || "Unknown",
    specs: root.year ? String(root.year) : null,
  };
}

/** Explicit "we do not know this TAC" markers in a 2xx body. */
export function isNotFoundBody(json) {
  if (!json || typeof json !== "object") return false;
  if (json.found === false || json.found === "false") return true;
  if (json.success === false && /not.?found|unknown|no ?data/i.test(String(json.error || json.message || ""))) return true;
  const code = String(json.error?.code || json.code || json.error || "").toLowerCase();
  return ["not_found", "notfound", "tac_not_found", "no_data"].includes(code);
}

function markKeyExhausted(id) {
  getDb()
    .prepare("UPDATE hicelltek_keys SET exhausted_until = ?, last_error = ? WHERE id = ?")
    .run(nextQuotaResetUTC(), "quota reached", id);
}

function disableKey(id, why) {
  getDb()
    .prepare("UPDATE hicelltek_keys SET is_enabled = 0, last_error = ? WHERE id = ?")
    .run(why, id);
}

/**
 * Call the API from the BACKEND only (keys never reach the browser).
 * Walks usable keys until one answers; network errors do NOT rotate.
 * Throws { code, message } style errors the route maps to the response.
 */
export async function fetchTacFromApi(tac, { force = false, keyId = null } = {}) {
  const db = getDb();

  if (!force) {
    const miss = db.prepare("SELECT checked_at FROM tac_api_misses WHERE tac = ?").get(tac);
    if (miss) {
      const checked = new Date(String(miss.checked_at).replace(" ", "T") + "Z").getTime();
      const ageDays = (Date.now() - checked) / 86_400_000;
      if (Number.isFinite(ageDays) && ageDays < MISS_TTL_DAYS) {
        const err = new Error("This TAC was not found by the API recently.");
        err.code = "NOT_FOUND";
        throw err;
      }
    }
  }

  let keys = usableKeys();
  if (keyId) keys = keys.filter((k) => k.id === keyId);
  if (!keys.length) {
    const anyEnabled = db.prepare("SELECT COUNT(*) AS n FROM hicelltek_keys WHERE is_enabled = 1").get().n;
    const err = new Error(anyEnabled ? "All API keys are used up for this month." : "No Hicelltek API key configured.");
    err.code = anyEnabled ? "QUOTA_EXHAUSTED" : "NO_KEY";
    throw err;
  }

  let lastNetworkError = null;
  for (const key of keys) {
    bumpUsage(key);

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    let res;
    try {
      res = await fetch(BASE_URL, {
        method: "POST",
        headers: { [API_KEY_HEADER]: key.api_key, "Content-Type": "application/json" },
        body: JSON.stringify({ query: tac }),
        signal: controller.signal,
      });
    } catch {
      lastNetworkError = { code: "NETWORK", message: "Could not reach the Hicelltek API (offline or timeout)." };
      continue; // network problems are not this key's fault - do not rotate marks
    } finally {
      clearTimeout(timer);
    }

    if (res.status === 401 || res.status === 403) {
      disableKey(key.id, "invalid key");
      logger.warn("Hicelltek key disabled", { key: maskKey(key.api_key) });
      continue;
    }
    if (res.status === 429) {
      markKeyExhausted(key.id);
      continue;
    }

    let body = null;
    try {
      body = await res.json();
    } catch {
      const err = new Error("Unexpected response from the Hicelltek API.");
      err.code = "BAD_RESPONSE";
      throw err;
    }

    if (!res.ok) {
      const err = new Error(`Hicelltek API error (HTTP ${res.status}).`);
      err.code = "BAD_RESPONSE";
      throw err;
    }
    if (isNotFoundBody(body)) {
      db.prepare("INSERT OR REPLACE INTO tac_api_misses (tac, checked_at) VALUES (?, datetime('now'))").run(tac);
      const err = new Error("The API does not know this TAC either.");
      err.code = "NOT_FOUND";
      throw err;
    }

    const mapped = mapResponse(body);
    if (!mapped) {
      const err = new Error("Could not read the Hicelltek response.");
      err.code = "BAD_RESPONSE";
      throw err;
    }
    return mapped;
  }

  if (lastNetworkError) throw Object.assign(new Error(lastNetworkError.message), { code: "NETWORK" });
  // Everything we tried was rejected or exhausted - report honestly.
  const stillEnabled = db.prepare("SELECT COUNT(*) AS n FROM hicelltek_keys WHERE is_enabled = 1").get().n;
  const err = new Error(
    stillEnabled ? "All API keys are used up for this month." : "All Hicelltek API keys were rejected - add a valid key."
  );
  err.code = stillEnabled ? "QUOTA_EXHAUSTED" : "NO_KEY";
  throw err;
}

/* --------------------------------------------------------------- keys */

export function listKeys() {
  const now = new Date().toISOString();
  const month = currentUsageMonth();
  return getDb()
    .prepare("SELECT * FROM hicelltek_keys ORDER BY position ASC, created_at ASC")
    .all()
    .map((k) => {
      const exhausted = k.exhausted_until && k.exhausted_until > now;
      let status = "Active";
      if (k.last_error === "invalid key") status = "Invalid"; // 401/403 disables it
      else if (!k.is_enabled) status = "Disabled";
      else if (exhausted) status = `Exhausted until ${String(k.exhausted_until).slice(0, 10)}`;
      else if (k.usage_month === month && k.calls_this_month >= k.monthly_limit) status = "Quota used";
      return {
        id: k.id,
        label: k.label || "",
        maskedKey: maskKey(k.api_key),
        position: k.position,
        isEnabled: !!k.is_enabled,
        monthlyLimit: k.monthly_limit,
        callsThisMonth: k.usage_month === month ? k.calls_this_month : 0,
        usageMonth: k.usage_month,
        exhaustedUntil: k.exhausted_until,
        lastError: k.last_error,
        status,
      };
    });
}

export function addKey({ label, key, monthly_limit }) {
  const apiKey = String(key || "").trim();
  if (apiKey.length < 8) throw badRequest("Enter the full Hicelltek API key.");
  const db = getDb();
  const maxPos = db.prepare("SELECT COALESCE(MAX(position), -1) AS p FROM hicelltek_keys").get().p;
  const id = randomUUID();
  db.prepare(
    `INSERT INTO hicelltek_keys (id, label, api_key, position, monthly_limit, usage_month)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).run(id, label ? String(label).slice(0, 60) : null, apiKey, maxPos + 1, Number(monthly_limit) > 0 ? Number(monthly_limit) : 100, currentUsageMonth());
  return listKeys();
}

export function deleteKey(id) {
  getDb().prepare("DELETE FROM hicelltek_keys WHERE id = ?").run(id);
  return listKeys();
}

export function patchKey(id, { is_enabled, position, label }) {
  const db = getDb();
  const row = db.prepare("SELECT * FROM hicelltek_keys WHERE id = ?").get(id);
  if (!row) throw notFound("Key not found.");
  const sets = [];
  const params = [];
  if (is_enabled !== undefined) {
    sets.push("is_enabled = ?");
    params.push(is_enabled ? 1 : 0);
    if (is_enabled) {
      sets.push("last_error = NULL", "exhausted_until = NULL");
    }
  }
  if (position !== undefined) {
    sets.push("position = ?");
    params.push(Number(position));
  }
  if (label !== undefined) {
    sets.push("label = ?");
    params.push(label ? String(label).slice(0, 60) : null);
  }
  if (sets.length) {
    db.prepare(`UPDATE hicelltek_keys SET ${sets.join(", ")} WHERE id = ?`).run(...params, id);
  }
  return listKeys();
}

export function reorderKeys(ids = []) {
  const db = getDb();
  const tx = db.transaction(() => {
    ids.forEach((id, i) => db.prepare("UPDATE hicelltek_keys SET position = ? WHERE id = ?").run(i, id));
  });
  tx();
  return listKeys();
}
