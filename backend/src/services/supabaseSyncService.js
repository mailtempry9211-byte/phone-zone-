/**
 * Two-way Cloud Persistence & Synchronization Service (SQLite <-> Supabase)
 *
 * Ensures that all shop settings, user accounts, phones, invoices, customers,
 * sellers, and repairs survive across Render container deploys and restarts.
 */
import { getDb } from "../db/index.js";
import { logger } from "../lib/logger.js";

export function getSupabaseConfig() {
  let url = (process.env.SUPABASE_URL || "").trim().replace(/\/+$/, "");
  let key = (
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    process.env.SUPABASE_PUBLISHABLE_KEY ||
    ""
  ).trim();

  // If not found in process.env, check admin_settings in DB
  if (!url || !key) {
    try {
      const db = getDb();
      const s = db.prepare("SELECT supabase_url, supabase_anon_key FROM admin_settings LIMIT 1").get();
      if (s) {
        if (!url && s.supabase_url) url = s.supabase_url.trim().replace(/\/+$/, "");
        if (!key && s.supabase_anon_key) key = s.supabase_anon_key.trim();
      }
    } catch {}
  }

  if (!url) {
    url = "https://rkhzhozrslrfsqlpgjav.supabase.co";
  }

  return { url, key, isConfigured: !!(url && key) };
}

export function supabaseHeaders(key) {
  return {
    "apikey": key,
    "Authorization": `Bearer ${key}`,
    "Content-Type": "application/json",
    "Prefer": "resolution=merge-duplicates,return=minimal",
  };
}

/** Valid columns in Supabase / Postgres schema */
const SUPABASE_COLUMNS = {
  admin_settings: [
    "id", "business_name", "business_tagline", "owner_name", "address",
    "phone_primary", "phone_secondary", "email", "instagram", "whatsapp_number",
    "google_business_url", "udyam_number", "logo_url", "signature_url",
    "terms_and_conditions", "terms_and_conditions_sale", "terms_and_conditions_purchase",
    "invoice_prefix_purchase", "invoice_prefix_sale", "invoice_prefix_return",
    "currency_code", "bank_name", "account_holder_name", "account_number", "ifsc_code",
    "ai_provider", "ai_model", "ai_api_key", "ai_custom_url", "ai_voice_enabled", "ai_auto_speak", "ocr_engine",
    "setup_completed", "updated_at"
  ],
  sellers: [
    "id", "name", "phone", "address", "id_proof_type", "id_number",
    "seller_photo_url", "aadhaar_photo_url", "bank_account_number",
    "bank_ifsc", "bank_name", "account_holder_name", "is_verified",
    "created_at", "updated_at"
  ],
  customers: [
    "id", "name", "phone", "address", "id_proof_type", "id_number",
    "customer_photo_url", "created_at", "updated_at"
  ],
  dealers: [
    "id", "business_name", "contact_person", "phone", "email", "address",
    "city", "state", "pincode", "gst_number", "pan_number", "photo_url",
    "signature_url", "notes", "is_active", "created_at", "updated_at"
  ],
  dealer_batches: [
    "id", "dealer_id", "invoice_number", "purchase_date", "total_phones",
    "total_amount", "payment_method", "payment_status", "notes", "created_at"
  ],
  phones: [
    "id", "phone_name", "model", "imei_number", "condition", "purchase_price",
    "selling_price", "purchase_date", "rating", "bill_available", "box_available",
    "charger_available", "features", "product_photos", "payment_proof_photos",
    "payment_method", "seller_id", "customer_id", "dealer_id", "is_dealer",
    "batch_purchase_id", "is_sold", "sold_date", "financial_year", "color",
    "storage", "notes", "created_at", "updated_at"
  ],
  repair_customers: [
    "id", "name", "phone", "address", "id_proof_type", "id_number",
    "created_at", "updated_at"
  ],
  repair_jobs: [
    "id", "job_no", "customer_name", "customer_phone", "customer_address",
    "device_brand", "device_model", "imei", "problem", "estimate",
    "advance_paid", "parts_cost", "labour_cost", "final_price",
    "status", "payment_status", "warranty_days", "received_at",
    "delivered_at", "notes", "technician_notes", "financial_year",
    "created_at", "updated_at"
  ],
  repair_job_items: [
    "id", "job_id", "kind", "description", "qty", "unit_price", "total_price", "created_at"
  ],
  returns: [
    "id", "phone_id", "return_date", "reason", "refund_amount", "processed_by", "created_at"
  ],
  user_roles: [
    "id", "user_id", "role"
  ]
};

/**
 * Format SQLite row into clean Postgres/Supabase schema format
 */
