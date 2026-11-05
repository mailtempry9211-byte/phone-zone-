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
  const apiKey = (settings.ai_api_key || process.env.AI_API_KEY || process.env.GEMINI_API_KEY || "").trim();
  const model = (settings.ai_model || process.env.AI_MODEL || (provider === "gemini" ? "gemini-1.5-flash" : provider === "groq" ? "llama-3.3-70b-versatile" : "meta-llama/llama-3.3-70b-instruct:free")).trim();
  const customUrl = (settings.ai_custom_url || process.env.AI_CUSTOM_URL || "").trim();
  const voiceEnabled = settings.ai_voice_enabled !== 0;
  const autoSpeak = Boolean(settings.ai_auto_speak);

  return {
    provider,
    apiKey,
    model,
    customUrl,
    voiceEnabled,
    autoSpeak,
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
    const model = config.model.includes("gemini") ? config.model : "gemini-1.5-flash";
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${config.apiKey}`;

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

    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const err = await res.text();
      logger.error("[AIVision] Gemini error: " + err);
      throw new Error(`Gemini Vision failed (${res.status}): ${err.slice(0, 150)}`);
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
 * -------------------------------------------------------------
 * 3. Conversational AI + Function / Tool Calling Engine
 * -------------------------------------------------------------
 */
export async function callLLMWithTools({ messages, tools = [], systemPrompt }) {
  const config = getAiConfig();
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
  const model = config.model.includes("gemini") ? config.model : "gemini-1.5-flash";
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${config.apiKey}`;

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
      if (m.content) parts.push({ text: m.content });
      if (m.toolCalls && m.toolCalls.length > 0) {
        for (const tc of m.toolCalls) {
          parts.push({
            functionCall: {
              name: tc.name,
              args: typeof tc.args === "string" ? JSON.parse(tc.args) : tc.args,
            },
          });
        }
      }
      if (parts.length > 0) contents.push({ role: "model", parts });
    } else if (m.role === "tool") {
      contents.push({
        role: "function",
        parts: [
          {
            functionResponse: {
              name: m.name,
              response: { result: m.content },
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

  const res = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const errText = await res.text();
    logger.error("[Jarvis] Gemini LLM Error: " + errText);
    throw new Error(`Gemini Error (${res.status}): ${errText.slice(0, 180)}`);
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
      });
    }
  }

  return {
    role: "assistant",
    content: textContent,
    toolCalls,
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
  const config = {
    provider: overrideConfig.provider || settings.ai_provider || "gemini",
    apiKey: overrideConfig.apiKey !== undefined ? overrideConfig.apiKey : settings.ai_api_key || "",
    model: overrideConfig.model || settings.ai_model || "gemini-1.5-flash",
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
