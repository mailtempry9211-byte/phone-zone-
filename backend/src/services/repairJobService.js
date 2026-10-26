/**
 * Service for repair jobs (strictly private, independent of public catalog/inventory).
 */
import { getDb, transaction } from "../db/index.js";
import { newId, badRequest, notFound } from "../lib/errors.js";
import { assertImei } from "../lib/validation.js";
import { activeFyLabel } from "./financialYearService.js";
import { createRepairCustomer, getRepairCustomer } from "./repairCustomerService.js";

const VALID_STATUSES = new Set([
  "received",
  "diagnosing",
  "waiting_parts",
  "in_progress",
  "ready",
  "delivered",
  "cancelled",
]);

export function nextJobNumber(shopCode = "MAIN") {
  const fy = activeFyLabel() || String(new Date().getFullYear());
  const cleanShop = String(shopCode || "MAIN").trim().toUpperCase().replace(/[^A-Z0-9]/g, "");

  return transaction(() => {
    const db = getDb();
    db.prepare(
      `INSERT OR IGNORE INTO repair_job_counters (shop_code, fiscal_year, last_number) VALUES (?, ?, 0)`
    ).run(cleanShop, fy);

    const row = db.prepare(
      `SELECT last_number FROM repair_job_counters WHERE shop_code = ? AND fiscal_year = ?`
    ).get(cleanShop, fy);

    const nextNumber = (row?.last_number || 0) + 1;
    db.prepare(
      `UPDATE repair_job_counters SET last_number = ? WHERE shop_code = ? AND fiscal_year = ?`
    ).run(nextNumber, cleanShop, fy);

    return `RJ-${cleanShop}-${fy}-${String(nextNumber).padStart(4, "0")}`;
  });
}

