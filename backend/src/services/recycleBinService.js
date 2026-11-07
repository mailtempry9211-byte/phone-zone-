import { getDb } from "../db/index.js";
import { logger } from "../lib/logger.js";
import { audit } from "./auditService.js";
import { deleteMediaByUrlOrPath } from "./storageService.js";
import { deleteRowFromSupabase, pushSingleRowToSupabase, triggerBackgroundSync } from "./supabaseSyncService.js";

/**
 * Retention period for Recycle Bin items before permanent auto-purge:
 * - On Render / Cloud Web: 15 Days (frees cloud & storage quota quickly)
 * - On Local / Desktop EXE: 30 Days (standard desktop recycle bin window)
 */
export function getRecycleBinRetentionDays() {
  const isCloudOrRender = process.env.RENDER === "true" || !!process.env.RENDER_EXTERNAL_URL;
  return isCloudOrRender ? 15 : 30;
}

function parseJsonArray(val) {
  if (!val) return [];
  if (Array.isArray(val)) return val;
  try {
    const parsed = JSON.parse(val);
    return Array.isArray(parsed) ? parsed : [parsed];
  } catch {
    return [val];
  }
}

/**
 * List all soft-deleted items across phones, repairs, customers, sellers, dealers.
 */
export function listRecycleBin() {
  const db = getDb();
  const retentionDays = getRecycleBinRetentionDays();
  const now = Date.now();
  const items = [];

  // 1. Phones
  try {
    const phones = db.prepare(`
      SELECT id, phone_name, model, imei_number, purchase_price, selling_price,
             product_photos, payment_proof_photos, purchase_documents, seller_photo_url, seller_signature_url,
             deleted_at, created_at
      FROM phones
      WHERE deleted_at IS NOT NULL AND deleted_at != ''
      ORDER BY deleted_at DESC
    `).all();

    for (const p of phones) {
      const deletedTime = new Date(p.deleted_at).getTime() || now;
      const daysPassed = Math.floor((now - deletedTime) / (24 * 3600 * 1000));
      const daysLeft = Math.max(0, retentionDays - daysPassed);
      const mediaUrls = [
        ...parseJsonArray(p.product_photos),
        ...parseJsonArray(p.payment_proof_photos),
        ...parseJsonArray(p.purchase_documents),
        p.seller_photo_url,
        p.seller_signature_url,
      ].filter(Boolean);

      items.push({
        id: p.id,
        type: "phone",
        typeLabel: "Phone (फ़ोन)",
        title: `${p.phone_name || "Phone"} ${p.model || ""}`.trim(),
        subtitle: `IMEI: ${p.imei_number || "N/A"} • Buy: ₹${p.purchase_price || 0}`,
        deleted_at: p.deleted_at,
        days_left: daysLeft,
        retention_days: retentionDays,
        media_count: mediaUrls.length,
        media_urls: mediaUrls,
      });
    }
  } catch (err) {
    logger.warn("[RecycleBin] Error listing phones:", err.message);
  }

  // 2. Workshop Repairs
  try {
    const repairs = db.prepare(`
      SELECT id, job_no, device_brand, device_model, problem, final_price, estimate,
             device_photos, customer_signature_url, deleted_at, created_at
      FROM repair_jobs
      WHERE deleted_at IS NOT NULL AND deleted_at != ''
      ORDER BY deleted_at DESC
    `).all();

    for (const r of repairs) {
      const deletedTime = new Date(r.deleted_at).getTime() || now;
      const daysPassed = Math.floor((now - deletedTime) / (24 * 3600 * 1000));
      const daysLeft = Math.max(0, retentionDays - daysPassed);
      const mediaUrls = [
        ...parseJsonArray(r.device_photos),
        r.customer_signature_url,
      ].filter(Boolean);

      items.push({
        id: r.id,
        type: "repair",
        typeLabel: "Repair Job (रिपेयरिंग)",
        title: `#${r.job_no || r.id?.slice(0, 8)} - ${r.device_brand || ""} ${r.device_model || "Device"}`.trim(),
        subtitle: `Issue: ${r.problem || "Repair"} • Price: ₹${r.final_price || r.estimate || 0}`,
        deleted_at: r.deleted_at,
        days_left: daysLeft,
        retention_days: retentionDays,
        media_count: mediaUrls.length,
        media_urls: mediaUrls,
      });
    }
  } catch (err) {
    logger.warn("[RecycleBin] Error listing repairs:", err.message);
  }

  // 3. Customers
  try {
    const customers = db.prepare(`
      SELECT id, name, phone, address, customer_photo_url, aadhaar_photo_url, deleted_at, created_at
      FROM customers
      WHERE deleted_at IS NOT NULL AND deleted_at != ''
      ORDER BY deleted_at DESC
    `).all();

    for (const c of customers) {
      const deletedTime = new Date(c.deleted_at).getTime() || now;
      const daysPassed = Math.floor((now - deletedTime) / (24 * 3600 * 1000));
      const daysLeft = Math.max(0, retentionDays - daysPassed);
      const mediaUrls = [c.customer_photo_url, c.aadhaar_photo_url].filter(Boolean);

      items.push({
        id: c.id,
        type: "customer",
        typeLabel: "Customer (ग्राहक)",
        title: c.name || "Customer",
        subtitle: `Phone: ${c.phone || "N/A"} • ${c.address || ""}`.trim(),
        deleted_at: c.deleted_at,
        days_left: daysLeft,
        retention_days: retentionDays,
        media_count: mediaUrls.length,
        media_urls: mediaUrls,
      });
    }
  } catch (err) {
    logger.warn("[RecycleBin] Error listing customers:", err.message);
  }

  // 4. Sellers
  try {
    const sellers = db.prepare(`
      SELECT id, name, phone, address, seller_photo_url, aadhaar_photo_url, deleted_at, created_at
      FROM sellers
      WHERE deleted_at IS NOT NULL AND deleted_at != ''
      ORDER BY deleted_at DESC
    `).all();

    for (const s of sellers) {
      const deletedTime = new Date(s.deleted_at).getTime() || now;
      const daysPassed = Math.floor((now - deletedTime) / (24 * 3600 * 1000));
      const daysLeft = Math.max(0, retentionDays - daysPassed);
      const mediaUrls = [s.seller_photo_url, s.aadhaar_photo_url].filter(Boolean);

      items.push({
        id: s.id,
        type: "seller",
        typeLabel: "Seller (विक्रेता)",
        title: s.name || "Seller",
        subtitle: `Phone: ${s.phone || "N/A"} • ${s.address || ""}`.trim(),
        deleted_at: s.deleted_at,
        days_left: daysLeft,
        retention_days: retentionDays,
        media_count: mediaUrls.length,
        media_urls: mediaUrls,
      });
    }
  } catch (err) {
    logger.warn("[RecycleBin] Error listing sellers:", err.message);
  }

  // 5. Dealers
  try {
    const dealers = db.prepare(`
      SELECT id, business_name, contact_person, phone, photo_url, updated_at
      FROM dealers
      WHERE is_active = 0
      ORDER BY updated_at DESC
    `).all();

    for (const d of dealers) {
      const deletedTime = new Date(d.updated_at).getTime() || now;
      const daysPassed = Math.floor((now - deletedTime) / (24 * 3600 * 1000));
      const daysLeft = Math.max(0, retentionDays - daysPassed);
      const mediaUrls = [d.photo_url].filter(Boolean);

      items.push({
        id: d.id,
        type: "dealer",
        typeLabel: "B2B Dealer (डीलर)",
        title: d.business_name || d.contact_person || "Dealer",
        subtitle: `Phone: ${d.phone || "N/A"}`,
        deleted_at: d.updated_at,
        days_left: daysLeft,
        retention_days: retentionDays,
        media_count: mediaUrls.length,
        media_urls: mediaUrls,
      });
    }
  } catch (err) {
    logger.warn("[RecycleBin] Error listing dealers:", err.message);
  }

  // Sort overall list: newest deleted first
  items.sort((a, b) => new Date(b.deleted_at).getTime() - new Date(a.deleted_at).getTime());

  return {
    items,
    count: items.length,
    retentionDays,
    environment: process.env.RENDER === "true" || !!process.env.RENDER_EXTERNAL_URL ? "render_cloud" : "local_desktop",
  };
}

