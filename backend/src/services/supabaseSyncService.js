/**
 * Two-way Cloud Persistence & Synchronization Service (SQLite <-> Supabase)
 *
 * Ensures that all shop settings, user accounts, phones, invoices, and customers
 * survive across Render container deploys and restarts.
 */
import { getDb } from "../db/index.js";
import { logger } from "../lib/logger.js";

function getSupabaseConfig() {
  const url = (process.env.SUPABASE_URL || "").trim().replace(/\/+$/, "");
  const key = (
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    process.env.SUPABASE_PUBLISHABLE_KEY ||
    ""
  ).trim();
  return { url, key, isConfigured: !!(url && key) };
}

function supabaseHeaders(key) {
  return {
    "apikey": key,
    "Authorization": `Bearer ${key}`,
    "Content-Type": "application/json",
    "Prefer": "resolution=merge-duplicates,return=representation",
  };
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
              business_hours = COALESCE(?, business_hours),
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
            typeof s.business_hours === "object" ? JSON.stringify(s.business_hours) : s.business_hours || null,
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
            INSERT INTO phones (id, brand, model, imei_number, purchase_price, selling_price, condition, is_sold, seller_id, customer_id, purchase_date, payment_method)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET
              is_sold = excluded.is_sold,
              selling_price = excluded.selling_price
          `).run(
            p.id,
            p.brand || "",
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
    const payload = {
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
    };

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
