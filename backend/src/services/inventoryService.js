/**
 * Purchase + inventory + sale workflows. All multi-step operations run inside
 * a single SQLite transaction so records can never end up inconsistent.
 */
import { getDb, transaction } from "../db/index.js";
import { newId, notFound, badRequest } from "../lib/errors.js";
import { requireFields, assertImei, assertAmount, assertPhoneNumber, isBlank, toJsonArray, fromJsonArray, toBool } from "../lib/validation.js";
import { createInvoice } from "./invoiceService.js";
import { audit } from "./auditService.js";
import { activeFyLabel } from "./financialYearService.js";
import { autoLearnTac } from "./tacService.js";

/**
 * Accounting rows live inside a financial year. `fyWhere` keeps reads inside the
 * active year's book; `activeFyLabel()` stamps new rows.
 */
const fyWhere = (col = "financial_year", includeCarried = false) => {
  const fy = activeFyLabel();
  if (!fy) return { label: null, sql: "", params: [] };
  if (includeCarried) {
    return {
      label: fy,
      sql: ` AND (COALESCE(${col}, ?) = ? OR carried_to_fy = ?)`,
      params: [fy, fy, fy],
    };
  }
  return {
    label: fy,
    sql: ` AND COALESCE(${col}, ?) = ?`,
    params: [fy, fy],
  };
};

const shopWhere = (shopId) => {
  return shopId ? { sql: " AND COALESCE(shop_id, ?) = ?", params: [shopId, shopId] } : { sql: "", params: [] };
};

const PUBLIC_COLUMNS = `id, phone_name, model, variant, colour, condition, selling_price, rating,
  bill_available, box_available, charger_available, features, product_photos, created_at, shop_id`;

const hydrate = (row) =>
  row && {
    ...row,
    features: fromJsonArray(row.features),
    product_photos: fromJsonArray(row.product_photos),
    payment_proof_photos: fromJsonArray(row.payment_proof_photos),
    purchase_documents: fromJsonArray(row.purchase_documents),
    bill_available: !!row.bill_available,
    box_available: !!row.box_available,
    charger_available: !!row.charger_available,
    is_sold: !!row.is_sold,
  };

/** PUBLIC endpoint data - no purchase price, IMEI, seller or profit. */
export function listPublicInventory({ limit = 100 } = {}, { shopId } = {}) {
  const fy = fyWhere("financial_year", true);
  const sw = shopWhere(shopId);
  return getDb()
    .prepare(
      `SELECT ${PUBLIC_COLUMNS} FROM phones
       WHERE is_sold = 0 AND deleted_at IS NULL AND (return_status IS NULL OR return_status != 'purchase_returned')${fy.sql}${sw.sql}
       ORDER BY created_at DESC LIMIT ?`,
    )
    .all(...fy.params, ...sw.params, limit)
    .map((r) => ({ ...r, features: fromJsonArray(r.features), product_photos: fromJsonArray(r.product_photos), shop_id: r.shop_id }));
}

/** ADMIN listing with every field. */
export function listPhones({ status = "all", search = "", limit = 500 } = {}, { shopId } = {}) {
  const where = ["deleted_at IS NULL"];
  const params = [];
  const fy = fyWhere();
  if (fy.label) {
    if (status === "available") {
      where.push("(COALESCE(financial_year, ?) = ? OR carried_to_fy = ?)");
      params.push(fy.label, fy.label, fy.label);
    } else {
      where.push("COALESCE(financial_year, ?) = ?");
      params.push(fy.label, fy.label);
    }
  }
  if (shopId) { where.push("COALESCE(shop_id, ?) = ?"); params.push(shopId); }
  if (status === "available") where.push("is_sold = 0");
  if (status === "sold") where.push("is_sold = 1");
  if (search) {
    where.push("(phone_name LIKE ? OR model LIKE ? OR imei_number LIKE ?)");
    params.push(`%${search}%`, `%${search}%`, `%${search}%`);
  }
  params.push(limit);
  return getDb()
    .prepare(`SELECT * FROM phones WHERE ${where.join(" AND ")} ORDER BY created_at DESC LIMIT ?`)
    .all(...params)
    .map(hydrate);
}

