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
  if (search && search.trim()) {
    const q = `%${search.trim()}%`;
    return db.prepare(
      `SELECT * FROM repair_customers
       WHERE deleted_at IS NULL AND (name LIKE ? OR phone LIKE ?)
       ORDER BY created_at DESC LIMIT ?`
    ).all(q, q, capped);
  }
  return db.prepare(
    `SELECT * FROM repair_customers
     WHERE deleted_at IS NULL
     ORDER BY created_at DESC LIMIT ?`
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
  ).all(customerId).map((row) => ({
    ...row,
    items: row.items ? JSON.parse(row.items) : [],
  }));
}

