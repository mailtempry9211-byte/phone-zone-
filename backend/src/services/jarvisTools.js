/**
 * PhoneZone Jarvis AI Tools Execution Engine
 *
 * Provides real database queries, business actions, Baileys WhatsApp dispatch,
 * and human-like clarification handling for the ERP.
 */
import { getDb } from "../db/index.js";
import { logger } from "../lib/logger.js";
import * as baileysService from "./baileysService.js";
import { lookupTac } from "./tacService.js";
import { getInvoicePdf } from "./invoiceService.js";

/**
 * Tool Specifications for LLM Function Calling
 */
export const JARVIS_TOOLS = [
  {
    name: "search_sales",
    description: "Search phone sales records and invoices by phone brand, model, customer name, or date reference (e.g. today, yesterday, parso, 3 days ago). If a specific brand is not found on that date, returns all other phones sold on that date for human clarification.",
    parameters: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "Search keyword like phone brand, model, customer name, or IMEI (e.g. 'Vivo', 'Rahul', 'iPhone 13')",
        },
        date_reference: {
          type: "string",
          description: "Date string or natural Hindi/English reference: 'today', 'yesterday', 'parso', 'last_3_days', 'last_week', or YYYY-MM-DD",
        },
        limit: {
          type: "integer",
          description: "Maximum records to return (default 5)",
        },
      },
    },
  },
  {
    name: "send_invoice_whatsapp",
    description: "Send a sales or repair invoice directly to the customer's mobile number via Native WhatsApp Gateway with official PDF bill attached.",
    parameters: {
      type: "object",
      properties: {
        invoice_id: {
          type: "string",
          description: "Unique ID of the phone or invoice (UUID)",
        },
        phone: {
          type: "string",
          description: "10-digit customer mobile number",
        },
        custom_message: {
          type: "string",
          description: "Optional custom greetings or thank you message",
        },
      },
      required: ["phone"],
    },
  },
  {
    name: "search_inventory",
    description: "Search phones currently in stock in the shop by brand, model, price range, or condition.",
    parameters: {
      type: "object",
      properties: {
        query: { type: "string", description: "Search brand or model name (e.g. 'Samsung', 'iPhone', '128GB')" },
        max_price: { type: "number", description: "Maximum budget or selling price" },
        min_price: { type: "number", description: "Minimum selling price" },
        in_stock_only: { type: "boolean", description: "True to only show phones currently unsold in shop (default true)" },
      },
    },
  },
  {
    name: "lookup_imei_tac",
    description: "Identify phone brand, model name, and specs instantly from the 15-digit IMEI number using the embedded TAC database.",
    parameters: {
      type: "object",
      properties: {
        imei: { type: "string", description: "15-digit IMEI number" },
      },
      required: ["imei"],
    },
  },
  {
    name: "get_business_summary",
    description: "Get financial statistics: total revenue, profit, units sold, units purchased, and stock valuation for today or a specific date.",
    parameters: {
      type: "object",
      properties: {
        date_reference: { type: "string", description: "'today', 'yesterday', 'this_month', or YYYY-MM-DD" },
      },
    },
  },
  {
    name: "search_repairs",
    description: "Search customer mobile repair tickets, current repair status, estimated delivery time, and repair cost.",
    parameters: {
      type: "object",
      properties: {
        query: { type: "string", description: "Customer name, phone number, repair issue, or device model" },
        status: { type: "string", description: "Optional filter: 'pending', 'in_progress', 'completed', 'delivered'" },
      },
    },
  },
  {
    name: "purchase_phone_entry",
    description: "Record a new second-hand or new mobile phone purchase into the store inventory.",
    parameters: {
      type: "object",
      properties: {
        brand: { type: "string", description: "Brand name (e.g. Vivo, Oppo, Apple)" },
        model: { type: "string", description: "Model name (e.g. V29e 5G, iPhone 14)" },
        imei: { type: "string", description: "15-digit IMEI number" },
        purchase_price: { type: "number", description: "Buying price in INR (e.g. 12000)" },
        expected_selling_price: { type: "number", description: "Target selling price in INR" },
        seller_name: { type: "string", description: "Full name of person selling the phone" },
        seller_phone: { type: "string", description: "10-digit mobile number of seller" },
        condition: { type: "string", description: "good, fair, like_new, or broken" },
        payment_method: { type: "string", description: "cash, upi, bank_transfer, or unpaid" },
      },
      required: ["brand", "model", "imei", "purchase_price", "seller_name", "seller_phone"],
    },
  },
  {
    name: "change_theme",
    description: "Change the active storefront and dashboard design theme. Themes: 'glassmorphism' (Frosted Glass), 'neon' (Cyber Neon), 'luxury' (Black & Gold Luxury), 'apple_minimal' (Apple Minimal), 'phonezone_signature' (PhoneZone Signature), 'bento_pro', 'compact_retail', 'brutalist', 'fluid_carousel', 'split_slider'.",
    parameters: {
      type: "object",
      properties: {
        theme_id: { type: "string", description: "Target theme name, e.g. 'glassmorphism', 'neon', 'luxury', 'apple_minimal'" },
      },
      required: ["theme_id"],
    },
  },
  {
    name: "navigate_tab",
    description: "Navigate to an admin dashboard tab screen: 'inventory' (phones stock), 'sold' (sold phones history & bills), 'repairs' (repair tickets), 'marketing' (WhatsApp campaigns & channel control), 'reports' (accounting & charts), 'settings' (store settings), 'storefront' (storefront designer).",
    parameters: {
      type: "object",
      properties: {
        tab: { type: "string", description: "Target tab: 'inventory', 'sold', 'repairs', 'marketing', 'reports', 'settings', 'storefront'" },
      },
      required: ["tab"],
    },
  },
];