export function sanitizeRowForSupabase(table, rawRow) {
  if (!rawRow || typeof rawRow !== "object") return null;
  const allowed = SUPABASE_COLUMNS[table];
  const out = {};

  const isUuid = (val) => typeof val === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val);

  const source = { ...rawRow };
  if (table === "phones") {
    // Map phone_name <-> brand if needed
    if (!source.phone_name && source.brand) source.phone_name = source.brand;
    if (source.colour && !source.color) source.color = source.colour;
    if (source.variant && !source.storage) source.storage = source.variant;

    // Normalize ENUM condition for Postgres
    const validConditions = ["excellent", "good", "fair", "poor"];
    const rawCond = (source.condition || "").toLowerCase().trim();
    if (validConditions.includes(rawCond)) {
      source.condition = rawCond;
    } else if (rawCond.includes("excel") || rawCond.includes("new")) {
      source.condition = "excellent";
    } else if (rawCond.includes("fair") || rawCond.includes("avg")) {
      source.condition = "fair";
    } else if (rawCond.includes("poor") || rawCond.includes("bad")) {
      source.condition = "poor";
    } else {
      source.condition = "good";
    }

    // Normalize ENUM payment_method for Postgres
    const validPayments = ["cash", "upi", "bank_transfer", "card"];
    const rawPay = (source.payment_method || "").toLowerCase().trim();
    if (validPayments.includes(rawPay)) {
      source.payment_method = rawPay;
    } else if (rawPay.includes("upi") || rawPay.includes("gpay") || rawPay.includes("paytm") || rawPay.includes("phonepe")) {
      source.payment_method = "upi";
    } else if (rawPay.includes("bank") || rawPay.includes("neft") || rawPay.includes("rtgs") || rawPay.includes("imps")) {
      source.payment_method = "bank_transfer";
    } else if (rawPay.includes("card")) {
      source.payment_method = "card";
    } else {
      source.payment_method = "cash";
    }

    // Foreign Key & UUID Guards: Ensure IDs are valid UUIDs and exist in local DB
    if (source.dealer_id && !isUuid(source.dealer_id)) source.dealer_id = null;
    if (source.batch_purchase_id && !isUuid(source.batch_purchase_id)) source.batch_purchase_id = null;
    if (source.seller_id && !isUuid(source.seller_id)) source.seller_id = null;
    if (source.customer_id && !isUuid(source.customer_id)) source.customer_id = null;

    try {
      const db = getDb();
      if (source.dealer_id) {
        const dealerExists = db.prepare("SELECT 1 FROM dealers WHERE id = ?").get(source.dealer_id);
        if (!dealerExists) source.dealer_id = null;
      }
      if (source.batch_purchase_id) {
        const batchExists = db.prepare("SELECT 1 FROM dealer_batches WHERE id = ?").get(source.batch_purchase_id);
        if (!batchExists) source.batch_purchase_id = null;
      }
      if (source.seller_id) {
        const sellerExists = db.prepare("SELECT 1 FROM sellers WHERE id = ?").get(source.seller_id);
        if (!sellerExists) source.seller_id = null;
      }
      if (source.customer_id) {
        const custExists = db.prepare("SELECT 1 FROM customers WHERE id = ?").get(source.customer_id);
        if (!custExists) source.customer_id = null;
      }
    } catch {}
  }
  if (table === "dealers") {
    if (source.gstin && !source.gst_number) source.gst_number = source.gstin;
  }
  if (table === "dealer_batches") {
    if (source.dealer_id && !isUuid(source.dealer_id)) source.dealer_id = null;
    if (source.batch_number && !source.invoice_number) source.invoice_number = source.batch_number;
    if (source.batch_date && !source.purchase_date) source.purchase_date = source.batch_date;
  }
  if (table === "returns") {
    if (source.phone_id && !isUuid(source.phone_id)) source.phone_id = null;
  }
  if (table === "repair_job_items") {
    if (source.job_id && !isUuid(source.job_id)) source.job_id = null;
  }
  if (table === "repair_jobs") {
    if (!source.customer_name && source.repair_customer_id) {
      try {
        const db = getDb();
        const cust = db.prepare("SELECT name, phone, address FROM repair_customers WHERE id = ?").get(source.repair_customer_id);
        if (cust) {
          source.customer_name = cust.name;
          source.customer_phone = cust.phone;
          source.customer_address = cust.address;
        }
      } catch {}
    }
    if (!source.customer_name) source.customer_name = "Customer";
    if (!source.customer_phone) source.customer_phone = "0000000000";
    if (!source.problem) source.problem = source.issue_description || "Repair";
    if (source.problem_description && !source.problem) source.problem = source.problem_description;
    if (source.total_cost && !source.final_price) source.final_price = Number(source.total_cost) || 0;
  }

  const parseArray = (val) => {
    if (Array.isArray(val)) return val;
    if (typeof val === "string" && val.trim().startsWith("[")) {
      try { return JSON.parse(val); } catch { return []; }
    }
    if (typeof val === "string" && val.trim()) return [val.trim()];
    return [];
  };

  const parseBool = (val) => {
    if (typeof val === "boolean") return val;
    return val === 1 || val === "1" || val === "true";
  };

  for (const key of Object.keys(source)) {
    if (allowed && !allowed.includes(key)) continue;
    let v = source[key];

    // Array columns
    if (["product_photos", "payment_proof_photos", "features"].includes(key)) {
      v = parseArray(v);
    }
    // Boolean columns
    else if (["is_sold", "bill_available", "box_available", "charger_available"].includes(key)) {
      v = parseBool(v);
    }
    // Dates
    else if (["purchase_date", "sold_date", "received_at", "delivered_at", "created_at", "updated_at"].includes(key)) {
      if (v === "" || v === undefined) v = null;
    }
    // Numeric
    else if (["purchase_price", "selling_price", "rating", "estimated_cost", "final_cost", "refund_amount"].includes(key)) {
      if (v !== null && v !== undefined && v !== "") v = Number(v) || 0;
    }

    out[key] = v;
  }

  return out;
}

let _syncDebounceTimer = null;

/**
 * Debounced background sync trigger: schedules a complete consistency pass
 * to reconcile SQLite and Supabase 3 seconds after any write action.
 */
export function triggerBackgroundSync(debounceMs = 3000) {
  const { isConfigured } = getSupabaseConfig();
  if (!isConfigured) return;

  if (_syncDebounceTimer) clearTimeout(_syncDebounceTimer);
  _syncDebounceTimer = setTimeout(() => {
    pushAllToSupabase().catch((err) => {
      logger.warn("[SupabaseSync] Auto background push error: " + err.message);
    });
  }, debounceMs);
}

/**
 * Push a single row to Supabase REST API in real time
 */
export async function pushSingleRowToSupabase(table, rawRow) {
  const { url, key, isConfigured } = getSupabaseConfig();
  if (!isConfigured || !table || !rawRow) return;

  const payload = sanitizeRowForSupabase(table, rawRow);
  if (!payload || !payload.id) return;

  try {
    const res = await fetch(`${url}/rest/v1/${table}`, {
      method: "POST",
      headers: supabaseHeaders(key),
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const errTxt = await res.text().catch(() => "");
      logger.warn(`[SupabaseSync] Push single row failed (${table}):`, errTxt.slice(0, 150));
    }
  } catch (err) {
    logger.warn(`[SupabaseSync] Push single row network error (${table}):`, err.message);
  }
}

/**
 * Delete a row from Supabase REST API
 */
export async function deleteRowFromSupabase(table, id) {
  const { url, key, isConfigured } = getSupabaseConfig();
  if (!isConfigured || !table || !id) return;

  try {
    await fetch(`${url}/rest/v1/${table}?id=eq.${encodeURIComponent(id)}`, {
      method: "DELETE",
      headers: supabaseHeaders(key),
    });
  } catch (err) {
    logger.warn(`[SupabaseSync] Delete row network error (${table}):`, err.message);
  }
}

/**
 * Push a batch of rows to Supabase
 */
export async function pushBatchToSupabase(table, rows) {
  const { url, key, isConfigured } = getSupabaseConfig();
  if (!isConfigured || !rows || rows.length === 0) return { ok: false, count: 0 };

  const chunkSize = 50;
  let totalUploaded = 0;

  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, i + chunkSize)
      .map((r) => sanitizeRowForSupabase(table, r))
      .filter(Boolean);

    if (chunk.length === 0) continue;

    try {
      const res = await fetch(`${url}/rest/v1/${table}`, {
        method: "POST",
        headers: supabaseHeaders(key),
        body: JSON.stringify(chunk),
      });

      if (res.ok) {
        totalUploaded += chunk.length;
      } else {
        const errTxt = await res.text().catch(() => "");
        logger.warn(`[SupabaseSync] Batch chunk upload warning for ${table}: ${errTxt.slice(0, 150)}. Retrying item-by-item...`);
        // Fallback: push item by item so 1 bad row doesn't kill the whole batch!
        for (const item of chunk) {
          try {
            const singleRes = await fetch(`${url}/rest/v1/${table}`, {
              method: "POST",
              headers: supabaseHeaders(key),
              body: JSON.stringify(item),
            });
            if (singleRes.ok) {
              totalUploaded++;
            } else {
              const singleErr = await singleRes.text().catch(() => "");
              logger.warn(`[SupabaseSync] Single item push rejected (${table} ${item.id}): ${singleErr.slice(0, 120)}`);
            }
          } catch {}
        }
      }
    } catch (e) {
      logger.warn(`[SupabaseSync] Batch network error for ${table}:`, e.message);
    }
  }

  return { ok: true, count: totalUploaded };
}