export function createRepairJob({
  repair_customer_id,
  customer,
  device_brand,
  device_model,
  imei,
  imei2,
  problem,
  accessories_received,
  passcode_note,
  estimate,
  advance_paid = 0,
  technician,
  notes,
  items = [],
  shop_id = null,
  shop_code = "MAIN",
  user_id = null,
}) {
  let cleanImei = null;
  if (imei && String(imei).trim()) {
    cleanImei = String(imei).trim();
    assertImei(cleanImei);
  }

  if (!problem || !String(problem).trim()) {
    throw badRequest("Problem description is required.");
  }

  let customerId = repair_customer_id;
  if (!customerId) {
    if (!customer || !customer.name || !customer.phone) {
      throw badRequest("Customer details (name and phone) are required.");
    }
    const createdCust = createRepairCustomer({ ...customer, shop_id });
    customerId = createdCust.id;
  } else {
    getRepairCustomer(customerId); // asserts exists
  }

  const tac = (cleanImei && cleanImei.length >= 8) ? cleanImei.slice(0, 8) : null;
  const fy = activeFyLabel();
  const jobNo = nextJobNumber(shop_code);
  const jobId = newId();

  let partsCost = 0;
  let labourCost = 0;
  let hasBoard = 0;

  for (const item of items) {
    const price = Number(item.unit_price || 0) * (Number(item.qty || 1));
    if (item.kind === "part") partsCost += price;
    else labourCost += price;
    if (item.is_board) hasBoard = 1;
  }

  const calculatedFinal = partsCost + labourCost;
  const finalPrice = calculatedFinal > 0 ? calculatedFinal : (Number(estimate) || null);
  const paid = Number(advance_paid) || 0;
  let paymentStatus = "unpaid";
  if (finalPrice && paid >= finalPrice) paymentStatus = "paid";
  else if (paid > 0) paymentStatus = "partial";

  return transaction(() => {
    const db = getDb();
    const jobRecord = {
      id: jobId,
      job_no: jobNo,
      shop_id: shop_id || null,
      repair_customer_id: customerId,
      device_brand: device_brand ? String(device_brand).trim() : null,
      device_model: device_model ? String(device_model).trim() : null,
      imei: cleanImei,
      imei2: imei2 ? String(imei2).trim() : null,
      tac,
      problem: String(problem).trim(),
      accessories_received: accessories_received ? String(accessories_received).trim() : null,
      passcode_note: passcode_note ? String(passcode_note).trim() : null,
      estimate: Number(estimate) || null,
      advance_paid: paid,
      parts_cost: partsCost,
      labour_cost: labourCost,
      final_price: finalPrice,
      status: "received",
      payment_status: paymentStatus,
      board_replaced: hasBoard,
      warranty_days: 30,
      technician: technician ? String(technician).trim() : null,
      notes: notes ? String(notes).trim() : null,
      financial_year: fy,
    };

    db.prepare(
      `INSERT INTO repair_jobs (
        id, job_no, shop_id, repair_customer_id, device_brand, device_model,
        imei, imei2, tac, problem, accessories_received, passcode_note,
        estimate, advance_paid, parts_cost, labour_cost, final_price,
        status, payment_status, board_replaced, warranty_days, technician,
        notes, financial_year
      ) VALUES (
        @id, @job_no, @shop_id, @repair_customer_id, @device_brand, @device_model,
        @imei, @imei2, @tac, @problem, @accessories_received, @passcode_note,
        @estimate, @advance_paid, @parts_cost, @labour_cost, @final_price,
        @status, @payment_status, @board_replaced, @warranty_days, @technician,
        @notes, @financial_year
      )`
    ).run(jobRecord);

    // Initial status log
    db.prepare(
      `INSERT INTO repair_status_log (id, job_id, status, note, user_id)
       VALUES (?, ?, 'received', 'Device received for repair', ?)`
    ).run(newId(), jobId, user_id || null);

    // Items
    for (const item of items) {
      db.prepare(
        `INSERT INTO repair_job_items (id, job_id, kind, description, qty, unit_price, is_board)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      ).run(
        newId(),
        jobId,
        item.kind === "part" ? "part" : "labour",
        String(item.description || "").trim(),
        Number(item.qty) || 1,
        Number(item.unit_price) || 0,
        item.is_board ? 1 : 0,
      );
    }

    return getRepairJob(jobId);
  });
}

export function listRepairJobs({ status, search, shop, limit = 100 } = {}) {
  const db = getDb();
  const capped = Math.min(Math.max(Number(limit) || 100, 1), 500);
  const where = ["j.deleted_at IS NULL"];
  const params = [];

  if (status && status !== "all") {
    where.push("j.status = ?");
    params.push(status);
  }

  if (shop && shop !== "all") {
    where.push("j.shop_id = ?");
    params.push(shop);
  }

  if (search && search.trim()) {
    const q = `%${search.trim()}%`;
    where.push("(j.job_no LIKE ? OR j.imei LIKE ? OR c.name LIKE ? OR c.phone LIKE ? OR j.device_model LIKE ?)");
    params.push(q, q, q, q, q);
  }

  params.push(capped);

  const rows = db.prepare(
    `SELECT j.*, c.name AS customer_name, c.phone AS customer_phone, c.address AS customer_address
     FROM repair_jobs j
     JOIN repair_customers c ON j.repair_customer_id = c.id
     WHERE ${where.join(" AND ")}
     ORDER BY j.created_at DESC LIMIT ?`
  ).all(...params);

  return rows;
}

export function getRepairJob(id) {
  const db = getDb();
  const job = db.prepare(
    `SELECT j.*, c.name AS customer_name, c.phone AS customer_phone, c.address AS customer_address,
            c.id_proof_type, c.id_number, c.photo_file_id, c.aadhaar_photo_file_id
     FROM repair_jobs j
     JOIN repair_customers c ON j.repair_customer_id = c.id
     WHERE j.id = ? AND j.deleted_at IS NULL`
  ).get(id);

  if (!job) throw notFound("Repair job not found.");

  job.items = db.prepare(
    `SELECT * FROM repair_job_items WHERE job_id = ? ORDER BY created_at ASC`
  ).all(id);

  job.status_log = db.prepare(
    `SELECT * FROM repair_status_log WHERE job_id = ? ORDER BY at ASC`
  ).all(id);

  return job;
}

export function updateRepairJobStatus(id, { status, note, userId }) {
  if (!VALID_STATUSES.has(status)) {
    throw badRequest(`Invalid status '${status}'. Must be one of: ${Array.from(VALID_STATUSES).join(", ")}`);
  }

  const job = getRepairJob(id);
  const db = getDb();

  return transaction(() => {
    const sets = ["status = ?"];
    const params = [status];

    if (status === "ready" && !job.ready_at) {
      sets.push("ready_at = datetime('now')");
    }
    if (status === "delivered" && !job.delivered_at) {
      sets.push("delivered_at = datetime('now')");
    }

    params.push(id);
    db.prepare(`UPDATE repair_jobs SET ${sets.join(", ")} WHERE id = ?`).run(...params);

    db.prepare(
      `INSERT INTO repair_status_log (id, job_id, status, note, user_id)
       VALUES (?, ?, ?, ?, ?)`
    ).run(newId(), id, status, note ? String(note).trim() : null, userId || null);

    return getRepairJob(id);
  });
}

export function addRepairJobItems(id, items = []) {
  if (!Array.isArray(items) || items.length === 0) {
    throw badRequest("Items must be a non-empty array.");
  }
  const job = getRepairJob(id);
  const db = getDb();

  return transaction(() => {
    let hasNewBoard = 0;
    for (const item of items) {
      if (item.is_board) hasNewBoard = 1;
      db.prepare(
        `INSERT INTO repair_job_items (id, job_id, kind, description, qty, unit_price, is_board)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      ).run(
        newId(),
        id,
        item.kind === "part" ? "part" : "labour",
        String(item.description || "").trim(),
        Number(item.qty) || 1,
        Number(item.unit_price) || 0,
        item.is_board ? 1 : 0,
      );
    }

    // Recalculate totals
    const allItems = db.prepare(`SELECT * FROM repair_job_items WHERE job_id = ?`).all(id);
    let partsCost = 0;
    let labourCost = 0;
    let anyBoard = 0;
    for (const it of allItems) {
      const line = Number(it.unit_price || 0) * Number(it.qty || 1);
      if (it.kind === "part") partsCost += line;
      else labourCost += line;
      if (it.is_board) anyBoard = 1;
    }

    const finalPrice = partsCost + labourCost;
    const paid = Number(job.advance_paid || 0);
    let paymentStatus = "unpaid";
    if (paid >= finalPrice && finalPrice > 0) paymentStatus = "paid";
    else if (paid > 0) paymentStatus = "partial";

    db.prepare(
      `UPDATE repair_jobs
       SET parts_cost = ?, labour_cost = ?, final_price = ?,
           board_replaced = CASE WHEN board_replaced = 1 OR ? = 1 THEN 1 ELSE 0 END,
           payment_status = ?
       WHERE id = ?`
    ).run(partsCost, labourCost, finalPrice, anyBoard, paymentStatus, id);

    return getRepairJob(id);
  });
}

