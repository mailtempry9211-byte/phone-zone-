/**
 * WhatsApp Marketing Service (Private, opt-in only, server-governed queue).
 * Strictly enforces rate limits, daily caps, active hours, and opt-in status.
 */
import crypto from "node:crypto";
import { getDb, transaction } from "../db/index.js";
import { newId, badRequest, unauthorized, notFound } from "../lib/errors.js";

const DEFAULT_DAILY_CAP = 50;
let lastDispatchTime = 0;

export function hashWaToken(token) {
  return crypto.createHash("sha256").update(String(token || "")).digest("hex");
}

export function createToken(description = "Chrome Extension") {
  const db = getDb();
  const rawToken = crypto.randomBytes(24).toString("hex");
  const tokenHash = hashWaToken(rawToken);
  const id = newId();

  db.prepare(
    "INSERT INTO wa_tokens (id, token_hash, description) VALUES (?, ?, ?)"
  ).run(id, tokenHash, description);

  return { id, token: rawToken, description };
}

export function verifyToken(rawToken) {
  if (!rawToken) return false;
  const db = getDb();
  const hash = hashWaToken(rawToken);
  const row = db
    .prepare("SELECT * FROM wa_tokens WHERE token_hash = ? AND revoked_at IS NULL")
    .get(hash);
  return !!row;
}

export function revokeToken(id) {
  const db = getDb();
  const info = db
    .prepare("UPDATE wa_tokens SET revoked_at = datetime('now') WHERE id = ?")
    .run(id);
  if (info.changes === 0) throw notFound("Token not found or already revoked.");
  return { ok: true, revoked: true };
}

export function listTokens() {
  const db = getDb();
  return db
    .prepare("SELECT id, description, revoked_at, created_at FROM wa_tokens ORDER BY created_at DESC")
    .all();
}

export function getNextQueueItem({ ignoreHours = false, minGapMs = 25000 } = {}) {
  const db = getDb();
  const now = new Date();
  const hour = now.getHours();

  // Active business hours enforcement: 10:00 to 20:00
  if (!ignoreHours && process.env.PHONEZONE_WA_IGNORE_HOURS !== "true") {
    if (hour < 10 || hour >= 20) {
      return { waitSeconds: 3600, reason: "outside_hours", item: null };
    }
  }

  // Daily limit check
  const sentTodayRow = db
    .prepare(
      "SELECT COUNT(*) AS count FROM wa_message_log WHERE date(sent_at) = date('now') AND status = 'sent'"
    )
    .get();
  const sentToday = sentTodayRow?.count || 0;
  if (sentToday >= DEFAULT_DAILY_CAP) {
    return { waitSeconds: 3600, reason: "daily_cap_reached", item: null };
  }

  // Gap between consecutive messages
  const elapsed = Date.now() - lastDispatchTime;
  if (lastDispatchTime > 0 && elapsed < minGapMs) {
    const waitMs = minGapMs - elapsed;
    return { waitSeconds: Math.ceil(waitMs / 1000), reason: "gap_required", item: null };
  }

  // Find next pending message
  const item = db
    .prepare(
      "SELECT * FROM wa_queue WHERE status = 'pending' ORDER BY scheduled_at ASC LIMIT 1"
    )
    .get();

  if (!item) {
    return { waitSeconds: 30, reason: "queue_empty", item: null };
  }

  lastDispatchTime = Date.now();
  return { waitSeconds: 0, reason: null, item };
}

export function recordResult(queueId, { status, error } = {}) {
  const db = getDb();
  const queueItem = db.prepare("SELECT * FROM wa_queue WHERE id = ?").get(queueId);
  if (!queueItem) throw notFound("Queue item not found.");

  const cleanStatus = status === "sent" ? "sent" : "failed";

  return transaction(() => {
    db.prepare(
      "UPDATE wa_queue SET status = ?, sent_at = datetime('now'), error = ? WHERE id = ?"
    ).run(cleanStatus, error || null, queueId);

    db.prepare(
      "INSERT INTO wa_message_log (id, queue_id, customer_phone, status, error) VALUES (?, ?, ?, ?, ?)"
    ).run(newId(), queueId, queueItem.customer_phone, cleanStatus, error || null);

    if (queueItem.campaign_id) {
      if (cleanStatus === "sent") {
        db.prepare(
          "UPDATE wa_campaigns SET sent_count = sent_count + 1, updated_at = datetime('now') WHERE id = ?"
        ).run(queueItem.campaign_id);
      } else {
        db.prepare(
          "UPDATE wa_campaigns SET failed_count = failed_count + 1, updated_at = datetime('now') WHERE id = ?"
        ).run(queueItem.campaign_id);
      }
    }

    return { ok: true, status: cleanStatus };
  });
}