/**
 * Comprehensive Two-Way Push: Pushes all local SQLite tables to Supabase Cloud
 */
export async function pushAllToSupabase() {
  const { url, key, isConfigured } = getSupabaseConfig();
  if (!isConfigured) return { ok: false, reason: "not_configured" };

  const db = getDb();
  const results = {};

  try {
    logger.info("[SupabaseSync] Starting Full Push to Supabase Cloud...");

    // 1. admin_settings
    try {
      const settings = db.prepare("SELECT * FROM admin_settings LIMIT 1").get();
      if (settings) {
        await pushSettingsToSupabase(settings);
        results.admin_settings = 1;
      }
    } catch (e) { logger.warn("[SupabaseSync] settings sync:", e.message); }

    // 2. sellers
    try {
      const sellers = db.prepare("SELECT * FROM sellers WHERE deleted_at IS NULL").all();
      if (sellers.length > 0) {
        const r = await pushBatchToSupabase("sellers", sellers);
        results.sellers = r.count;
      }
    } catch (e) { logger.warn("[SupabaseSync] sellers sync:", e.message); }

    // 3. customers
    try {
      const customers = db.prepare("SELECT * FROM customers WHERE deleted_at IS NULL").all();
      if (customers.length > 0) {
        const r = await pushBatchToSupabase("customers", customers);
        results.customers = r.count;
      }
    } catch (e) { logger.warn("[SupabaseSync] customers sync:", e.message); }

    // 4. dealers
    try {
      const dealers = db.prepare("SELECT * FROM dealers").all();
      if (dealers.length > 0) {
        const r = await pushBatchToSupabase("dealers", dealers);
        results.dealers = r.count;
      }
    } catch {}

    // 5. dealer_batches
    try {
      const batches = db.prepare("SELECT * FROM dealer_batches").all();
      if (batches.length > 0) {
        const r = await pushBatchToSupabase("dealer_batches", batches);
        results.dealer_batches = r.count;
      }
    } catch {}

    // 6. phones (inventory & sold)
    try {
      const phones = db.prepare("SELECT * FROM phones").all();
      if (phones.length > 0) {
        const r = await pushBatchToSupabase("phones", phones);
        results.phones = r.count;
      }
    } catch (e) { logger.warn("[SupabaseSync] phones sync:", e.message); }

    // 7. repair_customers
    try {
      const repCust = db.prepare("SELECT * FROM repair_customers").all();
      if (repCust.length > 0) {
        const r = await pushBatchToSupabase("repair_customers", repCust);
        results.repair_customers = r.count;
      }
    } catch {}

    // 8. repair_jobs
    try {
      const repJobs = db.prepare("SELECT * FROM repair_jobs").all();
      if (repJobs.length > 0) {
        const r = await pushBatchToSupabase("repair_jobs", repJobs);
        results.repair_jobs = r.count;
      }
    } catch {}

    // 9. repair_job_items
    try {
      const repItems = db.prepare("SELECT * FROM repair_job_items").all();
      if (repItems.length > 0) {
        const r = await pushBatchToSupabase("repair_job_items", repItems);
        results.repair_job_items = r.count;
      }
    } catch {}

    // 10. returns
    try {
      const rets = db.prepare("SELECT * FROM returns").all();
      if (rets.length > 0) {
        const r = await pushBatchToSupabase("returns", rets);
        results.returns = r.count;
      }
    } catch {}

    // 11. user_roles
    try {
      const roles = db.prepare("SELECT * FROM user_roles").all();
      if (roles.length > 0) {
        const r = await pushBatchToSupabase("user_roles", roles);
        results.user_roles = r.count;
      }
    } catch {}

    logger.info("[SupabaseSync] Full Push to Supabase Cloud Complete:", results);
    return { ok: true, synced: results };
  } catch (err) {
    logger.error("[SupabaseSync] Full push critical error:", err);
    return { ok: false, error: err.message };
  }
}

/**
 * On Server Boot / Deploy:
 * Pull persistent shop settings, users, and tables from Supabase into local SQLite.
 */