export function updateRepairJob(id, data) {
  getRepairJob(id);
  const fields = [];
  const params = [];

  const allowed = [
    "problem", "accessories_received", "passcode_note", "estimate",
    "advance_paid", "final_price", "payment_status", "warranty_days",
    "technician", "notes", "device_brand", "device_model"
  ];

  for (const key of allowed) {
    if (data[key] !== undefined) {
      fields.push(`${key} = ?`);
      params.push(data[key]);
    }
  }

  if (fields.length > 0) {
    params.push(id);
    getDb().prepare(`UPDATE repair_jobs SET ${fields.join(", ")} WHERE id = ?`).run(...params);
  }

  return getRepairJob(id);
}

export function deleteRepairJob(id) {
  getRepairJob(id);
  getDb().prepare("UPDATE repair_jobs SET deleted_at = datetime('now') WHERE id = ?").run(id);
  return { ok: true };
}

/**
 * Cross-check query by IMEI.
 * NOTE: Deliberately includes soft-deleted jobs so repair history can NEVER be destroyed!
 */
export function getRepairJobsByImei(imei) {
  if (!imei) return [];
  const clean = String(imei).trim();
  const db = getDb();

  const rows = db.prepare(
    `SELECT j.id, j.job_no, j.received_at, j.ready_at, j.delivered_at,
            j.device_brand, j.device_model, j.problem, j.board_replaced,
            j.final_price, j.status, j.deleted_at,
            c.name AS customer_name, c.phone AS customer_phone
     FROM repair_jobs j
     JOIN repair_customers c ON j.repair_customer_id = c.id
     WHERE j.imei = ?
     ORDER BY j.created_at DESC`
  ).all(clean);

  for (const r of rows) {
    r.items = db.prepare(
      `SELECT kind, description, qty, unit_price, is_board FROM repair_job_items WHERE job_id = ?`
    ).all(r.id);
  }

  return rows;
}

