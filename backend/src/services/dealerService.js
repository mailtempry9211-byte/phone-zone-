import { getDb, transaction } from "../db/index.js";
import { newId, badRequest, notFound } from "../lib/errors.js";
import { audit } from "./auditService.js";
import { assertImei, assertPhoneNumber, assertAmount } from "../lib/validation.js";
import { activeFyLabel } from "./financialYearService.js";
import { createInvoice, nextInvoiceNumber } from "./invoiceService.js";
import { autoLearnTac } from "./tacService.js";

export function listDealers({ search } = {}) {
  const db = getDb();
  let sql = `
    SELECT d.*,
      COUNT(p.id) AS phones_supplied,
      COALESCE(SUM(p.purchase_price), 0) AS total_amount_paid,
      COUNT(CASE WHEN p.is_sold = 1 THEN 1 END) AS phones_sold
    FROM dealers d
    LEFT JOIN phones p ON p.dealer_id = d.id AND p.deleted_at IS NULL
    WHERE d.is_active = 1
  `;
  const params = [];
  if (search && search.trim()) {
    sql += ` AND (d.shop_name LIKE ? OR d.proprietor_name LIKE ? OR d.phone LIKE ? OR d.gst_number LIKE ?)`;
    const q = `%${search.trim()}%`;
    params.push(q, q, q, q);
  }
  sql += ` GROUP BY d.id ORDER BY d.created_at DESC`;
  return db.prepare(sql).all(...params);
}

export function getDealer(id) {
  const db = getDb();
  const dealer = db.prepare("SELECT * FROM dealers WHERE id = ?").get(id);
  if (!dealer) throw notFound("Dealer not found.");
  const phones = db.prepare(`
    SELECT id, phone_name, model, variant, colour, imei_number, condition, purchase_price, selling_price, purchase_date, is_sold, batch_purchase_id
    FROM phones
    WHERE dealer_id = ? AND deleted_at IS NULL
    ORDER BY purchase_date DESC, created_at DESC
  `).all(id);
  const batches = db.prepare(`
    SELECT * FROM dealer_batches WHERE dealer_id = ? ORDER BY created_at DESC
  `).all(id);
  return { ...dealer, phones, batches };
}

export function createDealer(data, userId) {
  if (!data.shop_name?.trim()) throw badRequest("Shop / Firm Name is required.");
  if (!data.proprietor_name?.trim()) throw badRequest("Proprietor Name is required.");
  if (!data.phone?.trim()) throw badRequest("Phone number is required.");
  assertPhoneNumber(data.phone, "Dealer phone");

  const db = getDb();
  const id = newId();
  db.prepare(`
    INSERT INTO dealers (
      id, shop_name, proprietor_name, phone, alternate_phone, email,
      address, city, state, pincode, gst_number, pan_number, photo_url,
      signature_url, notes, is_active
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
  `).run(
    id,
    data.shop_name.trim(),
    data.proprietor_name.trim(),
    data.phone.trim(),
    data.alternate_phone?.trim() || null,
    data.email?.trim() || null,
    data.address?.trim() || "",
    data.city?.trim() || "Sitapur",
    data.state?.trim() || "Uttar Pradesh",
    data.pincode?.trim() || "261001",
    data.gst_number?.trim() || null,
    data.pan_number?.trim() || null,
    data.photo_url || null,
    data.signature_url || null,
    data.notes?.trim() || null
  );

  audit(userId, "dealer.created", "dealer", id, { shop_name: data.shop_name });
  return getDealer(id);
}

export function updateDealer(id, data, userId) {
  const db = getDb();
  const existing = db.prepare("SELECT * FROM dealers WHERE id = ?").get(id);
  if (!existing) throw notFound("Dealer not found.");

  if (data.phone) assertPhoneNumber(data.phone, "Dealer phone");

  const fields = [
    "shop_name", "proprietor_name", "phone", "alternate_phone", "email",
    "address", "city", "state", "pincode", "gst_number", "pan_number",
    "photo_url", "signature_url", "notes"
  ];

  const updates = [];
  const params = [];
  for (const f of fields) {
    if (data[f] !== undefined) {
      updates.push(`${f} = ?`);
      params.push(data[f]);
    }
  }

  if (updates.length > 0) {
    updates.push("updated_at = datetime('now')");
    params.push(id);
    db.prepare(`UPDATE dealers SET ${updates.join(", ")} WHERE id = ?`).run(...params);
    audit(userId, "dealer.updated", "dealer", id, { fields: Object.keys(data) });
  }

  return getDealer(id);
}

export function deleteDealer(id, userId) {
  const db = getDb();
  const existing = db.prepare("SELECT * FROM dealers WHERE id = ?").get(id);
  if (!existing) throw notFound("Dealer not found.");

  db.prepare("UPDATE dealers SET is_active = 0, updated_at = datetime('now') WHERE id = ?").run(id);
  audit(userId, "dealer.deleted", "dealer", id);
  return { ok: true, deleted: true };
}

