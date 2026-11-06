/**
 * Universal Multi-Provider AI & Vision Engine (PhoneZone JARVIS)
 *
 * Supports:
 * - Google Gemini (AI Studio - 1.5 Flash / 2.0 Flash) [Primary]
 * - Groq Cloud (Llama 3.3 70B Versatile)
 * - OpenRouter (Free Tier Models)
 * - Local Ollama / OpenAI-Compatible Endpoints
 */
import { getRawSettings } from "./settingsService.js";
import { logger } from "../lib/logger.js";

export function getAiConfig() {
  const settings = getRawSettings() || {};
  const provider = (settings.ai_provider || process.env.AI_PROVIDER || "gemini").toLowerCase().trim();
  let apiKey = (settings.ai_api_key || process.env.AI_API_KEY || process.env.GEMINI_API_KEY || "").trim();
  if (provider === "gemini" && apiKey) {
    const isLegit =
      apiKey.startsWith("AIzaSy") ||
      apiKey.startsWith("AQ.") ||
      (apiKey.length >= 35 && !apiKey.includes("@") && !apiKey.includes(" "));
    if (!isLegit) apiKey = ""; // Filter out accidental login password saved in DB by browser autofill
  }
  let model = (settings.ai_model || process.env.AI_MODEL || "").trim();
  if (!model || model === "gemini-1.5-flash" || model === "gemini-2.5-flash") {
    model = provider === "gemini" ? "gemini-3.5-flash" : provider === "groq" ? "llama-3.3-70b-versatile" : "meta-llama/llama-3.3-70b-instruct:free";
  }
  const customUrl = (settings.ai_custom_url || process.env.AI_CUSTOM_URL || "").trim();
  const voiceEnabled = settings.ai_voice_enabled !== 0;
  const autoSpeak = Boolean(settings.ai_auto_speak);
  const ocrEngine = settings.ocr_engine || "auto";

  return {
    provider,
    apiKey,
    model,
    customUrl,
    voiceEnabled,
    autoSpeak,
    ocrEngine,
    isConfigured: Boolean(apiKey || provider === "ollama"),
  };
}

/**
 * Clean base64 string helper
 */
function cleanBase64(b64) {
  if (!b64) return "";
  return b64.replace(/^data:[a-zA-Z0-9/+-]+;base64,/, "").trim();
}

/**
 * -------------------------------------------------------------
 * 1. AI Vision OCR: Parse Aadhaar Card (Front/Back)
 * -------------------------------------------------------------
 */
export async function parseAadhaarWithVision(imageBase64, side = "front") {
  const config = getAiConfig();
  if (!config.apiKey && config.provider !== "ollama") {
    throw new Error("AI API Key is missing. Please configure your Google Gemini or AI Studio key in Settings > Jarvis AI.");
  }

  const prompt = `You are an expert Indian identity document verification system.
Analyze the provided image of an Indian Aadhaar Card (${side.toUpperCase()} side) carefully.
Extract the text accurately. Even if the image is tilted, blurry, or captured in poor lighting, do your best to detect all fields.
Return a STRICT JSON object only. Do NOT include markdown code fences or conversational text.

JSON Schema to follow:
{
  "name": "Full legal name in English (front side)",
  "dob": "DD/MM/YYYY or Year of Birth",
  "gender": "Male / Female / Other",
  "id_number": "12-digit Aadhaar number with or without spaces (e.g. 1234 5678 9012)",
  "address": "Full residential address including Village/Town, District, State, PIN code (back side)",
  "confidence": 0.95
}`;

  return await executeVisionJson(imageBase64, prompt, config);
}

/**
 * -------------------------------------------------------------
 * 2. AI Vision OCR: Parse Phone Box Sticker / IMEI Barcode
 * -------------------------------------------------------------
 */
