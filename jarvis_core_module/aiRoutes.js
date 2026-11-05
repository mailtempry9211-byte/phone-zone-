/**
 * AI Assistant (Jarvis) & AI Vision OCR Routes
 * Mounted at /api/ai
 */
import express from "express";
import { badRequest } from "../lib/errors.js";
import { getAiConfig, parseAadhaarWithVision, parseImeiWithVision, testAiConnection } from "../services/aiService.js";
import { handleJarvisChat } from "../services/jarvisAgent.js";
import { saveSettings } from "../services/settingsService.js";

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

  // 2. AI Vision OCR: Aadhaar Card (Front/Back)
  r.post("/ocr-aadhaar", wrap(async (req, res) => {
    const { imageBase64, side = "front" } = req.body || {};
    if (!imageBase64) throw badRequest("imageBase64 is required.");
    const result = await parseAadhaarWithVision(imageBase64, side);
    res.json({ ok: true, data: result });
  }));

  // 3. AI Vision OCR: Phone Box / IMEI Barcode Sticker
  r.post("/ocr-imei", wrap(async (req, res) => {
    const { imageBase64 } = req.body || {};
    if (!imageBase64) throw badRequest("imageBase64 is required.");
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
      isConfigured: c.isConfigured,
      hasKey: Boolean(c.apiKey),
    });
  }));

  // 5. Save AI Configuration
  r.post("/config", adminAuth, wrap((req, res) => {
    const { provider, apiKey, model, customUrl, voiceEnabled, autoSpeak } = req.body || {};
    const updates = {};
    if (provider !== undefined) updates.ai_provider = String(provider).toLowerCase().trim();
    if (apiKey !== undefined) updates.ai_api_key = String(apiKey).trim();
    if (model !== undefined) updates.ai_model = String(model).trim();
    if (customUrl !== undefined) updates.ai_custom_url = String(customUrl).trim();
    if (voiceEnabled !== undefined) updates.ai_voice_enabled = voiceEnabled ? 1 : 0;
    if (autoSpeak !== undefined) updates.ai_auto_speak = autoSpeak ? 1 : 0;

    saveSettings(updates, req.user?.id);
    const updated = getAiConfig();
    res.json({
      ok: true,
      provider: updated.provider,
      model: updated.model,
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