export async function syncFromSupabaseOnBoot() {
  const { url, key, isConfigured } = getSupabaseConfig();
  if (!isConfigured) return { ok: false, reason: "not_configured" };

  const db = getDb();
  db.pragma("foreign_keys = OFF");
  const counts = {
    settings: false,
    users: 0,
    roles: 0,
    sellers: 0,
    customers: 0,
    dealers: 0,
    dealer_batches: 0,
    phones: 0,
    repair_customers: 0,
    repair_jobs: 0,
    repair_job_items: 0,
    returns: 0,
  };

  try {
    // 1. Sync admin_settings
    const settingsRes = await fetch(`${url}/rest/v1/admin_settings?select=*&limit=10`, {
      headers: { apikey: key, Authorization: `Bearer ${key}` },
      signal: AbortSignal.timeout(5000),
    });

    if (settingsRes.ok) {
      const rows = await settingsRes.json().catch(() => []);
      if (Array.isArray(rows) && rows.length > 0) {
        // Pick the row with actual setup or custom business name
        const s = rows.find(r => r.business_name && r.business_name.trim() !== "" && r.business_name !== "PhoneZone") || rows[0];
        if (s && (s.business_name || s.setup_completed)) {
          const existingLocal = db.prepare("SELECT id FROM admin_settings LIMIT 1").get();
          if (existingLocal) {
            db.prepare(`
              UPDATE admin_settings SET
                business_name = COALESCE(?, business_name),
                business_tagline = COALESCE(?, business_tagline),
                owner_name = COALESCE(?, owner_name),
                address = COALESCE(?, address),
                phone_primary = COALESCE(?, phone_primary),
                phone_secondary = COALESCE(?, phone_secondary),
                email = COALESCE(?, email),
                instagram = COALESCE(?, instagram),
                whatsapp_number = COALESCE(?, whatsapp_number),
                google_business_url = COALESCE(?, google_business_url),
                udyam_number = COALESCE(?, udyam_number),
                logo_url = COALESCE(?, logo_url),
                signature_url = COALESCE(?, signature_url),
                terms_and_conditions = COALESCE(?, terms_and_conditions),
                terms_and_conditions_sale = COALESCE(?, terms_and_conditions_sale),
                terms_and_conditions_purchase = COALESCE(?, terms_and_conditions_purchase),
                invoice_prefix_purchase = COALESCE(?, invoice_prefix_purchase),
                invoice_prefix_sale = COALESCE(?, invoice_prefix_sale),
                invoice_prefix_return = COALESCE(?, invoice_prefix_return),
                currency_code = COALESCE(?, currency_code),
                bank_name = COALESCE(?, bank_name),
                account_holder_name = COALESCE(?, account_holder_name),
                account_number = COALESCE(?, account_number),
                ifsc_code = COALESCE(?, ifsc_code),
                ai_provider = COALESCE(?, ai_provider),
                ai_model = COALESCE(?, ai_model),
                ai_api_key = COALESCE(?, ai_api_key),
                ocr_engine = COALESCE(?, ocr_engine),
                setup_completed = 1
              WHERE id = ?
            `).run(
              s.business_name || null,
              s.business_tagline || null,
              s.owner_name || null,
              s.address || null,
              s.phone_primary || null,
              s.phone_secondary || null,
              s.email || null,
              s.instagram || null,
              s.whatsapp_number || null,
              s.google_business_url || null,
              s.udyam_number || null,
              s.logo_url || null,
              s.signature_url || null,
              s.terms_and_conditions || null,
              s.terms_and_conditions_sale || null,
              s.terms_and_conditions_purchase || null,
              s.invoice_prefix_purchase || null,
              s.invoice_prefix_sale || null,
              s.invoice_prefix_return || null,
              s.currency_code || null,
              s.bank_name || null,
              s.account_holder_name || null,
              s.account_number || null,
              s.ifsc_code || null,
              s.ai_provider || null,
              s.ai_model || null,
              s.ai_api_key || null,
              s.ocr_engine || null,
              existingLocal.id
            );
          } else {
            db.prepare(`
              INSERT INTO admin_settings (
                id, business_name, business_tagline, owner_name, address, phone_primary, phone_secondary,
                email, instagram, whatsapp_number, google_business_url, udyam_number, logo_url, signature_url,
                terms_and_conditions, terms_and_conditions_sale, terms_and_conditions_purchase,
                invoice_prefix_purchase, invoice_prefix_sale, invoice_prefix_return, currency_code,
                bank_name, account_holder_name, account_number, ifsc_code, ai_provider, ai_model, ai_api_key, ocr_engine, setup_completed
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
            `).run(
              s.id || "00000000-0000-0000-0000-000000000001",
              s.business_name || "PhoneZone",
              s.business_tagline || "",
              s.owner_name || "",
              s.address || "",
              s.phone_primary || "",
              s.phone_secondary || "",
              s.email || "",
              s.instagram || "",
              s.whatsapp_number || "",
              s.google_business_url || "",
              s.udyam_number || "",
              s.logo_url || null,
              s.signature_url || null,
              s.terms_and_conditions || "",
              s.terms_and_conditions_sale || "",
              s.terms_and_conditions_purchase || "",
              s.invoice_prefix_purchase || "PUR",
              s.invoice_prefix_sale || "SAL",
              s.invoice_prefix_return || "RET",
              s.currency_code || "INR",
              s.bank_name || "",
              s.account_holder_name || "",
              s.account_number || "",
              s.ifsc_code || "",
              s.ai_provider || "gemini",
              s.ai_model || "gemini-2.5-flash-lite",
              s.ai_api_key || "",
              s.ocr_engine || "auto"
            );
          }
          counts.settings = true;
          logger.info("[SupabaseSync] Restored admin_settings from Supabase: " + (s.business_name || "Configured"));
        }
      }
    }

    // 2. Sync users & credentials
    const usersRes = await fetch(`${url}/rest/v1/users?select=*`, {
      headers: { apikey: key, Authorization: `Bearer ${key}` },
    });
    if (usersRes.ok) {
      const users = await usersRes.json().catch(() => []);
      for (const u of users) {
        if (!u.id || !u.email) continue;
        try {
          db.prepare(`
            INSERT INTO users (id, email, password_hash, display_name, is_active, shop_id, active_shop_id, security_question, security_answer_hash)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET
              email = excluded.email,
              password_hash = excluded.password_hash,
              display_name = excluded.display_name,
              is_active = excluded.is_active
          `).run(
            u.id,
            u.email,
            u.password_hash || u.encrypted_password || "synced_user",
            u.display_name || u.email,
            u.is_active === false ? 0 : 1,
            u.shop_id || "all",
            u.active_shop_id || "all",
            u.security_question || null,
            u.security_answer_hash || null
          );
        } catch {}
      }
    }

    // 3. Sync user_roles
    const rolesRes = await fetch(`${url}/rest/v1/user_roles?select=*`, {
      headers: { apikey: key, Authorization: `Bearer ${key}` },
    });
    if (rolesRes.ok) {
      const roles = await rolesRes.json().catch(() => []);
      for (const r of roles) {
        if (!r.user_id || !r.role) continue;
        try {
          db.prepare(`
            INSERT OR IGNORE INTO user_roles (id, user_id, role)
            VALUES (?, ?, ?)
          `).run(r.id || crypto.randomUUID(), r.user_id, r.role);
        } catch {}
      }
    }

    // 4. Sync sellers
    const sellersRes = await fetch(`${url}/rest/v1/sellers?select=*`, {
      headers: { apikey: key, Authorization: `Bearer ${key}` },
    });
    if (sellersRes.ok) {
      const sellers = await sellersRes.json().catch(() => []);
      for (const s of sellers) {
        try {
          db.prepare(`
            INSERT INTO sellers (id, name, phone, address, id_proof_type, id_number, seller_photo_url, aadhaar_photo_url)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET
              name = excluded.name,
              phone = excluded.phone,
              address = excluded.address
          `).run(s.id, s.name, s.phone, s.address || "", s.id_proof_type || "aadhaar", s.id_number || "", s.seller_photo_url || null, s.aadhaar_photo_url || null);
          counts.sellers++;
        } catch (err) {
          logger.warn("[SupabaseSync] seller sync item error: " + err.message);
        }
      }
    }

    // 5. Sync customers
    const custRes = await fetch(`${url}/rest/v1/customers?select=*`, {
      headers: { apikey: key, Authorization: `Bearer ${key}` },
    });
    if (custRes.ok) {
      const custs = await custRes.json().catch(() => []);
      for (const c of custs) {
        try {
          db.prepare(`
            INSERT INTO customers (id, name, phone, address, id_proof_type, id_number)
            VALUES (?, ?, ?, ?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET
              name = excluded.name,
              phone = excluded.phone,
              address = excluded.address
          `).run(c.id, c.name, c.phone, c.address || "", c.id_proof_type || "aadhaar", c.id_number || "");
          counts.customers++;
        } catch (err) {
          logger.warn("[SupabaseSync] customer sync item error: " + err.message);
        }
      }
    }

    // 6. Sync dealers
    try {
      const dealersRes = await fetch(`${url}/rest/v1/dealers?select=*`, {
        headers: { apikey: key, Authorization: `Bearer ${key}` },
      });
      if (dealersRes.ok) {
        const dealers = await dealersRes.json().catch(() => []);
        for (const d of dealers) {
          try {
            db.prepare(`
              INSERT INTO dealers (id, shop_name, proprietor_name, phone, alternate_phone, email, address, city, state, pincode, gst_number, pan_number, photo_url, signature_url, notes, is_active, created_at, updated_at, balance)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
              ON CONFLICT(id) DO UPDATE SET
                shop_name = excluded.shop_name,
                proprietor_name = excluded.proprietor_name,
                phone = excluded.phone,
                email = excluded.email
            `).run(
              d.id,
              d.shop_name || d.business_name || "Dealer",
              d.proprietor_name || d.contact_person || null,
              d.phone || "",
              d.alternate_phone || null,
              d.email || null,
              d.address || "",
              d.city || "Sitapur",
              d.state || "Uttar Pradesh",
              d.pincode || "261001",
              d.gst_number || d.gstin || null,
              d.pan_number || null,
              d.photo_url || null,
              d.signature_url || null,
              d.notes || null,
              d.is_active === 0 ? 0 : 1,
              d.created_at || new Date().toISOString(),
              d.updated_at || new Date().toISOString(),
              Number(d.balance) || 0
            );
            counts.dealers++;
          } catch {}
        }
      }
    } catch {}

    // 7. Sync dealer_batches
    try {
      const batchesRes = await fetch(`${url}/rest/v1/dealer_batches?select=*`, {
        headers: { apikey: key, Authorization: `Bearer ${key}` },
      });
      if (batchesRes.ok) {
        const batches = await batchesRes.json().catch(() => []);
        for (const b of batches) {
          try {
            db.prepare(`
              INSERT INTO dealer_batches (id, dealer_id, invoice_number, purchase_date, total_phones, total_amount, payment_method, payment_status, notes, created_at)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
              ON CONFLICT(id) DO NOTHING
            `).run(
              b.id, b.dealer_id, b.invoice_number || b.batch_number || "BATCH-001",
              b.purchase_date || b.batch_date || new Date().toISOString().slice(0, 10),
              b.total_phones || 1, b.total_amount || 0, b.payment_method || "UPI",
              b.payment_status || "completed", b.notes || null, b.created_at || new Date().toISOString()
            );
            counts.dealer_batches++;
          } catch {}
        }
      }
    } catch {}

    // 8. Sync phones (complete inventory & sold records with photos)
    const phonesRes = await fetch(`${url}/rest/v1/phones?select=*`, {
      headers: { apikey: key, Authorization: `Bearer ${key}` },
    });
    if (phonesRes.ok) {
      const phones = await phonesRes.json().catch(() => []);
      for (const p of phones) {
        try {
          const productPhotos = Array.isArray(p.product_photos) ? JSON.stringify(p.product_photos) : (p.product_photos || "[]");
          const paymentPhotos = Array.isArray(p.payment_proof_photos) ? JSON.stringify(p.payment_proof_photos) : (p.payment_proof_photos || "[]");
          const features = Array.isArray(p.features) ? JSON.stringify(p.features) : (p.features || "[]");

          db.prepare(`
            INSERT INTO phones (
              id, phone_name, model, imei_number, condition, purchase_price, selling_price,
              purchase_date, rating, bill_available, box_available, charger_available,
              features, product_photos, payment_proof_photos, payment_method, seller_id, customer_id,
              dealer_id, is_dealer, batch_purchase_id, is_sold, sold_date, financial_year, colour, variant,
              created_at, updated_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET
              is_sold = excluded.is_sold,
              sold_date = excluded.sold_date,
              selling_price = excluded.selling_price,
              customer_id = excluded.customer_id,
              product_photos = excluded.product_photos
          `).run(
            p.id,
            p.phone_name || p.brand || "",
            p.model || "",
            p.imei_number || "",
            p.condition || "good",
            Number(p.purchase_price) || 0,
            Number(p.selling_price) || 0,
            p.purchase_date || new Date().toISOString().slice(0, 10),
            Number(p.rating) || 5.0,
            p.bill_available ? 1 : 0,
            p.box_available ? 1 : 0,
            p.charger_available ? 1 : 0,
            features,
            productPhotos,
            paymentPhotos,
            p.payment_method || "cash",
            p.seller_id || null,
            p.customer_id || null,
            p.dealer_id || null,
            p.is_dealer ? 1 : 0,
            p.batch_purchase_id || null,
            p.is_sold ? 1 : 0,
            p.sold_date || null,
            p.financial_year || null,
            p.colour || p.color || null,
            p.variant || p.storage || null,
            p.created_at || new Date().toISOString(),
            p.updated_at || new Date().toISOString()
          );
          counts.phones++;
        } catch {}
      }
    }

    // 9. Sync repair_customers
    try {
      const repCustRes = await fetch(`${url}/rest/v1/repair_customers?select=*`, {
        headers: { apikey: key, Authorization: `Bearer ${key}` },
      });
      if (repCustRes.ok) {
        const repCusts = await repCustRes.json().catch(() => []);
        for (const rc of repCusts) {
          try {
            db.prepare(`
              INSERT INTO repair_customers (id, name, phone, address, id_proof_type, id_number, created_at, updated_at)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?)
              ON CONFLICT(id) DO UPDATE SET name = excluded.name, phone = excluded.phone
            `).run(
              rc.id, rc.name, rc.phone, rc.address || "", rc.id_proof_type || "aadhaar",
              rc.id_number || "", rc.created_at || new Date().toISOString(), rc.updated_at || new Date().toISOString()
            );
            counts.repair_customers++;
          } catch {}
        }
      }
    } catch {}

    // 10. Sync repair_jobs
    try {
      const repJobsRes = await fetch(`${url}/rest/v1/repair_jobs?select=*`, {
        headers: { apikey: key, Authorization: `Bearer ${key}` },
      });
      if (repJobsRes.ok) {
        const jobs = await repJobsRes.json().catch(() => []);
        for (const j of jobs) {
          try {
            let customerId = j.repair_customer_id || null;
            if (!customerId && j.customer_phone) {
              const matchedCust = db.prepare("SELECT id FROM repair_customers WHERE phone = ?").get(j.customer_phone);
              if (matchedCust) customerId = matchedCust.id;
            }

            db.prepare(`
              INSERT INTO repair_jobs (
                id, job_no, shop_id, repair_customer_id, device_brand, device_model, imei, problem,
                estimate, advance_paid, parts_cost, labour_cost, final_price, status, payment_status,
                warranty_days, technician, received_at, delivered_at, notes, financial_year, created_at, updated_at
              )
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
              ON CONFLICT(id) DO UPDATE SET
                status = excluded.status,
                final_price = excluded.final_price,
                payment_status = excluded.payment_status
            `).run(
              j.id, j.job_no || "RJ-001", "shop_1", customerId,
              j.device_brand || "Device", j.device_model || "", j.imei || null,
              j.problem || j.issue_description || "Repair",
              Number(j.estimate) || 0, Number(j.advance_paid) || 0, Number(j.parts_cost) || 0,
              Number(j.labour_cost) || 0, Number(j.final_price) || 0, j.status || "delivered",
              j.payment_status || "paid", Number(j.warranty_days) || 7, j.technician || "Workshop",
              j.received_at || new Date().toISOString(), j.delivered_at || null, j.notes || null,
              j.financial_year || null, j.created_at || new Date().toISOString(), j.updated_at || new Date().toISOString()
            );
            counts.repair_jobs++;
          } catch {}
        }
      }
    } catch {}

    // 11. Sync repair_job_items
    try {
      const itemsRes = await fetch(`${url}/rest/v1/repair_job_items?select=*`, {
        headers: { apikey: key, Authorization: `Bearer ${key}` },
      });
      if (itemsRes.ok) {
        const items = await itemsRes.json().catch(() => []);
        for (const item of items) {
          try {
            db.prepare(`
              INSERT INTO repair_job_items (id, job_id, kind, description, qty, unit_price, total_price, created_at)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?)
              ON CONFLICT(id) DO NOTHING
            `).run(
              item.id, item.job_id, item.kind || "part", item.description || "Part",
              Number(item.qty) || 1, Number(item.unit_price) || 0, Number(item.total_price) || 0,
              item.created_at || new Date().toISOString()
            );
            counts.repair_job_items++;
          } catch {}
        }
      }
    } catch {}

    // 12. Sync returns
    try {
      const retsRes = await fetch(`${url}/rest/v1/returns?select=*`, {
        headers: { apikey: key, Authorization: `Bearer ${key}` },
      });
      if (retsRes.ok) {
        const rets = await retsRes.json().catch(() => []);
        for (const r of rets) {
          try {
            db.prepare(`
              INSERT INTO returns (id, phone_id, return_date, reason, refund_amount, processed_by, created_at)
              VALUES (?, ?, ?, ?, ?, ?, ?)
              ON CONFLICT(id) DO NOTHING
            `).run(
              r.id, r.phone_id, r.return_date || new Date().toISOString(),
              r.reason || "Return", Number(r.refund_amount) || 0, r.processed_by || null,
              r.created_at || new Date().toISOString()
            );
            counts.returns++;
          } catch {}
        }
      }
    } catch {}

    logger.info("[SupabaseSync] Auto-sync from Supabase completed successfully! Restored:", counts);
    return { ok: true, synced: true, counts };
  } catch (err) {
    logger.warn("[SupabaseSync] Boot sync error", err);
    return { ok: false, error: err.message, counts };
  } finally {
    try {
      db.pragma("foreign_keys = ON");
    } catch {}
  }
}

