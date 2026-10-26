/**
 * PostgREST-compatible compatibility layer.
 *
 * Lets the existing admin UI (which speaks `supabase.from(...)`) run unchanged
 * against the local SQLite database when the app is in offline mode.
 * No new tables, no new services - it reuses the existing db + storage service.
 */
import { randomUUID } from "node:crypto";
import express from "express";
import multer from "multer";
import { getDb } from "../db/index.js";
import * as storage from "../services/storageService.js";
import { SERVER } from "../config/business.js";
import { activeFyLabel, isPreviousYearActive, recordPreviousYearChange } from "../services/financialYearService.js";
import { badRequest, forbidden, AppError } from "../lib/errors.js";
import { makeLimiter } from "../lib/rateLimit.js";

/**
 * Accounting tables that are stamped with (and read from) a financial year.
 * sellers/customers are deliberately absent - people carry forward every year.
 */
const FY_SCOPED = new Set(["phones", "returns", "invoices"]);

export const FY_COLUMN = "financial_year";

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: SERVER.maxUploadBytes } });
const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

/**
 * Mutation guard for the compatibility layer.
 *
 * Every table insert/update/delete and every storage write goes through here.
 * The ceiling is deliberately high (bulk restore and "delete all files" both
 * issue one request per row) - it only stops a runaway loop, not real work.
 */
const writeLimiter = makeLimiter(3000, 60 * 1000, "write operations");
function guardWrites(req) {
  if (!writeLimiter.allow(req)) throw new AppError(writeLimiter.message, 429, "too_many_requests");
}

const ALLOWED = new Set([
  "phones", "customers", "sellers", "messages", "returns",
  "admin_settings", "invoices", "repairs", "files", "audit_logs",
  "shops",
]);

/**
 * Tables the delete route may touch. `audit_logs` (the tamper-evident log) and
 * `files` (binary metadata) are deliberately NOT deletable through this
 * compatibility layer - removing log rows would defeat the audit trail.
 */
const DELETE_ALLOWED = new Set([
  "phones", "customers", "sellers", "messages", "returns",
  "admin_settings", "invoices", "repairs", "shops",
]);

/**
 * Tables the compatibility layer may never write to.
 *
 * `audit_logs` is the tamper-evident trail: rows are written only by backend
 * services, never by a client (insert/update/delete all answer 403).
 * `files` metadata is created by the upload endpoint and the storage service;
 * letting a client insert/update a row would let it point `relative_path` at
 * an arbitrary file, so compat writes are refused and uploads stay on
 * POST /api/files (see REPORT.md stage 1.1).
 */
const COMPAT_WRITE_FORBIDDEN = new Set(["audit_logs", "files"]);

/** Columns no compat update may ever change, on any table. */
const PROTECTED_UPDATE_COLUMNS = new Set(["id", "created_at"]);

/**
 * Contact-form messages are not accounting history; the admin UI explicitly
 * offers "delete this message" / "delete all", so they stay hard-deletable.
 * Every other deletable table with a `deleted_at` column is SOFT deleted.
 */
const HARD_DELETE_TABLES = new Set(["messages"]);

/**
 * Guard for every `/:table/...` route. Without this the table name travelled
 * straight into SQL (it is a URL segment, so it was never parameterised).
 */
function table(name) {
  if (!ALLOWED.has(String(name))) throw badRequest("Unknown table.");
  return String(name);
}

/**
 * Headers that stop a stored file from executing as a script in the browser.
 * (Same policy as /api/files/:id and /api/public/files/:id.)
 */
function setSafeFileHeaders(res, mimeType) {
  const type = String(mimeType || "").toLowerCase();
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Content-Security-Policy", "default-src 'none'; sandbox");
  const inlineSafe = /^(image\/(jpeg|png|webp|gif|bmp)|application\/pdf)$/.test(type);
  res.setHeader("Content-Disposition", inlineSafe ? "inline" : "attachment");
}

const ALLOWED_COLUMNS = new Map();

function columnsOf(name) {
  if (!ALLOWED_COLUMNS.has(name)) {
    ALLOWED_COLUMNS.set(name, getDb().prepare(`PRAGMA table_info(${name})`).all().map((c) => c.name));
  }
  return ALLOWED_COLUMNS.get(name);
}