/**
 * Parse human date reference to SQLite date string range
 */
function resolveDateRange(ref) {
  if (!ref) return { start: null, end: null };

  const lower = String(ref).toLowerCase().trim();
  if (!lower || lower === "all" || lower === "all_time" || lower === "total" || lower === "sab" || lower === "abhi_tak" || lower === "ever") {
    return { start: null, end: null };
  }

  const now = new Date();
  const format = (d) => d.toISOString().split("T")[0];

  if (lower === "today" || lower === "aaj") {
    const today = format(now);
    return { start: today, end: today };
  }
  if (lower === "yesterday" || lower === "kal" || lower === "beeta hua kal") {
    const y = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const dStr = format(y);
    return { start: dStr, end: dStr };
  }
  if (lower === "parso" || lower === "2 days ago") {
    const p = new Date(now.getTime() - 48 * 60 * 60 * 1000);
    const dStr = format(p);
    return { start: dStr, end: dStr };
  }
  if (lower === "3 days ago" || lower === "3 din pehle" || lower === "tarso") {
    const t = new Date(now.getTime() - 72 * 60 * 60 * 1000);
    const dStr = format(t);
    return { start: dStr, end: dStr };
  }
  if (lower === "last_3_days" || lower === "pichle 3 din") {
    const s = new Date(now.getTime() - 72 * 60 * 60 * 1000);
    return { start: format(s), end: format(now) };
  }
  if (lower === "last_week" || lower === "pichle hafte") {
    const s = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    return { start: format(s), end: format(now) };
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(lower)) {
    return { start: lower, end: lower };
  }
  return { start: null, end: null };
}

/**
 * Execute Tool Implementation
 */
