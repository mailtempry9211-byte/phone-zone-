/**
 * Service for repair customers (strictly private, independent of sales/inventory).
 */
import { getDb } from "../db/index.js";
import { newId, badRequest, notFound } from "../lib/errors.js";

function cleanPhone(raw) {
  const digits = String(raw || "").replace(/\D/g, "");
  return digits.length >= 10 ? digits.slice(-10) : digits;
}

export function listRepairCustomers({ search = "", limit = 50 } = {}) {
  const db = getDb();
  const capped = Math.min(Math.max(Number(limit) || 50, 1), 200);
  const selectCols = `
    c.*,
    COUNT(j.id) AS total_repairs,
    COALESCE(SUM(CASE WHEN j.status = 'delivered' THEN COALESCE(j.final_price, j.estimate, 0) ELSE COALESCE(j.estimate, 0) END), 0) AS total_spent,
    COALESCE(SUM(j.advance_paid), 0) AS total_paid,
    COALESCE(SUM(CASE WHEN (COALESCE(j.final_price, j.estimate, 0) - COALESCE(j.advance_paid, 0)) > 0 THEN (COALESCE(j.final_price, j.estimate, 0) - COALESCE(j.advance_paid, 0)) ELSE 0 END), 0) AS total_balance_due,
    COUNT(CASE WHEN j.status IN ('received', 'diagnosing', 'waiting_parts', 'in_progress', 'ready') THEN 1 END) AS active_repairs
  `;

  if (search && search.trim()) {
    const q = `%${search.trim()}%`;
    return db.prepare(
      `SELECT ${selectCols}
       FROM repair_customers c
       LEFT JOIN repair_jobs j ON j.repair_customer_id = c.id AND j.deleted_at IS NULL
       WHERE c.deleted_at IS NULL AND (c.name LIKE ? OR c.phone LIKE ?)
       GROUP BY c.id
       ORDER BY c.created_at DESC LIMIT ?`
    ).all(q, q, capped);
  }
  return db.prepare(
    `SELECT ${selectCols}
     FROM repair_customers c
     LEFT JOIN repair_jobs j ON j.repair_customer_id = c.id AND j.deleted_at IS NULL
     WHERE c.deleted_at IS NULL
     GROUP BY c.id
     ORDER BY c.created_at DESC LIMIT ?`
  ).all(capped);
}

export function getRepairCustomer(id) {
  const row = getDb().prepare("SELECT * FROM repair_customers WHERE id = ? AND deleted_at IS NULL").get(id);
  if (!row) throw notFound("Repair customer not found.");
  return row;
}

export function getRepairCustomerByPhone(phone) {
  const cleaned = cleanPhone(phone);
  if (!cleaned || cleaned.length < 10) return null;
  return getDb().prepare(
    `SELECT * FROM repair_customers WHERE (phone = ? OR phone LIKE ?) AND deleted_at IS NULL`
  ).get(cleaned, `%${cleaned}`);
}