export function optOut(phone) {
  if (!phone) throw badRequest("Phone number is required.");
  const cleanPhone = String(phone).trim();
  const db = getDb();

  return transaction(() => {
    db.prepare(
      "UPDATE customers SET whatsapp_opt_in = 0, wa_opted_out_at = datetime('now') WHERE phone = ?"
    ).run(cleanPhone);

    db.prepare(
      "UPDATE repair_customers SET whatsapp_opt_in = 0, wa_opted_out_at = datetime('now') WHERE phone = ?"
    ).run(cleanPhone);

    // Cancel pending queue messages for this phone
    db.prepare(
      "UPDATE wa_queue SET status = 'failed', error = 'Customer opted out' WHERE customer_phone = ? AND status = 'pending'"
    ).run(cleanPhone);

    return { ok: true, phone: cleanPhone, optedOut: true };
  });
}

export function createCampaign({
  name,
  template_id,
  dry_run = false,
  audience = "all",
  recipients = null,
  media_url = null,
  media_type = null,
  delay_min = 25,
  delay_max = 60,
}) {
  if (!name || !template_id) throw badRequest("Campaign name and template are required.");
  const db = getDb();

  const template = db.prepare("SELECT * FROM wa_templates WHERE id = ?").get(template_id);
  if (!template) throw notFound("Template not found.");

  let targets = [];

  if (Array.isArray(recipients) && recipients.length > 0) {
    const phoneMap = new Map();
    for (const r of recipients) {
      if (r && r.phone) {
        const cleanPhone = String(r.phone).replace(/\D/g, "");
        if (cleanPhone.length >= 10 && !phoneMap.has(cleanPhone)) {
          phoneMap.set(cleanPhone, {
            id: r.id || newId(),
            name: r.name || "Valued Contact",
            phone: cleanPhone,
            shop_name: r.shop_name || "",
          });
        }
      }
    }
    targets = Array.from(phoneMap.values());
  } else {
    // Default selection: customers with whatsapp_opt_in = 1 AND wa_opted_out_at IS NULL
    const optedInCustomers = db
      .prepare(
        "SELECT id, name, phone FROM customers WHERE whatsapp_opt_in = 1 AND wa_opted_out_at IS NULL AND deleted_at IS NULL"
      )
      .all();

    const optedInRepairCustomers = db
      .prepare(
        "SELECT id, name, phone FROM repair_customers WHERE whatsapp_opt_in = 1 AND wa_opted_out_at IS NULL AND deleted_at IS NULL"
      )
      .all();

    // Deduplicate by phone
    const phoneMap = new Map();
    for (const c of [...optedInCustomers, ...optedInRepairCustomers]) {
      if (!phoneMap.has(c.phone)) {
        phoneMap.set(c.phone, c);
      }
    }
    targets = Array.from(phoneMap.values());
  }

  const campaignId = newId();

  return transaction(() => {
    db.prepare(
      `INSERT INTO wa_campaigns (id, name, template_id, status, total_count, dry_run, audience_type, media_url, media_type, delay_min, delay_max)
       VALUES (?, ?, ?, 'running', ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      campaignId,
      name,
      template_id,
      targets.length,
      dry_run ? 1 : 0,
      audience,
      media_url || null,
      media_type || null,
      delay_min || 25,
      delay_max || 60
    );

    for (const target of targets) {
      const rendered = template.content
        .replace(/\{name\}/g, target.name || "Customer")
        .replace(/\{shop_name\}/g, target.shop_name || "PhoneZone")
        .replace(/\{phone\}/g, target.phone);

      db.prepare(
        `INSERT INTO wa_queue (id, campaign_id, customer_id, customer_phone, customer_name, message, status)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      ).run(
        newId(),
        campaignId,
        target.id,
        target.phone,
        target.name || "Customer",
        rendered,
        dry_run ? "sent" : "pending"
      );
    }

    return {
      id: campaignId,
      name,
      total_count: targets.length,
      dry_run: !!dry_run,
    };
  });
}

