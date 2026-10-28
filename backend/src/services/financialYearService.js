/**
 * Financial year (FY) service - Busy / Tally style year-wise books.
 *
 * Rules implemented here:
 *   1. Exactly one FY is ACTIVE. Every accounting row (phone, return, invoice)
 *      is stamped with the FY label it was created in.
 *   2. Reads of accounting data default to the active FY, so a fresh year starts
 *      with an empty book. Old years are still fully readable/editable by
 *      switching the active year - edits stay on the old year's rows.
 *   3. Switching or creating a year needs the logged-in admin's password.
 *   4. Customers and sellers are global (never year-scoped) so they carry
 *      forward automatically. Nothing is copied or cleared destructively.
 *   5. `imeiHistory()` reports a phone's full purchase + sale + return trail
 *      across EVERY year, so the admin can see complete history without
 *      switching years.
 */
import { getDb, transaction } from "../db/index.js";
import { newId, badRequest, forbidden, notFound } from "../lib/errors.js";
import { verifyPassword, rolesOf } from "./authService.js";
import { audit } from "./auditService.js";

const LABEL_RE = /^\d{4}-\d{2}$/;

/** Indian FY label for a date: 1 Apr - 31 Mar -> "2026-27". */
export function fyLabelForDate(date = new Date()) {
  const startYear = date.getMonth() + 1 >= 4 ? date.getFullYear() : date.getFullYear() - 1;
  return `${startYear}-${String((startYear + 1) % 100).padStart(2, "0")}`;
}

/** Date range (YYYY-MM-DD) covered by a label like "2026-27". */
export function fyRangeForLabel(label) {
  if (!LABEL_RE.test(String(label || ""))) throw badRequest("Financial year label must look like 2026-27.");
  const startYear = Number(String(label).slice(0, 4));
  const endYear = Number(String(label).slice(5, 7));
  if (endYear !== (startYear + 1) % 100) throw badRequest("Financial year label must be two consecutive years, e.g. 2026-27.");
  return { startDate: `${startYear}-04-01`, endDate: `${startYear + 1}-03-31` };
}

const shape = (row) =>
  row && {
    id: row.id,
    label: row.label,
    startDate: row.start_date,
    endDate: row.end_date,
    isActive: !!row.is_active,
    isClosed: !!row.is_closed,
    createdAt: row.created_at,
    closedAt: row.closed_at,
  };

export function getActiveFinancialYear() {
  return shape(getDb().prepare("SELECT * FROM financial_years WHERE is_active = 1 LIMIT 1").get());
}

export function getLatestFinancialYear() {
  return shape(getDb().prepare("SELECT * FROM financial_years ORDER BY start_date DESC LIMIT 1").get());
}

/** Check if the currently active FY is an older (previous) FY compared to the latest recorded year */
export function isPreviousYearActive() {
  const db = getDb();
  const active = db.prepare("SELECT * FROM financial_years WHERE is_active = 1 LIMIT 1").get();
  if (!active) return { isPrevious: false };
  const latest = db.prepare("SELECT * FROM financial_years ORDER BY start_date DESC LIMIT 1").get();
  if (!latest || latest.id === active.id) {
    return { isPrevious: false, activeYear: active.label, latestYear: active.label };
  }
  return {
    isPrevious: true,
    activeYear: active.label,
    latestYear: latest.label,
  };
}

/** Record a change made while operating in a previous financial year */
export function recordPreviousYearChange(entityType, entityId, action, details = {}) {
  const prev = isPreviousYearActive();
  if (!prev.isPrevious) return null;
  const db = getDb();
  const id = newId();
  try {
    db.prepare(
      `INSERT INTO financial_year_changes (id, from_fy, to_fy, entity_type, entity_id, action, details, reflected)
       VALUES (?, ?, ?, ?, ?, ?, ?, 0)`
    ).run(id, prev.activeYear, prev.latestYear, entityType, entityId, action, JSON.stringify(details));
    return {
      id,
      fromYear: prev.activeYear,
      toYear: prev.latestYear,
      entityType,
      action,
      promptCarryForward: true,
    };
  } catch (_e) {
    return null;
  }
}

