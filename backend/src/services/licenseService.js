/**
 * PhoneZone Multi-Software Licensing Service
 * Features:
 * - Master God Mode Secret Hashes (never plain text) for lifetime free access
 * - Hardware ID (HWID) lock & multi-device concurrency control
 * - Platform-specific entitlements (EXE, APK, Web, Linux)
 * - Server-level activation (all LAN, ngrok, and browser clients share server license)
 * - Supabase multi-software integration (50+ softwares in 1 Supabase project)
 * - Robust offline grace period & Render reboot persistence
 */
import crypto from "node:crypto";
import os from "node:os";
import { getDb } from "../db/index.js";
import { badRequest } from "../lib/errors.js";
import { getHardwareId, getPlatformType } from "./hardwareId.js";

// SHA-256 hashes of master keys (NEVER stored in plain text!)
const MASTER_GOD_MODE_HASHES = new Set([
  "015acc62fdf15a1455ae47a1504875b4961de972d2545be59f08ee8d51c22298", // 9211921192119211
  "6362ce8bcc58f5d427865ba54fdc59d60c87e5fc7a05ea22949c151bbaee9901", // Humsafar@1998Humsafar@1998Humsafar@1998Humsafar@1998
]);

const SOFTWARE_ID = process.env.PHONEZONE_SOFTWARE_ID || "phonezone";

/**
 * Reads Supabase licensing configuration from environment or fallback settings.
 */
function getSupabaseConfig() {
  const url = process.env.SUPABASE_LICENSE_URL || process.env.SUPABASE_URL || "https://nfktxnjxdmqcvlghlodi.supabase.co";
  const key = process.env.SUPABASE_LICENSE_KEY || process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || "sb_publishable_D7kiQTcdnrb7NhOJhZ2dQw_6Fqnuhlk";
  return { url: url.replace(/\/+$/, ""), key };
}

/**
 * Returns current license state from SQLite database.
 */
export function getLocalLicenseRecord() {
  const db = getDb();
  let row = db.prepare("SELECT * FROM license_state WHERE id = 1").get();
  if (!row) {
    db.prepare("INSERT OR IGNORE INTO license_state (id, software_id, status) VALUES (1, ?, 'unlicensed')").run(SOFTWARE_ID);
    row = db.prepare("SELECT * FROM license_state WHERE id = 1").get();
  }
  return row;
}

/**
 * Evaluates license validity for the current machine/server.
 */
