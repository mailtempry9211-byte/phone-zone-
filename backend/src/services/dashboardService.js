/**
 * Dashboard metrics & analytics service.
 *
 * Implements real-time SQL aggregation for the Admin Dashboard overview.
 * Complies with Asia/Kolkata (IST) timezone for day/month/FY boundaries.
 * Enforces role-based data projection (admin sees profit/cost/stock values;
 * staff sees volumes and operational counts).
 */
import { getDb } from "../db/index.js";
import { activeFyLabel } from "./financialYearService.js";
import { logger } from "../lib/logger.js";

// 20-second in-memory response cache
const cache = new Map();
const CACHE_TTL_MS = 20 * 1000;

export function invalidateDashboardCache() {
  cache.clear();
}

/** Get formatted date in Asia/Kolkata timezone (YYYY-MM-DD). */
export function getIstDateString(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const y = parts.find((p) => p.type === "year")?.value;
  const m = parts.find((p) => p.type === "month")?.value;
  const d = parts.find((p) => p.type === "day")?.value;
  return `${y}-${m}-${d}`;
}

/** Shift a date by days relative to IST. */
function shiftDateStr(dateStr, days) {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + days, 12, 0, 0));
  const sy = dt.getUTCFullYear();
  const sm = String(dt.getUTCMonth() + 1).padStart(2, "0");
  const sd = String(dt.getUTCDate()).padStart(2, "0");
  return `${sy}-${sm}-${sd}`;
}

/** Normalise phone brand from brand column or first word of phone_name. */
function extractBrand(phoneName = "") {
  const lower = phoneName.trim().toLowerCase();
  if (!lower) return "Other";
  if (lower.includes("apple") || lower.includes("iphone") || lower.includes("ipad")) return "Apple";
  if (lower.includes("samsung") || lower.includes("galaxy")) return "Samsung";
  if (lower.includes("xiaomi") || lower.includes("redmi") || lower.includes("poco")) return "Xiaomi";
  if (lower.includes("oneplus")) return "OnePlus";
  if (lower.includes("vivo") || lower.includes("iqoo")) return "Vivo";
  if (lower.includes("oppo")) return "Oppo";
  if (lower.includes("realme")) return "Realme";
  if (lower.includes("motorola") || lower.includes("moto")) return "Motorola";
  if (lower.includes("google") || lower.includes("pixel")) return "Google";
  if (lower.includes("nothing")) return "Nothing";
  const firstWord = phoneName.trim().split(/\s+/)[0];
  return firstWord.charAt(0).toUpperCase() + firstWord.slice(1);
}

/**
 * Main dashboard overview data provider.
 * @param {object} options
 * @param {'week'|'month'|'year'} [options.range='week']
 * @param {string} [options.shop]
 * @param {string} [options.fy]
 * @param {string} [options.role='staff']
 * @param {boolean} [options.nocache=false]
 */
