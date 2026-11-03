/** Sellers & customers share the same shape - one service, two tables. */
import { getDb, transaction } from "../db/index.js";
import { newId, notFound, badRequest } from "../lib/errors.js";
import { requireFields, assertPhoneNumber } from "../lib/validation.js";
import { deleteFilesFor } from "./storageService.js";
import { audit } from "./auditService.js";

const TABLES = { seller: "sellers", customer: "customers" };
const PHOTO_COL = { seller: "seller_photo_url", customer: "customer_photo_url" };

const table = (kind) => TABLES[kind] || badRequestThrow();
function badRequestThrow() {
  throw badRequest("Unknown person type.");
}

export function listPeople(kind, { search = "", limit = 200 } = {}) {
  const db = getDb();
  const like = `%${search}%`;
  if (kind === "seller") {
    return search
      ? db
          .prepare(
            `SELECT s.*,
              (SELECT p.seller_signature_url FROM phones p WHERE p.seller_id = s.id AND p.seller_signature_url IS NOT NULL AND p.seller_signature_url != '' ORDER BY p.created_at DESC LIMIT 1) AS seller_signature_url
             FROM ${table(kind)} s WHERE s.deleted_at IS NULL AND (s.name LIKE ? OR s.phone LIKE ? OR s.id_number LIKE ?)
             ORDER BY s.created_at DESC LIMIT ?`,
          )
          .all(like, like, like, limit)
      : db
          .prepare(
            `SELECT s.*,
              (SELECT p.seller_signature_url FROM phones p WHERE p.seller_id = s.id AND p.seller_signature_url IS NOT NULL AND p.seller_signature_url != '' ORDER BY p.created_at DESC LIMIT 1) AS seller_signature_url
             FROM ${table(kind)} s WHERE s.deleted_at IS NULL ORDER BY s.created_at DESC LIMIT ?`,
          )
          .all(limit);
  }
  return search
    ? db
        .prepare(
          `SELECT * FROM ${table(kind)} WHERE deleted_at IS NULL AND (name LIKE ? OR phone LIKE ? OR id_number LIKE ?)
           ORDER BY created_at DESC LIMIT ?`,
        )
        .all(like, like, like, limit)
    : db.prepare(`SELECT * FROM ${table(kind)} WHERE deleted_at IS NULL ORDER BY created_at DESC LIMIT ?`).all(limit);
}

export function getPerson(kind, id) {
  const row = getDb().prepare(`SELECT * FROM ${table(kind)} WHERE id = ?`).get(id);
  if (!row) throw notFound(`That ${kind} could not be found.`);
  if (kind === "seller") {
    const recentSig = getDb()
      .prepare(
        "SELECT seller_signature_url FROM phones WHERE seller_id = ? AND seller_signature_url IS NOT NULL AND seller_signature_url != '' ORDER BY created_at DESC LIMIT 1",
      )
      .get(id);
    if (recentSig?.seller_signature_url) {
      row.seller_signature_url = recentSig.seller_signature_url;
      row.signature_url = recentSig.seller_signature_url;
    }
  }
  return row;
}

export function createPerson(kind, data, userId) {
  requireFields(data, ["name", "phone", "address", "id_proof_type", "id_number"]);
  assertPhoneNumber(data.phone);
  const row = {
    id: newId(),
    name: String(data.name).trim(),
    phone: String(data.phone).trim(),
    address: String(data.address).trim(),
    id_proof_type: data.id_proof_type,
    id_number: String(data.id_number).trim(),
    photo: data.seller_photo_url || data.customer_photo_url || data.photo_url || null,
    aadhaar: data.aadhaar_photo_url || null,
  };
  getDb()
    .prepare(
      `INSERT INTO ${table(kind)} (id, name, phone, address, id_proof_type, id_number, ${PHOTO_COL[kind]}, aadhaar_photo_url)
       VALUES (@id, @name, @phone, @address, @id_proof_type, @id_number, @photo, @aadhaar)`,
    )
    .run(row);
  audit(userId, `${kind}.created`, kind, row.id);
  return getPerson(kind, row.id);
}