export async function executeJarvisTool(toolName, args = {}) {
  const db = getDb();

  try {
    switch (toolName) {
      // -------------------------------------------------------------
      // 1. Search Sales with Smart Disambiguation
      // -------------------------------------------------------------
      case "search_sales": {
        const { query = "", date_reference, limit = 5 } = args;
        const dateRange = resolveDateRange(date_reference);

        let sql = `
          SELECT p.id, p.phone_name as brand, p.model, p.imei_number, p.selling_price, p.sold_date as sale_date,
                 c.name as customer_name, c.phone as customer_phone
          FROM phones p
          LEFT JOIN customers c ON p.customer_id = c.id
          WHERE p.is_sold = 1
        `;
        const params = [];

        if (dateRange.start && dateRange.end) {
          sql += ` AND date(p.sold_date) >= date(?) AND date(p.sold_date) <= date(?)`;
          params.push(dateRange.start, dateRange.end);
        }

        if (query.trim()) {
          sql += ` AND (p.phone_name LIKE ? OR p.model LIKE ? OR c.name LIKE ? OR c.phone LIKE ? OR p.imei_number LIKE ?)`;
          const wildcard = `%${query.trim()}%`;
          params.push(wildcard, wildcard, wildcard, wildcard, wildcard);
        }

        sql += ` ORDER BY p.sold_date DESC LIMIT ?`;
        params.push(limit);

        const rows = db.prepare(sql).all(...params);

        // If specific search query returned nothing, but date range was specified,
        // pull ALL other phones sold on that date so Jarvis can clarify with user!
        if (rows.length === 0 && dateRange.start && query.trim()) {
          const allSoldOnDate = db.prepare(`
            SELECT p.id, p.phone_name as brand, p.model, p.selling_price, c.name as customer_name, c.phone as customer_phone
            FROM phones p
            LEFT JOIN customers c ON p.customer_id = c.id
            WHERE p.is_sold = 1 AND date(p.sold_date) >= date(?) AND date(p.sold_date) <= date(?)
          `).all(dateRange.start, dateRange.end);

          return {
            found_count: 0,
            requested_query: query,
            date_checked: dateRange.start,
            message: `No ${query} was sold on ${dateRange.start}.`,
            other_phones_sold_on_this_date: allSoldOnDate,
            clarification_needed: allSoldOnDate.length > 0,
          };
        }

        return {
          found_count: rows.length,
          sales: rows,
        };
      }

      // -------------------------------------------------------------
      // 2. Send Invoice via Baileys WhatsApp
      // -------------------------------------------------------------
      case "send_invoice_whatsapp": {
        const { invoice_id, phone, custom_message } = args;
        const cleanPhone = (phone || "").replace(/\D/g, "");
        if (!cleanPhone || cleanPhone.length < 10) {
          return { ok: false, error: "Valid 10-digit mobile number is required" };
        }

        let pdfBuf = null;
        let invoiceRecord = null;

        if (invoice_id) {
          invoiceRecord = db.prepare(`
            SELECT p.*, c.name as customer_name, c.phone as customer_phone
            FROM phones p
            LEFT JOIN customers c ON p.customer_id = c.id
            WHERE p.id = ?
          `).get(invoice_id);

          try {
            pdfBuf = getInvoicePdf(invoice_id);
          } catch {}
        }

        const msgText = custom_message || `Namaste ${invoiceRecord?.customer_name || "Grahak"} ji! PhoneZone se aapka kharidari bill aur invoice document sath me bheja ja raha hai. Kharidari ke liye shukriya! 🙏`;

        let waStatus = baileysService.getStatus();
        if (!waStatus.connected) {
          return {
            ok: false,
            error: "WhatsApp gateway is not connected yet. Please link WhatsApp via QR code or Pairing Code in Marketing tab.",
            phone: cleanPhone,
          };
        }

        // Send Text
        await baileysService.sendTextMessage({
          phone: cleanPhone,
          message: msgText,
        });

        // Send PDF if available
        let pdfSent = false;
        if (pdfBuf) {
          try {
            await baileysService.sendDocumentMessage({
              phone: cleanPhone,
              pdfBuffer: pdfBuf,
              filename: `Invoice_${invoiceRecord?.phone_name || "Phone"}_${invoiceRecord?.model || "Zone"}.pdf`,
              caption: "Official Tax Invoice Receipt",
            });
            pdfSent = true;
          } catch (e) {
            logger.warn("Jarvis sendDocumentMessage error", e);
          }
        }

        return {
          ok: true,
          recipient_phone: cleanPhone,
          customer_name: invoiceRecord?.customer_name || "Customer",
          device: invoiceRecord ? `${invoiceRecord.phone_name} ${invoiceRecord.model}` : "Mobile Phone",
          text_sent: true,
          pdf_sent: pdfSent,
          message: `Invoice successfully dispatched to +${cleanPhone} via WhatsApp!`,
        };
      }

      // -------------------------------------------------------------
      // 3. Search Inventory
      // -------------------------------------------------------------
      case "search_inventory": {
        const { query = "", max_price, min_price, in_stock_only = true } = args;
        let sql = `SELECT id, phone_name as brand, model, imei_number, purchase_price, selling_price, condition, is_sold FROM phones WHERE 1=1`;
        const params = [];

        if (in_stock_only) {
          sql += ` AND is_sold = 0`;
        }
        if (query.trim()) {
          sql += ` AND (phone_name LIKE ? OR model LIKE ? OR imei_number LIKE ?)`;
          const w = `%${query.trim()}%`;
          params.push(w, w, w);
        }
        if (max_price) {
          sql += ` AND selling_price <= ?`;
          params.push(max_price);
        }
        if (min_price) {
          sql += ` AND selling_price >= ?`;
          params.push(min_price);
        }
        sql += ` ORDER BY purchase_date DESC LIMIT 10`;

        const items = db.prepare(sql).all(...params);
        return {
          count: items.length,
          items,
        };
      }

      // -------------------------------------------------------------
      // 4. Lookup IMEI TAC
      // -------------------------------------------------------------
      case "lookup_imei_tac": {
        const { imei } = args;
        const clean = (imei || "").replace(/\D/g, "");
        if (clean.length < 8) {
          return { found: false, error: "IMEI must be at least 8 digits" };
        }
        const tac = clean.slice(0, 8);
        const info = lookupTac(tac);
        return {
          imei: clean,
          tac,
          found: Boolean(info),
          brand: info?.brand || "Unknown",
          model: info?.model || "Unknown",
          specs: info || null,
        };
      }

      // -------------------------------------------------------------
      // 5. Business Financial Summary
      // -------------------------------------------------------------
      case "get_business_summary": {
        const { date_reference } = args;
        const dateRange = resolveDateRange(date_reference);
        const dStart = dateRange.start;
        const dEnd = dateRange.end;

        // All-time lifetime statistics
        const lifetimeSales = db.prepare(`
          SELECT COUNT(*) as count, COALESCE(SUM(selling_price), 0) as total_sales,
                 COALESCE(SUM(selling_price - purchase_price), 0) as gross_profit
          FROM phones
          WHERE is_sold = 1
        `).get();

        const activeStock = db.prepare(`
          SELECT COUNT(*) as count, COALESCE(SUM(purchase_price), 0) as valuation
          FROM phones WHERE is_sold = 0
        `).get();

        const allTimePurchases = db.prepare(`
          SELECT COUNT(*) as count, COALESCE(SUM(purchase_price), 0) as total_purchases
          FROM phones
        `).get();

        // Period-specific statistics
        let periodSales = lifetimeSales;
        if (dStart && dEnd) {
          periodSales = db.prepare(`
            SELECT COUNT(*) as count, COALESCE(SUM(selling_price), 0) as total_sales,
                   COALESCE(SUM(selling_price - purchase_price), 0) as gross_profit
            FROM phones
            WHERE is_sold = 1 AND date(sold_date) >= date(?) AND date(sold_date) <= date(?)
          `).get(dStart, dEnd);
        }

        return {
          period: date_reference || "all_time",
          date_start: dStart || "all_time",
          date_end: dEnd || "all_time",
          period_sales_count: periodSales?.count || 0,
          period_revenue: periodSales?.total_sales || 0,
          period_profit: periodSales?.gross_profit || 0,
          all_time_sold_phones_count: lifetimeSales?.count || 0,
          all_time_sales_revenue: lifetimeSales?.total_sales || 0,
          all_time_gross_profit: lifetimeSales?.gross_profit || 0,
          current_stock_count: activeStock?.count || 0,
          stock_valuation: activeStock?.valuation || 0,
          total_phones_purchased_ever: allTimePurchases?.count || 0,
        };
      }

      // -------------------------------------------------------------
      // 6. Search Repairs (Tickets & All-time count)
      // -------------------------------------------------------------
      case "search_repairs": {
        const { query = "", status } = args;

        // All-time repair summary statistics
        const summary = db.prepare(`
          SELECT 
            COUNT(*) as total_count,
            SUM(CASE WHEN status = 'delivered' OR status = 'completed' THEN 1 ELSE 0 END) as completed_count,
            SUM(CASE WHEN status = 'in_progress' OR status = 'pending' THEN 1 ELSE 0 END) as active_count,
            COALESCE(SUM(final_price), 0) as total_revenue
          FROM repair_jobs
          WHERE deleted_at IS NULL
        `).get();

        let sql = `
          SELECT rj.id, rj.job_no, rc.name as customer_name, rc.phone as customer_phone,
                 rj.device_brand, rj.device_model, rj.problem as problem_description,
                 rj.status, rj.estimate as estimated_cost, rj.advance_paid, rj.final_price,
                 rj.created_at
          FROM repair_jobs rj
          LEFT JOIN repair_customers rc ON rj.repair_customer_id = rc.id
          WHERE rj.deleted_at IS NULL
        `;
        const params = [];

        if (status) {
          sql += ` AND rj.status = ?`;
          params.push(status);
        }
        if (query.trim()) {
          sql += ` AND (rc.name LIKE ? OR rc.phone LIKE ? OR rj.device_brand LIKE ? OR rj.device_model LIKE ? OR rj.problem LIKE ? OR rj.job_no LIKE ?)`;
          const w = `%${query.trim()}%`;
          params.push(w, w, w, w, w, w);
        }
        sql += ` ORDER BY rj.created_at DESC LIMIT 10`;

        const repairs = db.prepare(sql).all(...params);
        return {
          all_time_repairs_count: summary?.total_count || 0,
          completed_repairs_count: summary?.completed_count || 0,
          active_repairs_count: summary?.active_count || 0,
          total_repair_revenue: summary?.total_revenue || 0,
          matching_count: repairs.length,
          repairs,
        };
      }

      // -------------------------------------------------------------
      // 7. Purchase Phone Entry
      // -------------------------------------------------------------
      case "purchase_phone_entry": {
        const {
          brand,
          model,
          imei,
          purchase_price,
          expected_selling_price,
          seller_name,
          seller_phone,
          condition = "good",
          payment_method = "cash",
        } = args;

        const cleanImei = (imei || "").replace(/\D/g, "");
        if (cleanImei.length < 15) {
          return { ok: false, error: "15-digit valid IMEI number is required." };
        }

        // Check duplicate IMEI
        const existing = db.prepare("SELECT id, is_sold FROM phones WHERE imei_number = ?").get(cleanImei);
        if (existing) {
          return { ok: false, error: `IMEI ${cleanImei} is already registered in the shop (${existing.is_sold ? "Sold" : "In Stock"}).` };
        }

        // Upsert seller
        let seller = db.prepare("SELECT id FROM sellers WHERE phone = ?").get(seller_phone);
        let sellerId = seller?.id;
        if (!sellerId) {
          sellerId = "sel_" + Math.random().toString(36).substring(2, 10);
          db.prepare(`
            INSERT INTO sellers (id, name, phone, address, id_proof_type, id_number)
            VALUES (?, ?, ?, '', 'aadhaar', '')
          `).run(sellerId, seller_name, seller_phone);
        }

        const phoneId = "ph_" + Math.random().toString(36).substring(2, 12);
        const sellPrice = expected_selling_price || Math.round(Number(purchase_price) * 1.15);

        db.prepare(`
          INSERT INTO phones (
            id, phone_name, model, imei_number, purchase_price, selling_price,
            condition, is_sold, seller_id, purchase_date, payment_method, shop_id
          ) VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, datetime('now'), ?, 'all')
        `).run(
          phoneId,
          brand,
          model,
          cleanImei,
          Number(purchase_price),
          sellPrice,
          condition,
          sellerId,
          payment_method
        );

        return {
          ok: true,
          phone_id: phoneId,
          brand,
          model,
          imei: cleanImei,
          purchase_price: Number(purchase_price),
          seller_name,
          message: `Phone ${brand} ${model} successfully added to inventory!`,
        };
      }

      // -------------------------------------------------------------
      // 8. Change Storefront / Admin Theme
      // -------------------------------------------------------------
      case "change_theme": {
        const { theme_id } = args;
        let cleanTheme = (theme_id || "").toLowerCase().trim();
        if (cleanTheme.includes("frost") || cleanTheme.includes("glass")) cleanTheme = "glassmorphism";
        else if (cleanTheme.includes("neon") || cleanTheme.includes("cyber")) cleanTheme = "neon";
        else if (cleanTheme.includes("lux") || cleanTheme.includes("gold")) cleanTheme = "luxury";
        else if (cleanTheme.includes("apple") || cleanTheme.includes("mini")) cleanTheme = "apple_minimal";
        else if (cleanTheme.includes("sign") || cleanTheme.includes("phonezone")) cleanTheme = "phonezone_signature";

        try {
          db.prepare("UPDATE admin_settings SET homepage_theme = ?").run(cleanTheme);
        } catch {}

        return {
          ok: true,
          theme_id: cleanTheme,
          action: "CHANGE_THEME",
          message: `Theme successfully changed to ${cleanTheme}!`,
        };
      }

      // -------------------------------------------------------------
      // 9. Navigate Dashboard Tab
      // -------------------------------------------------------------
      case "navigate_tab": {
        const { tab } = args;
        const cleanTab = (tab || "dashboard").toLowerCase().trim();
        return {
          ok: true,
          tab: cleanTab,
          action: "NAVIGATE_TAB",
          message: `Navigating to ${cleanTab} tab...`,
        };
      }

      default:
        return { error: `Tool ${toolName} is not recognized.` };
    }
  } catch (err) {
    logger.error(`[JarvisToolError] ${toolName}: ` + err.message);
    return { error: err.message };
  }
}