export function createBatchPurchase(data, userId) {
  const { dealer_id, purchase_date, payment_method = "UPI", notes, phones = [] } = data;
  if (!dealer_id) throw badRequest("Dealer is required for B2B batch purchase.");
  if (!Array.isArray(phones) || phones.length === 0) {
    throw badRequest("At least one phone is required for batch purchase.");
  }

  const db = getDb();
  const dealer = db.prepare("SELECT * FROM dealers WHERE id = ? AND is_active = 1").get(dealer_id);
  if (!dealer) throw notFound("Dealer not found or inactive.");

  return transaction(() => {
    const batchId = newId();
    const fy = activeFyLabel();
    const invoiceNumber = `PUR-B2B-${Date.now().toString().slice(-6)}`;
    const effectiveDate = purchase_date || new Date().toISOString().split("T")[0];

    let totalAmount = 0;
    const insertedPhones = [];

    for (let i = 0; i < phones.length; i++) {
      const p = phones[i];
      if (!p.brand?.trim() && !p.phone_name?.trim()) {
        throw badRequest(`Row ${i + 1}: Brand / Phone Name is required.`);
      }
      if (!p.model?.trim()) {
        throw badRequest(`Row ${i + 1}: Model is required.`);
      }
      if (!p.imei?.trim()) {
        throw badRequest(`Row ${i + 1}: IMEI is required.`);
      }

      const imei = String(p.imei).trim();
      assertImei(imei);
      assertAmount(p.purchase_price, `Row ${i + 1} purchase price`);

      const dup = db.prepare(
        `SELECT id FROM phones WHERE imei_number = ? AND deleted_at IS NULL AND is_sold = 0`
      ).get(imei);
      if (dup) {
        throw badRequest(`Row ${i + 1}: IMEI ${imei} is already in stock.`);
      }

      const phoneId = newId();
      const price = Number(p.purchase_price);
      const sellPrice = Number(p.selling_price || Math.round(price * 1.15));
      totalAmount += price;

      db.prepare(`
        INSERT INTO phones (
          id, phone_name, model, imei_number, imei2_number, condition,
          purchase_price, selling_price, purchase_date, bill_available,
          box_available, charger_available, variant, colour,
          dealer_id, is_dealer, batch_purchase_id, seller_signature_url,
          payment_method, financial_year, shop_id
        ) VALUES (
          ?, ?, ?, ?, ?, ?,
          ?, ?, ?, ?,
          ?, ?, ?, ?,
          ?, 1, ?, ?,
          ?, ?, 'shop_1'
        )
      `).run(
        phoneId,
        (p.brand || p.phone_name).trim(),
        p.model.trim(),
        imei,
        p.imei2?.trim() || null,
        p.condition || "good",
        price,
        sellPrice,
        effectiveDate,
        p.bill_available ? 1 : 0,
        p.box_available ? 1 : 0,
        p.charger_available ? 1 : 0,
        p.variant?.trim() || null,
        p.colour?.trim() || null,
        dealer.id,
        batchId,
        dealer.signature_url || null,
        p.payment_method || payment_method,
        fy
      );

      // Create individual purchase invoice record
      const invId = newId();
      const singleInvNo = nextInvoiceNumber("purchase", "shop_1");
      db.prepare(`
        INSERT INTO invoices (id, invoice_number, type, phone_id, amount, shop_id)
        VALUES (?, ?, 'purchase', ?, ?, 'shop_1')
      `).run(invId, singleInvNo, phoneId, price);

      insertedPhones.push({ id: phoneId, imei, model: p.model, price });

      // Auto-learn TAC for batch phone
      try {
        autoLearnTac({
          imei,
          brand: p.brand || p.phone_name,
          phoneName: p.phone_name || `${p.brand} ${p.model}`.trim(),
          model: p.model,
        });
      } catch {}
    }

    // Insert batch record
    db.prepare(`
      INSERT INTO dealer_batches (
        id, dealer_id, invoice_number, purchase_date, total_phones,
        total_amount, payment_method, payment_status, notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, 'completed', ?)
    `).run(
      batchId,
      dealer.id,
      invoiceNumber,
      effectiveDate,
      phones.length,
      totalAmount,
      payment_method,
      notes?.trim() || null
    );

    audit(userId, "dealer.batch_purchase", "dealer_batch", batchId, {
      dealer_id: dealer.id,
      dealer_name: dealer.shop_name,
      phones_count: phones.length,
      total_amount: totalAmount,
    });

    return {
      batchId,
      invoiceNumber,
      dealer,
      purchaseDate: effectiveDate,
      totalPhones: phones.length,
      totalAmount,
      paymentMethod: payment_method,
      phones: insertedPhones,
    };
  });
}
