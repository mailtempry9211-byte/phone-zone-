/**
 * Invoice numbering + local HTML/PDF persistence.
 * PDF generation is done client-side/offline (browser print / jsPDF already
 * bundled with the frontend) and the resulting bytes are stored here - no
 * online PDF service is ever contacted.
 */
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import cp from "node:child_process";
import { getDb, transaction } from "../db/index.js";
import { newId, badRequest } from "../lib/errors.js";
import { businessConfig } from "../config/business.js";
import { resolveStoragePath } from "../config/paths.js";
import { activeFyLabel } from "./financialYearService.js";
import * as storage from "./storageService.js";

/**
 * Atomically allocates the next invoice number for a type. Never duplicates.
 *
 * The counter is per FINANCIAL YEAR (1 Apr - 31 Mar), matching the rest of the
 * app (books, reports, IMEI trail). A new year therefore restarts at 0001 and
 * old numbers can never collide with new ones: PZ-2026-27-0001, PZ-2027-28-0001.
 */
export function nextInvoiceNumber(type, shopId = null) {
  const cfg = businessConfig().invoiceSettings;
  const prefix = cfg.prefixes[type];
  if (!prefix) throw badRequest("Unknown invoice type.");
  const year = activeFyLabel() || String(new Date().getFullYear());

  return transaction(() => {
    const db = getDb();
    let shopCode = "";
    if (shopId) {
      const s = db.prepare("SELECT shop_code FROM shops WHERE id = ?").get(shopId);
      if (s?.shop_code) shopCode = String(s.shop_code).trim().toUpperCase();
    }
    const counterKey = shopCode ? `${type}:${shopCode}` : type;
    db.prepare("INSERT OR IGNORE INTO invoice_counters (invoice_type, fiscal_year, last_number) VALUES (?,?,0)").run(counterKey, year);
    const row = db.prepare("SELECT * FROM invoice_counters WHERE invoice_type = ?").get(counterKey);
    const nextNumber = row.fiscal_year === year ? row.last_number + 1 : 1;
    db.prepare("UPDATE invoice_counters SET fiscal_year = ?, last_number = ? WHERE invoice_type = ?").run(year, nextNumber, counterKey);
    const shopPart = shopCode ? `${shopCode}-` : "";
    return `${prefix}-${shopPart}${year}-${String(nextNumber).padStart(4, "0")}`;
  });
}

export function createInvoice({ type, phoneId, sellerId, customerId, amount, html, shopId = null }) {
  const invoiceNumber = nextInvoiceNumber(type, shopId);
  const relative = `invoices/${type}/${invoiceNumber}.html`;
  if (html) {
    const abs = resolveStoragePath(relative);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, html, "utf8");
  }
  const record = {
    id: newId(),
    invoice_number: invoiceNumber,
    invoice_type: type,
    shop_id: shopId || null,
    phone_id: phoneId || null,
    seller_id: sellerId || null,
    customer_id: customerId || null,
    amount: Number(amount) || 0,
    html_path: html ? relative : null,
    pdf_path: null,
    financial_year: activeFyLabel(),
  };
  getDb()
    .prepare(
      `INSERT INTO invoices (id, invoice_number, invoice_type, shop_id, phone_id, seller_id, customer_id, amount, html_path, pdf_path, financial_year)
       VALUES (@id, @invoice_number, @invoice_type, @shop_id, @phone_id, @seller_id, @customer_id, @amount, @html_path, @pdf_path, @financial_year)`,
    )
    .run(record);
  return record;
}

export function attachPdf(invoiceId, buffer) {
  const inv = getDb().prepare("SELECT * FROM invoices WHERE id = ?").get(invoiceId);
  if (!inv) throw badRequest("Invoice not found.");
  const relative = `invoices/${inv.invoice_type}/${inv.invoice_number}.pdf`;
  const abs = resolveStoragePath(relative);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, buffer);
  getDb().prepare("UPDATE invoices SET pdf_path = ? WHERE id = ?").run(relative, invoiceId);
  return { ...inv, pdf_path: relative };
}

export function getInvoice(id) {
  const db = getDb();
  const inv = db
    .prepare(
      `SELECT inv.*,
              p.phone_name, p.model, p.imei_number, p.colour, p.variant, p.condition,
              p.purchase_price, p.selling_price,
              c.name AS customer_name, c.phone AS customer_phone, c.address AS customer_address,
              s.name AS seller_name, s.phone AS seller_phone, s.address AS seller_address,
              sh.name AS shop_name
       FROM invoices inv
       LEFT JOIN phones p ON p.id = inv.phone_id
       LEFT JOIN customers c ON c.id = inv.customer_id
       LEFT JOIN sellers s ON s.id = inv.seller_id
       LEFT JOIN shops sh ON sh.id = inv.shop_id
       WHERE inv.id = ? OR inv.invoice_number = ?`,
    )
    .get(id, id);
  if (!inv) throw badRequest("Invoice not found.");
  return inv;
}