/**
 * Check if Supabase Cloud has an active business configured
 */
export async function checkSupabaseSetupStatus() {
  const { url, key, isConfigured } = getSupabaseConfig();
  if (!isConfigured) return { isConfigured: false, hasCloudSetup: false };

  try {
    const res = await fetch(`${url}/rest/v1/admin_settings?select=business_name,setup_completed,owner_name,phone_primary&limit=1`, {
      headers: { apikey: key, Authorization: `Bearer ${key}` }
    });
    if (res.ok) {
      const rows = await res.json().catch(() => []);
      if (Array.isArray(rows) && rows.length > 0) {
        const s = rows[0];
        if (s.setup_completed || (s.business_name && s.business_name.trim() !== "" && s.business_name.trim() !== "PhoneZone")) {
          return {
            isConfigured: true,
            hasCloudSetup: true,
            businessName: s.business_name,
            ownerName: s.owner_name,
            phonePrimary: s.phone_primary
          };
        }
      }
    }

    // Check if phones exist in Supabase
    const phonesRes = await fetch(`${url}/rest/v1/phones?select=id&limit=1`, {
      headers: { apikey: key, Authorization: `Bearer ${key}` }
    });
    if (phonesRes.ok) {
      const phones = await phonesRes.json().catch(() => []);
      if (Array.isArray(phones) && phones.length > 0) {
        return { isConfigured: true, hasCloudSetup: true, businessName: "Cloud Store" };
      }
    }
    return { isConfigured: true, hasCloudSetup: false };
  } catch (err) {
    return { isConfigured: true, hasCloudSetup: false, error: err.message };
  }
}