/**
 * EXACT column match only. No quote stripping, no aliases: a value that is not
 * byte-for-byte a column name of this table is rejected by the caller. The
 * validated name is the only thing ever interpolated into SQL.
 */
function columnAllowed(tableName, col) {
  const cols = columnsOf(tableName);
  if (!cols) return false;
  return typeof col === "string" && cols.includes(col);
}

/** Filter operators the compat layer understands. */
const FILTER_OPS = new Set(["eq", "neq", "gte", "lte", "is", "in", "or"]);
/** Operators allowed inside a PostgREST-style `or=(...)` expression. */
const OR_OPS = new Set(["eq", "is", "ilike"]);

/**
 * Reject the WHOLE request when any filter names an unknown column or operator.
 * Silently dropping a bad filter is how an empty WHERE ("delete everything")
 * gets built, so nothing is dropped here - it is a 400 instead. `or` carries the
 * expression in `val` and its column names are checked one by one.
 */
function assertFilterColumns(tableName, filters) {
  if (!Array.isArray(filters)) throw badRequest("filters must be an array.");
  for (const f of filters) {
    if (!f || typeof f !== "object") throw badRequest("Invalid filter.");
    const op = String(f.op || "");
    if (!FILTER_OPS.has(op)) throw badRequest(`Unknown filter operator: ${op || "(missing)"}.`);
    if (op === "or") {
      for (const part of String(f.val ?? "").split(",")) {
        const [col, subOp] = part.split(".");
        if (!columnAllowed(tableName, col)) throw badRequest(`Unknown column in filter: ${String(col).slice(0, 60)}.`);
        if (!OR_OPS.has(subOp)) throw badRequest(`Unknown filter operator: ${String(subOp || "(missing)").slice(0, 40)}.`);
      }
      continue;
    }
    if (!columnAllowed(tableName, f.col)) throw badRequest(`Unknown column in filter: ${String(f.col).slice(0, 60)}.`);
  }
}

/** 403 for every write route that must stay server-side-only. */
function assertCompatWritable(t) {
  if (t === "audit_logs") {
    throw forbidden("The audit log is read-only. Audit rows are written only by the server.");
  }
  if (t === "files") {
    throw forbidden("Files are stored by the upload endpoint and cannot be written through this route.");
  }
}

