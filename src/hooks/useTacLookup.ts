import { useCallback, useEffect, useRef, useState } from "react";

export interface TacInfo {
  found: boolean;
  tac?: string;
  brand?: string;
  phoneName?: string;
  model?: string;
  specs?: string;
  source?: string;
  fetchMode?: "ask" | "auto" | "off";
  hasKeys?: boolean;
  error?: { code?: string; message?: string };
}

export type TacStatus = "idle" | "checking" | "found" | "miss" | "fetching" | "error";

export interface TacFill {
  phoneName: string;
  model: string;
  brand?: string;
}

/**
 * Step 2 - watch an IMEI/TAC field and auto-fill phone name + model.
 *
 * Local GET /api/tac/:value first (no quota cost). On a local miss the
 * `tac_fetch_mode` from the server decides: `auto` fetches online right away,
 * `ask` exposes fetchOnline() for a button, `off` never calls the API.
 */
export const useTacLookup = (value: string, onFill: (fill: TacFill) => void) => {
  const [status, setStatus] = useState<TacStatus>("idle");
  const [info, setInfo] = useState<TacInfo | null>(null);
  const [error, setError] = useState<string>("");

  const reqId = useRef(0);
  const fillRef = useRef(onFill);
  fillRef.current = onFill;

  // digits only, trimmed to 15 (IMEI) - Excel drops leading zeros on TACs
  const digits = (value || "").replace(/\D/g, "").slice(0, 15);

  const applyHit = useCallback((hit: TacInfo) => {
    setInfo(hit);
    if (hit.found && hit.phoneName && hit.model) {
      fillRef.current({ phoneName: hit.phoneName, model: hit.model, brand: hit.brand });
    }
  }, []);

  const fetchOnline = useCallback(
    async (target: string, force = false) => {
      const id = ++reqId.current;
      setStatus("fetching");
      setError("");
      try {
        const res = await fetch("/api/tac/fetch", {
          method: "POST",
          headers: { "content-type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ value: target, force }),
        });
        const body = await res.json().catch(() => ({}));
        if (id !== reqId.current) return;
        if (!res.ok) {
          setStatus("error");
          setError(body.error || "Online lookup failed.");
          return;
        }
        if (body.found) {
          setStatus("found");
          applyHit({ ...body, source: body.source || "api" });
        } else {
          setStatus("miss");
          setError(body.error?.message || "This TAC is not known online either.");
        }
      } catch {
        if (id !== reqId.current) return;
        setStatus("error");
        setError("Could not reach the server.");
      }
    },
    [applyHit],
  );

  useEffect(() => {
    if (digits.length < 8) {
      reqId.current++;
      setStatus("idle");
      setInfo(null);
      setError("");
      return;
    }

    const id = ++reqId.current;
    setStatus("checking");
    setError("");
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/tac/${digits}`, { credentials: "include" });
        const body = await res.json().catch(() => ({}));
        if (id !== reqId.current) return;
        if (!res.ok) {
          setStatus("error");
          setError(body.error || "TAC lookup failed.");
          return;
        }
        if (body.found) {
          setStatus("found");
          applyHit(body as TacInfo);
          return;
        }
        // local miss -> keep the response (fetchMode/hasKeys) for the UI hints
        setInfo(body as TacInfo);
        // local miss -> honour ask / auto / off
        if (body.fetchMode === "auto" && body.hasKeys) {
          fetchOnline(digits);
        } else {
          setStatus("miss");
        }
      } catch {
        if (id !== reqId.current) return;
        setStatus("error");
        setError("Could not reach the server.");
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [digits, applyHit, fetchOnline]);

  return { status, info, error, fetchOnline, digits };
};