export async function parseImeiWithVision(imageBase64) {
  const config = getAiConfig();
  if (!config.apiKey && config.provider !== "ollama") {
    throw new Error("AI API Key is missing. Please configure your AI Key in Settings > Jarvis AI.");
  }

  const prompt = `You are an expert mobile phone serial & IMEI scanner.
Examine this photo of a smartphone packaging box sticker, bill, or phone back.
Extract:
1. Primary IMEI (15 digits)
2. Secondary IMEI 2 (15 digits, if present)
3. Brand / Manufacturer (e.g. Vivo, Oppo, Samsung, Apple, Realme)
4. Model Name & Storage (e.g. Y200 5G 8GB/128GB)
5. Color (e.g. Starry Night Blue)
6. Serial Number (S/N)

Return a STRICT JSON object only. Do NOT include markdown blocks.
JSON Schema:
{
  "imei1": "15 digit string",
  "imei2": "15 digit string or empty string",
  "brand": "Detected brand or empty string",
  "model": "Detected model or empty string",
  "color": "Detected color or empty string",
  "serialNumber": "Serial number or empty string"
}`;

  return await executeVisionJson(imageBase64, prompt, config);
}

/**
 * Universal Vision Executor
 */
async function executeVisionJson(imageBase64, prompt, config) {
  const b64Data = cleanBase64(imageBase64);
  if (!b64Data) throw new Error("Invalid or empty image data");

  // Gemini Vision
  if (config.provider === "gemini" || !config.provider) {
    let model = config.model && config.model.includes("gemini") ? config.model : "gemini-2.5-flash-lite";
    if (model === "gemini-1.5-flash" || model === "gemini-2.5-flash") model = "gemini-2.5-flash-lite";

    const candidateModels = [model, "gemini-2.5-flash-lite", "gemini-3.1-flash-lite", "gemini-3.5-flash"].filter(
      (m, idx, arr) => arr.indexOf(m) === idx
    );

    const payload = {
      contents: [
        {
          parts: [
            { text: prompt },
            {
              inline_data: {
                mime_type: "image/jpeg",
                data: b64Data,
              },
            },
          ],
        },
      ],
      generationConfig: {
        temperature: 0.1,
        response_mime_type: "application/json",
      },
    };

    let res = null;
    let errText = "";

    for (const m of candidateModels) {
      const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent?key=${config.apiKey}`;
      res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (res.ok) break;
      errText = await res.text();
      logger.warn(`[AIVision] Gemini model ${m} returned ${res.status}: ${errText.slice(0, 100)}. Falling back...`);
      if (res.status === 400) break;
    }

    if (!res || !res.ok) {
      logger.error("[AIVision] Gemini error: " + errText);
      throw new Error(`Gemini Vision failed (${res?.status || 500}): ${errText.slice(0, 150)}`);
    }

    const json = await res.json();
    const rawText = json?.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
    try {
      return JSON.parse(rawText.replace(/```json\n?|```/g, "").trim());
    } catch {
      return { raw: rawText };
    }
  }

  // OpenRouter Vision or Groq / OpenAI compatible
  const endpoint = config.provider === "openrouter"
    ? "https://openrouter.ai/api/v1/chat/completions"
    : config.customUrl || "https://api.openai.com/v1/chat/completions";

  const payload = {
    model: config.model,
    messages: [
      {
        role: "user",
        content: [
          { type: "text", text: prompt },
          {
            type: "image_url",
            image_url: { url: `data:image/jpeg;base64,${b64Data}` },
          },
        ],
      },
    ],
    temperature: 0.1,
  };

  const res = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Vision API error (${res.status}): ${errText.slice(0, 150)}`);
  }

  const json = await res.json();
  const rawText = json?.choices?.[0]?.message?.content || "{}";
  try {
    return JSON.parse(rawText.replace(/```json\n?|```/g, "").trim());
  } catch {
    return { raw: rawText };
  }
}

/**
 * Multi-Modal Multi-Photo Smart Intake
 * Automatically categorizes photos into product_photos, purchase_documents (Aadhaar), and payment_proof
 * and extracts all fields for a 1-click on-screen confirmation card.
 */
