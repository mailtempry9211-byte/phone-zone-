import { badRequest } from "./errors.js";

export const isBlank = (v) => v === undefined || v === null || String(v).trim() === "";

export function requireFields(body, fields) {
  const missing = fields.filter((f) => isBlank(body?.[f]));
  if (missing.length) throw badRequest(`Please fill in: ${missing.join(", ")}.`);
}

export function validPhoneNumber(value) {
  return /^(\+?91[-\s]?)?[6-9]\d{9}$/.test(String(value).replace(/[\s-]/g, ""));
}

export function validEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(value));
}

/**
 * Luhn checksum (the check digit rule every real IMEI satisfies).
 * A 14-16 digit string that fails this is a typo or an invented number.
 */
export function luhnValid(digits) {
  let sum = 0;
  let double = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    let d = digits.charCodeAt(i) - 48;
    if (double) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
    double = !double;
  }
  return sum % 10 === 0;
}

/**
 * IMEI: 14-16 digits AND a valid Luhn check digit for 15-digit IMEIs (the real
 * IMEI length). Dual-SIM second IMEI may be supplied comma-separated.
 */
export function validImei(value) {
  return String(value)
    .split(/[,/]/)
    .map((s) => s.trim())
    .every((s) => {
      if (!/^\d{14,16}$/.test(s)) return false;
      // 15 digits is the IMEI format; 14/16 appear on some cloned/legacy labels,
      // so keep accepting them on length alone.
      return s.length === 15 ? luhnValid(s) : true;
    });
}

export function positiveAmount(value) {
  const n = Number(value);
  return Number.isFinite(n) && n >= 0;
}

export function assertPhoneNumber(value, label = "Phone number") {
  if (!validPhoneNumber(value)) throw badRequest(`${label} must be a valid 10-digit Indian mobile number.`);
}

export function assertImei(value) {
  if (!validImei(value)) {
    throw badRequest(
      "That IMEI is not valid. Please check the 15 digits printed on the phone box or dial *#06# on the handset and type them again.",
    );
  }
}

export function assertAmount(value, label = "Amount") {
  if (!positiveAmount(value)) throw badRequest(`${label} must be a number of 0 or more.`);
}

export const toJsonArray = (v) => JSON.stringify(Array.isArray(v) ? v : v ? [v] : []);
export const fromJsonArray = (v) => {
  try {
    const parsed = JSON.parse(v ?? "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};
export const toBool = (v) => (v ? 1 : 0);
