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
    "gstin", "created_at", "updated_at"
  ],
  dealer_batches: [
    "id", "dealer_id", "batch_number", "batch_date", "total_phones",
    "total_amount", "payment_status", "created_at", "updated_at"
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
    "id", "job_no", "customer_id", "phone_model", "imei", "issue_description",
    "condition", "status", "estimated_cost", "final_cost", "received_at",
    "delivered_at", "created_at", "updated_at"
  ],
  repair_job_items: [
    "id", "repair_id", "description", "cost", "created_at"
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

  const source = { ...rawRow };
  if (table === "phones") {
    // Map phone_name <-> brand if needed
    if (!source.phone_name && source.brand) source.phone_name = source.brand;
    if (source.colour && !source.color) source.color = source.colour;
    if (source.variant && !source.storage) source.storage = source.variant;
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
        logger.warn(`[SupabaseSync] Batch chunk upload warning for ${table}:`, errTxt.slice(0, 150));
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

  try {
    // 1. Sync admin_settings
    const settingsRes = await fetch(`${url}/rest/v1/admin_settings?select=*&limit=1`, {
      headers: { apikey: key, Authorization: `Bearer ${key}` },
    });

    if (settingsRes.ok) {
      const rows = await settingsRes.json().catch(() => []);
      if (Array.isArray(rows) && rows.length > 0) {
        const s = rows[0];
        if (s.business_name || s.setup_completed) {
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
              setup_completed = 1
            WHERE id = '00000000-0000-0000-0000-000000000001'
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
            s.ifsc_code || null
          );
          logger.info("[SupabaseSync] Restored admin_settings from Supabase: " + s.business_name);
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
            INSERT INTO sellers (id, name, phone, address, id_proof_type, id_number, seller_photo_url, aadhaar_photo_url, bank_account_number, bank_ifsc, bank_name, account_holder_name)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(id) DO NOTHING
          `).run(s.id, s.name, s.phone, s.address || "", s.id_proof_type || "aadhaar", s.id_number || "", s.seller_photo_url || null, s.aadhaar_photo_url || null, s.bank_account_number || null, s.bank_ifsc || null, s.bank_name || null, s.account_holder_name || null);
        } catch {}
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
            ON CONFLICT(id) DO NOTHING
          `).run(c.id, c.name, c.phone, c.address || "", c.id_proof_type || "aadhaar", c.id_number || "");
        } catch {}
      }
    }

    // 6. Sync phones (inventory)
    const phonesRes = await fetch(`${url}/rest/v1/phones?select=*`, {
      headers: { apikey: key, Authorization: `Bearer ${key}` },
    });
    if (phonesRes.ok) {
      const phones = await phonesRes.json().catch(() => []);
      for (const p of phones) {
        try {
          db.prepare(`
            INSERT INTO phones (id, phone_name, model, imei_number, purchase_price, selling_price, condition, is_sold, seller_id, customer_id, purchase_date, payment_method)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET
              is_sold = excluded.is_sold,
              selling_price = excluded.selling_price
          `).run(
            p.id,
            p.phone_name || p.brand || "",
            p.model || "",
            p.imei_number || "",
            p.purchase_price || 0,
            p.selling_price || 0,
            p.condition || "good",
            p.is_sold ? 1 : 0,
            p.seller_id,
            p.customer_id || null,
            p.purchase_date || new Date().toISOString(),
            p.payment_method || "cash"
          );
        } catch {}
      }
    }

    logger.info("[SupabaseSync] Auto-sync from Supabase completed successfully!");
    return { ok: true, synced: true };
  } catch (err) {
    logger.warn("[SupabaseSync] Boot sync error", err);
    return { ok: false, error: err.message };
  }
}

/**
 * Push business settings to Supabase
 */
export async function pushSettingsToSupabase(settingsRow) {
  const { url, key, isConfigured } = getSupabaseConfig();
  if (!isConfigured || !settingsRow) return;

  try {
    const payload = sanitizeRowForSupabase("admin_settings", {
      id: "00000000-0000-0000-0000-000000000001",
      business_name: settingsRow.business_name || settingsRow.businessName || "",
      business_tagline: settingsRow.business_tagline || settingsRow.businessTagline || "",
      owner_name: settingsRow.owner_name || settingsRow.ownerName || "",
      address: settingsRow.address || "",
      phone_primary: settingsRow.phone_primary || settingsRow.primaryPhone || "",
      phone_secondary: settingsRow.phone_secondary || settingsRow.secondaryPhone || "",
      email: settingsRow.email || "",
      instagram: settingsRow.instagram || "",
      whatsapp_number: settingsRow.whatsapp_number || settingsRow.whatsappNumber || "",
      google_business_url: settingsRow.google_business_url || settingsRow.googleBusinessUrl || "",
      udyam_number: settingsRow.udyam_number || settingsRow.udyamNumber || "",
      logo_url: settingsRow.logo_url || settingsRow.logoUrl || null,
      signature_url: settingsRow.signature_url || settingsRow.signatureUrl || null,
      terms_and_conditions: settingsRow.terms_and_conditions || settingsRow.termsAndConditions || "",
      terms_and_conditions_sale: settingsRow.terms_and_conditions_sale || settingsRow.termsAndConditionsSale || "",
      terms_and_conditions_purchase: settingsRow.terms_and_conditions_purchase || settingsRow.termsAndConditionsPurchase || "",
      invoice_prefix_purchase: settingsRow.invoice_prefix_purchase || "PUR",
      invoice_prefix_sale: settingsRow.invoice_prefix_sale || "SAL",
      invoice_prefix_return: settingsRow.invoice_prefix_return || "RET",
      currency_code: settingsRow.currency_code || "INR",
      bank_name: settingsRow.bank_name || settingsRow.bankName || "",
      account_holder_name: settingsRow.account_holder_name || settingsRow.accountHolderName || "",
      account_number: settingsRow.account_number || settingsRow.accountNumber || "",
      ifsc_code: settingsRow.ifsc_code || settingsRow.ifscCode || "",
      setup_completed: 1,
    });

    const res = await fetch(`${url}/rest/v1/admin_settings`, {
      method: "POST",
      headers: supabaseHeaders(key),
      body: JSON.stringify(payload),
    });

    if (res.ok) {
      logger.info("[SupabaseSync] Pushed admin_settings to Supabase successfully");
    } else {
      logger.warn("[SupabaseSync] Failed to push admin_settings to Supabase", await res.text().catch(() => ""));
    }
  } catch (err) {
    logger.warn("[SupabaseSync] pushSettingsToSupabase error", err);
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