export function getInvoicePdf(id) {
  const inv = getInvoice(id);
  if (!inv.pdf_path) return null;
  const abs = resolveStoragePath(inv.pdf_path);
  if (!fs.existsSync(abs)) return null;
  return fs.readFileSync(abs);
}

export function getInvoiceHtml(id) {
  const inv = getInvoice(id);
  if (inv.html_path) {
    const abs = resolveStoragePath(inv.html_path);
    if (fs.existsSync(abs)) {
      return fs.readFileSync(abs, "utf8");
    }
  }

  // Synthesize a clean, professional HTML invoice representation if no raw snapshot was stored
  const partyName = inv.customer_name || inv.seller_name || "Direct Party";
  const partyPhone = inv.customer_phone || inv.seller_phone || "";
  const partyAddress = inv.customer_address || inv.seller_address || "";
  const isSale = inv.invoice_type === "sale";
  const title = isSale ? "TAX INVOICE / SALE BILL" : "PURCHASE VOUCHER";
  const dateStr = inv.issued_at || inv.created_at || new Date().toISOString();
  const formattedDate = new Date(dateStr).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${inv.invoice_number} - ${title}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; margin: 0; padding: 24px; color: #1e293b; background: #f8fafc; }
    .invoice-card { max-width: 760px; margin: 0 auto; border: 1px solid #cbd5e1; border-radius: 12px; padding: 28px; background: #fff; box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1); }
    .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #0f172a; padding-bottom: 16px; margin-bottom: 20px; }
    .title { font-size: 20px; font-weight: 800; color: #0f172a; text-transform: uppercase; margin: 0; }
    .inv-num { font-family: monospace; font-size: 14px; font-weight: 700; color: #0284c7; margin-top: 4px; }
    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 24px; font-size: 13px; }
    .section-title { font-size: 11px; text-transform: uppercase; color: #64748b; font-weight: 700; margin-bottom: 6px; letter-spacing: 0.5px; }
    .party-name { font-size: 15px; font-weight: 700; color: #0f172a; margin-bottom: 2px; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 24px; font-size: 13px; }
    th { background: #f8fafc; border-bottom: 2px solid #e2e8f0; padding: 10px 12px; text-align: left; font-weight: 700; color: #475569; }
    td { padding: 12px; border-bottom: 1px solid #f1f5f9; }
    .total-row { font-size: 16px; font-weight: 800; background: #f8fafc; }
    .footer { border-top: 1px solid #e2e8f0; padding-top: 16px; text-align: center; font-size: 11px; color: #94a3b8; }
    @media print {
      body { padding: 0; background: #fff; }
      .invoice-card { border: none; padding: 0; box-shadow: none; }
    }
  </style>
</head>
<body>
  <div class="invoice-card">
    <div class="header">
      <div>
        <h1 class="title">${title}</h1>
        <div class="inv-num">Invoice #${inv.invoice_number}</div>
        <div style="font-size: 12px; color: #64748b; margin-top: 4px;">Date: ${formattedDate}</div>
      </div>
      <div style="text-align: right;">
        <div style="font-size: 16px; font-weight: 800; color: #0f172a;">${inv.shop_name || "PhoneZone Store"}</div>
        <div style="font-size: 11px; color: #64748b; margin-top: 2px;">Verified Business Transaction</div>
      </div>
    </div>

    <div class="grid">
      <div>
        <div class="section-title">${isSale ? "Billed To (Customer)" : "Purchased From (Seller)"}</div>
        <div class="party-name">${partyName}</div>
        ${partyPhone ? `<div>Phone: <strong>${partyPhone}</strong></div>` : ""}
        ${partyAddress ? `<div>Address: ${partyAddress}</div>` : ""}
      </div>
      <div style="text-align: right;">
        <div class="section-title">Payment Summary</div>
        <div>Status: <strong style="color: #16a34a;">PAID (Verified)</strong></div>
        <div style="margin-top: 4px;">Branch: <strong>${inv.shop_name || "Main Store"}</strong></div>
      </div>
    </div>

    <table>
      <thead>
        <tr>
          <th>Description / Device</th>
          <th>IMEI Details</th>
          <th>Condition</th>
          <th style="text-align: right;">Amount (₹)</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>
            <strong>${inv.phone_name || inv.brand || "Mobile Device"}</strong> ${inv.model ? `(${inv.model})` : ""}<br>
            <span style="font-size: 11px; color: #64748b;">${[inv.variant, inv.colour].filter(Boolean).join(" • ")}</span>
          </td>
          <td style="font-family: monospace;">
            ${inv.imei_number ? `IMEI: ${inv.imei_number}` : "–"}<br>
            ${inv.imei2_number ? `<span style="font-size: 11px; color: #64748b;">IMEI2: ${inv.imei2_number}</span>` : ""}
          </td>
          <td><span style="text-transform: capitalize;">${inv.condition || "Standard"}</span></td>
          <td style="text-align: right; font-weight: 700; font-family: monospace;">₹${Number(inv.amount || 0).toLocaleString("en-IN")}</td>
        </tr>
      </tbody>
      <tfoot>
        <tr class="total-row">
          <td colspan="3" style="text-align: right; padding-right: 16px;">Total Amount:</td>
          <td style="text-align: right; font-family: monospace; color: #0f172a;">₹${Number(inv.amount || 0).toLocaleString("en-IN")}</td>
        </tr>
      </tfoot>
    </table>

    <div class="footer">
      This is a computer-generated authenticated invoice recorded in PhoneZone ERP.
    </div>
  </div>
</body>
</html>`;
}

export function listInvoices(type) {
  const db = getDb();
  const fy = activeFyLabel();
  const fyClause = fy ? " AND COALESCE(financial_year, ?) = ?" : "";
  const fyParams = fy ? [fy, fy] : [];
  return type
    ? db.prepare(`SELECT * FROM invoices WHERE invoice_type = ?${fyClause} ORDER BY issued_at DESC`).all(type, ...fyParams)
    : db.prepare(`SELECT * FROM invoices WHERE 1=1${fyClause} ORDER BY issued_at DESC`).all(...fyParams);
}

export function findChromePath() {
  const candidates = [
    process.env.PUPPETEER_EXECUTABLE_PATH,
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Users\\Kohinoor\\.cache\\puppeteer\\chrome\\win64-146.0.7680.31\\chrome-win64\\chrome.exe",
    path.resolve(process.env.LOCALAPPDATA || "", "Google/Chrome/Application/chrome.exe"),
  ].filter(Boolean);

  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  return null;
}

export function inlineImagesForPdf(html) {
  if (!html) return html;

  // 1. Resolve /api/public/files/:id and /public/files/:id
  let processed = html.replace(/(?:src=["'](?:\/api)?\/public\/files\/([a-zA-Z0-9\-_]+)["'])/g, (match, fileId) => {
    try {
      const file = storage.getFileRecord(fileId);
      if (file) {
        const buf = storage.readFile(file.relative_path);
        if (buf && buf.length > 0) {
          const mime = file.mime_type || "image/jpeg";
          return `src="data:${mime};base64,${buf.toString("base64")}"`;
        }
      }
    } catch {}
    return match;
  });

  // 2. Resolve relative file paths if any (e.g. storage/uploads/...)
  processed = processed.replace(/src=["'](?:file:\/\/\/)?([^"']+\.(?:png|jpe?g|webp|gif|svg))["']/gi, (match, filePath) => {
    try {
      if (filePath.startsWith("data:") || filePath.startsWith("http://") || filePath.startsWith("https://")) {
        return match;
      }
      let abs = filePath;
      if (!fs.existsSync(abs)) {
        abs = resolveStoragePath(filePath);
      }
      if (fs.existsSync(abs)) {
        const buf = fs.readFileSync(abs);
        const ext = path.extname(abs).toLowerCase().replace(".", "");
        const mime = ext === "svg" ? "image/svg+xml" : `image/${ext === "jpg" ? "jpeg" : ext}`;
        return `src="data:${mime};base64,${buf.toString("base64")}"`;
      }
    } catch {}
    return match;
  });

  // 3. Inject base href so any other relative URLs can hit local server
  const port = process.env.PORT || 47713;
  const baseTag = `<base href="http://127.0.0.1:${port}/">`;
  if (processed.includes("<head>")) {
    processed = processed.replace("<head>", `<head>\n  ${baseTag}`);
  } else if (processed.includes("<head ")) {
    processed = processed.replace(/<head[^>]*>/, `$& \n  ${baseTag}`);
  }

  return processed;
}

export function htmlToPdfBuffer(html) {
  const chrome = findChromePath();
  if (!chrome) return null;

  const inlinedHtml = inlineImagesForPdf(html);

  const tempDir = os.tmpdir();
  const id = Date.now() + "_" + Math.random().toString(36).slice(2, 8);
  const tempHtml = path.join(tempDir, `inv_${id}.html`);
  const tempPdf = path.join(tempDir, `inv_${id}.pdf`);

  try {
    fs.writeFileSync(tempHtml, inlinedHtml, "utf8");
    cp.spawnSync(chrome, [
      "--headless=new",
      "--disable-gpu",
      "--no-sandbox",
      "--allow-file-access-from-files",
      "--enable-local-file-accesses",
      "--no-pdf-header-footer",
      `--print-to-pdf=${tempPdf}`,
      tempHtml,
    ], { timeout: 20000 });

    if (fs.existsSync(tempPdf)) {
      const buf = fs.readFileSync(tempPdf);
      return buf;
    }
  } catch (err) {
    // ignore
  } finally {
    try { if (fs.existsSync(tempHtml)) fs.unlinkSync(tempHtml); } catch {}
    try { if (fs.existsSync(tempPdf)) fs.unlinkSync(tempPdf); } catch {}
  }
  return null;
}
