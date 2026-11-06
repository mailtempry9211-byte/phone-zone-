/**
 * AI Assistant (Jarvis) & AI Vision OCR Routes
 * Mounted at /api/ai
 */
import express from "express";
import { badRequest } from "../lib/errors.js";
import { getAiConfig, parseAadhaarWithVision, parseImeiWithVision, processSmartIntake, testAiConnection } from "../services/aiService.js";
import { handleJarvisChat } from "../services/jarvisAgent.js";
import { saveSettings } from "../services/settingsService.js";
import { getDb } from "../db/index.js";
import * as baileysService from "../services/baileysService.js";
import { pushSingleRowToSupabase } from "../services/supabaseSyncService.js";

const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

export function buildAiRouter(staffAuth, adminAuth) {
  const r = express.Router();

  // 1. Jarvis Voice & Text Chat
  r.post("/chat", staffAuth, wrap(async (req, res) => {
    const { message, conversationId, history } = req.body || {};
    if (!message || !message.trim()) {
      throw badRequest("Message is required.");
    }
    const result = await handleJarvisChat({
      conversationId,
      userId: req.user?.id || "staff",
      message: message.trim(),
      history,
    });
    res.json(result);
  }));

  // 2. AI Multi-Photo Smart Intake
  r.post("/smart-intake", staffAuth, wrap(async (req, res) => {
    const { images = [], message = "" } = req.body || {};
    if (!images || images.length === 0) {
      throw badRequest("At least 1 image is required for smart intake.");
    }
    const result = await processSmartIntake({ images, message });

    // Check if seller already exists with a saved signature
    try {
      const db = getDb();
      if (result.seller_phone) {
        const cleanPhone = String(result.seller_phone).replace(/\D/g, "");
        const exSeller = db.prepare(
          "SELECT id, name, address, id_number, signature_url FROM sellers WHERE phone LIKE ? OR phone = ? LIMIT 1"
        ).get(`%${cleanPhone}%`, cleanPhone);

        if (exSeller) {
          result.saved_signature = exSeller.signature_url || null;
          if (!result.seller_name && exSeller.name) result.seller_name = exSeller.name;
          if (!result.seller_address && exSeller.address) result.seller_address = exSeller.address;
          if (!result.seller_aadhaar && exSeller.id_number) result.seller_aadhaar = exSeller.id_number;
        }
      }
    } catch {}

    res.json({ ok: true, data: result });
  }));

  // 3. Confirm and Save Smart Intake Deal into Inventory
  r.post("/confirm-intake", staffAuth, wrap(async (req, res) => {
    const db = getDb();
    const {
      brand,
      model,
      imei1,
      imei2 = "",
      purchase_price,
      selling_price,
      seller_name,
      seller_phone,
      seller_aadhaar = "",
      seller_address = "",
      seller_signature = "",
      condition = "good",
      payment_method = "cash",
      product_photos = [],
      purchase_documents = [],
      payment_proof_photos = [],
    } = req.body || {};

    const cleanImei = (imei1 || "").replace(/\D/g, "");
    if (cleanImei.length < 15) throw badRequest("Valid 15-digit IMEI 1 is required.");
    if (!brand || !model) throw badRequest("Brand and Model are required.");
    if (!purchase_price) throw badRequest("Purchase price is required.");

    // Check duplicate IMEI
    const existing = db.prepare("SELECT id, is_sold FROM phones WHERE imei_number = ?").get(cleanImei);
    if (existing) {
      throw badRequest(`IMEI ${cleanImei} is already registered in store (${existing.is_sold ? "Sold" : "In Stock"}).`);
    }

    // Upsert Seller
    let sellerId = "sel_" + Math.random().toString(36).substring(2, 10);
    if (seller_phone) {
      const exSeller = db.prepare("SELECT id FROM sellers WHERE phone = ?").get(seller_phone);
      if (exSeller) sellerId = exSeller.id;
      else {
        db.prepare(`
          INSERT INTO sellers (id, name, phone, address, id_proof_type, id_number)
          VALUES (?, ?, ?, ?, 'aadhaar', ?)
        `).run(sellerId, seller_name || "Customer", seller_phone, seller_address, seller_aadhaar);
      }
    }

    const phoneId = "ph_" + Math.random().toString(36).substring(2, 12);
    const sellPrice = selling_price || Math.round(Number(purchase_price) * 1.15);

    db.prepare(`
      INSERT INTO phones (
        id, phone_name, model, imei_number, imei2_number, purchase_price, selling_price,
        condition, is_sold, seller_id, purchase_date, payment_method, shop_id,
        product_photos, purchase_documents, payment_proof_photos, seller_signature_url
      ) VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, datetime('now'), ?, 'all', ?, ?, ?, ?)
    `).run(
      phoneId,
      brand,
      model,
      cleanImei,
      (imei2 || "").replace(/\D/g, ""),
      Number(purchase_price),
      Number(sellPrice),
      condition,
      sellerId,
      payment_method,
      JSON.stringify(product_photos),
      JSON.stringify(purchase_documents),
      JSON.stringify(payment_proof_photos),
      seller_signature
    );

    const phoneRow = {
      id: phoneId,
      phone_name: brand,
      model,
      imei_number: cleanImei,
      imei2_number: (imei2 || "").replace(/\D/g, ""),
      purchase_price: Number(purchase_price),
      selling_price: Number(sellPrice),
      condition,
      is_sold: false,
      seller_id: sellerId,
      purchase_date: new Date().toISOString().split("T")[0],
      payment_method,
      product_photos,
      purchase_documents,
      payment_proof_photos,
      seller_signature_url: seller_signature,
    };

    // Mirror to Supabase Cloud in real time
    pushSingleRowToSupabase("phones", phoneRow).catch(() => {});

    // Optional WhatsApp acknowledgment
    if (seller_phone && seller_phone.length >= 10 && baileysService.isReady()) {
      try {
        await baileysService.sendTextMessage({
          phone: seller_phone,
          message: `Namaste ${seller_name || "Customer"} ji, PhoneZone me aapka phone (${brand} ${model}) purchase record successfully register ho gaya hai. Aapki payment ₹${Number(purchase_price).toLocaleString()} (${payment_method.toUpperCase()}) complete hai. Dhanyawad!`,
        });
      } catch {}
    }

    res.json({
      ok: true,
      phone_id: phoneId,
      brand,
      model,
      imei: cleanImei,
      message: `Phone ${brand} ${model} successfully added to inventory!`,
    });
  }));

  // 2. AI Vision OCR: Aadhaar Card (Front/Back)
  r.post("/ocr-aadhaar", wrap(async (req, res) => {
    const { imageBase64, side = "front" } = req.body || {};
    if (!imageBase64) throw badRequest("imageBase64 is required.");
    const cfg = getAiConfig();
    if (cfg.ocrEngine === "offline_only") {
      throw badRequest("AI OCR is disabled in Settings (Offline Only mode is active).");
    }
    const result = await parseAadhaarWithVision(imageBase64, side);
    res.json({ ok: true, data: result });
  }));

  // 3. AI Vision OCR: Phone Box / IMEI Barcode Sticker
  r.post("/ocr-imei", wrap(async (req, res) => {
    const { imageBase64 } = req.body || {};
    if (!imageBase64) throw badRequest("imageBase64 is required.");
    const cfg = getAiConfig();
    if (cfg.ocrEngine === "offline_only") {
      throw badRequest("AI OCR is disabled in Settings (Offline Only mode is active).");
    }
    const result = await parseImeiWithVision(imageBase64);
    res.json({ ok: true, data: result });
  }));

  // 4. AI Configuration Status
  r.get("/config", staffAuth, wrap((_req, res) => {
    const c = getAiConfig();
    res.json({
      provider: c.provider,
      model: c.model,
      customUrl: c.customUrl,
      voiceEnabled: c.voiceEnabled,
      autoSpeak: c.autoSpeak,
      ocrEngine: c.ocrEngine || "auto",
      isConfigured: c.isConfigured,
      hasKey: Boolean(c.apiKey),
    });
  }));

  // 5. Save AI Configuration
  r.post("/config", adminAuth, wrap((req, res) => {
    const { provider, apiKey, model, customUrl, voiceEnabled, autoSpeak, ocrEngine } = req.body || {};
    const updates = {};
    if (provider !== undefined) updates.ai_provider = String(provider).toLowerCase().trim();
    if (apiKey !== undefined) updates.ai_api_key = String(apiKey).trim();
    if (model !== undefined) updates.ai_model = String(model).trim();
    if (customUrl !== undefined) updates.ai_custom_url = String(customUrl).trim();
    if (voiceEnabled !== undefined) updates.ai_voice_enabled = voiceEnabled ? 1 : 0;
    if (autoSpeak !== undefined) updates.ai_auto_speak = autoSpeak ? 1 : 0;
    if (ocrEngine !== undefined) updates.ocr_engine = String(ocrEngine).trim();

    saveSettings(updates, req.user?.id);
    const updated = getAiConfig();
    res.json({
      ok: true,
      provider: updated.provider,
      model: updated.model,
      ocrEngine: updated.ocrEngine,
      isConfigured: updated.isConfigured,
    });
  }));

  // 6. Test AI Connection Live
  r.post("/test-connection", staffAuth, wrap(async (req, res) => {
    const result = await testAiConnection(req.body || {});
    res.json(result);
  }));

  return r;
}
