import { getDb } from "../db/index.js";
import { newId } from "../lib/errors.js";

/** Append-only audit trail for important actions. Never throws. */
export function audit(userId, action, entity = null, entityId = null, details = null) {
  try {
    getDb()
      .prepare("INSERT INTO audit_logs (id, user_id, action, entity, entity_id, details) VALUES (?,?,?,?,?,?)")
      .run(newId(), userId || null, action, entity, entityId, details ? JSON.stringify(details) : null);
  } catch {
    /* auditing must never break a business operation */
  }
}

export function listAuditLogs(limit = 100) {
  return getDb().prepare("SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT ?").all(limit);
}