/** Get list of pending unreflected changes from an older FY to the newer FY */
export function getPendingChanges(fromYear, toYear) {
  const db = getDb();
  const prev = isPreviousYearActive();
  const from = fromYear || prev.activeYear;
  const to = toYear || prev.latestYear;
  if (!from || !to || from === to) return { hasPending: false, changes: [] };

  try {
    const changes = db.prepare(
      `SELECT * FROM financial_year_changes WHERE from_fy = ? AND to_fy = ? AND reflected = 0 ORDER BY created_at ASC`
    ).all(from, to);

    return {
      hasPending: changes.length > 0,
      fromYear: from,
      toYear: to,
      count: changes.length,
      changes,
    };
  } catch (_e) {
    return { hasPending: false, changes: [] };
  }
}

/**
 * Busy / Tally style Carry Forward:
 * Carries forward closing unsold inventory and pending repair jobs from fromYear to toYear,
 * and marks all logged previous year changes as reflected.
 */
export function carryForwardFinancialYear({ fromYear, toYear, userId }) {
  const db = getDb();
  const from = String(fromYear || "").trim();
  const to = String(toYear || "").trim();
  if (!from || !to) throw badRequest("Source and target financial years are required.");
  if (from === to) throw badRequest("Source and target financial years must be different.");

  return transaction(() => {
    // 1. Unsold phones: if a phone in fromYear is unsold and active, carry it to toYear
    const carriedPhones = db.prepare(
      `UPDATE phones
       SET carried_to_fy = ?
       WHERE (financial_year = ? OR carried_to_fy = ?)
         AND COALESCE(is_sold, 0) = 0
         AND (return_status IS NULL OR return_status != 'purchase_returned')
         AND deleted_at IS NULL`
    ).run(to, from, from);

    // 2. Pending repair jobs: ONLY active in-progress jobs (never delivered or cancelled)
    const carriedRepairs = db.prepare(
      `UPDATE repair_jobs
       SET carried_to_fy = ?
       WHERE (financial_year = ? OR carried_to_fy = ?)
         AND LOWER(status) NOT IN ('delivered', 'cancelled')
         AND deleted_at IS NULL`
    ).run(to, from, from);

    // Safeguard: Ensure completed/delivered jobs are NEVER marked as carried forward to new years
    db.prepare(
      `UPDATE repair_jobs
       SET carried_to_fy = NULL
       WHERE LOWER(status) IN ('delivered', 'cancelled')`
    ).run();

    // 3. Mark all changes as reflected
    db.prepare(
      `UPDATE financial_year_changes
       SET reflected = 1, reflected_at = datetime('now')
       WHERE from_fy = ? AND to_fy = ? AND reflected = 0`
    ).run(from, to);

    if (userId) {
      audit(userId, "financial_year.carry_forward", "financial_year", to, {
        fromYear: from,
        toYear: to,
        phonesCarried: carriedPhones.changes,
        repairsCarried: carriedRepairs.changes,
      });
    }

    return {
      success: true,
      fromYear: from,
      toYear: to,
      phonesCarried: carriedPhones.changes,
      repairsCarried: carriedRepairs.changes,
    };
  });
}

/** The active FY label, used to scope every accounting query. */
export function activeFyLabel() {
  const row = getDb().prepare("SELECT label FROM financial_years WHERE is_active = 1 LIMIT 1").get();
  return row?.label || null;
}

/** All years, newest first, each with row counts + revenue for the picker. */
export function listFinancialYears() {
  const db = getDb();
  const rows = db.prepare("SELECT * FROM financial_years ORDER BY start_date DESC").all();
  const stats = db
    .prepare(
      `SELECT financial_year AS fy,
              COUNT(*) AS total,
              SUM(CASE WHEN COALESCE(is_sold,0) = 0 AND deleted_at IS NULL THEN 1 ELSE 0 END) AS available,
              SUM(CASE WHEN COALESCE(is_sold,0) = 1 THEN 1 ELSE 0 END) AS sold,
              COALESCE(SUM(CASE WHEN COALESCE(is_sold,0) = 1 THEN selling_price ELSE 0 END), 0) AS revenue
         FROM phones GROUP BY financial_year`,
    )
    .all();
  const byFy = Object.fromEntries(stats.map((s) => [s.fy, s]));
  return rows.map((r) => {
    const s = byFy[r.label] || {};
    return {
      ...shape(r),
      totalPhones: Number(s.total || 0),
      availablePhones: Number(s.available || 0),
      soldPhones: Number(s.sold || 0),
      revenue: Number(s.revenue || 0),
    };
  });
}