export function updatePerson(kind, id, data, userId) {
  getPerson(kind, id);
  if (data.phone) assertPhoneNumber(data.phone);
  const allowed = ["name", "phone", "address", "id_proof_type", "id_number", PHOTO_COL[kind], "aadhaar_photo_url"];
  const sets = allowed.filter((c) => data[c] !== undefined);
  if (!sets.length) return getPerson(kind, id);
  getDb()
    .prepare(`UPDATE ${table(kind)} SET ${sets.map((c) => `${c} = ?`).join(", ")} WHERE id = ?`)
    .run(...sets.map((c) => data[c]), id);
  audit(userId, `${kind}.updated`, kind, id);
  return getPerson(kind, id);
}

/** Soft delete: business history is never destroyed. Files go only on purge. */
export function archivePerson(kind, id, userId) {
  getPerson(kind, id);
  getDb().prepare(`UPDATE ${table(kind)} SET deleted_at = datetime('now') WHERE id = ?`).run(id);
  audit(userId, `${kind}.archived`, kind, id);
}

/** Hard delete + file cleanup. Blocked while linked records exist. */
export function purgePerson(kind, id, userId) {
  const db = getDb();
  const linkCol = kind === "seller" ? "seller_id" : "customer_id";
  const linked = db.prepare(`SELECT COUNT(*) AS n FROM phones WHERE ${linkCol} = ?`).get(id).n;
  if (linked > 0) throw badRequest(`This ${kind} is linked to ${linked} phone record(s) and cannot be deleted.`);
  transaction(() => {
    deleteFilesFor(kind, id);
    db.prepare(`DELETE FROM ${table(kind)} WHERE id = ?`).run(id);
  });
  audit(userId, `${kind}.deleted`, kind, id);
}

/** Customer purchase history + totals. */
export function customerHistory(customerId) {
  const db = getDb();
  const purchases = db
    .prepare("SELECT id, phone_name, model, selling_price, sold_date FROM phones WHERE customer_id = ? ORDER BY sold_date DESC")
    .all(customerId);
  return {
    purchases,
    totalPurchases: purchases.length,
    totalSpent: purchases.reduce((sum, p) => sum + Number(p.selling_price || 0), 0),
  };
}

/** Seller purchase history + totals (phones purchased from this seller). */
export function sellerHistory(sellerId) {
  const db = getDb();
  const phones = db
    .prepare(
      "SELECT id, phone_name, model, imei_number, purchase_price, purchase_date, condition, is_sold, return_status, return_date FROM phones WHERE seller_id = ? AND deleted_at IS NULL ORDER BY purchase_date DESC",
    )
    .all(sellerId);
  const returns = db
    .prepare("SELECT phone_id, return_amount, return_date, return_type FROM returns WHERE seller_id = ? ORDER BY return_date DESC")
    .all(sellerId);
  const returnByPhone = Object.fromEntries(returns.map((r) => [r.phone_id, r]));
  const purchases = phones.map((p) => ({
    ...p,
    returnStatus: returnByPhone[p.id]?.return_type || null,
    returnDate: returnByPhone[p.id]?.return_date || null,
    returned: !!returnByPhone[p.id],
  }));
  return {
    purchases,
    totalPurchases: purchases.length,
    totalSpent: purchases.reduce((sum, p) => sum + Number(p.purchase_price || 0), 0),
    returnsCount: returns.length,
    totalReturned: returns.reduce((sum, r) => sum + Number(r.return_amount || 0), 0),
  };
}

/**
 * Universal cross-entity phone lookup.
 * Probes across sellers, customers, dealers, and repair customers simultaneously.
 * Returns linked profiles, past purchases, sales, and repairs for seamless cross-operations.
 */