/**
 * Permanently wipe Supabase Cloud database tables and Storage buckets,
 * plus reset local SQLite, to cleanly free up all quota for a fresh store.
 * Supports selective entities: ['settings', 'phones', 'sellers', 'customers', 'dealers', 'repairs', 'returns'] or ['all'].
 */
export async function wipeSupabaseCloudData(entities = ["all"]) {
  const { url, key, isConfigured } = getSupabaseConfig();
  const db = getDb();

  let normalizedEntities = Array.isArray(entities) ? entities : [entities];
  if (typeof entities === "string") {
    try {
      const parsed = JSON.parse(entities);
      if (Array.isArray(parsed)) normalizedEntities = parsed;
      else normalizedEntities = [parsed];
    } catch {
      normalizedEntities = entities.split(",").map((s) => s.trim()).filter(Boolean);
    }
  }
  const isAll = !normalizedEntities || normalizedEntities.includes("all") || normalizedEntities.length === 0 || normalizedEntities.includes("*");

  logger.info("[SupabaseSync] Starting Cloud and Local Storage Wipe...", { isAll, entities: normalizedEntities });

  const entityTableMap = {
    settings: ["admin_settings"],
    phones: ["phones"],
    sellers: ["sellers"],
    customers: ["customers"],
    dealers: ["dealer_batches", "dealers"],
    repairs: ["repair_job_items", "repair_jobs", "repair_customers"],
    returns: ["returns"],
  };

  const entityBucketMap = {
    settings: ["branding", "signatures"],
    phones: ["phones", "product-photos"],
    sellers: ["sellers"],
    customers: ["customers"],
    dealers: ["dealers"],
    repairs: ["repairs"],
    returns: [],
  };

  let tablesToWipe = [];
  let bucketsToWipe = [];

  if (isAll) {
    tablesToWipe = [
      "repair_job_items",
      "repair_jobs",
      "repair_customers",
      "returns",
      "phones",
      "dealer_batches",
      "dealers",
      "customers",
      "sellers",
      "messages",
      "audit_logs",
      "user_roles",
      "admin_settings"
    ];
    bucketsToWipe = ["phones", "sellers", "customers", "invoices", "repairs", "documents", "signatures", "product-photos"];
  } else {
    for (const ent of normalizedEntities) {
      if (entityTableMap[ent]) tablesToWipe.push(...entityTableMap[ent]);
      if (entityBucketMap[ent]) bucketsToWipe.push(...entityBucketMap[ent]);
    }
  }

  if (isConfigured) {
    // Delete tables concurrently with 4s timeout so it never stalls
    const tablePromises = tablesToWipe.map((tbl) =>
      fetch(`${url}/rest/v1/${tbl}?id=not.is.null`, {
        method: "DELETE",
        headers: supabaseHeaders(key),
        signal: AbortSignal.timeout(4000),
      }).catch((e) => logger.warn(`[SupabaseSync] Wipe table ${tbl} warning:`, e.message))
    );
    await Promise.allSettled(tablePromises);

    // Wipe storage buckets concurrently with 4s timeout
    const bucketPromises = bucketsToWipe.map(async (b) => {
      try {
        const listRes = await fetch(`${url}/storage/v1/object/list/${b}`, {
          method: "POST",
          headers: supabaseHeaders(key),
          body: JSON.stringify({ prefix: "", limit: 1000 }),
          signal: AbortSignal.timeout(4000),
        });
        if (listRes.ok) {
          const files = await listRes.json().catch(() => []);
          if (Array.isArray(files) && files.length > 0) {
            const prefixes = files.map((f) => f.name).filter(Boolean);
            await fetch(`${url}/storage/v1/object/${b}`, {
              method: "DELETE",
              headers: supabaseHeaders(key),
              body: JSON.stringify({ prefixes }),
              signal: AbortSignal.timeout(4000),
            });
          }
        }
      } catch (e) {
        logger.warn(`[SupabaseSync] Wipe bucket ${b} warning:`, e.message);
      }
    });
    await Promise.allSettled(bucketPromises);
  }

  // Wipe local SQLite data
  const localTableMap = {
    settings: [],
    phones: ["phones"],
    sellers: ["sellers"],
    customers: ["customers"],
    dealers: ["dealer_batches", "dealers"],
    repairs: ["repair_job_items", "repair_jobs", "repair_customers"],
    returns: ["returns"],
  };

  let localTables = [];
  if (isAll) {
    localTables = [
      "repair_job_items", "repair_jobs", "repair_customers", "returns",
      "phones", "dealer_batches", "dealers", "customers", "sellers",
      "messages", "audit_logs", "sessions"
    ];
  } else {
    for (const ent of normalizedEntities) {
      if (localTableMap[ent]) localTables.push(...localTableMap[ent]);
    }
  }

  for (const t of localTables) {
    try { db.prepare(`DELETE FROM ${t}`).run(); } catch {}
  }

  if (isAll) {
    // Reset admin_settings
    try {
      db.prepare(`
        UPDATE admin_settings SET
          business_name = 'PhoneZone',
          business_tagline = 'Second Hand Mobile & Repair Hub',
          owner_name = '',
          address = '',
          phone_primary = '',
          phone_secondary = '',
          email = '',
          instagram = '',
          whatsapp_number = '',
          google_business_url = '',
          udyam_number = '',
          logo_url = '',
          signature_url = '',
          setup_completed = 0
        WHERE id = '00000000-0000-0000-0000-000000000001'
      `).run();
    } catch {}

    // Clean local storage files
    try {
      const fs = await import("node:fs");
      const pathMod = await import("node:path");
      const { PATHS } = await import("../config/paths.js");
      if (fs.existsSync(PATHS.storageDir)) {
        const entries = fs.readdirSync(PATHS.storageDir);
        for (const e of entries) {
          try { fs.rmSync(pathMod.join(PATHS.storageDir, e), { recursive: true, force: true }); } catch {}
        }
      }
    } catch {}
  }

  logger.info("[SupabaseSync] Cloud & Local Wipe finished successfully!", { isAll, entities: normalizedEntities });
  return { ok: true, wiped: true, entities: isAll ? ["all"] : normalizedEntities };
}