/**
 * Restore (recover) an item from Recycle Bin back to active status.
 */
export async function restoreRecycleItem(type, id, userId = null) {
  const db = getDb();
  let restoredRow = null;

  switch (type) {
    case "phone": {
      db.prepare("UPDATE phones SET deleted_at = NULL, updated_at = datetime('now') WHERE id = ?").run(id);
      restoredRow = db.prepare("SELECT * FROM phones WHERE id = ?").get(id);
      if (restoredRow) await pushSingleRowToSupabase("phones", restoredRow).catch(() => {});
      break;
    }
    case "repair": {
      db.prepare("UPDATE repair_jobs SET deleted_at = NULL, updated_at = datetime('now') WHERE id = ?").run(id);
      restoredRow = db.prepare("SELECT * FROM repair_jobs WHERE id = ?").get(id);
      if (restoredRow) await pushSingleRowToSupabase("repair_jobs", restoredRow).catch(() => {});
      break;
    }
    case "customer": {
      db.prepare("UPDATE customers SET deleted_at = NULL, updated_at = datetime('now') WHERE id = ?").run(id);
      restoredRow = db.prepare("SELECT * FROM customers WHERE id = ?").get(id);
      if (restoredRow) await pushSingleRowToSupabase("customers", restoredRow).catch(() => {});
      break;
    }
    case "seller": {
      db.prepare("UPDATE sellers SET deleted_at = NULL, updated_at = datetime('now') WHERE id = ?").run(id);
      restoredRow = db.prepare("SELECT * FROM sellers WHERE id = ?").get(id);
      if (restoredRow) await pushSingleRowToSupabase("sellers", restoredRow).catch(() => {});
      break;
    }
    case "dealer": {
      db.prepare("UPDATE dealers SET is_active = 1, updated_at = datetime('now') WHERE id = ?").run(id);
      restoredRow = db.prepare("SELECT * FROM dealers WHERE id = ?").get(id);
      if (restoredRow) await pushSingleRowToSupabase("dealers", restoredRow).catch(() => {});
      break;
    }
    default:
      throw new Error(`Unknown recycle item type: ${type}`);
  }

  audit(userId, "recycle_bin.restore", type, id);
  triggerBackgroundSync();
  return { ok: true, restored: true, id, type };
}