/** Label for the next year after the newest one on file. */
export function nextFyLabel() {
  const latest = getDb().prepare("SELECT label FROM financial_years ORDER BY start_date DESC LIMIT 1").get();
  if (!latest) return fyLabelForDate();
  const { endDate } = fyRangeForLabel(latest.label);
  const nextYear = Number(String(endDate).slice(0, 4)) + 1;
  return `${nextYear}-${String((nextYear + 1) % 100).padStart(2, "0")}`;
}

/**
 * Every year change must be authorised with the admin's own password - a random
 * staff/viewer session must not be able to reopen or start a year.
 */
export function assertAdminPassword(userId, password) {
  const db = getDb();
  const userRoles = rolesOf(userId);
  const isAdmin = userRoles.includes("admin") || userRoles.includes("master_admin");
  if (!isAdmin) throw forbidden("Only an admin can change the financial year.");
  const user = db.prepare("SELECT * FROM users WHERE id = ?").get(userId);
  if (!user || !verifyPassword(String(password || ""), user.password_hash)) {
    throw badRequest("Incorrect admin password.");
  }
}

/**
 * Automatically carries forward closing unsold inventory and active workshop repair jobs
 * into the target financial year so the business never loses physical stock or active tickets.
 */
export function autoCarryForwardToYear(targetYear) {
  if (!targetYear) return;
  const db = getDb();
  const targetRow = db.prepare("SELECT start_date FROM financial_years WHERE label = ?").get(targetYear);
  if (!targetRow) return;

  // 1. Unsold phones: all phones in hand that are not sold, not returned, from prior or current years
  db.prepare(`
    UPDATE phones
    SET carried_to_fy = ?
    WHERE COALESCE(is_sold, 0) = 0
      AND (return_status IS NULL OR return_status != 'purchase_returned')
      AND deleted_at IS NULL
      AND (carried_to_fy IS NULL OR carried_to_fy != ?)
      AND (financial_year IS NULL OR financial_year != ?)
      AND (financial_year IS NULL OR financial_year IN (
        SELECT label FROM financial_years WHERE start_date <= ?
      ))
  `).run(targetYear, targetYear, targetYear, targetRow.start_date);

  // 2. Active repair jobs: only open tickets in workshop (received, diagnosing, waiting_parts, in_progress, ready)
  db.prepare(`
    UPDATE repair_jobs
    SET carried_to_fy = ?
    WHERE LOWER(status) NOT IN ('delivered', 'cancelled')
      AND deleted_at IS NULL
      AND (carried_to_fy IS NULL OR carried_to_fy != ?)
      AND (financial_year IS NULL OR financial_year != ?)
      AND (financial_year IS NULL OR financial_year IN (
        SELECT label FROM financial_years WHERE start_date <= ?
      ))
  `).run(targetYear, targetYear, targetYear, targetRow.start_date);

  // 3. Safeguard: Delivered and cancelled jobs must NEVER have carried_to_fy set
  db.prepare(`
    UPDATE repair_jobs
    SET carried_to_fy = NULL
    WHERE LOWER(status) IN ('delivered', 'cancelled')
      AND carried_to_fy IS NOT NULL
  `).run();
}

/**
 * Start a new financial year. Unsold stock and active workshop jobs are carried
 * forward as opening stock/tickets. Past completed accounting remains closed in old years.
 */
export function createFinancialYear({ label, startDate, endDate, password, userId }) {
  assertAdminPassword(userId, password);
  const db = getDb();
  const finalLabel = String(label || nextFyLabel()).trim();
  const range = fyRangeForLabel(finalLabel);
  if (db.prepare("SELECT 1 FROM financial_years WHERE label = ?").get(finalLabel)) {
    throw badRequest(`Financial year ${finalLabel} already exists.`);
  }
  const id = newId();
  transaction(() => {
    db.prepare("UPDATE financial_years SET is_active = 0").run();
    db.prepare(
      `INSERT INTO financial_years (id, label, start_date, end_date, is_active, is_closed)
       VALUES (?,?,?,?,1,0)`,
    ).run(id, finalLabel, startDate || range.startDate, endDate || range.endDate);

    // Auto-carry forward unsold stock and active workshop jobs to the new year
    autoCarryForwardToYear(finalLabel);
  });
  audit(userId, "financial_year.created", "financial_year", id, { label: finalLabel });
  return { active: getActiveFinancialYear(), years: listFinancialYears() };
}