/**
 * Push business settings to Supabase
 */
export async function pushSettingsToSupabase(settingsRow) {
  const { url, key, isConfigured } = getSupabaseConfig();
  if (!isConfigured || !settingsRow) return;

  try {
    // If partial object passed, hydrate with full current settings from local DB
    let source = { ...settingsRow };
    try {
      const db = getDb();
      const current = db.prepare("SELECT * FROM admin_settings LIMIT 1").get();
      if (current) source = { ...current, ...source };
    } catch {}

    // Check if an existing row already exists in Supabase admin_settings
    let existingId = "00000000-0000-0000-0000-000000000001";
    let hasExisting = false;
    try {
      const checkRes = await fetch(`${url}/rest/v1/admin_settings?select=id&limit=1`, {
        headers: { apikey: key, Authorization: `Bearer ${key}` },
        signal: AbortSignal.timeout(4000),
      });
      if (checkRes.ok) {
        const rows = await checkRes.json().catch(() => []);
        if (Array.isArray(rows) && rows.length > 0 && rows[0].id) {
          existingId = rows[0].id;
          hasExisting = true;
        }
      }
    } catch {}

    const payload = sanitizeRowForSupabase("admin_settings", {
      id: existingId,
      business_name: source.business_name || source.businessName || "PhoneZone",
      business_tagline: source.business_tagline || source.businessTagline || "",
      owner_name: source.owner_name || source.ownerName || "",
      address: source.address || "",
      phone_primary: source.phone_primary || source.primaryPhone || "",
      phone_secondary: source.phone_secondary || source.secondaryPhone || "",
      email: source.email || "",
      instagram: source.instagram || "",
      whatsapp_number: source.whatsapp_number || source.whatsappNumber || source.phone_primary || "",
      google_business_url: source.google_business_url || source.googleBusinessUrl || "",
      udyam_number: source.udyam_number || source.udyamNumber || "",
      logo_url: source.logo_url || source.logoUrl || null,
      signature_url: source.signature_url || source.signatureUrl || null,
      terms_and_conditions: source.terms_and_conditions || source.termsAndConditions || "",
      terms_and_conditions_sale: source.terms_and_conditions_sale || source.termsAndConditionsSale || "",
      terms_and_conditions_purchase: source.terms_and_conditions_purchase || source.termsAndConditionsPurchase || "",
      invoice_prefix_purchase: source.invoice_prefix_purchase || "PUR",
      invoice_prefix_sale: source.invoice_prefix_sale || "SAL",
      invoice_prefix_return: source.invoice_prefix_return || "RET",
      currency_code: source.currency_code || "INR",
      bank_name: source.bank_name || source.bankName || "",
      account_holder_name: source.account_holder_name || source.accountHolderName || "",
      account_number: source.account_number || source.accountNumber || "",
      ifsc_code: source.ifsc_code || source.ifscCode || "",
      ai_provider: source.ai_provider || source.aiProvider || "gemini",
      ai_model: source.ai_model || source.aiModel || "gemini-2.5-flash-lite",
      ai_api_key: source.ai_api_key || source.aiApiKey || "",
      ai_custom_url: source.ai_custom_url || source.aiCustomUrl || "",
      ai_voice_enabled: source.ai_voice_enabled !== undefined ? source.ai_voice_enabled : 1,
      ai_auto_speak: source.ai_auto_speak !== undefined ? source.ai_auto_speak : 0,
      ocr_engine: source.ocr_engine || source.ocrEngine || "auto",
      setup_completed: 1,
    });

    const endpoint = hasExisting
      ? `${url}/rest/v1/admin_settings?id=eq.${encodeURIComponent(existingId)}`
      : `${url}/rest/v1/admin_settings`;
    const method = hasExisting ? "PATCH" : "POST";

    let currentPayload = { ...payload };
    for (let attempt = 0; attempt < 5; attempt++) {
      const res = await fetch(endpoint, {
        method,
        headers: supabaseHeaders(key),
        body: JSON.stringify(currentPayload),
        signal: AbortSignal.timeout(5000),
      });

      if (res.ok) {
        logger.info("[SupabaseSync] Pushed admin_settings to Supabase successfully!");
        break;
      }

      const errTxt = await res.text().catch(() => "");
      const match = errTxt.match(/Could not find the '([^']+)' column/i);
      if (match && match[1] && currentPayload[match[1]] !== undefined) {
        logger.warn(`[SupabaseSync] Column '${match[1]}' not in Supabase schema. Stripping and retrying...`);
        delete currentPayload[match[1]];
        continue;
      }
      logger.warn("[SupabaseSync] Failed to push admin_settings to Supabase", errTxt);
      break;
    }
  } catch (err) {
    logger.warn("[SupabaseSync] pushSettingsToSupabase error", err.message);
  }
}