export function lookupAnyContactByPhone(phone) {
  const cleaned = cleanPhone(phone);
  if (!cleaned || cleaned.length < 10) return null;
  const db = getDb();
  const phonePattern = `%${cleaned.slice(-10)}`;

  // 1. Repair customers (first preference)
  const rep = db.prepare(
    `SELECT id, name, phone, address, id_proof_type, id_number, photo_file_id, aadhaar_photo_file_id
     FROM repair_customers
     WHERE (phone = ? OR phone LIKE ?) AND deleted_at IS NULL LIMIT 1`
  ).get(cleaned, phonePattern);
  if (rep) {
    return {
      ...rep,
      source: "repair_customer",
      source_label: "Previous Repair Customer",
      existing_repair_customer_id: rep.id,
    };
  }

  // 2. Customers (sales buyers)
  const cust = db.prepare(
    `SELECT id, name, phone, address, id_proof_type, id_number
     FROM customers
     WHERE (phone = ? OR phone LIKE ?) AND deleted_at IS NULL LIMIT 1`
  ).get(cleaned, phonePattern);
  if (cust) {
    return {
      ...cust,
      source: "customer",
      source_label: "Store Customer (Sales Buyer)",
      existing_repair_customer_id: null,
    };
  }

  // 3. Sellers (phone suppliers)
  const sel = db.prepare(
    `SELECT id, name, phone, address, id_proof_type, id_number
     FROM sellers
     WHERE (phone = ? OR phone LIKE ?) AND deleted_at IS NULL LIMIT 1`
  ).get(cleaned, phonePattern);
  if (sel) {
    return {
      ...sel,
      source: "seller",
      source_label: "Registered Phone Seller",
      existing_repair_customer_id: null,
    };
  }

  // 4. Dealers (B2B suppliers)
  try {
    const deal = db.prepare(
      `SELECT id, shop_name AS name, proprietor_name, phone, address
       FROM dealers
       WHERE (phone = ? OR phone LIKE ?) LIMIT 1`
    ).get(cleaned, phonePattern);
    if (deal) {
      return {
        id: deal.id,
        name: deal.name || deal.proprietor_name,
        phone: deal.phone,
        address: deal.address,
        id_proof_type: null,
        id_number: null,
        source: "dealer",
        source_label: "Registered B2B Dealer",
        existing_repair_customer_id: null,
      };
    }
  } catch {}

  return null;
}

export function searchAllContacts(query = "", limit = 20) {
  const db = getDb();
  const capped = Math.min(Math.max(Number(limit) || 20, 1), 100);
  const q = `%${String(query || "").trim()}%`;
  const results = [];

  // Repair customers
  try {
    const reps = db.prepare(
      `SELECT id, name, phone, address, id_proof_type, id_number, 'repair_customer' AS source, 'Repair Customer' AS source_label
       FROM repair_customers
       WHERE deleted_at IS NULL AND (name LIKE ? OR phone LIKE ?)
       ORDER BY created_at DESC LIMIT ?`
    ).all(q, q, capped);
    results.push(...reps);
  } catch {}

  // Customers
  try {
    const custs = db.prepare(
      `SELECT id, name, phone, address, id_proof_type, id_number, 'customer' AS source, 'Store Customer' AS source_label
       FROM customers
       WHERE deleted_at IS NULL AND (name LIKE ? OR phone LIKE ?)
       ORDER BY created_at DESC LIMIT ?`
    ).all(q, q, capped);
    results.push(...custs);
  } catch {}

  // Sellers
  try {
    const sels = db.prepare(
      `SELECT id, name, phone, address, id_proof_type, id_number, 'seller' AS source, 'Phone Seller' AS source_label
       FROM sellers
       WHERE deleted_at IS NULL AND (name LIKE ? OR phone LIKE ?)
       ORDER BY created_at DESC LIMIT ?`
    ).all(q, q, capped);
    results.push(...sels);
  } catch {}

  // Dealers
  try {
    const deals = db.prepare(
      `SELECT id, COALESCE(shop_name, proprietor_name) AS name, phone, address, NULL AS id_proof_type, NULL AS id_number, 'dealer' AS source, 'B2B Dealer' AS source_label
       FROM dealers
       WHERE (shop_name LIKE ? OR proprietor_name LIKE ? OR phone LIKE ?)
       ORDER BY created_at DESC LIMIT ?`
    ).all(q, q, q, capped);
    results.push(...deals);
  } catch {}

  // Deduplicate by clean 10-digit phone
  const seen = new Set();
  const unique = [];
  for (const item of results) {
    const p = (item.phone || "").replace(/\D/g, "").slice(-10);
    if (p && !seen.has(p)) {
      seen.add(p);
      unique.push(item);
    }
  }

  return unique.slice(0, capped);
}

