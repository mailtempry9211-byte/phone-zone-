import { getDb } from "../db/index.js";
import { newId, notFound } from "../lib/errors.js";
import { requireFields, assertPhoneNumber, toJsonArray, fromJsonArray } from "../lib/validation.js";
import { audit } from "./auditService.js";

const hydrate = (r) => r && { ...r, photos: fromJsonArray(r.photos) };

export function listRepairs({ status = "all", search = "", limit = 300 } = {}) {
  const where = ["deleted_at IS NULL"];
  const params = [];
  if (status !== "all") { where.push("status = ?"); params.push(status); }
  if (search) {
    where.push("(customer_name LIKE ? OR customer_phone LIKE ? OR device LIKE ? OR imei_number LIKE ?)");
    params.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`);
  }
  params.push(limit);
  return getDb()
    .prepare(`SELECT * FROM repairs WHERE ${where.join(" AND ")} ORDER BY received_date DESC LIMIT ?`)
    .all(...params)
    .map(hydrate);
}

export function getRepair(id) {
  const row = getDb().prepare("SELECT * FROM repairs WHERE id = ?").get(id);
  if (!row) throw notFound("That repair job could not be found.");
  return hydrate(row);
}

export function createRepair(data, userId) {
  requireFields(data, ["customer_name", "customer_phone", "device", "service_type", "problem"]);
  assertPhoneNumber(data.customer_phone, "Customer phone");
  const row = {
    id: newId(),
    customer_id: data.customer_id || null,
    customer_name: data.customer_name,
    customer_phone: data.customer_phone,
    device: data.device,
    imei_number: data.imei_number || null,
    service_type: data.service_type,
    problem: data.problem,
    estimated_cost: data.estimated_cost ?? null,
    expected_completion: data.expected_completion || null,
    notes: data.notes || null,
    photos: toJsonArray(data.photos),
  };
  getDb()
    .prepare(
      `INSERT INTO repairs (id, customer_id, customer_name, customer_phone, device, imei_number, service_type,
        problem, estimated_cost, expected_completion, notes, photos)
       VALUES (@id, @customer_id, @customer_name, @customer_phone, @device, @imei_number, @service_type,
        @problem, @estimated_cost, @expected_completion, @notes, @photos)`,
    )
    .run(row);
  audit(userId, "repair.created", "repair", row.id);
  return getRepair(row.id);
}

export function updateRepair(id, data, userId) {
  getRepair(id);
  const cols = ["customer_name", "customer_phone", "device", "imei_number", "service_type", "problem",
    "estimated_cost", "final_cost", "status", "payment_status", "expected_completion", "warranty_days", "notes"];
  const sets = cols.filter((c) => data[c] !== undefined);
  const values = sets.map((c) => data[c]);
  if (data.photos !== undefined) { sets.push("photos"); values.push(toJsonArray(data.photos)); }
  if (!sets.length) return getRepair(id);
  getDb().prepare(`UPDATE repairs SET ${sets.map((c) => `${c} = ?`).join(", ")} WHERE id = ?`).run(...values, id);
  audit(userId, "repair.updated", "repair", id, { status: data.status });
  return getRepair(id);
}

export function archiveRepair(id, userId) {
  getRepair(id);
  getDb().prepare("UPDATE repairs SET deleted_at = datetime('now') WHERE id = ?").run(id);
  audit(userId, "repair.archived", "repair", id);
}
