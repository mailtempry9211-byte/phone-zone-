/**
 * Business settings service.
 *
 * admin_settings is the SINGLE source of truth for everything that used to be
 * hard-coded as "PhoneZone": business name, owner, address, contact/social links,
 * business hours, logo, signature, invoice settings and terms. Nothing here is a
 * business-specific code default. On a fresh installation every column starts
 * empty; values only appear after first-run setup / Settings save.
 */
import fs from "node:fs";
import { getDb } from "../db/index.js";
import { businessConfig } from "../config/business.js";
import { resolveStoragePath } from "../config/paths.js";
import { badRequest } from "../lib/errors.js";
import { audit } from "./auditService.js";

const SETTINGS_ID = "00000000-0000-0000-0000-000000000001";

const WRITABLE_COLUMNS = [
  "business_name", "business_tagline", "owner_name", "address",
  "phone_primary", "phone_secondary", "email", "instagram",
  "whatsapp_number", "google_business_url", "udyam_number",
  "logo_url", "signature_url", "business_hours",
  "terms_and_conditions", "terms_and_conditions_sale", "terms_and_conditions_purchase",
  "invoice_prefix_purchase", "invoice_prefix_sale", "invoice_prefix_return",
  "currency_code", "setup_completed",
  "bank_name", "account_holder_name", "account_number", "ifsc_code",
  "udyam_verified", "google_business_verified", "show_google_business",
  "tac_fetch_mode", "whatsapp_channel",
];

const TAC_FETCH_MODES = new Set(["ask", "auto", "off"]);
const WHATSAPP_CHANNELS = new Set(["click_to_chat", "openwa", "chrome_extension"]);

const empty = (v) => (v === undefined || v === null ? "" : String(v));

export function getRawSettings() {
  return getDb().prepare(`SELECT * FROM admin_settings WHERE id = ?`).get(SETTINGS_ID) || null;
}

function parseHours(raw) {
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
}

/** Normalised, frontend-friendly business profile. */
export function getSettings() {
  const row = getRawSettings();
  const shipped = businessConfig();
  const hours = parseHours(row?.business_hours);
  const prefixes = {
    purchase: row?.invoice_prefix_purchase || shipped.invoiceSettings?.prefixes?.purchase || "",
    sale: row?.invoice_prefix_sale || shipped.invoiceSettings?.prefixes?.sale || "",
    return: row?.invoice_prefix_return || shipped.invoiceSettings?.prefixes?.return || "",
  };
  return {
    businessName: empty(row?.business_name),
    businessTagline: empty(row?.business_tagline),
    ownerName: empty(row?.owner_name),
    udyamNumber: empty(row?.udyam_number),
    udyamVerified: !!row?.udyam_verified,
    address: empty(row?.address),
    primaryPhone: empty(row?.phone_primary),
    secondaryPhone: empty(row?.phone_secondary),
    email: empty(row?.email),
    instagram: empty(row?.instagram),
    whatsappNumber: empty(row?.whatsapp_number) || empty(row?.phone_primary).replace(/\D/g, "") || "",
    googleBusinessUrl: empty(row?.google_business_url),
    googleBusinessVerified: !!row?.google_business_verified,
    showGoogleBusiness: !!row?.show_google_business,
    logoUrl: empty(row?.logo_url),
    signatureUrl: empty(row?.signature_url),
    businessHours: hours || {},
    invoicePrefixes: prefixes,
    currency: row?.currency_code || shipped.invoiceSettings?.currency || "INR",
    currencySymbol: shipped.invoiceSettings?.currencySymbol || "₹",
    showUdyam: !!row?.setup_completed && !!row?.udyam_verified,
    termsAndConditions: empty(row?.terms_and_conditions),
    termsAndConditionsSale: empty(row?.terms_and_conditions_sale),
    termsAndConditionsPurchase: empty(row?.terms_and_conditions_purchase),
    setupCompleted: !!row?.setup_completed,
    // Bank details
    bankName: empty(row?.bank_name),
    accountHolderName: empty(row?.account_holder_name),
    accountNumber: empty(row?.account_number),
    ifscCode: empty(row?.ifsc_code),
    // IMEI / TAC engine: what to do when a TAC is not in the local database.
    tacFetchMode: TAC_FETCH_MODES.has(row?.tac_fetch_mode) ? row.tac_fetch_mode : "ask",
    whatsappChannel: WHATSAPP_CHANNELS.has(row?.whatsapp_channel) ? row.whatsapp_channel : "click_to_chat",
    repairServices: shipped.repairServices || [],
    messageTemplates: shipped.messageTemplates || {},
  };
}

