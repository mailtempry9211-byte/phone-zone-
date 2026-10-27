/** Dashboard metrics, profit and CSV exports. */
import { getDb } from "../db/index.js";
import { activeFyLabel } from "./financialYearService.js";

/** `AND <col> = <active FY>` - keeps every figure inside the open book. */
function fyScope(col = "financial_year") {
  const fy = activeFyLabel();
  return fy ? { sql: ` AND COALESCE(${col}, ?) = ?`, params: [fy, fy] } : { sql: "", params: [] };
}

const dateFilter = (col, from, to) => {
  const clauses = [];
  const params = [];
  if (from) { clauses.push(`${col} >= ?`); params.push(from); }
  if (to) { clauses.push(`${col} <= ?`); params.push(to); }
  return { sql: clauses.length ? ` AND ${clauses.join(" AND ")}` : "", params };
};

export function dashboard({ from, to } = {}) {
  const db = getDb();
  const purchased = dateFilter("purchase_date", from, to);
  const sold = dateFilter("sold_date", from, to);
  const fy = fyScope();
  const fyS = fyScope("financial_year");

  const inv = db
    .prepare(
      `SELECT COUNT(*) AS total,
              SUM(CASE WHEN is_sold = 0 THEN 1 ELSE 0 END) AS available,
              SUM(CASE WHEN is_sold = 1 THEN 1 ELSE 0 END) AS sold,
              COALESCE(SUM(CASE WHEN is_sold = 0 THEN selling_price END),0) AS stock_value
       FROM phones WHERE deleted_at IS NULL AND (return_status IS NULL OR return_status != 'purchase_returned')
       ${fy.label ? `AND (COALESCE(financial_year, ?) = ? OR carried_to_fy = ? OR is_sold = 0)` : ""}${purchased.sql}`,
    )
    .get(...(fy.label ? [fy.label, fy.label, fy.label] : []), ...purchased.params);

  const money = db
    .prepare(
      `SELECT COALESCE(SUM(selling_price),0) AS revenue,
              COALESCE(SUM(purchase_price),0) AS cost,
              COALESCE(SUM(selling_price - purchase_price),0) AS profit
       FROM phones WHERE is_sold = 1 AND deleted_at IS NULL${fy.sql}${sold.sql}`,
    )
    .get(...fy.params, ...sold.params);

  const spend = db
    .prepare(`SELECT COALESCE(SUM(purchase_price),0) AS total FROM phones WHERE deleted_at IS NULL${fy.sql}${purchased.sql}`)
    .get(...fy.params, ...purchased.params);

  const count = (t, extra = "") => db.prepare(`SELECT COUNT(*) AS n FROM ${t} ${extra}`).get().n;

  return {
    inventory: {
      total: inv.total || 0,
      available: inv.available || 0,
      sold: inv.sold || 0,
      stockValue: inv.stock_value || 0,
    },
    finance: {
      revenue: money.revenue,
      costOfGoodsSold: money.cost,
      profit: money.profit,
      totalPurchaseSpend: spend.total,
    },
    counts: {
      sellers: count("sellers", "WHERE deleted_at IS NULL"),
      customers: count("customers", "WHERE deleted_at IS NULL"),
      repairs: count("repairs", "WHERE deleted_at IS NULL"),
      returns: activeFyLabel() ? db.prepare("SELECT COUNT(*) AS n FROM returns WHERE COALESCE(financial_year, ?) = ?").get(activeFyLabel(), activeFyLabel()).n : count("returns"),
      messages: count("messages"),
      unreadMessages: count("messages", "WHERE is_read = 0"),
      invoices: activeFyLabel() ? db.prepare("SELECT COUNT(*) AS n FROM invoices WHERE COALESCE(financial_year, ?) = ?").get(activeFyLabel(), activeFyLabel()).n : count("invoices"),
    },
    financialYear: activeFyLabel(),
  };
}

const CSV_QUERIES = {
  sellers: "SELECT * FROM sellers WHERE deleted_at IS NULL",
  customers: "SELECT * FROM customers WHERE deleted_at IS NULL",
  inventory: "SELECT * FROM phones WHERE is_sold = 0 AND deleted_at IS NULL",
  purchases: "SELECT * FROM phones WHERE deleted_at IS NULL",
  sales: "SELECT * FROM phones WHERE is_sold = 1 AND deleted_at IS NULL",
  returns: "SELECT * FROM returns WHERE 1=1",
  repairs: "SELECT * FROM repairs WHERE deleted_at IS NULL",
  invoices: "SELECT * FROM invoices WHERE 1=1",
};

export function exportCsv(entity) {
  const sql = CSV_QUERIES[entity];
  if (!sql) return null;
  const fy = activeFyLabel();
  const scoped = fy && ["inventory", "purchases", "sales", "returns", "invoices"].includes(entity)
    ? { sql: `${sql} AND COALESCE(financial_year, ?) = ?`, params: [fy, fy] }
    : { sql, params: [] };
  const rows = getDb().prepare(scoped.sql).all(...scoped.params);
  if (!rows.length) return "";
  const headers = Object.keys(rows[0]);
  const escape = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  return [headers.join(","), ...rows.map((r) => headers.map((h) => escape(r[h])).join(","))].join("\n");
}

export const exportableEntities = Object.keys(CSV_QUERIES);
