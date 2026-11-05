/**
 * PhoneZone Jarvis Conversational Agent Loop
 *
 * Implements agentic reasoning, memory persistence, tool execution,
 * and human-like clarification handling.
 */
import { getDb } from "../db/index.js";
import { logger } from "../lib/logger.js";
import { callLLMWithTools, getAiConfig } from "./aiService.js";
import { JARVIS_TOOLS, executeJarvisTool } from "./jarvisTools.js";

const SYSTEM_PROMPT = `You are JARVIS, the ultra-smart, reliable, and respectful AI Store Manager & Copilot for PhoneZone Mobile ERP.
You talk in natural, friendly, polite Hinglish (Hindi + English) like a seasoned Indian shop assistant / partner.
The shop owner or staff is talking to you via Voice or Text.

Core Behavior Guidelines:
1. TOOL CALLING PRIORITY (CRITICAL):
   - When asked about repairs, total repairs, repair count, or repair tickets (e.g. "repairing total kitni hui hai", "kitne phone theek hue"):
     ALWAYS call the search_repairs tool immediately! It returns total repairs count, completed count, revenue, and recent jobs.
   - When asked about a specific sold phone (e.g. "Realme ka jo phone bika tha", "iPhone kisko becha tha"):
     ALWAYS call search_sales with query (e.g. query: "Realme"). Do NOT filter by date unless the user explicitly specified a date (like "aaj" or "kal")!
   - When asked about total sold phones or all-time store statistics (e.g. "abhi tak kitne phone bika", "total sales kitni hui"):
     ALWAYS call get_business_summary with date_reference: "all_time"!
   - When asked about in-stock phones:
     ALWAYS call search_inventory!
   - When asked to record a purchase:
     Call purchase_phone_entry with extracted details.

2. HUMAN-LIKE CLARIFICATION:
   - If the user asks about a specific item and the tool returns that NO matching item was found for that date, but other items exist:
     POLITELY CLARIFY like a human shop assistant:
     "Bhaiya, parso Vivo ka koi phone nahi bika tha, sirf Tecno Spark 10 aur Oppo A58 bika tha. Aap kiska invoice bhejna chahte hain?"
   - Do NOT guess or make up data. If multiple records match, ask which one they want.

3. If the user confirms a choice (e.g. "Realme ka bhej do" or "Haan hisab dikhao"), proceed immediately with the appropriate tool and confirm when finished.

4. VOICE & TTS READABILITY (CRITICAL):
   - The user often listens to your answer via browser Voice / Text-To-Speech.
   - Speak in fluent, natural Indian conversational sentences (e.g. "Bhaiya, dukan me abhi tak total 1 repair complete hua hai, jiska bill 5,000 rupaye tha.").
   - DO NOT output robotic markdown bullet points (*, -, #) or asterisks in conversational answers, as browser speech synthesizers try to read asterisks and bullet symbols literally.
   - Always mention currency as "rupaye" or simple numbers with commas (e.g. "13,800 rupaye" or "37 hazar rupaye" instead of raw symbols like "₹13800").
   - Avoid acronyms or weird spellings. Keep words phonetically clear and pleasant to listen to.
5. All amounts are in Indian Rupees (rupaye).
`;

/**
 * Handle a chat turn with full tool execution loop
 */
export async function handleJarvisChat({ conversationId, userId, message, history = [] }) {
  const db = getDb();
  const config = getAiConfig();

  // Ensure conversation exists in DB
  const convId = conversationId || "conv_" + Math.random().toString(36).substring(2, 10);
  try {
    db.prepare(`
      INSERT OR IGNORE INTO jarvis_conversations (id, user_id, title)
      VALUES (?, ?, ?)
    `).run(convId, userId || "owner", message.slice(0, 30));
  } catch {}

  // Build message thread (Last 10 turns for speed & context)
  const messages = [];

  // Add past history if provided, or pull from DB
  if (Array.isArray(history) && history.length > 0) {
    for (const h of history.slice(-8)) {
      messages.push({ role: h.role, content: h.content });
    }
  } else {
    try {
      const dbMsgs = db.prepare(`
        SELECT role, content FROM jarvis_messages
        WHERE conversation_id = ?
        ORDER BY created_at ASC LIMIT 10
      `).all(convId);
      for (const m of dbMsgs) {
        messages.push({ role: m.role, content: m.content });
      }
    } catch {}
  }

  // Append user's current query
  messages.push({ role: "user", content: message });

  // Save user message to DB
  try {
    db.prepare(`
      INSERT INTO jarvis_messages (id, conversation_id, role, content)
      VALUES (?, ?, 'user', ?)
    `).run("msg_" + Math.random().toString(36).substring(2, 10), convId, message);
  } catch {}

  // 1. Initial LLM Call with Tools
  let currentResponse = await callLLMWithTools({
    messages,
    tools: JARVIS_TOOLS,
    systemPrompt: SYSTEM_PROMPT,
  });

  // If no tools requested, return text response directly
  if (!currentResponse.toolCalls || currentResponse.toolCalls.length === 0) {
    saveAssistantMessage(db, convId, currentResponse.content);
    return {
      conversationId: convId,
      reply: currentResponse.content,
      toolResults: [],
      autoSpeak: config.autoSpeak,
    };
  }

  // 2. Multi-turn Autonomous Tool Execution Loop (up to 4 steps)
  const toolResults = [];
  const followUpMessages = [...messages];
  let steps = 0;
  const maxSteps = 4;

  while (steps < maxSteps && currentResponse.toolCalls && currentResponse.toolCalls.length > 0) {
    steps++;
    followUpMessages.push({
      role: "assistant",
      content: currentResponse.content || "",
      toolCalls: currentResponse.toolCalls,
      rawParts: currentResponse.rawParts,
    });

    for (const tc of currentResponse.toolCalls) {
      logger.info(`[JarvisAgent Step ${steps}] Executing tool: ${tc.name} with args: ${JSON.stringify(tc.args)}`);
      const result = await executeJarvisTool(tc.name, tc.args);
      toolResults.push({
        toolName: tc.name,
        args: tc.args,
        result,
      });

      followUpMessages.push({
        role: "tool",
        name: tc.name,
        tool_call_id: tc.id,
        content: result,
      });
    }

    // Call LLM again with tool results
    currentResponse = await callLLMWithTools({
      messages: followUpMessages,
      tools: JARVIS_TOOLS,
      systemPrompt: SYSTEM_PROMPT,
    });
  }

  const finalReply = currentResponse.content || (toolResults.length > 0 ? "Maine records check kar liye hain sir." : "Main aapki kya madad kar sakta hoon?");
  saveAssistantMessage(db, convId, finalReply, JSON.stringify(toolResults));

  return {
    conversationId: convId,
    reply: finalReply,
    toolResults,
    autoSpeak: config.autoSpeak,
  };
}

function saveAssistantMessage(db, convId, content, toolResults = null) {
  try {
    db.prepare(`
      INSERT INTO jarvis_messages (id, conversation_id, role, content, tool_results)
      VALUES (?, ?, 'assistant', ?, ?)
    `).run("msg_" + Math.random().toString(36).substring(2, 10), convId, content, toolResults);
  } catch {}
}