/** First value of a `col IN ('a','b')` CHECK constraint, so NOT NULL enum columns get a legal default. */
function enumDefaults(name) {
  const row = getDb().prepare("SELECT sql FROM sqlite_master WHERE name = ?").get(name);
  const map = {};
  for (const m of (row?.sql || "").matchAll(/(\w+)\s+IN\s*\(\s*'([^']+)'/gi)) map[m[1]] = m[2];
  return map;
}

const maybeJson = (v) => {
  if (typeof v !== "string") return v;
  const t = v.trim();
  if (!t.startsWith("[") && !t.startsWith("{")) return v;
  try { return JSON.parse(t); } catch { return v; }
};

const rowOut = (row) => {
  if (!row) return row;
  const out = {};
  for (const [k, v] of Object.entries(row)) out[k] = maybeJson(v);
  return out;
};

const valueIn = (v) => {
  if (v === undefined) return null;
  if (v === null) return null;
  if (typeof v === "boolean") return v ? 1 : 0;
  if (typeof v === "object") return JSON.stringify(v);
  return v;
};

/** filters: [{ op, col, val }] where op = eq|neq|in|is|gte|lte|or */
function buildWhere(filters = [], tableName = "") {
  // Column names are WHITELISTED against the actual table schema - never
  // interpolated verbatim. This closes the SQL-injection vector where a
  // caller supplies filter.col = "password; DROP TABLE phones; --".
  if (tableName) assertFilterColumns(tableName, filters);
  const clauses = [];
  const params = [];
  for (const f of filters) {
    const col = f.col;
    switch (f.op) {
      case "eq": clauses.push(`"${col}" = ?`); params.push(valueIn(f.val)); break;
      case "neq": clauses.push(`("${col}" IS NULL OR "${col}" <> ?)`); params.push(valueIn(f.val)); break;
      case "gte": clauses.push(`"${col}" >= ?`); params.push(valueIn(f.val)); break;
      case "lte": clauses.push(`"${col}" <= ?`); params.push(valueIn(f.val)); break;
      case "is": clauses.push(f.val === null ? `"${col}" IS NULL` : `"${col}" = ?`);
        if (f.val !== null) params.push(valueIn(f.val));
        break;
      case "in": {
        const list = Array.isArray(f.val) ? f.val : [];
        if (!list.length) { clauses.push("0 = 1"); break; }
        clauses.push(`"${col}" IN (${list.map(() => "?").join(",")})`);
        params.push(...list.map(valueIn));
        break;
      }
      case "or": {
        // "col.eq.x,col2.eq.y" (PostgREST syntax, subset)
        const parts = String(f.val).split(",").map((p) => p.split("."));
        const ors = [];
        for (const [col, op, ...rest] of parts) {
          const raw = rest.join(".");
          // assertFilterColumns already validated every column/operator here.
          // Coerce Postgres boolean literals to SQLite integers (0/1) so
          // filters like `.or('is_sold.eq.true,...')` match stored 0/1 values.
          let value = raw;
          if (raw === "true") value = 1;
          else if (raw === "false") value = 0;
          if (op === "eq") { ors.push(`"${col}" = ?`); params.push(value); }
          else if (op === "is") { ors.push(raw === "null" ? `"${col}" IS NULL` : `"${col}" = ?`); if (raw !== "null") params.push(value); }
          else if (op === "ilike") { ors.push(`"${col}" LIKE ?`); params.push(raw.replace(/\*/g, "%")); }
        }
        if (ors.length) clauses.push(`(${ors.join(" OR ")})`);
        break;
      }
      default: break;
    }
  }
  return { sql: clauses.length ? ` WHERE ${clauses.join(" AND ")}` : "", params };
}

function checkAndSetPreviousYear(res, table, id, action, details = {}) {
  try {
    const prev = isPreviousYearActive();
    if (prev.isPrevious && (table === "phones" || table === "repairs")) {
      recordPreviousYearChange(table, id, action, details);
      res.set("X-Prompt-Carry-Forward", "true");
      res.set("X-From-Year", prev.activeYear);
      res.set("X-To-Year", prev.latestYear);
      res.set("Access-Control-Expose-Headers", "X-Prompt-Carry-Forward, X-From-Year, X-To-Year");
    }
  } catch (_e) {}
}

export function buildCompatRouter(staff, canRead = staff) {
  const r = express.Router();

  r.post("/:table/select", canRead, wrap((req, res) => {
    const t = table(req.params.table);
    const { order, limit, allYears } = req.body || {};
    const filters = [...(req.body?.filters || [])];
    // Accounting data defaults to the ACTIVE financial year, so a new year
    // starts with an empty book. A client that wants one specific year (or all
    // years) says so explicitly and is trusted verbatim.
    if (FY_SCOPED.has(t) && !allYears && !filters.some((f) => f.col === FY_COLUMN)) {
      const fy = activeFyLabel();
      if (fy) filters.push({ op: "eq", col: FY_COLUMN, val: fy });
    }
    // Soft-deleted rows are hidden from normal reads. A client that really wants
    // them (or a historical view) says so with an explicit deleted_at filter.
    if (columnsOf(t).includes("deleted_at") && !filters.some((f) => f.col === "deleted_at")) {
      filters.push({ op: "is", col: "deleted_at", val: null });
    }

    // Multi-shop scoping: non-admin users only see rows belonging to their shop.
    // Admin users can inspect all shops or filter by ?shop=<id>.
    const hasShopId = columnsOf(t).includes("shop_id");
    const isAdmin = req.user?.roles?.includes("admin");
    const userShopId = req.user?.shopId || "shop_1";

    if (hasShopId) {
      if (!isAdmin) {
        filters.push({ op: "eq", col: "shop_id", val: userShopId });
      } else if (req.query?.shop && req.query.shop !== "all") {
        filters.push({ op: "eq", col: "shop_id", val: req.query.shop });
      }
    }

    const where = buildWhere(filters, t);
    let sql = `SELECT * FROM ${t}${where.sql}`;
    if (order?.column && columnsOf(t).includes(order.column)) {
      sql += ` ORDER BY "${order.column}" ${order.ascending === false ? "DESC" : "ASC"}`;
                }
    if (limit) sql += ` LIMIT ${Number(limit)}`;
    const db = getDb();
    const rows = db.prepare(sql).all(...where.params).map(rowOut);

    // Nest related rows so the existing admin UI (which uses Supabase-style
    // `*, sellers(...), customers(...)` selects) gets `phone.sellers` /
    // `phone.customers` objects instead of undefined -> "N/A".
    if (t === "phones") {
      const sellerOf = db.prepare("SELECT id, name, phone, address, id_proof_type, id_number FROM sellers WHERE id = ? AND deleted_at IS NULL");
      const customerOf = db.prepare("SELECT id, name, phone, address, id_proof_type, id_number FROM customers WHERE id = ? AND deleted_at IS NULL");
      res.json(rows.map((p) => ({
        ...p,
        sellers: p.seller_id ? (sellerOf.get(p.seller_id) || null) : null,
        customers: p.customer_id ? (customerOf.get(p.customer_id) || null) : null,
      })));
    } else if (t === "invoices") {
      const phoneOf = db.prepare("SELECT id, phone_name, model, imei_number, condition, purchase_price, selling_price FROM phones WHERE id = ?");
      const sellerOf = db.prepare("SELECT id, name, phone, address, id_proof_type, id_number FROM sellers WHERE id = ?");
      const customerOf = db.prepare("SELECT id, name, phone, address, id_proof_type, id_number FROM customers WHERE id = ?");
      res.json(rows.map((i) => ({
        ...i,
        phones: i.phone_id ? (phoneOf.get(i.phone_id) || null) : null,
        sellers: i.seller_id ? (sellerOf.get(i.seller_id) || null) : null,
        customers: i.customer_id ? (customerOf.get(i.customer_id) || null) : null,
      })));
    } else if (t === "returns") {
      // The admin returns screen renders `returnItem.phones/customers/sellers`;
      // embed them like the phones/invoices branches do.
      const phoneOf = db.prepare("SELECT * FROM phones WHERE id = ?");
      const customerOf = db.prepare("SELECT id, name, phone, address, id_proof_type, id_number FROM customers WHERE id = ?");
      const sellerOf = db.prepare("SELECT id, name, phone, address, id_proof_type, id_number FROM sellers WHERE id = ?");
      res.json(rows.map((r) => ({
        ...r,
        phones: r.phone_id ? (phoneOf.get(r.phone_id) || null) : null,
        customers: r.customer_id ? (customerOf.get(r.customer_id) || null) : null,
        sellers: r.seller_id ? (sellerOf.get(r.seller_id) || null) : null,
      })));
    } else if (t === "customers" || t === "sellers") {
      res.json(rows.map((r) => {
        if (r.id_proof_type === "aadhaar" && r.id_number) {
          const raw = String(r.id_number).trim();
          return {
            ...r,
            id_number_masked: raw.length >= 4 ? `•••• •••• ${raw.slice(-4)}` : raw,
          };
        }
        return r;
      }));
    } else {
      res.json(rows);
    }
  }));

  r.post("/:table/insert", staff, wrap((req, res) => {
    guardWrites(req);
    const t = table(req.params.table);
    assertCompatWritable(t);
    const rows = Array.isArray(req.body?.rows) ? req.body.rows : [req.body?.rows];
    const info = getDb().prepare(`PRAGMA table_info(${t})`).all();
    const cols = info.map((c) => c.name);
    const enums = enumDefaults(t);
    const db = getDb();
    const out = [];
    db.transaction(() => {
      for (const row of rows) {
        const keys = Object.keys(row || {}).filter((k) => cols.includes(k));
        if (!keys.includes("id") && cols.includes("id")) {
          keys.push("id");
          row.id = randomUUID();
        }
        // Supabase/Postgres columns the UI leaves out but SQLite marks NOT NULL:
        // fill a safe default so existing screens keep working unchanged.
        for (const c of info) {
          if (keys.includes(c.name) || !c.notnull || c.dflt_value !== null || c.pk) continue;
          keys.push(c.name);
          row[c.name] = enums[c.name] !== undefined
            ? enums[c.name]
            : /_date$|_at$/.test(c.name)
              ? new Date().toISOString()
              : /INT|REAL|NUM|DEC/i.test(c.type) ? 0 : "";
        }

        // Multi-shop scoping for inserts: non-admin gets their shop_id
        if (cols.includes("shop_id")) {
          const isAdmin = req.user?.roles?.includes("admin");
          const userShopId = req.user?.shopId || "shop_1";
          if (!isAdmin || !row.shop_id) {
            row.shop_id = userShopId;
            if (!keys.includes("shop_id")) keys.push("shop_id");
          }
        }

        // Stamp new accounting rows with the active financial year.
        if (FY_SCOPED.has(t) && cols.includes(FY_COLUMN) && row[FY_COLUMN] === undefined) {
          const fy = activeFyLabel();
          if (fy) { keys.push(FY_COLUMN); row[FY_COLUMN] = fy; }
        }

        const sql = `INSERT INTO ${t} (${keys.map((k) => `"${k}"`).join(",")}) VALUES (${keys.map(() => "?").join(",")})`;
        db.prepare(sql).run(...keys.map((k) => valueIn(row[k])));
        out.push(db.prepare(`SELECT * FROM ${t} WHERE id = ?`).get(row.id));
        checkAndSetPreviousYear(res, t, row.id, "insert", row);
      }

    })();
    res.status(201).json(out.map(rowOut));
  }));

  r.post("/:table/update", staff, wrap((req, res) => {
    guardWrites(req);
    const t = table(req.params.table);
    assertCompatWritable(t);
    const cols = columnsOf(t);

    // Same protection as delete: an update without a real, exact filter would
    // mean "rewrite every row", so it is refused before anything is written.
    const filters = req.body?.filters;
    if (!Array.isArray(filters) || filters.length === 0) {
      throw badRequest("Refusing to update without a filter. Please select the exact record to update.");
    }
    assertFilterColumns(t, filters);
    const where = buildWhere(filters, t);
    if (!where.sql) {
      throw badRequest("Refusing to update: the filter did not name a real column. No rows were changed.");
    }

    const values = req.body?.values;
    if (!values || typeof values !== "object" || Array.isArray(values)) throw badRequest("values must be an object.");
    const keys = Object.keys(values);
    if (!keys.length) return res.json([]);
    for (const k of keys) {
      // An unknown key is rejected, never silently dropped: a caller that sends
      // an injected/invalid column learns about it instead of believing the
      // write succeeded.
      if (!cols.includes(k)) throw badRequest(`Unknown column in update values: ${String(k).slice(0, 60)}.`);
      if (PROTECTED_UPDATE_COLUMNS.has(k)) {
        throw forbidden(`"${k}" cannot be changed through the compatibility layer.`);
      }
    }

    const sql = `UPDATE ${t} SET ${keys.map((k) => `"${k}" = ?`).join(", ")}${where.sql}`;
    const db = getDb();

    // Multi-shop check: non-admin users cannot update rows belonging to another shop
    const hasShopId = cols.includes("shop_id");
    const isAdmin = req.user?.roles?.includes("admin");
    const userShopId = req.user?.shopId || "shop_1";

    if (hasShopId && !isAdmin) {
      const targetRows = db.prepare(`SELECT id, shop_id FROM ${t}${where.sql}`).all(...where.params);
      if (targetRows.length > 0 && targetRows.some((r) => r.shop_id && r.shop_id !== userShopId)) {
        throw forbidden("You do not have permission to modify records belonging to another shop.");
      }
      if (values.shop_id && values.shop_id !== userShopId) {
        throw forbidden("You cannot reassign records to another shop.");
      }
    }

    db.prepare(sql).run(...keys.map((k) => valueIn(values[k])), ...where.params);
    const updated = db.prepare(`SELECT * FROM ${t}${where.sql}`).all(...where.params);
    for (const u of updated) {
      checkAndSetPreviousYear(res, t, u.id, "update", values);
    }
    res.json(updated.map(rowOut));
  }));

  r.post("/:table/delete", staff, wrap((req, res) => {
    guardWrites(req);
    const t = table(req.params.table);
    assertCompatWritable(t);
    if (!DELETE_ALLOWED.has(t)) {
      throw forbidden("That table cannot be deleted from here.");
    }
    const filters = req.body?.filters;
    // An empty filter would mean "delete every row" - refuse outright.
    if (!Array.isArray(filters) || filters.length === 0) {
      throw badRequest("Refusing to delete without a filter. Please select the exact record to delete.");
    }
    const cols = columnsOf(t);
    const where = buildWhere(filters, t);
    // buildWhere throws on a column that is not a real column of this table
    // (e.g. a quote/SQL-injection attempt). A blank WHERE is refused too.
    if (!where.sql) {
      throw badRequest("Refusing to delete: the filter did not name a real column. No rows were changed.");
    }
    const db = getDb();

    // Multi-shop check: non-admin users cannot delete rows belonging to another shop
    const hasShopId = cols.includes("shop_id");
    const isAdmin = req.user?.roles?.includes("admin");
    const userShopId = req.user?.shopId || "shop_1";

    if (hasShopId && !isAdmin) {
      const targetRows = db.prepare(`SELECT id, shop_id FROM ${t}${where.sql}`).all(...where.params);
      if (targetRows.length > 0 && targetRows.some((r) => r.shop_id && r.shop_id !== userShopId)) {
        throw forbidden("You do not have permission to delete records belonging to another shop.");
      }
    }

    if (cols.includes("deleted_at") && !HARD_DELETE_TABLES.has(t)) {
      // Business history is never destroyed - mark the row as archived instead.
      const rows = db.prepare(`SELECT id FROM ${t}${where.sql}`).all(...where.params);
      const info = db.prepare(`UPDATE ${t} SET deleted_at = datetime('now')${where.sql}`).run(...where.params);
      for (const r of rows) checkAndSetPreviousYear(res, t, r.id, "delete", {});
      return res.json({ ok: true, softDeleted: info.changes });
    }
    if (!HARD_DELETE_TABLES.has(t)) {
      throw badRequest("This table keeps its full history and cannot be deleted from here.");
    }
    const info = db.prepare(`DELETE FROM ${t}${where.sql}`).run(...where.params);
    res.json({ ok: true, deleted: info.changes });
  }));

  // ---------------- storage compatibility ----------------
  r.post("/storage/upload", staff, upload.single("file"), wrap((req, res) => {
    guardWrites(req);
    const saved = storage.saveFile({
      ownerType: "bucket",
      ownerId: req.body.bucket || "phonezone-uploads",
      category: req.body.path,
      buffer: req.file?.buffer,
      originalName: req.file?.originalname,
      mimeType: req.file?.mimetype,
    });
    res.status(201).json({ id: saved.id, path: req.body.path });
  }));

  r.post("/storage/list", staff, wrap((req, res) => {
    const rows = getDb()
      .prepare(`SELECT id, category AS name, size_bytes, created_at FROM files WHERE owner_type = 'bucket' AND owner_id = ?`)
      .all(req.body?.bucket || "phonezone-uploads");
    res.json(rows.map((f) => ({
      id: f.id,
      name: f.name,
      created_at: f.created_at,
      metadata: { size: f.size_bytes },
    })));
  }));

  r.post("/storage/remove", staff, wrap((req, res) => {
    guardWrites(req);
    const paths = req.body?.paths || [];
    const bucket = req.body?.bucket || "phonezone-uploads";
    for (const p of paths) {
      const row = getDb().prepare(`SELECT id FROM files WHERE owner_type='bucket' AND owner_id=? AND category=?`).get(bucket, p);
      if (row) storage.deleteFile(row.id);
    }
    res.json({ ok: true });
  }));

  const objectRow = (bucket, p) =>
    getDb().prepare(`SELECT * FROM files WHERE owner_type='bucket' AND owner_id=? AND category=?`).get(bucket, p);

  /** Serve whatever the guard above resolved, with safe headers. */
  const sendObject = (res, row) => {
    setSafeFileHeaders(res, row.mime_type);
    res.type(row.mime_type).send(storage.readFile(row.relative_path));
  };

  // Public object URL used by <img src> on the customer homepage.
  //
  // Two-tier access, decided by the server-side `is_public` flag (set from the
  // destination folder - product photos/logo/signature are public, purchase
  // documents, payment proofs and Aadhaar copies are private):
  //   * public  -> served to anyone, so the homepage catalogue and the invoice
  //                logo keep working while nobody is signed in;
  //   * private -> falls through to the `staff` guard below and answers 401
  //                without a valid session.
  r.get(
    "/storage/object/:bucket/*",
    wrap((req, res, next) => {
      const row = objectRow(req.params.bucket, req.params[0]);
      if (!row) return next(); // let the guarded handler answer (401 / 404)
      if (row.is_public === 1) return sendObject(res, row);
      next();
    }),
    staff,
    wrap((req, res) => {
      const row = objectRow(req.params.bucket, req.params[0]);
      if (!row) return res.status(404).json({ error: "Not found" });
      sendObject(res, row);
    }),
  );

  return r;
}