export function getPhone(id) {
  const row = getDb().prepare("SELECT * FROM phones WHERE id = ?").get(id);
  if (!row) throw notFound("That phone could not be found.");
  return hydrate(row);
}

/**
 * PURCHASE WORKFLOW: create (or reuse) the seller, the phone record, the
 * inventory entry and the purchase invoice - all inside ONE transaction.
 *
 * Everything below happens in that transaction, so a validation failure on the
 * phone can never leave a half-created seller behind.
 *
 * Accepts EITHER an existing `seller_id` OR a `seller` object (name, phone,
 * address, id_proof_type, id_number) which is created inline. The seller is
 * matched on phone number first, so re-adding a known seller never duplicates.
 */
export function createPurchase(data, userId) {
  const sellerInput = data.seller || null;
  requireFields(data, ["phone_name", "model", "imei_number", "condition", "purchase_price", "selling_price", "purchase_date", "payment_method"]);
  if (!sellerInput && isBlank(data.seller_id)) {
    throw badRequest("Please choose an existing seller or fill in the new seller's name and phone number.");
  }
  if (sellerInput) {
    requireFields(sellerInput, ["name", "phone", "address", "id_proof_type", "id_number"]);
    assertPhoneNumber(sellerInput.phone, "Seller phone number");
  }
  assertImei(data.imei_number);
  assertAmount(data.purchase_price, "Purchase price");
  assertAmount(data.selling_price, "Selling price");

  const db = getDb();
  const imei = String(data.imei_number).trim();
  // A phone still in stock is a duplicate. A purchase-returned unit went back to
  // the seller, so buying that IMEI again is legitimate.
  const duplicate = db
    .prepare(
      `SELECT id FROM phones
        WHERE imei_number = ? AND deleted_at IS NULL AND is_sold = 0
          AND (return_status IS NULL OR return_status <> 'purchase_returned')`,
    )
    .get(imei);
  if (duplicate) throw badRequest("A phone with this IMEI is already in stock. Check the IMEI and try again.");

  return transaction(() => {
    let sellerId = isBlank(data.seller_id) ? null : data.seller_id;
    if (sellerInput) {
      const known = db
        .prepare("SELECT id FROM sellers WHERE phone = ? AND deleted_at IS NULL ORDER BY created_at LIMIT 1")
        .get(String(sellerInput.phone).trim());
      if (known) {
        sellerId = known.id;
      } else {
        sellerId = newId();
        db.prepare(
          `INSERT INTO sellers (id, name, phone, address, id_proof_type, id_number, seller_photo_url, aadhaar_photo_url)
           VALUES (?,?,?,?,?,?,?,?)`,
        ).run(
          sellerId,
          String(sellerInput.name).trim(),
          String(sellerInput.phone).trim(),
          String(sellerInput.address).trim(),
          sellerInput.id_proof_type,
          String(sellerInput.id_number).trim(),
          sellerInput.seller_photo_url || null,
          sellerInput.aadhaar_photo_url || null,
        );
      }
    }

    const row = {
      id: newId(),
      phone_name: data.phone_name,
      model: data.model,
      imei_number: imei,
      condition: data.condition,
      purchase_price: Number(data.purchase_price),
      selling_price: Number(data.selling_price),
      purchase_date: data.purchase_date,
      rating: data.rating ?? null,
      bill_available: toBool(data.bill_available),
      box_available: toBool(data.box_available),
      charger_available: toBool(data.charger_available),
      features: toJsonArray(data.features),
      product_photos: toJsonArray(data.product_photos),
      payment_proof_photos: toJsonArray(data.payment_proof_photos),
      purchase_documents: toJsonArray(data.purchase_documents),
      payment_method: data.payment_method,
      variant: data.variant ?? null,
      colour: data.colour ?? null,
      seller_photo_url: data.seller_photo_url || (sellerInput ? sellerInput.seller_photo_url : null) || null,
      seller_signature_url: data.seller_signature_url || null,
      sapath_patra_language: data.sapath_patra_language || 'both',
      seller_id: sellerId,
      shop_id: data.shop_id || 'shop_1',
    };
    db.prepare(
      `INSERT INTO phones (id, phone_name, model, imei_number, condition, purchase_price, selling_price,
        purchase_date, rating, bill_available, box_available, charger_available, features, product_photos,
        payment_proof_photos, purchase_documents, payment_method, variant, colour, seller_photo_url, seller_signature_url,
        sapath_patra_language, seller_id, financial_year, shop_id)
       VALUES (@id, @phone_name, @model, @imei_number, @condition, @purchase_price, @selling_price,
        @purchase_date, @rating, @bill_available, @box_available, @charger_available, @features, @product_photos,
        @payment_proof_photos, @purchase_documents, @payment_method, @variant, @colour, @seller_photo_url, @seller_signature_url,
        @sapath_patra_language, @seller_id, @financial_year, @shop_id)`,
    ).run({ ...row, financial_year: activeFyLabel(), shop_id: data.shop_id || 'shop_1' });

    const invoice = createInvoice({
      type: "purchase",
      phoneId: row.id,
      sellerId,
      amount: row.purchase_price,
      html: data.invoice_html || null,
    });
    audit(userId, "purchase.created", "phone", row.id, { invoice: invoice.invoice_number });

    // Auto-learn TAC if not already known
    try {
      autoLearnTac({
        imei,
        brand: data.brand || data.phone_name,
        phoneName: data.phone_name,
        model: data.model,
      });
    } catch {}

    return { phone: getPhone(row.id), invoice };
  });
}