/** Whether the welcome/first-run wizard should be shown. */
export function isSetupComplete() {
  const row = getDb().prepare(`SELECT setup_completed FROM admin_settings WHERE id = ?`).get(SETTINGS_ID);
  return !!row?.setup_completed;
}

/** Persist a partial set of business settings (Admin > Settings). */
export function saveSettings(updates, userId) {
  if (updates.tac_fetch_mode !== undefined && !TAC_FETCH_MODES.has(updates.tac_fetch_mode)) {
    throw badRequest("tac_fetch_mode must be ask, auto or off.");
  }
  if (updates.whatsapp_channel === "chrome_extension") {
    updates.whatsapp_channel = "openwa";
  }
  if (updates.whatsapp_channel !== undefined && !WHATSAPP_CHANNELS.has(updates.whatsapp_channel)) {
    throw badRequest("whatsapp_channel must be click_to_chat or openwa.");
  }
  const cols = WRITABLE_COLUMNS.filter((c) => updates[c] !== undefined);
  if (!cols.length) return getSettings();
  const tx = getDb().transaction(() => {
    const params = cols.map((c) => (updates[c] === undefined ? null : updates[c]));
    getDb()
      .prepare(`UPDATE admin_settings SET ${cols.map((c) => `"${c}" = ?`).join(", ")} WHERE id = ?`)
      .run(...params, SETTINGS_ID);
  });
  tx();
  audit(userId, "settings.updated", "admin_settings", SETTINGS_ID, { fields: cols });
  return getSettings();
}

/** First-run wizard: write the profile + mark setup complete atomically. */
export function completeSetup(profile) {
  const hours = profile.businessHours ? JSON.stringify(profile.businessHours) : null;
  const updates = {
    business_name: profile.businessName || "",
    business_tagline: profile.businessTagline || "",
    owner_name: profile.ownerName || "",
    address: profile.address || "",
    phone_primary: profile.primaryPhone || "",
    phone_secondary: profile.secondaryPhone || "",
    email: profile.email || "",
    instagram: profile.instagram || "",
    whatsapp_number: profile.whatsappNumber || "",
    google_business_url: profile.googleBusinessUrl || "",
    udyam_number: profile.udyamNumber || "",
    udyam_verified: profile.udyamVerified ? 1 : 0,
    google_business_verified: profile.googleBusinessVerified ? 1 : 0,
    show_google_business: profile.showGoogleBusiness ? 1 : 0,
    logo_url: profile.logoUrl || null,
    signature_url: profile.signatureUrl || null,
    business_hours: hours,
    terms_and_conditions: profile.termsAndConditions || "",
    terms_and_conditions_sale: profile.termsAndConditionsSale || "",
    terms_and_conditions_purchase: profile.termsAndConditionsPurchase || "",
    invoice_prefix_purchase: profile.invoicePrefixes?.purchase || "",
    invoice_prefix_sale: profile.invoicePrefixes?.sale || "",
    invoice_prefix_return: profile.invoicePrefixes?.return || "",
    currency_code: profile.currencyCode || "",
    business_module: profile.businessModule || "both",
    setup_completed: 1,
    // Bank details
    bank_name: profile.bankName || "",
    account_holder_name: profile.accountHolderName || "",
    account_number: profile.accountNumber || "",
    ifsc_code: profile.ifscCode || "",
  };
  saveSettings(updates, null);
  return getSettings();
}

/** Resolve an application-managed media file (logo/signature/phones) for serving. */
export function readMedia(relativePath) {
  const abs = resolveStoragePath(relativePath);
  if (!fs.existsSync(abs)) throw badRequest("That media file is missing from local storage.");
  return fs.readFileSync(abs);
}