export function createReworkJob(jobId, { reason, technician, notes, userId } = {}) {
  const db = getDb();
  const original = getRepairJob(jobId);
  if (!original) throw notFound("Original repair job not found.");

  const reworkJobNo = `RW-${original.job_no}`;
  const newJobId = newId();

  return transaction(() => {
    db.prepare(
      `INSERT INTO repair_jobs (
        id, job_no, shop_id, repair_customer_id, device_brand, device_model,
        imei, imei2, tac, problem, accessories_received, passcode_note,
        estimate, advance_paid, parts_cost, labour_cost, final_price,
        status, payment_status, board_replaced, warranty_days, technician,
        notes, financial_year, is_rework, rework_notes, original_job_id
      ) VALUES (
        ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?, ?,
        0, 0, 0, 0, 0,
        'received', 'paid', 0, 30, ?,
        ?, ?, 1, ?, ?
      )`
    ).run(
      newJobId,
      reworkJobNo,
      original.shop_id,
      original.repair_customer_id,
      original.device_brand,
      original.device_model,
      original.imei,
      original.imei2,
      original.tac,
      `[REWORK CLAIM]: ${reason || original.problem}`,
      original.accessories_received,
      original.passcode_note,
      technician || original.technician,
      notes || `Warranty rework against ${original.job_no}`,
      original.financial_year,
      reason,
      jobId
    );

    // Initial status log for rework
    db.prepare(
      `INSERT INTO repair_status_log (id, job_id, status, note, user_id)
       VALUES (?, ?, 'received', ?, ?)`
    ).run(newId(), newJobId, `Device returned for warranty rework: ${reason}`, userId || null);

    return getRepairJob(newJobId);
  });
}

export function getRepairAccounting() {
  const db = getDb();
  const summary = db.prepare(`
    SELECT
      COUNT(*) AS total_jobs,
      SUM(CASE WHEN status = 'delivered' THEN 1 ELSE 0 END) AS delivered_jobs,
      SUM(CASE WHEN is_rework = 1 THEN 1 ELSE 0 END) AS rework_jobs,
      SUM(CASE WHEN status = 'delivered' THEN COALESCE(final_price, estimate, 0) ELSE 0 END) AS total_revenue,
      SUM(CASE WHEN status = 'delivered' THEN COALESCE(parts_cost, 0) ELSE 0 END) AS total_parts_cost,
      SUM(CASE WHEN status = 'delivered' THEN COALESCE(labour_cost, 0) ELSE 0 END) AS total_labour_revenue,
      SUM(CASE WHEN status = 'received' OR status = 'in_progress' OR status = 'waiting_parts' OR status = 'diagnosing' THEN 1 ELSE 0 END) AS pending_jobs
    FROM repair_jobs
    WHERE deleted_at IS NULL
  `).get();

  const netProfit = (summary?.total_revenue || 0) - (summary?.total_parts_cost || 0);

  const recentDelivered = db.prepare(`
    SELECT id, job_no, device_brand, device_model, imei, final_price, parts_cost, labour_cost, delivered_at, created_at
    FROM repair_jobs
    WHERE status = 'delivered' AND deleted_at IS NULL
    ORDER BY COALESCE(delivered_at, updated_at) DESC
    LIMIT 20
  `).all();

  return {
    ...summary,
    net_profit: netProfit,
    recent_delivered: recentDelivered,
  };
}

