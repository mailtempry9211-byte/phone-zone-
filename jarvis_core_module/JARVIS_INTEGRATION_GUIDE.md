# 🤖 JARVIS AI Copilot & Vision Engine — Universal ERP Integration Guide

Yeh module PhoneZone ke alawa aapke **kisi bhi doosre ERP ya Custom Software** (Node.js, Express, React, PostgreSQL/SQLite/MySQL) me sirf **5 minute me drop-in integrate** ho sakta hai!

---

## 📁 Is Module Me Kya-Kya Hai (`jarvis_core_module/`):

1. **`aiService.js`** — Universal Multi-Provider Engine (Google Gemini 1.5/2.0 Flash, Groq Llama 3.3 70B, OpenRouter, Ollama).
2. **`jarvisAgent.js`** — Agentic Loop (Human-like reasoning, conversation memory, tool execution, and clarification).
3. **`jarvisToolsTemplate.js`** — ERP Tool definitions template (Aapke naye ERP ke tables ke hisab se 2-3 line me customize karein).
4. **`aiRoutes.js`** — Express router (`/api/ai/chat`, `/api/ai/ocr-aadhaar`, `/api/ai/ocr-imei`, `/api/ai/config`).
5. **`JarvisOrb.tsx`** — React Floating Voice & Text Copilot Widget (Siri/Copilot style orb).
6. **`JarvisSettingsCard.tsx`** — React Settings component jahan user apni Free Gemini/Groq API Key daal sakega.

---

## 🚀 Doosre ERP Me Integrate Karne Ke 3 Aasan Steps:

### Step 1: Backend Files Copy Karein
Apne naye ERP ke `backend/src/services/` me:
- `aiService.js`
- `jarvisAgent.js`
- `jarvisToolsTemplate.js` (Isko `jarvisTools.js` rename karke apne ERP ke functions map karein).

Apne `backend/src/routes/` me:
- `aiRoutes.js` copy karein aur server me mount karein:
```javascript
import { buildAiRouter } from "./routes/aiRoutes.js";
app.use("/api/ai", buildAiRouter());
```

### Step 2: Database Migration Run Karein
Aapke ERP ke database me ye 3 tables hone chahiye (ya migration run karein):
```sql
ALTER TABLE admin_settings ADD COLUMN ai_provider TEXT DEFAULT 'gemini';
ALTER TABLE admin_settings ADD COLUMN ai_api_key TEXT DEFAULT '';
ALTER TABLE admin_settings ADD COLUMN ai_model TEXT DEFAULT 'gemini-1.5-flash';
ALTER TABLE admin_settings ADD COLUMN ai_custom_url TEXT DEFAULT '';
ALTER TABLE admin_settings ADD COLUMN ai_voice_enabled INTEGER DEFAULT 1;
ALTER TABLE admin_settings ADD COLUMN ai_auto_speak INTEGER DEFAULT 0;

CREATE TABLE IF NOT EXISTS jarvis_conversations (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  title TEXT DEFAULT 'New Conversation',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS jarvis_messages (
  id TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL,
  role TEXT NOT NULL,
  content TEXT NOT NULL,
  tool_calls TEXT,
  tool_results TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### Step 3: Frontend Me Jarvis Orb Lagayein
Apne naye ERP ke React main layout (Dashboard ya App.tsx) me:
```tsx
import JarvisOrb from "@/components/jarvis/JarvisOrb";

export default function Dashboard() {
  return (
    <div>
      {/* Aapka ERP Content */}
      <JarvisOrb />
    </div>
  );
}
```

---

## 🧠 Apne Doosre ERP ke Tools Kaise Add Karein:

Agar aapka doosra ERP Pharmacy, Grocery, ya Garment store ka hai, toh `jarvisToolsTemplate.js` me sirf naye functions add karein:

```javascript
// Example for Pharmacy ERP:
{
  name: "search_medicine_stock",
  description: "Search available medicine stock, expiry dates, and rack location",
  parameters: {
    type: "object",
    properties: {
      medicine_name: { type: "string", description: "Name of medicine (e.g. Paracetamol)" }
    },
    required: ["medicine_name"]
  }
}
```
JARVIS apne-aap us tool ko call karega aur dukan-dar ko bolkar aawaz me uttar dega!