/** Switch the active year (reopen an old year, or move back to a newer one). */
export function activateFinancialYear({ id, password, userId }) {
  assertAdminPassword(userId, password);
  const db = getDb();
  const row = db.prepare("SELECT * FROM financial_years WHERE id = ?").get(id);
  if (!row) throw notFound("That financial year could not be found.");
  transaction(() => {
    db.prepare("UPDATE financial_years SET is_active = 0").run();
    db.prepare("UPDATE financial_years SET is_active = 1 WHERE id = ?").run(id);

    // Auto-reflect closing unsold stock and active tickets into the activated year
    autoCarryForwardToYear(row.label);
  });
  audit(userId, "financial_year.activated", "financial_year", id, { label: row.label });
  return { active: getActiveFinancialYear(), years: listFinancialYears() };
}

/** One phone's full trail (purchase + sale + returns) across EVERY year. */
function phoneTrail(db, phone) {
  const seller = phone.seller_id
    ? db.prepare("SELECT name, phone, address, id_proof_type, id_number FROM sellers WHERE id = ?").get(phone.seller_id)
    : null;
  const customer = phone.customer_id
    ? db.prepare("SELECT name, phone, address, id_proof_type, id_number FROM customers WHERE id = ?").get(phone.customer_id)
    : null;
  const returns = db
    .prepare("SELECT return_type, return_amount, return_reason, return_date FROM returns WHERE phone_id = ? ORDER BY return_date")
    .all(phone.id);
  const invoices = db
    .prepare("SELECT invoice_number, invoice_type, amount, issued_at FROM invoices WHERE phone_id = ? ORDER BY issued_at")
    .all(phone.id);
  return { phone, seller, customer, returns, invoices };
}

/**
 * Cross-year IMEI lookup. Matches the IMEI as stored (which may hold a second
 * IMEI comma-separated) so a dual-SIM phone is found from either number.
 */
export function imeiHistory(rawImei) {
  const imei = String(rawImei || "").replace(/[^\d,/\s]/g, "").trim();
  if (!imei) throw badRequest("Enter an IMEI to look up.");
  const db = getDb();
  const single = imei.split(/[,/\s]+/).filter(Boolean);
  const where = single.map(() => "imei_number LIKE ?").join(" OR ");
  const params = single.map((s) => `%${s}%`);
  const phones = db
    .prepare(`SELECT * FROM phones WHERE (${where}) ORDER BY COALESCE(purchase_date, created_at) ASC`)
    .all(...params);

  const records = phones.map((p) => phoneTrail(db, p));
  const purchases = records.map((r) => ({
    id: r.phone.id,
    financialYear: r.phone.financial_year || null,
    phoneName: r.phone.phone_name,
    model: r.phone.model,
    imei: r.phone.imei_number,
    condition: r.phone.condition,
    date: r.phone.purchase_date,
    amount: Number(r.phone.purchase_price || 0),
    paymentMethod: r.phone.payment_method || null,
    seller: r.seller,
    archived: !!r.phone.deleted_at,
  }));
  const sales = records
    .filter((r) => r.phone.is_sold || r.phone.sold_date)
    .map((r) => ({
      id: r.phone.id,
      financialYear: r.phone.financial_year || null,
      soldDate: r.phone.sold_date,
      amount: Number(r.phone.selling_price || 0),
      customer: r.customer,
      returned: r.phone.return_status === "sales_returned",
    }));
  const returnRows = records.flatMap((r) =>
    r.returns.map((x) => ({ id: r.phone.id, financialYear: r.phone.financial_year || null, ...x })),
  );
  const invoiceRows = records.flatMap((r) =>
    r.invoices.map((x) => ({ id: r.phone.id, financialYear: r.phone.financial_year || null, ...x })),
  );

  const years = [...new Set(records.map((r) => r.phone.financial_year).filter(Boolean))].sort();
  return {
    imei,
    found: records.length > 0,
    count: records.length,
    years,
    purchases,
    sales,
    returns: returnRows,
    invoices: invoiceRows,
    totals: {
      purchased: purchases.reduce((s, p) => s + p.amount, 0),
      sold: sales.reduce((s, p) => s + p.amount, 0),
      returned: returnRows.reduce((s, r) => s + Number(r.return_amount || 0), 0),
    },
  };
}
