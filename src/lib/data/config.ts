/**
 * Offline mode toggle.
 *
 * The same frontend build runs in two environments:
 *   - ONLINE  (Lovable preview / phonezonestp.lovable.app) -> Supabase driver
 *   - OFFLINE (Electron EXE / local start scripts)         -> local Express + SQLite driver
 *
 * Resolution order (first match wins):
 *   1. localStorage "phonezone.offline" = "true" | "false"   (manual override, for testing)
 *   2. VITE_PHONEZONE_OFFLINE = "true"                       (build-time flag)
 *   3. window.__PHONEZONE_OFFLINE__ = true                   (injected by the desktop shell)
 *   4. Auto-detect: served from 127.0.0.1/localhost on the local backend port
 */
export const LOCAL_API_BASE =
  (import.meta.env.VITE_PHONEZONE_API as string | undefined)?.replace(/\/$/, "") || "/api";

const LOCAL_PORT = import.meta.env.VITE_PHONEZONE_PORT || "47713";
const STORAGE_KEY = "phonezone.offline";

declare global {
  interface Window {
    __PHONEZONE_OFFLINE__?: boolean;
  }
}

function autoDetect(): boolean {
  if (typeof window === "undefined") return false;
  const { hostname, port } = window.location;
  // If explicitly hosted on Lovable preview cloud, use online Supabase
  if (hostname.includes("lovable.app") || hostname.includes("supabase.co")) return false;
  // Localhost, 127.0.0.1, ngrok tunnel, LAN IP, desktop app are all local backend
  return true;
}

export function isOfflineMode(): boolean {
  if (typeof window !== "undefined") {
    try {
      const override = window.localStorage.getItem(STORAGE_KEY);
      if (override === "true") return true;
      if (override === "false") return false;
    } catch {
      /* private mode - ignore */
    }
    if (window.__PHONEZONE_OFFLINE__ === true) return true;
  }
  if (String(import.meta.env.VITE_PHONEZONE_OFFLINE) === "true") return true;
  return autoDetect();
}

/** Manual override helper (used by the Settings tab / dev tooling). Reloads the app. */
export function setOfflineOverride(value: boolean | null) {
  if (typeof window === "undefined") return;
  if (value === null) window.localStorage.removeItem(STORAGE_KEY);
  else window.localStorage.setItem(STORAGE_KEY, String(value));
  window.location.reload();
}