/**
 * Permanently delete an item from database AND wipe all its physical photos/files from storage & Supabase Cloud.
 */
export async function permanentlyDeleteItem(type, id, userId = null) {
  const db = getDb();
  let mediaUrls = [];

  switch (type) {
    case "phone": {
      const p = db.prepare("SELECT * FROM phones WHERE id = ?").get(id);
      if (p) {
        mediaUrls = [
          ...parseJsonArray(p.product_photos),
          ...parseJsonArray(p.payment_proof_photos),
          ...parseJsonArray(p.purchase_documents),
          p.seller_photo_url,
          p.seller_signature_url,
        ].filter(Boolean);
      }
      db.prepare("DELETE FROM phones WHERE id = ?").run(id);
      await deleteRowFromSupabase("phones", id).catch(() => {});
      break;
    }
    case "repair": {
      const r = db.prepare("SELECT * FROM repair_jobs WHERE id = ?").get(id);
      if (r) {
        mediaUrls = [...parseJsonArray(r.device_photos), r.customer_signature_url].filter(Boolean);
      }
      db.prepare("DELETE FROM repair_job_items WHERE repair_job_id = ?").run(id);
      db.prepare("DELETE FROM repair_status_log WHERE repair_job_id = ?").run(id);
      db.prepare("DELETE FROM repair_jobs WHERE id = ?").run(id);
      await deleteRowFromSupabase("repair_jobs", id).catch(() => {});
      break;
    }
    case "customer": {
      const c = db.prepare("SELECT * FROM customers WHERE id = ?").get(id);
      if (c) {
        mediaUrls = [c.customer_photo_url, c.aadhaar_photo_url].filter(Boolean);
      }
      db.prepare("DELETE FROM customers WHERE id = ?").run(id);
      await deleteRowFromSupabase("customers", id).catch(() => {});
      break;
    }
    case "seller": {
      const s = db.prepare("SELECT * FROM sellers WHERE id = ?").get(id);
      if (s) {
        mediaUrls = [s.seller_photo_url, s.aadhaar_photo_url].filter(Boolean);
      }
      db.prepare("DELETE FROM sellers WHERE id = ?").run(id);
      await deleteRowFromSupabase("sellers", id).catch(() => {});
      break;
    }
    case "dealer": {
      const d = db.prepare("SELECT * FROM dealers WHERE id = ?").get(id);
      if (d) {
        mediaUrls = [d.photo_url].filter(Boolean);
      }
      db.prepare("DELETE FROM dealers WHERE id = ?").run(id);
      await deleteRowFromSupabase("dealers", id).catch(() => {});
      break;
    }
    default:
      throw new Error(`Unknown recycle item type: ${type}`);
  }

  // Permanently delete linked photos/files from local storage and Supabase Cloud
  for (const url of mediaUrls) {
    try {
      deleteMediaByUrlOrPath(url);
    } catch {}
  }

  audit(userId, "recycle_bin.permanent_delete", type, id);
  triggerBackgroundSync();
  return { ok: true, permanentlyDeleted: true, id, type, purgedMediaCount: mediaUrls.length };
}