export function getDashboardOverview({ range = "week", date = "", shop = "", fy = "", role = "staff", nocache = false } = {}) {
  const isAdmin = role === "admin";
  const activeFy = fy || activeFyLabel() || "";
  const cacheKey = `${range}_${date}_${shop}_${activeFy}_${isAdmin ? "admin" : "staff"}`;

  if (!nocache) {
    const cached = cache.get(cacheKey);
    if (cached && Date.now() - cached.ts < CACHE_TTL_MS) {
      return cached.data;
    }
  }

  const db = getDb();
  const now = new Date();
  const todayStr = getIstDateString(now);
  const yesterdayStr = shiftDateStr(todayStr, -1);

  // Shop filter clauses if shop scoping is present
  const shopClause = shop && shop !== "all" ? " AND shop_id = ?" : "";
  const shopParams = shop && shop !== "all" ? [shop] : [];

  // 1. Sales & Purchases for a single target date
  const getDayMetrics = (dateStr) => {
    // Sold phones on that date (supports ISO string, YYYY-MM-DD or created_at fallback)
    const salesRow = db
      .prepare(
        `SELECT COUNT(*) AS phones_sold,
                COALESCE(SUM(selling_price), 0) AS sales_amount,
                COALESCE(SUM(purchase_price), 0) AS cost_amount,
                COALESCE(SUM(selling_price - purchase_price), 0) AS profit
         FROM phones
         WHERE is_sold = 1
           AND deleted_at IS NULL
           AND (return_status IS NULL OR return_status != 'sales_returned')
           AND (substr(sold_date, 1, 10) = ? OR date(sold_date) = ? OR (sold_date IS NULL AND date(created_at) = ?))
           ${shopClause}`,
      )
      .get(dateStr, dateStr, dateStr, ...shopParams) || {};

    // Purchases on that date
    const purchasesRow = db
      .prepare(
        `SELECT COUNT(*) AS phones_bought,
                COALESCE(SUM(purchase_price), 0) AS purchases_amount
         FROM phones
         WHERE deleted_at IS NULL
           AND (return_status IS NULL OR return_status != 'purchase_returned')
           AND (substr(purchase_date, 1, 10) = ? OR date(purchase_date) = ? OR (purchase_date IS NULL AND date(created_at) = ?))
           ${shopClause}`,
      )
      .get(dateStr, dateStr, dateStr, ...shopParams) || {};

    // Returns on that date
    const returnsRow = db
      .prepare(
        `SELECT COUNT(*) AS returns_count
         FROM returns
         WHERE (substr(created_at, 1, 10) = ? OR date(created_at) = ?)
         ${shopClause}`,
      )
      .get(dateStr, dateStr, ...shopParams) || {};

    return {
      salesAmount: Number(salesRow.sales_amount || 0),
      phonesSold: Number(salesRow.phones_sold || 0),
      profit: isAdmin ? Number(salesRow.profit || 0) : undefined,
      purchasesAmount: Number(purchasesRow.purchases_amount || 0),
      phonesBought: Number(purchasesRow.phones_bought || 0),
      returnsCount: Number(returnsRow.returns_count || 0),
    };
  };

  // Range metrics across multiple days (e.g. 7 days or 30 days)
  const getRangeMetrics = (fromDate, toDate = null) => {
    const toClause = toDate ? " AND (substr(sold_date, 1, 10) <= ? OR (sold_date IS NULL AND date(created_at) <= ?))" : "";
    const toPurchasesClause = toDate ? " AND (substr(purchase_date, 1, 10) <= ? OR (purchase_date IS NULL AND date(created_at) <= ?))" : "";
    const toParams = toDate ? [toDate, toDate] : [];

    const salesRow = db
      .prepare(
        `SELECT COUNT(*) AS phones_sold,
                COALESCE(SUM(selling_price), 0) AS sales_amount,
                COALESCE(SUM(purchase_price), 0) AS cost_amount,
                COALESCE(SUM(selling_price - purchase_price), 0) AS profit
         FROM phones
         WHERE is_sold = 1
           AND deleted_at IS NULL
           AND (return_status IS NULL OR return_status != 'sales_returned')
           AND (substr(sold_date, 1, 10) >= ? OR (sold_date IS NULL AND date(created_at) >= ?))
           ${toClause}
           ${shopClause}`,
      )
      .get(fromDate, fromDate, ...toParams, ...shopParams) || {};

    const purchasesRow = db
      .prepare(
        `SELECT COUNT(*) AS phones_bought,
                COALESCE(SUM(purchase_price), 0) AS purchases_amount
         FROM phones
         WHERE deleted_at IS NULL
           AND (return_status IS NULL OR return_status != 'purchase_returned')
           AND (substr(purchase_date, 1, 10) >= ? OR (purchase_date IS NULL AND date(created_at) >= ?))
           ${toPurchasesClause}
           ${shopClause}`,
      )
      .get(fromDate, fromDate, ...toParams, ...shopParams) || {};

    const returnsRow = db
      .prepare(
        `SELECT COUNT(*) AS returns_count
         FROM returns
         WHERE (substr(created_at, 1, 10) >= ? OR date(created_at) >= ?)
         ${toDate ? " AND (substr(created_at, 1, 10) <= ? OR date(created_at) <= ?)" : ""}
         ${shopClause}`,
      )
      .get(fromDate, fromDate, ...toParams, ...shopParams) || {};

    return {
      salesAmount: Number(salesRow.sales_amount || 0),
      phonesSold: Number(salesRow.phones_sold || 0),
      profit: isAdmin ? Number(salesRow.profit || 0) : undefined,
      purchasesAmount: Number(purchasesRow.purchases_amount || 0),
      phonesBought: Number(purchasesRow.phones_bought || 0),
      returnsCount: Number(returnsRow.returns_count || 0),
    };
  };

  const today = getDayMetrics(todayStr);
  const yesterday = getDayMetrics(yesterdayStr);

  // 2. Unsold Stock & Aging Buckets
  const stockRows = db
    .prepare(
      `SELECT id, selling_price, purchase_price, phone_name,
              CAST(julianday('now', 'localtime') - julianday(COALESCE(purchase_date, date(created_at), 'now')) AS INTEGER) AS age_days
       FROM phones
       WHERE is_sold = 0
         AND deleted_at IS NULL
         AND (return_status IS NULL OR return_status != 'purchase_returned')
         ${shopClause}`,
    )
    .all(...shopParams);

  const stockCount = stockRows.length;
  const stockValue = stockRows.reduce((acc, row) => acc + Number(row.selling_price || 0), 0);

  const agingBuckets = { d0_30: 0, d31_60: 0, d61_90: 0, d90plus: 0 };
  const brandMap = new Map();

  for (const row of stockRows) {
    const age = Number(row.age_days || 0);
    if (age <= 30) agingBuckets.d0_30++;
    else if (age <= 60) agingBuckets.d31_60++;
    else if (age <= 90) agingBuckets.d61_90++;
    else agingBuckets.d90plus++;

    const b = extractBrand(row.phone_name);
    const existing = brandMap.get(b) || { name: b, count: 0, value: 0 };
    existing.count += 1;
    existing.value += Number(row.selling_price || 0);
    brandMap.set(b, existing);
  }

  // Top 5 brands + Others
  const sortedBrands = Array.from(brandMap.values()).sort((a, b) => b.count - a.count);
  const topBrands = sortedBrands.slice(0, 5);
  const otherBrands = sortedBrands.slice(5);
  if (otherBrands.length > 0) {
    const otherAgg = otherBrands.reduce(
      (acc, curr) => ({ name: "Others", count: acc.count + curr.count, value: acc.value + curr.value }),
      { name: "Others", count: 0, value: 0 },
    );
    topBrands.push(otherAgg);
  }

  const brands = topBrands.map((b) => ({
    name: b.name,
    count: b.count,
    ...(isAdmin ? { value: b.value } : {}),
  }));

  // 3. Customers, Sellers & Messages
  const totalCustomers = db.prepare(`SELECT COUNT(*) AS c FROM customers WHERE deleted_at IS NULL`).get()?.c || 0;
  const newCustomers30d =
    db
      .prepare(
        `SELECT COUNT(*) AS c FROM customers WHERE deleted_at IS NULL AND created_at >= datetime('now', '-30 days', 'localtime')`,
      )
      .get()?.c || 0;
  const totalSellers = db.prepare(`SELECT COUNT(*) AS c FROM sellers WHERE deleted_at IS NULL`).get()?.c || 0;
  const unreadMessages = db.prepare(`SELECT COUNT(*) AS c FROM messages WHERE is_read = 0`).get()?.c || 0;

  // 4. Repairs Pipeline & Balance Due
  let repairs = {
    available: false,
    pending: 0,
    readyForDelivery: 0,
    balanceDue: isAdmin ? 0 : undefined,
    byStage: {
      received: 0,
      diagnosing: 0,
      waiting_parts: 0,
      in_progress: 0,
      ready: 0,
      delivered: 0,
    },
    jobs: [],
  };

  try {
    const repairStageRows = db
      .prepare(
        `SELECT status, COUNT(*) AS count
         FROM repair_jobs
         WHERE deleted_at IS NULL
         ${shopClause}
         GROUP BY status`,
      )
      .all(...shopParams);

    const byStage = {
      received: 0,
      diagnosing: 0,
      waiting_parts: 0,
      in_progress: 0,
      ready: 0,
      delivered: 0,
    };

    for (const r of repairStageRows) {
      if (byStage[r.status] !== undefined) {
        byStage[r.status] = Number(r.count || 0);
      }
    }

    const pendingCount =
      byStage.received + byStage.diagnosing + byStage.waiting_parts + byStage.in_progress;
    const readyCount = byStage.ready;

    // Balance Due = sum of balance for non-delivered non-cancelled jobs
    const balanceRow = db
      .prepare(
        `SELECT COALESCE(SUM(CASE WHEN (COALESCE(final_price, estimate, 0) - COALESCE(advance_paid, 0)) > 0 THEN (COALESCE(final_price, estimate, 0) - COALESCE(advance_paid, 0)) ELSE 0 END), 0) AS due
         FROM repair_jobs
         WHERE deleted_at IS NULL
           AND status NOT IN ('delivered', 'cancelled')
           ${shopClause}`,
      )
      .get(...shopParams);

    // Recent active repair jobs
    const recentJobRows = db
      .prepare(
        `SELECT rj.id, rj.job_no, rj.device_brand, rj.device_model, rj.problem, rj.status,
                CAST(julianday('now', 'localtime') - julianday(COALESCE(rj.received_at, rj.created_at)) AS INTEGER) AS age_days,
                rc.name AS customer_name
         FROM repair_jobs rj
         LEFT JOIN repair_customers rc ON rc.id = rj.repair_customer_id
         WHERE rj.deleted_at IS NULL
           AND rj.status != 'delivered'
           ${shopClause ? " AND rj.shop_id = ?" : ""}
         ORDER BY rj.created_at DESC
         LIMIT 8`,
      )
      .all(...shopParams);

    const jobs = recentJobRows.map((j) => ({
      id: j.id,
      jobNo: j.job_no || "RJ-000",
      customerName: j.customer_name || "Walk-in Customer",
      device: `${j.device_brand || ""} ${j.device_model || ""}`.trim() || "Smartphone",
      problem: j.problem || "Repair inspection",
      status: j.status || "received",
      ageDays: Math.max(0, Number(j.age_days || 0)),
    }));

    // Repair revenue calculation (Item 8)
    const repairRevenueRow = db.prepare(
      `SELECT COUNT(*) AS total_delivered,
              COALESCE(SUM(COALESCE(final_price, estimate, 0)), 0) AS total_revenue
       FROM repair_jobs
       WHERE deleted_at IS NULL AND status = 'delivered'
       ${shopClause}`
    ).get(...shopParams) || {};

    const repairTodayRow = db.prepare(
      `SELECT COUNT(*) AS today_delivered,
              COALESCE(SUM(COALESCE(final_price, estimate, 0)), 0) AS today_revenue
       FROM repair_jobs
       WHERE deleted_at IS NULL AND status = 'delivered'
         AND (date(delivered_at) = ? OR (delivered_at IS NULL AND date(updated_at) = ?))
       ${shopClause}`
    ).get(todayStr, todayStr, ...shopParams) || {};

    repairs = {
      available: true,
      pending: pendingCount,
      readyForDelivery: readyCount,
      balanceDue: isAdmin ? Number(balanceRow?.due || 0) : undefined,
      totalDelivered: Number(repairRevenueRow?.total_delivered || 0),
      totalRevenue: Number(repairRevenueRow?.total_revenue || 0),
      todayDelivered: Number(repairTodayRow?.today_delivered || 0),
      todayRevenue: Number(repairTodayRow?.today_revenue || 0),
      byStage,
      jobs,
    };
  } catch (err) {
    logger.warn({ err: err?.message || String(err) }, "repairs module dashboard query warning");
    repairs.available = false;
  }

  // 5. Chart Time Series (Week = 7 days, Month = 30 days, Year = 12 months)
  const series = [];
  if (range === "year") {
    // 12 months for current FY: April to March
    const months = ["Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec", "Jan", "Feb", "Mar"];
    // Get start year from active FY e.g. "2026-2027" -> 2026
    let startYear = now.getFullYear();
    if (activeFy && activeFy.includes("-")) {
      const parsed = parseInt(activeFy.split("-")[0], 10);
      if (!isNaN(parsed)) startYear = parsed;
    }

    months.forEach((mLabel, idx) => {
      const year = idx >= 9 ? startYear + 1 : startYear;
      const monthNum = idx >= 9 ? idx - 8 : idx + 4; // 4..12, then 1..3
      const monthPrefix = `${year}-${String(monthNum).padStart(2, "0")}`;

      const mRow = db
        .prepare(
          `SELECT COUNT(*) AS c,
                  COALESCE(SUM(selling_price), 0) AS s,
                  COALESCE(SUM(selling_price - purchase_price), 0) AS p
           FROM phones
           WHERE is_sold = 1
             AND deleted_at IS NULL
             AND (return_status IS NULL OR return_status != 'sales_returned')
             AND (sold_date LIKE ? OR (sold_date IS NULL AND date(created_at) LIKE ?))
             ${shopClause}`,
        )
        .get(`${monthPrefix}%`, `${monthPrefix}%`, ...shopParams);

      series.push({
        label: mLabel,
        date: monthPrefix,
        sales: Number(mRow?.s || 0),
        count: Number(mRow?.c || 0),
        ...(isAdmin ? { profit: Number(mRow?.p || 0) } : {}),
      });
    });
  } else {
    // Days series: 7 days or 30 days
    const numDays = range === "month" ? 30 : 7;
    for (let i = numDays - 1; i >= 0; i--) {
      const dStr = shiftDateStr(todayStr, -i);
      const row = db
        .prepare(
          `SELECT COUNT(*) AS c,
                  COALESCE(SUM(selling_price), 0) AS s,
                  COALESCE(SUM(selling_price - purchase_price), 0) AS p
           FROM phones
           WHERE is_sold = 1
             AND deleted_at IS NULL
             AND (return_status IS NULL OR return_status != 'sales_returned')
             AND (substr(sold_date, 1, 10) = ? OR date(sold_date) = ? OR (sold_date IS NULL AND date(created_at) = ?))
             ${shopClause}`,
        )
        .get(dStr, dStr, dStr, ...shopParams);

      const [_, mm, dd] = dStr.split("-");
      const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
      const label = `${parseInt(dd, 10)} ${monthNames[parseInt(mm, 10) - 1]}`;

      series.push({
        label,
        date: dStr,
        sales: Number(row?.s || 0),
        count: Number(row?.c || 0),
        ...(isAdmin ? { profit: Number(row?.p || 0) } : {}),
      });
    }
  }

  // 6. Recent Invoices (last 8) with real device and party details
  const invoiceRows = db
    .prepare(
      `SELECT inv.id, inv.invoice_number, inv.invoice_type, inv.amount, inv.created_at,
              inv.phone_id, inv.customer_id, inv.seller_id,
              COALESCE(c.name, s.name, 'Customer') AS party_name,
              p.phone_name, p.model, p.colour, p.variant, p.condition
       FROM invoices inv
       LEFT JOIN customers c ON c.id = inv.customer_id
       LEFT JOIN sellers s ON s.id = inv.seller_id
       LEFT JOIN phones p ON p.id = inv.phone_id
       ${shopClause ? "WHERE inv.shop_id = ?" : ""}
       ORDER BY inv.created_at DESC
       LIMIT 8`,
    )
    .all(...shopParams);

  const recentInvoices = invoiceRows.map((inv) => ({
    id: inv.id,
    number: inv.invoice_number || "INV-001",
    type: inv.invoice_type || "sale",
    party: inv.party_name || "Direct Party",
    amount: Number(inv.amount || 0),
    status: "paid",
    date: inv.created_at || todayStr,
    phoneId: inv.phone_id || null,
    phoneName: inv.phone_name || "",
    model: inv.model || "",
    variant: inv.variant || "",
    colour: inv.colour || "",
    condition: inv.condition || "",
  }));

  // 7. Actionable Alerts
  const alerts = [];
  if (stockCount <= 5) {
    alerts.push({
      type: "stock",
      severity: "warning",
      text: `Low inventory: Only ${stockCount} phones available in stock.`,
      count: stockCount,
      link: "inventory",
    });
  }

  const slowMoversCount = agingBuckets.d61_90 + agingBuckets.d90plus;
  if (slowMoversCount > 0) {
    alerts.push({
      type: "aging",
      severity: "warning",
      text: `${slowMoversCount} phones have been unsold for over 60 days.`,
      count: slowMoversCount,
      link: "inventory",
    });
  }

  if (repairs.available && repairs.readyForDelivery > 0) {
    alerts.push({
      type: "repair_ready",
      severity: "info",
      text: `${repairs.readyForDelivery} completed repair jobs waiting for customer delivery.`,
      count: repairs.readyForDelivery,
      link: "repairs",
    });
  }

  if (unreadMessages > 0) {
    alerts.push({
      type: "message",
      severity: "info",
      text: `${unreadMessages} new customer messages on website contact form.`,
      count: unreadMessages,
      link: "messages",
    });
  }

  // 6. FY Total Sales & Revenue across the open book
  const fySalesRow = db
    .prepare(
      `SELECT COUNT(*) AS total_sold,
              COALESCE(SUM(selling_price), 0) AS total_revenue,
              COALESCE(SUM(purchase_price), 0) AS total_cost,
              COALESCE(SUM(selling_price - purchase_price), 0) AS total_profit
       FROM phones
       WHERE is_sold = 1
         AND deleted_at IS NULL
         AND (return_status IS NULL OR return_status != 'sales_returned')
         ${activeFy ? " AND (COALESCE(financial_year, ?) = ? OR carried_to_fy = ?)" : ""}
         ${shopClause}`,
    )
    .get(...(activeFy ? [activeFy, activeFy, activeFy] : []), ...shopParams) || {};

  // 8. Purchase Overview & Model Valuation Stats (Item 7)
  const purchase7d = db.prepare(
    `SELECT COUNT(*) as count, COALESCE(SUM(purchase_price), 0) as total
     FROM phones
     WHERE deleted_at IS NULL AND purchase_date >= datetime('now', '-7 days', 'localtime')
     ${shopClause}`
  ).get(...shopParams) || {};

  const purchasePrev7d = db.prepare(
    `SELECT COUNT(*) as count, COALESCE(SUM(purchase_price), 0) as total
     FROM phones
     WHERE deleted_at IS NULL
       AND purchase_date >= datetime('now', '-14 days', 'localtime')
       AND purchase_date < datetime('now', '-7 days', 'localtime')
     ${shopClause}`
  ).get(...shopParams) || {};

  const modelAverages = db.prepare(
    `SELECT 
       phone_name,
       model,
       COUNT(*) as units_purchased,
       ROUND(AVG(purchase_price), 0) as avg_purchase_price,
       MIN(purchase_price) as min_purchase_price,
       MAX(purchase_price) as max_purchase_price,
       ROUND(AVG(selling_price), 0) as avg_selling_price
     FROM phones
     WHERE deleted_at IS NULL
     GROUP BY LOWER(TRIM(phone_name)), LOWER(TRIM(model))
     ORDER BY units_purchased DESC, avg_purchase_price DESC
     LIMIT 30`
  ).all();

  const brandAverages = db.prepare(
    `SELECT 
       SUBSTR(phone_name, 1, INSTR(phone_name || ' ', ' ') - 1) as brand,
       COUNT(*) as units,
       ROUND(AVG(purchase_price), 0) as avg_purchase_price,
       ROUND(AVG(selling_price), 0) as avg_selling_price
     FROM phones
     WHERE deleted_at IS NULL AND phone_name IS NOT NULL AND phone_name != '' AND LOWER(phone_name) NOT LIKE '%object%'
     GROUP BY LOWER(TRIM(SUBSTR(phone_name, 1, INSTR(phone_name || ' ', ' ') - 1)))
     ORDER BY units DESC
     LIMIT 15`
  ).all();

  const topSellers = db.prepare(
    `SELECT s.id, s.name, s.phone, COUNT(p.id) as phones_supplied, COALESCE(SUM(p.purchase_price), 0) as total_volume, ROUND(AVG(p.purchase_price), 0) as avg_ticket
     FROM sellers s
     LEFT JOIN phones p ON p.seller_id = s.id AND p.deleted_at IS NULL
     WHERE s.deleted_at IS NULL
     GROUP BY s.id
     ORDER BY total_volume DESC
     LIMIT 10`
  ).all();

  const purchaseOverview = {
    incoming7dCount: Number(purchase7d.count || 0),
    incoming7dAmount: Number(purchase7d.total || 0),
    incomingPrev7dCount: Number(purchasePrev7d.count || 0),
    isLowIncoming: Number(purchase7d.count || 0) < 3,
    modelAverages,
    brandAverages,
    topSellers,
  };

  // Calculate selected period / target date metrics for the live dashboard cards
  let periodMetrics = today;
  let periodLabel = "Today";

  if (date && date.trim()) {
    periodMetrics = getDayMetrics(date.trim());
    periodLabel = `Date: ${date.trim()}`;
  } else if (range === "yesterday") {
    periodMetrics = yesterday;
    periodLabel = "Yesterday";
  } else if (range === "week") {
    const from7d = shiftDateStr(todayStr, -6);
    periodMetrics = getRangeMetrics(from7d);
    periodLabel = "Last 7 Days";
  } else if (range === "month") {
    const from30d = shiftDateStr(todayStr, -29);
    periodMetrics = getRangeMetrics(from30d);
    periodLabel = "Last 30 Days";
  } else if (range === "year") {
    const fyPurchasesRow = db
      .prepare(
        `SELECT COUNT(*) AS total_bought,
                COALESCE(SUM(purchase_price), 0) AS total_spent
         FROM phones
         WHERE deleted_at IS NULL
           AND (return_status IS NULL OR return_status != 'purchase_returned')
           ${activeFy ? " AND (COALESCE(financial_year, ?) = ? OR carried_to_fy = ?)" : ""}
           ${shopClause}`,
      )
      .get(...(activeFy ? [activeFy, activeFy, activeFy] : []), ...shopParams) || {};

    periodMetrics = {
      salesAmount: Number(fySalesRow.total_revenue || 0),
      phonesSold: Number(fySalesRow.total_sold || 0),
      profit: isAdmin ? Number(fySalesRow.total_profit || 0) : undefined,
      purchasesAmount: Number(fyPurchasesRow.total_spent || 0),
      phonesBought: Number(fyPurchasesRow.total_bought || 0),
      returnsCount: 0,
    };
    periodLabel = `Financial Year (${activeFy || "2026-27"})`;
  }

  const result = {
    generatedAt: now.toISOString(),
    timezone: "Asia/Kolkata",
    financialYear: activeFy,
    range,
    selectedDate: date || null,
    periodLabel,
    periodMetrics,
    today,
    yesterday,
    purchaseOverview,
    fyTotals: {
      soldCount: Number(fySalesRow.total_sold || 0),
      revenue: Number(fySalesRow.total_revenue || 0),
      cost: Number(fySalesRow.total_cost || 0),
      profit: isAdmin ? Number(fySalesRow.total_profit || 0) : undefined,
    },
    stock: {
      count: stockCount,
      ...(isAdmin ? { value: stockValue } : {}),
      agingBuckets,
      lowStock: stockCount <= 5,
      threshold: 5,
    },
    people: {
      customers: totalCustomers,
      sellers: totalSellers,
      newCustomers30d,
    },
    messages: {
      unread: unreadMessages,
    },
    repairs,
    series,
    brands,
    recentInvoices,
    alerts,
  };

  cache.set(cacheKey, { ts: Date.now(), data: result });
  return result;
}

