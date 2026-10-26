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
    photo: data.photo_url || null,
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
