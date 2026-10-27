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
  const inv = getDb().prepare("SELECT * FROM invoices WHERE id = ?").get(id);
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
  if (!inv.html_path) throw badRequest("No HTML snapshot saved for this invoice.");
  const abs = resolveStoragePath(inv.html_path);
  if (!fs.existsSync(abs)) throw badRequest("Invoice HTML file missing from storage.");
  return fs.readFileSync(abs, "utf8");
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
