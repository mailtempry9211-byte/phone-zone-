-- Migration 029: Jarvis AI Assistant & AI Vision Engine Settings
-- Adds persistent AI configuration to admin_settings and stores Jarvis conversation history

ALTER TABLE admin_settings ADD COLUMN ai_provider TEXT DEFAULT 'gemini';
ALTER TABLE admin_settings ADD COLUMN ai_api_key TEXT DEFAULT '';
ALTER TABLE admin_settings ADD COLUMN ai_model TEXT DEFAULT 'gemini-2.5-flash-lite';
ALTER TABLE admin_settings ADD COLUMN ai_custom_url TEXT DEFAULT '';
ALTER TABLE admin_settings ADD COLUMN ai_voice_enabled INTEGER DEFAULT 1;
ALTER TABLE admin_settings ADD COLUMN ai_auto_speak INTEGER DEFAULT 0;

CREATE TABLE IF NOT EXISTS jarvis_conversations (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  title TEXT DEFAULT 'New Conversation',
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS jarvis_messages (
  id TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL,
  role TEXT NOT NULL CHECK(role IN ('user', 'assistant', 'system', 'tool')),
  content TEXT NOT NULL,
  tool_calls TEXT,
  tool_results TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (conversation_id) REFERENCES jarvis_conversations(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_jarvis_messages_conv ON jarvis_messages(conversation_id, created_at ASC);