export function updatePhone(id, data, userId) {
  getPhone(id);
  const columns = [
    "phone_name", "model", "imei_number", "condition", "purchase_price", "selling_price", "purchase_date",
    "rating", "payment_method", "seller_id",
  ];
  const sets = columns.filter((c) => data[c] !== undefined);
  const jsonCols = ["features", "product_photos", "payment_proof_photos", "purchase_documents"];
  const boolCols = ["bill_available", "box_available", "charger_available"];
  const values = sets.map((c) => data[c]);
  for (const c of jsonCols) if (data[c] !== undefined) { sets.push(c); values.push(toJsonArray(data[c])); }
  for (const c of boolCols) if (data[c] !== undefined) { sets.push(c); values.push(toBool(data[c])); }
  if (!sets.length) return getPhone(id);
  if (data.imei_number) assertImei(data.imei_number);
  getDb().prepare(`UPDATE phones SET ${sets.map((c) => `${c} = ?`).join(", ")} WHERE id = ?`).run(...values, id);
  audit(userId, "phone.updated", "phone", id);
  return getPhone(id);
}

/**
 * SALE WORKFLOW: mark sold + attach customer + generate sale invoice, atomically.
 */
export function sellPhone(phoneId, { customer_id, sale_price, sold_date, invoice_html }, userId) {
  const phone = getPhone(phoneId);
  if (phone.is_sold) throw badRequest("This phone has already been sold.");
  if (phone.return_status === "purchase_returned") {
    throw badRequest("This phone was already returned to the seller, so it cannot be sold. Please add it to stock again first.");
  }
  if (!customer_id) throw badRequest("Please select a customer for this sale.");
  assertAmount(sale_price, "Sale price");

  const customer = getDb().prepare("SELECT id, deleted_at FROM customers WHERE id = ?").get(customer_id);
  if (!customer) throw badRequest("That customer could not be found. Please add the customer first.");
  if (customer.deleted_at) {
    throw badRequest("That customer has been archived. Please choose another customer or add a new one.");
  }

  return transaction(() => {
    const db = getDb();
    const soldAt = sold_date || new Date().toISOString();
    db.prepare(
      "UPDATE phones SET is_sold = 1, sold_date = ?, customer_id = ?, selling_price = ?, shop_id = ? WHERE id = ?",
    ).run(soldAt, customer_id, Number(sale_price), phone.shop_id, phoneId);

    const invoice = createInvoice({
      type: "sale",
      phoneId,
      sellerId: phone.seller_id,
      customerId: customer_id,
      amount: Number(sale_price),
      html: invoice_html || null,
    });
    const updated = getPhone(phoneId);
    const profit = Number(sale_price) - Number(updated.purchase_price);
    audit(userId, "sale.created", "phone", phoneId, { invoice: invoice.invoice_number, profit });
    return { phone: updated, invoice, profit };
  });
}