export async function processSmartIntake({ images = [], message = "" }) {
  const config = getAiConfig();
  if (!config.apiKey && config.provider !== "ollama") {
    throw new Error("AI API Key is missing. Please configure your AI Key in Settings > Jarvis AI.");
  }

  const prompt = `You are an expert mobile shop AI intake assistant for PhoneZone ERP.
Carefully examine the attached photos (up to 10 images) and user notes: "${message}".
Classify each individual image accurately and extract second-hand smartphone purchase details.

IMAGE TYPES (Use strictly one of these for each image):
- "product_photo": Smartphone hardware physical device (back cover, front screen, camera lenses, sides). Max 4 will be used on storefront.
- "box_sticker": Smartphone packaging box sticker, barcode label, or phone screen displaying *#06# IMEI numbers. Extract IMEI1 and IMEI2 here. DO NOT classify as product_photo.
- "aadhaar_front": Government Aadhaar card front side showing photo, name, and 12-digit Aadhaar number.
- "aadhaar_back": Government Aadhaar card back side showing full permanent address and pincode.
- "seller_photo": Photo of a human face / customer selling the phone.
- "seller_signature": Handwritten signature on paper or digital pad.
- "payment_proof": Screenshot or photo of UPI payment, Amazon Pay, PhonePe, Google Pay, Paytm, or bank transfer receipt.
- "purchase_document": Shop bill, purchase receipt, or cash memo.

EXTRACTION RULES:
- brand: Phone brand (e.g. Apple, Vivo, Oppo, Realme, Samsung, OnePlus, Xiaomi).
- model: Phone model name (e.g. iPhone 12 Pro, T2 Pro 5G, Reno 11).
- color: Physical color of the phone.
- imei1: Primary 15-digit IMEI number.
- imei2: Secondary 15-digit IMEI number (if dual SIM).
- seller_name: Customer full name from Aadhaar card.
- seller_phone: 10-digit mobile number from message or bill.
- seller_aadhaar: 12-digit Aadhaar number.
- seller_address: Complete address with pincode from Aadhaar back.
- purchase_price: Numeric purchase cost paid to seller (e.g. 19000).
- condition: Physical condition ("excellent", "good", "fair", "poor"). Default to "good" if clean.
- payment_method: "cash" or "upi" (set "upi" if payment_proof is detected).

Return a STRICT JSON object only. No markdown formatting.
Schema:
{
  "brand": string,
  "model": string,
  "color": string,
  "imei1": string,
  "imei2": string,
  "seller_name": string,
  "seller_phone": string,
  "seller_aadhaar": string,
  "seller_address": string,
  "purchase_price": number or null,
  "condition": "excellent" | "good" | "fair" | "poor",
  "payment_method": "cash" | "upi",
  "classifications": [
    {
      "index": 0,
      "type": "product_photo" | "box_sticker" | "aadhaar_front" | "aadhaar_back" | "seller_photo" | "seller_signature" | "payment_proof" | "purchase_document"
    }
  ]
}`;

  const b64Parts = images.map((img) => {
    let mime = "image/jpeg";
    const match = typeof img === "string" ? img.match(/^data:(image\/[a-zA-Z0-9.+_-]+);base64,/) : null;
    if (match) mime = match[1];
    return {
      inline_data: {
        mime_type: mime,
        data: cleanBase64(img),
      },
    };
  });

  const payload = {
    contents: [
      {
        parts: [{ text: prompt }, ...b64Parts],
      },
    ],
    generationConfig: {
      temperature: 0.1,
      response_mime_type: "application/json",
    },
  };

  let model = config.model && config.model.includes("gemini") ? config.model : "gemini-1.5-flash";
  const candidateModels = [model, "gemini-1.5-flash", "gemini-1.5-pro", "gemini-2.0-flash"].filter(
    (m, idx, arr) => arr.indexOf(m) === idx
  );

  let res = null;
  let lastErr = "";
  for (const m of candidateModels) {
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent?key=${config.apiKey}`;
    res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (res.ok) break;
    lastErr = await res.text();
  }

  if (!res || !res.ok) {
    throw new Error(`AI Intake Vision failed: ${lastErr.slice(0, 150)}`);
  }

  const json = await res.json();
  const rawText = json?.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
  let extracted = {};
  try {
    extracted = JSON.parse(rawText.replace(/```json\n?|```/g, "").trim());
  } catch {
    extracted = {};
  }

  // Parse price from message if not extracted
  if (!extracted.purchase_price && message) {
    const priceMatch = message.match(/(?:rs\.?|inr|₹)?\s*(\d{3,6})/i);
    if (priceMatch) extracted.purchase_price = Number(priceMatch[1]);
  }

  // Parse phone number from message if not extracted
  if (!extracted.seller_phone && message) {
    const phoneMatch = message.match(/\b([6-9]\d{9})\b/);
    if (phoneMatch) extracted.seller_phone = phoneMatch[1];
  }

  // Calculate Selling Price with 20% margin + increasing round figure to nearest ₹500
  const pPrice = Number(extracted.purchase_price) || 0;
  let sPrice = extracted.selling_price ? Number(extracted.selling_price) : null;
  if (!sPrice && pPrice > 0) {
    sPrice = Math.ceil((pPrice * 1.20) / 500) * 500;
  }

  // Smart Auto-Defaults
  const purchase_date = new Date().toISOString().split("T")[0]; // Auto Today's date
  const condition = extracted.condition || "good";
  const id_proof_type = extracted.seller_aadhaar ? "aadhaar" : "aadhaar";

  // Classify attached photos into exact destinations
  const product_photos = [];
  const purchase_documents = [];
  const payment_proof_photos = [];
  let seller_photo_url = "";
  let seller_signature_url = "";

  const classes = extracted.classifications || [];
  images.forEach((img, idx) => {
    const t = classes.find((c) => c.index === idx)?.type || "product_photo";

    if (t === "seller_photo") {
      if (!seller_photo_url) seller_photo_url = img;
    } else if (t === "seller_signature") {
      if (!seller_signature_url) seller_signature_url = img;
    } else if (t === "payment_proof") {
      payment_proof_photos.push(img);
    } else if (t === "aadhaar_front" || t === "aadhaar_back" || t === "purchase_document") {
      purchase_documents.push(img);
    } else if (t === "box_sticker") {
      // Box sticker / IMEI barcode is ONLY used to read IMEI, NOT added to product photos!
      // (Optionally added to documents for audit safety)
      purchase_documents.push(img);
    } else {
      // Physical product photos (max 4 on storefront)
      if (product_photos.length < 4) {
        product_photos.push(img);
      } else {
        purchase_documents.push(img);
      }
    }
  });

  // Determine Payment Method
  let payment_method = "cash";
  if (payment_proof_photos.length > 0 || /upi|gpay|paytm|phonepe|online|amazon\s*pay/i.test(message)) {
    payment_method = "upi";
  } else if (/cash|nakad/i.test(message)) {
    payment_method = "cash";
  }

  return {
    brand: extracted.brand || "",
    model: extracted.model || "",
    color: extracted.color || "",
    imei1: extracted.imei1 || "",
    imei2: extracted.imei2 || "",
    seller_name: extracted.seller_name || "",
    seller_phone: extracted.seller_phone || "",
    seller_aadhaar: extracted.seller_aadhaar || "",
    seller_address: extracted.seller_address || "",
    purchase_price: pPrice || null,
    selling_price: sPrice,
    purchase_date,
    condition,
    payment_method,
    id_proof_type,
    seller_photo_url,
    seller_signature_url,
    product_photos,
    purchase_documents,
    payment_proof_photos,
  };
}

/**
 * -------------------------------------------------------------
 * 3. Conversational AI + Function / Tool Calling Engine
 * -------------------------------------------------------------
 */
export async function callLLMWithTools({ messages, tools = [], systemPrompt, config: customConfig }) {
  const config = customConfig || getAiConfig();
  if (!config.apiKey && config.provider !== "ollama") {
    return {
      role: "assistant",
      content: "Namaste! Main PhoneZone ka AI Assistant JARVIS hoon. Kripya Admin Settings > Jarvis AI me jakar apni FREE Google Gemini ya AI Studio API key daal dijiye, taaki main dukan ke sabhi kaam bolkar ya type karke kar saku!",
      toolCalls: [],
    };
  }

  // 1. Google Gemini Native Tool Calling
  if (config.provider === "gemini") {
    return await callGeminiWithTools({ messages, tools, systemPrompt, config });
  }

  // 2. OpenAI-Compatible (Groq, OpenRouter, Ollama)
  return await callOpenAICompatibleWithTools({ messages, tools, systemPrompt, config });
}

/**
 * Gemini Provider Implementation
 */
async function callGeminiWithTools({ messages, tools, systemPrompt, config }) {
  let model = config.model && config.model.includes("gemini") ? config.model : "gemini-3.5-flash";
  if (model === "gemini-1.5-flash" || model === "gemini-2.5-flash") {
    model = "gemini-3.5-flash";
  }

  // Format tools for Gemini functionDeclarations
  const geminiTools = tools.length > 0 ? [
    {
      functionDeclarations: tools.map((t) => ({
        name: t.name,
        description: t.description,
        parameters: t.parameters,
      })),
    },
  ] : undefined;

  // Convert conversation history to Gemini contents format
  const contents = [];
  for (const m of messages) {
    if (m.role === "system") continue; // Passed via system_instruction

    if (m.role === "user") {
      contents.push({ role: "user", parts: [{ text: m.content }] });
    } else if (m.role === "assistant") {
      const parts = [];
      if (m.rawParts && m.rawParts.length > 0) {
        parts.push(...m.rawParts);
      } else {
        if (m.content) parts.push({ text: m.content });
        if (m.toolCalls && m.toolCalls.length > 0) {
          for (const tc of m.toolCalls) {
            const p = {
              functionCall: {
                name: tc.name,
                args: typeof tc.args === "string" ? JSON.parse(tc.args) : tc.args,
              },
            };
            if (tc.thoughtSignature || tc.thought_signature) {
              p.thoughtSignature = tc.thoughtSignature || tc.thought_signature;
            }
            parts.push(p);
          }
        }
      }
      if (parts.length > 0) contents.push({ role: "model", parts });
    } else if (m.role === "tool") {
      contents.push({
        role: "user",
        parts: [
          {
            functionResponse: {
              name: m.name,
              response: { content: m.content },
            },
          },
        ],
      });
    }
  }

  const payload = {
    contents,
    generationConfig: {
      temperature: 0.3,
    },
  };

  if (systemPrompt) {
    payload.system_instruction = {
      parts: [{ text: systemPrompt }],
    };
  }

  if (geminiTools) {
    payload.tools = geminiTools;
  }

  const executeCall = async (modelToUse) => {
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${modelToUse}:generateContent?key=${config.apiKey}`;
    return await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  };

  const candidateModels = [model, "gemini-2.5-flash-lite", "gemini-3.1-flash-lite", "gemini-3-flash-preview"].filter(
    (m, idx, arr) => arr.indexOf(m) === idx
  );

  let res = null;
  let lastErrorText = "";

  for (const m of candidateModels) {
    res = await executeCall(m);
    if (res.ok) {
      break;
    }
    lastErrorText = await res.text();
    logger.warn(`[Jarvis] Gemini model ${m} returned ${res.status}: ${lastErrorText.slice(0, 100)}. Trying fallback...`);
    if (res.status === 400) break;
  }

  if (!res || !res.ok) {
    logger.error("[Jarvis] Gemini LLM Error: " + lastErrorText);
    throw new Error(`Gemini Error (${res?.status || 500}): ${lastErrorText.slice(0, 180)}`);
  }

  const data = await res.json();
  const candidate = data?.candidates?.[0];
  const parts = candidate?.content?.parts || [];

  let textContent = "";
  const toolCalls = [];

  for (const p of parts) {
    if (p.text) textContent += p.text;
    if (p.functionCall) {
      toolCalls.push({
        id: "call_" + Math.random().toString(36).substring(2, 9),
        name: p.functionCall.name,
        args: p.functionCall.args || {},
        thoughtSignature: p.thoughtSignature || p.thought_signature,
        rawPart: p,
      });
    }
  }

  return {
    role: "assistant",
    content: textContent,
    toolCalls,
    rawParts: parts,
  };
}