export function lookupUniversal(rawPhone) {
  if (!rawPhone) return { found: false, matches: [] };
  const clean = String(rawPhone).replace(/\D/g, "").slice(-10);
  if (clean.length < 10) return { found: false, matches: [] };
  const db = getDb();
  const phoneLike = `%${clean}`;

  // 1. Check sellers
  const sellerRows = db
    .prepare(
      `SELECT s.*,
        (SELECT p.seller_signature_url FROM phones p WHERE p.seller_id = s.id AND p.seller_signature_url IS NOT NULL AND p.seller_signature_url != '' ORDER BY p.created_at DESC LIMIT 1) AS seller_signature_url
       FROM sellers s
       WHERE s.deleted_at IS NULL AND s.phone LIKE ?
       ORDER BY s.created_at DESC`,
    )
    .all(phoneLike);

  // 2. Check customers
  const customerRows = db
    .prepare("SELECT * FROM customers WHERE deleted_at IS NULL AND phone LIKE ? ORDER BY created_at DESC")
    .all(phoneLike);

  // 3. Check dealers
  const dealerRows = db
    .prepare("SELECT * FROM dealers WHERE deleted_at IS NULL AND phone LIKE ? ORDER BY created_at DESC")
    .all(phoneLike);

  // 4. Check repair customers
  let repairCustomerRows = [];
  try {
    repairCustomerRows = db
      .prepare("SELECT * FROM repair_customers WHERE phone LIKE ? ORDER BY created_at DESC")
      .all(phoneLike);
  } catch {}

  const matches = [];

  for (const s of sellerRows) {
    const pStats = db
      .prepare("SELECT COUNT(*) as count, COALESCE(SUM(purchase_price), 0) as total FROM phones WHERE seller_id = ?")
      .get(s.id);
    matches.push({
      role: "seller",
      id: s.id,
      name: s.name,
      phone: s.phone,
      address: s.address,
      id_proof_type: s.id_proof_type,
      id_number: s.id_number,
      photo_url: s.seller_photo_url,
      signature_url: s.seller_signature_url,
      summary: `Sold ${pStats.count} phone(s) to store (₹${Number(pStats.total).toLocaleString("en-IN")})`,
      txCount: pStats.count,
      txTotal: pStats.total,
    });
  }

  for (const c of customerRows) {
    const cStats = db
      .prepare("SELECT COUNT(*) as count, COALESCE(SUM(selling_price), 0) as total FROM phones WHERE customer_id = ?")
      .get(c.id);
    matches.push({
      role: "customer",
      id: c.id,
      name: c.name,
      phone: c.phone,
      address: c.address,
      id_proof_type: c.id_proof_type,
      id_number: c.id_number,
      photo_url: c.customer_photo_url,
      signature_url: null,
      summary: `Bought ${cStats.count} phone(s) from store (₹${Number(cStats.total).toLocaleString("en-IN")})`,
      txCount: cStats.count,
      txTotal: cStats.total,
    });
  }

  for (const d of dealerRows) {
    const dStats = db
      .prepare("SELECT COUNT(*) as count, COALESCE(SUM(purchase_price), 0) as total FROM phones WHERE dealer_id = ?")
      .get(d.id);
    matches.push({
      role: "dealer",
      id: d.id,
      name: d.shop_name ? `${d.shop_name} (${d.proprietor_name})` : d.proprietor_name,
      phone: d.phone,
      address: d.address,
      id_proof_type: d.gst_number ? "gst" : null,
      id_number: d.gst_number || "",
      photo_url: d.photo_url,
      signature_url: d.signature_url,
      summary: `B2B Supplier: Supplied ${dStats.count} phones (₹${Number(dStats.total).toLocaleString("en-IN")})`,
      txCount: dStats.count,
      txTotal: dStats.total,
    });
  }

  for (const rc of repairCustomerRows) {
    if (!matches.some((m) => m.name.toLowerCase() === rc.name?.toLowerCase())) {
      const rStats = db.prepare("SELECT COUNT(*) as count FROM repair_jobs WHERE customer_id = ?").get(rc.id);
      matches.push({
        role: "repair_customer",
        id: rc.id,
        name: rc.name,
        phone: rc.phone,
        address: rc.address,
        id_proof_type: null,
        id_number: "",
        photo_url: null,
        signature_url: null,
        summary: `Repair Client: ${rStats.count} repair job(s) booked`,
        txCount: rStats.count,
        txTotal: 0,
      });
    }
  }

  return {
    found: matches.length > 0,
    phone: clean,
    primary: matches[0] || null,
    matches,
  };
}
