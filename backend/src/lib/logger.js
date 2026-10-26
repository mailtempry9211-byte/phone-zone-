/** Local file logger. Technical detail goes to disk, never to the user's screen. */
import fs from "node:fs";
import path from "node:path";
import { PATHS } from "../config/paths.js";

function write(level, message, meta) {
  const line = JSON.stringify({
    ts: new Date().toISOString(),
    level,
    message: String(message),
    ...(meta ? { meta: meta instanceof Error ? { name: meta.name, message: meta.message, stack: meta.stack } : meta } : {}),
  });
  try {
    const file = path.join(PATHS.logsDir, `phonezone-${new Date().toISOString().slice(0, 10)}.log`);
    fs.appendFileSync(file, line + "\n");
  } catch {
    /* logging must never crash the app */
  }
  if (level === "error") console.error(line);
  else console.log(line);
}

export const logger = {
  info: (m, meta) => write("info", m, meta),
  warn: (m, meta) => write("warn", m, meta),
  error: (m, meta) => write("error", m, meta),
};