/**
 * Groq / OpenRouter / Ollama Provider Implementation
 */
async function callOpenAICompatibleWithTools({ messages, tools, systemPrompt, config }) {
  let endpoint = "https://api.groq.com/openai/v1/chat/completions";
  if (config.provider === "openrouter") endpoint = "https://openrouter.ai/api/v1/chat/completions";
  if (config.provider === "ollama") endpoint = (config.customUrl || "http://127.0.0.1:11434").replace(/\/+$/, "") + "/v1/chat/completions";
  if (config.customUrl && config.provider !== "ollama") endpoint = config.customUrl;

  const formattedMessages = [];
  if (systemPrompt) {
    formattedMessages.push({ role: "system", content: systemPrompt });
  }

  for (const m of messages) {
    if (m.role === "tool") {
      formattedMessages.push({
        role: "tool",
        tool_call_id: m.tool_call_id || "call_default",
        content: typeof m.content === "object" ? JSON.stringify(m.content) : String(m.content),
      });
    } else if (m.role === "assistant" && m.toolCalls?.length) {
      formattedMessages.push({
        role: "assistant",
        content: m.content || null,
        tool_calls: m.toolCalls.map((tc) => ({
          id: tc.id || "call_default",
          type: "function",
          function: {
            name: tc.name,
            arguments: typeof tc.args === "object" ? JSON.stringify(tc.args) : String(tc.args),
          },
        })),
      });
    } else {
      formattedMessages.push({ role: m.role, content: m.content });
    }
  }

  const payload = {
    model: config.model,
    messages: formattedMessages,
    temperature: 0.3,
  };

  if (tools.length > 0) {
    payload.tools = tools.map((t) => ({
      type: "function",
      function: {
        name: t.name,
        description: t.description,
        parameters: t.parameters,
      },
    }));
  }

  const res = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const errText = await res.text();
    logger.error("[Jarvis] LLM error: " + errText);
    throw new Error(`AI Gateway Error (${res.status}): ${errText.slice(0, 180)}`);
  }

  const data = await res.json();
  const choice = data?.choices?.[0]?.message;

  const toolCalls = [];
  if (choice?.tool_calls) {
    for (const tc of choice.tool_calls) {
      let args = {};
      try {
        args = typeof tc.function.arguments === "string" ? JSON.parse(tc.function.arguments) : tc.function.arguments;
      } catch {}
      toolCalls.push({
        id: tc.id,
        name: tc.function.name,
        args,
      });
    }
  }

  return {
    role: "assistant",
    content: choice?.content || "",
    toolCalls,
  };
}