export function listAllContacts({ search } = {}) {
  const db = getDb();
  const contacts = [];
  const seen = new Set();

  try {
    // 1. Customers
    const customers = db.prepare("SELECT id, name, phone, address FROM customers WHERE deleted_at IS NULL").all();
    for (const c of customers) {
      const p = String(c.phone || "").replace(/\D/g, "");
      if (p.length >= 10 && !seen.has(p)) {
        seen.add(p);
        contacts.push({ id: c.id, name: c.name || "Customer", phone: p, address: c.address || "", type: "customer" });
      }
    }
  } catch (_e) {}

  try {
    // 2. Sellers
    const sellers = db.prepare("SELECT id, name, phone, address FROM sellers WHERE deleted_at IS NULL").all();
    for (const s of sellers) {
      const p = String(s.phone || "").replace(/\D/g, "");
      if (p.length >= 10 && !seen.has(p)) {
        seen.add(p);
        contacts.push({ id: s.id, name: s.name || "Seller", phone: p, address: s.address || "", type: "seller" });
      }
    }
  } catch (_e) {}

  try {
    // 3. Dealers
    const dealers = db.prepare("SELECT id, shop_name, proprietor_name, phone, address FROM dealers WHERE is_active = 1").all();
    for (const d of dealers) {
      const p = String(d.phone || "").replace(/\D/g, "");
      if (p.length >= 10 && !seen.has(p)) {
        seen.add(p);
        contacts.push({
          id: d.id,
          name: d.proprietor_name || d.shop_name,
          shop_name: d.shop_name,
          phone: p,
          address: d.address || "",
          type: "dealer",
        });
      }
    }
  } catch (_e) {}

  try {
    // 4. Repair Customers
    const repairs = db.prepare("SELECT id, name, phone, address FROM repair_customers WHERE deleted_at IS NULL").all();
    for (const r of repairs) {
      const p = String(r.phone || "").replace(/\D/g, "");
      if (p.length >= 10 && !seen.has(p)) {
        seen.add(p);
        contacts.push({ id: r.id, name: r.name || "Repair Client", phone: p, address: r.address || "", type: "repair_customer" });
      }
    }
  } catch (_e) {}

  let filtered = contacts;
  if (search && search.trim()) {
    const q = search.trim().toLowerCase();
    filtered = contacts.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.phone.includes(q) ||
        (c.shop_name && c.shop_name.toLowerCase().includes(q))
    );
  }

  const counts = {
    all: contacts.length,
    customers: contacts.filter((c) => c.type === "customer").length,
    sellers: contacts.filter((c) => c.type === "seller").length,
    dealers: contacts.filter((c) => c.type === "dealer").length,
    repair_customers: contacts.filter((c) => c.type === "repair_customer").length,
  };

  return { contacts: filtered, counts };
}

export function listCampaigns() {
  const db = getDb();
  return db.prepare("SELECT * FROM wa_campaigns ORDER BY created_at DESC").all();
}

export function getCampaignLogs(campaignId) {
  const db = getDb();
  return db.prepare(`
    SELECT id, campaign_id, customer_name, customer_phone, message, status, scheduled_at, sent_at, error
    FROM wa_queue
    WHERE campaign_id = ?
    ORDER BY created_at ASC
  `).all(campaignId);
}

export function createTemplate({ name, content, category = "general" }) {
  if (!name || !content) throw badRequest("Template name and content are required.");
  const db = getDb();
  const id = newId();
  db.prepare(
    "INSERT INTO wa_templates (id, name, content, category) VALUES (?, ?, ?, ?)"
  ).run(id, name, content, category);
  return { id, name, content, category };
}

export function listTemplates() {
  const db = getDb();
  return db.prepare("SELECT * FROM wa_templates ORDER BY created_at DESC").all();
}

export function getQueueStatus() {
  const db = getDb();
  const pending = db.prepare("SELECT COUNT(*) AS count FROM wa_queue WHERE status = 'pending'").get()?.count || 0;
  const sent = db.prepare("SELECT COUNT(*) AS count FROM wa_queue WHERE status = 'sent'").get()?.count || 0;
  const failed = db.prepare("SELECT COUNT(*) AS count FROM wa_queue WHERE status = 'failed'").get()?.count || 0;
  return { pending, sent, failed };
}