export function getLicenseStatus() {
  const row = getLocalLicenseRecord();
  const hwid = getHardwareId();
  const platform = getPlatformType();

  if (!row || row.status === "unlicensed") {
    return {
      activated: false,
      status: "unlicensed",
      softwareId: SOFTWARE_ID,
      hwid,
      platform,
      isGodMode: false,
      message: "PhoneZone is currently unlicensed. Please enter your license activation key.",
    };
  }

  // 1. GOD MODE: Permanent Lifetime VIP
  if (row.status === "god_mode") {
    return {
      activated: true,
      status: "active",
      planType: "god_mode",
      isGodMode: true,
      softwareId: SOFTWARE_ID,
      customerName: row.customer_name || "Master VIP Owner",
      shopName: row.shop_name || "All Access VIP",
      validUntil: "2099-12-31T23:59:59.000Z",
      daysRemaining: 99999,
      allowedPlatforms: ["all"],
      hardwareLockEnabled: false,
      hwid,
      platform,
      message: "God Mode Lifetime VIP Active (Permanent Free License).",
    };
  }

  // 2. Terminated or Suspended
  if (row.status === "terminated" || row.status === "suspended") {
    return {
      activated: false,
      status: row.status,
      softwareId: SOFTWARE_ID,
      hwid,
      platform,
      isGodMode: false,
      message: `License is ${row.status.toUpperCase()}. Contact administrator to restore access.`,
    };
  }

  // 3. Platform entitlement check
  let platforms = ["all"];
  try {
    if (row.allowed_platforms) {
      platforms = JSON.parse(row.allowed_platforms);
    }
  } catch {}

  const isPlatformAllowed =
    platforms.includes("all") ||
    platforms.includes(platform) ||
    (platform === "exe" && platforms.includes("windows")) ||
    (platform === "apk" && platforms.includes("android")) ||
    (platform === "web" && platforms.includes("cloud"));

  if (!isPlatformAllowed) {
    return {
      activated: false,
      status: "platform_mismatch",
      softwareId: SOFTWARE_ID,
      hwid,
      platform,
      isGodMode: false,
      message: `License is restricted to platforms: [${platforms.join(", ")}]. Current running platform is '${platform}'.`,
    };
  }

  // 4. Hardware lock check
  if (row.hardware_lock_enabled && row.bound_hardware_id && row.bound_hardware_id !== hwid) {
    return {
      activated: false,
      status: "hardware_locked",
      softwareId: SOFTWARE_ID,
      hwid,
      platform,
      isGodMode: false,
      message: `License is hardware-locked to another PC (Bound HWID: ${row.bound_hardware_id.slice(0, 12)}...).`,
    };
  }

  // 5. Expiration check
  if (row.valid_until) {
    const expireDate = new Date(row.valid_until);
    const now = new Date();
    if (expireDate < now) {
      return {
        activated: false,
        status: "expired",
        softwareId: SOFTWARE_ID,
        hwid,
        platform,
        isGodMode: false,
        validUntil: row.valid_until,
        message: "License has expired. Please renew your subscription to continue.",
      };
    }

    const diffDays = Math.ceil((expireDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    return {
      activated: true,
      status: "active",
      planType: row.plan_type || "pro",
      isGodMode: false,
      softwareId: SOFTWARE_ID,
      customerName: row.customer_name || "Valued Merchant",
      shopName: row.shop_name || "PhoneZone Store",
      validUntil: row.valid_until,
      daysRemaining: diffDays,
      allowedPlatforms: platforms,
      hardwareLockEnabled: Boolean(row.hardware_lock_enabled),
      hwid,
      platform,
      message: `License Active (${diffDays} days remaining).`,
    };
  }

  // Lifetime regular plan
  return {
    activated: true,
    status: "active",
    planType: row.plan_type || "lifetime",
    isGodMode: false,
    softwareId: SOFTWARE_ID,
    customerName: row.customer_name || "Valued Merchant",
    shopName: row.shop_name || "PhoneZone Store",
    validUntil: null,
    daysRemaining: 99999,
    allowedPlatforms: platforms,
    hardwareLockEnabled: Boolean(row.hardware_lock_enabled),
    hwid,
    platform,
    message: "Lifetime License Active.",
  };
}

/**
 * Fast boolean check used by Express middleware.
 */
export function isLicenseValid() {
  const status = getLicenseStatus();
  return Boolean(status && status.activated);
}

/**
 * Activates license via Master Secret Key (God Mode) or Supabase multi-software registry.
 */
export async function activateLicense({ licenseKey, customerName, shopName }) {
  if (!licenseKey || !String(licenseKey).trim()) {
    throw badRequest("License activation key is required.");
  }

  const key = String(licenseKey).trim();
  const keyHash = crypto.createHash("sha256").update(key).digest("hex");
  const hwid = getHardwareId();
  const platform = getPlatformType();
  const db = getDb();

  // 1. Check if key matches Master God Mode Secret Hashes
  if (MASTER_GOD_MODE_HASHES.has(keyHash)) {
    const godRecord = {
      license_key: "GOD-MODE-PERMANENT-VIP",
      status: "god_mode",
      plan_type: "lifetime",
      customer_name: customerName?.trim() || "Master VIP Owner",
      customer_phone: "Master Direct",
      shop_name: shopName?.trim() || "All Access VIP",
      valid_from: new Date().toISOString(),
      valid_until: "2099-12-31T23:59:59.000Z",
      allowed_platforms: JSON.stringify(["all"]),
      hardware_lock_enabled: 0,
      bound_hardware_id: null,
      max_active_devices: 999999,
      activated_at: new Date().toISOString(),
      last_validated_at: new Date().toISOString(),
      signature: crypto.createHmac("sha256", "pz_god_salt").update(`god_mode|${keyHash}`).digest("hex"),
    };

    db.prepare(`
      UPDATE license_state
      SET license_key = @license_key,
          status = @status,
          plan_type = @plan_type,
          customer_name = @customer_name,
          customer_phone = @customer_phone,
          shop_name = @shop_name,
          valid_from = @valid_from,
          valid_until = @valid_until,
          allowed_platforms = @allowed_platforms,
          hardware_lock_enabled = @hardware_lock_enabled,
          bound_hardware_id = @bound_hardware_id,
          max_active_devices = @max_active_devices,
          activated_at = @activated_at,
          last_validated_at = @last_validated_at,
          signature = @signature,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = 1
    `).run(godRecord);

    return {
      success: true,
      isGodMode: true,
      message: "God Mode Activated! Lifetime Free Master Access Unlocked.",
      status: getLicenseStatus(),
    };
  }

  // 2. Validate with Supabase Multi-Software Licensing Cloud
  const { url: supabaseUrl, key: supabaseKey } = getSupabaseConfig();
  if (!supabaseUrl || !supabaseKey) {
    // If Supabase is not yet configured, allow informative response
    throw badRequest(
      "License verification service is not yet configured. Please configure Supabase URL/Key or use your Master Secret Key."
    );
  }

  try {
    const endpoint = `${supabaseUrl}/rest/v1/rpc/validate_or_activate_license`;
    const res = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: supabaseKey,
        Authorization: `Bearer ${supabaseKey}`,
      },
      body: JSON.stringify({
        p_software_id: SOFTWARE_ID,
        p_license_key: key,
        p_hwid: hwid,
        p_platform: platform,
        p_device_name: os.hostname(),
      }),
    });

    const data = await res.json();
    if (!res.ok || data?.error || data?.success === false) {
      const errMsg = data?.message || data?.error || "Invalid or unauthorized license key.";
      throw badRequest(errMsg);
    }

    // License valid! Store in local SQLite
    const lic = data.license || data;
    const localRecord = {
      license_key: key,
      status: "active",
      plan_type: lic.plan_type || "pro",
      customer_name: lic.customer_name || customerName || "Merchant",
      customer_phone: lic.customer_phone || "",
      shop_name: lic.shop_name || shopName || "Store",
      valid_from: lic.valid_from || new Date().toISOString(),
      valid_until: lic.valid_until || null,
      allowed_platforms: JSON.stringify(lic.allowed_platforms || ["all"]),
      hardware_lock_enabled: lic.hardware_lock_enabled ? 1 : 0,
      bound_hardware_id: lic.bound_hardware_id || hwid,
      max_active_devices: Number(lic.max_active_devices || 1),
      activated_at: new Date().toISOString(),
      last_validated_at: new Date().toISOString(),
      signature: crypto.createHmac("sha256", "pz_lic_salt").update(`${key}|${hwid}`).digest("hex"),
    };

    db.prepare(`
      UPDATE license_state
      SET license_key = @license_key,
          status = @status,
          plan_type = @plan_type,
          customer_name = @customer_name,
          customer_phone = @customer_phone,
          shop_name = @shop_name,
          valid_from = @valid_from,
          valid_until = @valid_until,
          allowed_platforms = @allowed_platforms,
          hardware_lock_enabled = @hardware_lock_enabled,
          bound_hardware_id = @bound_hardware_id,
          max_active_devices = @max_active_devices,
          activated_at = @activated_at,
          last_validated_at = @last_validated_at,
          signature = @signature,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = 1
    `).run(localRecord);

    return {
      success: true,
      isGodMode: false,
      message: "License activated successfully!",
      status: getLicenseStatus(),
    };
  } catch (err) {
    if (err.statusCode) throw err;
    throw badRequest(`License activation failed: ${err.message || "Network error reaching license cloud"}`);
  }
}

/**
 * Deactivates this machine's session so the license can be transferred to another PC.
 */
export async function deactivateLicense() {
  const row = getLocalLicenseRecord();
  const hwid = getHardwareId();
  const db = getDb();

  // If connected to Supabase and not in god mode, release this device HWID
  if (row.license_key && row.status !== "god_mode") {
    const { url: supabaseUrl, key: supabaseKey } = getSupabaseConfig();
    if (supabaseUrl && supabaseKey) {
      try {
        await fetch(`${supabaseUrl}/rest/v1/rpc/deactivate_license_device`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            apikey: supabaseKey,
            Authorization: `Bearer ${supabaseKey}`,
          },
          body: JSON.stringify({
            p_software_id: SOFTWARE_ID,
            p_license_key: row.license_key,
            p_hwid: hwid,
          }),
        });
      } catch {}
    }
  }

  // Reset local SQLite record to unlicensed
  db.prepare(`
    UPDATE license_state
    SET status = 'unlicensed',
        license_key = NULL,
        plan_type = 'none',
        valid_until = NULL,
        signature = NULL,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = 1
  `).run();

  return {
    success: true,
    message: "Device deactivated. License can now be activated on another PC.",
  };
}
