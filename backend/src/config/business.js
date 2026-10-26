/** Loads config/business-config.json once. Never hardcode business info elsewhere. */
import fs from "node:fs";
import path from "node:path";
import { CONFIG_DIR, PATHS } from "./paths.js";

let cache = null;

export function businessConfig() {
  if (cache) return cache;
  // A user-editable copy in the data dir wins over the shipped default.
  const userCopy = path.join(PATHS.configDir, "business-config.json");
  const shipped = path.join(CONFIG_DIR, "business-config.json");
  const file = fs.existsSync(userCopy) ? userCopy : shipped;
  cache = JSON.parse(fs.readFileSync(file, "utf8"));
  return cache;
}

export function reloadBusinessConfig() {
  cache = null;
  return businessConfig();
}

export const SERVER = {
  host: process.env.PHONEZONE_HOST || "127.0.0.1",
  port: Number(process.env.PHONEZONE_PORT || 47713),
  sessionTtlHours: Number(process.env.PHONEZONE_SESSION_HOURS || 12),
  maxUploadBytes: Number(process.env.PHONEZONE_MAX_UPLOAD_BYTES || 10 * 1024 * 1024),
};