/** RETURN WORKFLOW - mirrors the Postgres process_phone_return() function. */
export function processReturn({ phone_id, return_type, return_amount, return_reason, notes, customer_id, seller_id }, userId) {
  const phone = getPhone(phone_id);
  if (!["sales_return", "purchase_return"].includes(return_type)) throw badRequest("Unknown return type.");
  assertAmount(return_amount, "Return amount");

  const db = getDb();
  // A sales return only makes sense for a phone that is currently sold.
  if (return_type === "sales_return" && !phone.is_sold) {
    throw badRequest("This phone is not currently sold, so it cannot be returned by a customer.");
  }
  // The same phone can never be returned twice with the same return type.
  const alreadyReturned = db
    .prepare("SELECT id FROM returns WHERE phone_id = ? AND return_type = ? LIMIT 1")
    .get(phone_id, return_type);
  if (alreadyReturned) {
    throw badRequest(
      return_type === "sales_return"
        ? "This phone has already been returned by the customer."
        : "This phone has already been returned to the seller.",
    );
  }

  // Who processed it: the signed-in user, never a hard-coded name.
  const user = userId ? db.prepare("SELECT display_name, email FROM users WHERE id = ?").get(userId) : null;
  const processedBy = user?.display_name || user?.email || "Admin";

  return transaction(() => {
    db.prepare(
      `INSERT INTO returns (id, phone_id, return_type, return_amount, return_reason, notes, customer_id, seller_id, processed_by, original_transaction_date, financial_year)
       VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
    ).run(
      newId(), phone_id, return_type, Number(return_amount), return_reason, notes || "",
      customer_id || phone.customer_id || null, seller_id || phone.seller_id || null, processedBy,
      return_type === "sales_return" ? phone.sold_date : phone.purchase_date,
      phone.financial_year || activeFyLabel(),
    );

    if (return_type === "sales_return") {
      db.prepare(
        `UPDATE phones SET is_sold = 0, sold_date = NULL, customer_id = NULL, return_status = 'sales_returned',
          return_reason = ?, return_amount = ?, return_processed_date = datetime('now'), return_type = ? WHERE id = ?`,
      ).run(return_reason, Number(return_amount), return_type, phone_id);
    } else {
      db.prepare(
        `UPDATE phones SET return_status = 'purchase_returned', return_reason = ?, return_amount = ?,
          return_processed_date = datetime('now'), return_type = ? WHERE id = ?`,
      ).run(return_reason, Number(return_amount), return_type, phone_id);
    }
    audit(userId, "return.processed", "phone", phone_id, { return_type });
    return getPhone(phone_id);
  });
}

export function listReturns() {
  const fy = fyWhere();
  return getDb().prepare(`SELECT * FROM returns WHERE 1=1${fy.sql} ORDER BY return_date DESC`).all(...fy.params);
}

export function archivePhone(id, userId) {
  getPhone(id);
  getDb().prepare("UPDATE phones SET deleted_at = datetime('now') WHERE id = ?").run(id);
  audit(userId, "phone.archived", "phone", id);
}