/**
 * Quick Test Connection
 */
export async function testAiConnection(overrideConfig = {}) {
  const settings = getRawSettings() || {};
  let apiKey = overrideConfig.apiKey !== undefined ? overrideConfig.apiKey : settings.ai_api_key || "";
  const provider = (overrideConfig.provider || settings.ai_provider || "gemini").toLowerCase().trim();
  let model = overrideConfig.model || settings.ai_model || "gemini-2.5-flash-lite";

  apiKey = (apiKey || "").trim();
  if (provider === "gemini" && apiKey) {
    const isLegit =
      apiKey.startsWith("AIzaSy") ||
      apiKey.startsWith("AQ.") ||
      (apiKey.length >= 35 && !apiKey.includes("@") && !apiKey.includes(" "));
    if (!isLegit) {
      return { ok: false, error: "Invalid Gemini API Key! Key must start with 'AIzaSy...' or 'AQ.'. Browser password detected." };
    }
  }

  const config = {
    provider,
    apiKey,
    model,
    customUrl: overrideConfig.customUrl || settings.ai_custom_url || "",
  };

  if (!config.apiKey && config.provider !== "ollama") {
    return { ok: false, error: "API Key is required" };
  }

  try {
    const reply = await callLLMWithTools({
      messages: [{ role: "user", content: "Reply strictly with: 'PhoneZone JARVIS Online!'" }],
      tools: [],
      systemPrompt: "You are a health check agent.",
      config,
    });

    return {
      ok: true,
      provider: config.provider,
      model: config.model,
      message: reply.content || "Connected successfully!",
    };
  } catch (err) {
    return {
      ok: false,
      error: err.message,
    };
  }
}