/**
 * Empty the entire Recycle Bin: permanently wipes all soft-deleted records + all physical photos.
 */
export async function emptyRecycleBin(userId = null) {
  const { items } = listRecycleBin();
  let deletedCount = 0;
  let mediaCount = 0;

  for (const item of items) {
    try {
      const res = await permanentlyDeleteItem(item.type, item.id, userId);
      deletedCount++;
      mediaCount += res.purgedMediaCount || 0;
    } catch (err) {
      logger.warn(`[RecycleBin] Error permanently deleting ${item.type} ${item.id}:`, err.message);
    }
  }

  audit(userId, "recycle_bin.empty_all", "all", null, { deletedCount, mediaCount });
  return { ok: true, deletedCount, mediaCount };
}

/**
 * Auto-purge expired items from Recycle Bin based on environment retention window:
 * - Render / Cloud: 15 days
 * - Desktop / Local: 30 days
 */
export async function autoPurgeExpiredRecycleBin() {
  const retentionDays = getRecycleBinRetentionDays();
  const db = getDb();
  const cutoffSql = `datetime('now', '-${retentionDays} days')`;

  logger.info(`[RecycleBin] Checking auto-purge (Retention window: ${retentionDays} days)...`);

  const expiredPhones = db.prepare(`SELECT id FROM phones WHERE deleted_at IS NOT NULL AND deleted_at != '' AND deleted_at <= ${cutoffSql}`).all();
  const expiredRepairs = db.prepare(`SELECT id FROM repair_jobs WHERE deleted_at IS NOT NULL AND deleted_at != '' AND deleted_at <= ${cutoffSql}`).all();
  const expiredCustomers = db.prepare(`SELECT id FROM customers WHERE deleted_at IS NOT NULL AND deleted_at != '' AND deleted_at <= ${cutoffSql}`).all();
  const expiredSellers = db.prepare(`SELECT id FROM sellers WHERE deleted_at IS NOT NULL AND deleted_at != '' AND deleted_at <= ${cutoffSql}`).all();
  const expiredDealers = db.prepare(`SELECT id FROM dealers WHERE is_active = 0 AND updated_at <= ${cutoffSql}`).all();

  let totalPurged = 0;

  for (const p of expiredPhones) {
    await permanentlyDeleteItem("phone", p.id, "system_auto_purge");
    totalPurged++;
  }
  for (const r of expiredRepairs) {
    await permanentlyDeleteItem("repair", r.id, "system_auto_purge");
    totalPurged++;
  }
  for (const c of expiredCustomers) {
    await permanentlyDeleteItem("customer", c.id, "system_auto_purge");
    totalPurged++;
  }
  for (const s of expiredSellers) {
    await permanentlyDeleteItem("seller", s.id, "system_auto_purge");
    totalPurged++;
  }
  for (const d of expiredDealers) {
    await permanentlyDeleteItem("dealer", d.id, "system_auto_purge");
    totalPurged++;
  }

  if (totalPurged > 0) {
    logger.info(`[RecycleBin] Auto-purged ${totalPurged} expired items older than ${retentionDays} days.`);
  }

  return { ok: true, totalPurged, retentionDays };
}
