/**
 * Single entry point for app data. Components call `data.*` instead of Supabase
 * directly, so the exact same UI runs online (Supabase) and offline (SQLite).
 */
import { isOfflineMode, setOfflineOverride, LOCAL_API_BASE } from "./config.ts";
import { localDriver } from "./localDriver.ts";
import { supabaseDriver } from "./supabaseDriver.ts";
import type { DataDriver } from "./types.ts";

export const OFFLINE = isOfflineMode();
export const data: DataDriver = OFFLINE ? localDriver : supabaseDriver;

export { isOfflineMode, setOfflineOverride, LOCAL_API_BASE };
export * from "./types.ts";