export function createRepairCustomer({
  name,
  phone,
  address,
  id_proof_type,
  id_number,
  photo_file_id,
  aadhaar_photo_file_id,
  whatsapp_opt_in = 0,
  shop_id = null,
}) {
  if (!name || !name.trim()) throw badRequest("Customer name is required.");
  const cleanedPhone = cleanPhone(phone);
  if (!cleanedPhone || cleanedPhone.length !== 10) {
    throw badRequest("Please enter a valid 10-digit mobile number.");
  }

  const existing = getRepairCustomerByPhone(cleanedPhone);
  if (existing) {
    return existing;
  }

  const id = newId();
  const record = {
    id,
    shop_id: shop_id || null,
    name: name.trim(),
    phone: cleanedPhone,
    address: address ? address.trim() : null,
    id_proof_type: id_proof_type || null,
    id_number: id_number ? id_number.trim() : null,
    photo_file_id: photo_file_id || null,
    aadhaar_photo_file_id: aadhaar_photo_file_id || null,
    whatsapp_opt_in: whatsapp_opt_in ? 1 : 0,
  };

  getDb().prepare(
    `INSERT INTO repair_customers (id, shop_id, name, phone, address, id_proof_type, id_number, photo_file_id, aadhaar_photo_file_id, whatsapp_opt_in)
     VALUES (@id, @shop_id, @name, @phone, @address, @id_proof_type, @id_number, @photo_file_id, @aadhaar_photo_file_id, @whatsapp_opt_in)`
  ).run(record);

  return getRepairCustomer(id);
}

export function updateRepairCustomer(id, data) {
  getRepairCustomer(id); // asserts exists
  const fields = [];
  const params = [];

  if (data.name !== undefined) {
    if (!data.name?.trim()) throw badRequest("Name cannot be empty.");
    fields.push("name = ?");
    params.push(data.name.trim());
  }
  if (data.phone !== undefined) {
    const cleaned = cleanPhone(data.phone);
    if (!cleaned || cleaned.length !== 10) throw badRequest("Valid 10-digit phone required.");
    fields.push("phone = ?");
    params.push(cleaned);
  }
  if (data.address !== undefined) {
    fields.push("address = ?");
    params.push(data.address ? data.address.trim() : null);
  }
  if (data.id_proof_type !== undefined) {
    fields.push("id_proof_type = ?");
    params.push(data.id_proof_type || null);
  }
  if (data.id_number !== undefined) {
    fields.push("id_number = ?");
    params.push(data.id_number ? data.id_number.trim() : null);
  }
  if (data.photo_file_id !== undefined) {
    fields.push("photo_file_id = ?");
    params.push(data.photo_file_id || null);
  }
  if (data.aadhaar_photo_file_id !== undefined) {
    fields.push("aadhaar_photo_file_id = ?");
    params.push(data.aadhaar_photo_file_id || null);
  }
  if (data.whatsapp_opt_in !== undefined) {
    fields.push("whatsapp_opt_in = ?");
    params.push(data.whatsapp_opt_in ? 1 : 0);
  }

  if (fields.length > 0) {
    params.push(id);
    getDb().prepare(`UPDATE repair_customers SET ${fields.join(", ")} WHERE id = ?`).run(...params);
  }

  return getRepairCustomer(id);
}

export function deleteRepairCustomer(id) {
  getRepairCustomer(id);
  getDb().prepare("UPDATE repair_customers SET deleted_at = datetime('now') WHERE id = ?").run(id);
  return { ok: true };
}

export function getRepairCustomerHistory(customerId) {
  const db = getDb();
  return db.prepare(
    `SELECT j.*, 
            (SELECT json_group_array(json_object('id', i.id, 'kind', i.kind, 'description', i.description, 'qty', i.qty, 'unit_price', i.unit_price, 'is_board', i.is_board))
             FROM repair_job_items i WHERE i.job_id = j.id) AS items
     FROM repair_jobs j
     WHERE j.repair_customer_id = ? AND j.deleted_at IS NULL
     ORDER BY j.created_at DESC`
  ).all(customerId).map((row) => {
    const items = row.items ? JSON.parse(row.items) : [];
    const total_price = Number(row.final_price || row.parts_cost + row.labour_cost || row.estimate || 0);
    const paid_amount = Number(row.advance_paid || 0);
    const balance_due = Math.max(0, total_price - paid_amount);
    const is_fully_paid = (paid_amount >= total_price && total_price > 0) || row.payment_status === "paid";

    return {
      ...row,
      items,
      total_price,
      paid_amount,
      balance_due,
      is_fully_paid,
    };
  });
}