/**
 * Push user account to Supabase
 */
export async function pushUserToSupabase(user, role = "admin") {
  const { url, key, isConfigured } = getSupabaseConfig();
  if (!isConfigured || !user) return;

  try {
    const userPayload = {
      id: user.id,
      email: user.email,
      password_hash: user.password_hash,
      display_name: user.display_name,
      is_active: user.is_active !== undefined ? user.is_active : 1,
      security_question: user.security_question || null,
      security_answer_hash: user.security_answer_hash || null,
    };

    await fetch(`${url}/rest/v1/users`, {
      method: "POST",
      headers: supabaseHeaders(key),
      body: JSON.stringify(userPayload),
    });

    const rolePayload = {
      id: crypto.randomUUID(),
      user_id: user.id,
      role: role || "admin",
    };

    await fetch(`${url}/rest/v1/user_roles`, {
      method: "POST",
      headers: supabaseHeaders(key),
      body: JSON.stringify(rolePayload),
    });

    logger.info("[SupabaseSync] Pushed user & role to Supabase: " + user.email);
  } catch (err) {
    logger.warn("[SupabaseSync] pushUserToSupabase error", err);
  }
}

/**
 * Check Supabase Live Connection Status & Row Counts
 */
export async function getSupabaseSyncStatus() {
  const { url, key, isConfigured } = getSupabaseConfig();
  if (!isConfigured) {
    return {
      connected: false,
      isConfigured: false,
      reason: "SUPABASE_URL or SUPABASE_ANON_KEY not set",
      rowCounts: { phones: 0, sellers: 0, customers: 0, repairs: 0 },
    };
  }

  try {
    const [phonesRes, sellersRes, custRes, repRes, repCustRes, dealersRes] = await Promise.all([
      fetch(`${url}/rest/v1/phones?select=id`, {
        headers: { apikey: key, Authorization: `Bearer ${key}`, Range: "0-0", Prefer: "count=exact" },
      }),
      fetch(`${url}/rest/v1/sellers?select=id`, {
        headers: { apikey: key, Authorization: `Bearer ${key}`, Range: "0-0", Prefer: "count=exact" },
      }),
      fetch(`${url}/rest/v1/customers?select=id`, {
        headers: { apikey: key, Authorization: `Bearer ${key}`, Range: "0-0", Prefer: "count=exact" },
      }),
      fetch(`${url}/rest/v1/repair_jobs?select=id`, {
        headers: { apikey: key, Authorization: `Bearer ${key}`, Range: "0-0", Prefer: "count=exact" },
      }).catch(() => ({ ok: false, headers: new Map() })),
      fetch(`${url}/rest/v1/repair_customers?select=id`, {
        headers: { apikey: key, Authorization: `Bearer ${key}`, Range: "0-0", Prefer: "count=exact" },
      }).catch(() => ({ ok: false, headers: new Map() })),
      fetch(`${url}/rest/v1/dealers?select=id`, {
        headers: { apikey: key, Authorization: `Bearer ${key}`, Range: "0-0", Prefer: "count=exact" },
      }).catch(() => ({ ok: false, headers: new Map() })),
    ]);

    const getCount = (res) => {
      if (!res || !res.ok) return 0;
      const range = (typeof res.headers?.get === "function" ? res.headers.get("content-range") : "") || "";
      const match = range.match(/\/(\d+)/);
      return match ? parseInt(match[1], 10) : 0;
    };

    const connected = phonesRes.ok || sellersRes.ok || custRes.ok;

    return {
      connected,
      isConfigured: true,
      url: url.replace(/^https?:\/\//, ""),
      rowCounts: {
        phones: getCount(phonesRes),
        sellers: getCount(sellersRes),
        customers: getCount(custRes),
        repairs: getCount(repRes),
        repair_customers: getCount(repCustRes),
        dealers: getCount(dealersRes),
      },
    };
  } catch (err) {
    return {
      connected: false,
      isConfigured: true,
      error: err.message,
      rowCounts: { phones: 0, sellers: 0, customers: 0, repairs: 0 },
    };
  }
}
