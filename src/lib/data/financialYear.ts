/**
 * Financial-year REST helpers.
 *
 * These talk to the local Express backend directly (the same origin the offline
 * shim uses) because financial years are an offline/desktop feature: the hosted
 * Supabase site has no such endpoints. Callers gate on `isOfflineMode()` and the
 * UI simply hides the year switcher when the endpoints are unavailable.
 */
import { LOCAL_API_BASE } from "./config";

export interface FinancialYear {
  id: string;
  label: string;
  startDate: string;
  endDate: string;
  isActive: boolean;
  isClosed: boolean;
  totalPhones?: number;
  availablePhones?: number;
  soldPhones?: number;
  revenue?: number;
}

export interface FinancialYearState {
  active: FinancialYear | null;
  years: FinancialYear[];
  isPreviousYear?: boolean;
  latestYear?: string | null;
}

export interface CarryForwardResult {
  success: boolean;
  fromYear: string;
  toYear: string;
  phonesCarried: number;
  repairsCarried: number;
}

export interface PendingChangesResult {
  hasPending: boolean;
  fromYear?: string;
  toYear?: string;
  count: number;
  changes: Array<{
    id: string;
    from_fy: string;
    to_fy: string;
    entity_type: string;
    entity_id: string;
    action: string;
    details: string;
    created_at: string;
  }>;
}

async function call<T>(path: string, method: "GET" | "POST" = "GET", body?: unknown): Promise<T> {
  const res = await fetch(`${LOCAL_API_BASE}${path}`, {
    method,
    credentials: "include",
    headers: body === undefined ? undefined : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!res.ok) {
    const e = await res.json().catch(() => ({}));
    throw new Error((e as { error?: string }).error || `Request failed (${res.status})`);
  }
  return (await res.json()) as T;
}

export const getFinancialYears = () => call<FinancialYearState>("/financial-years");
export const getNextFinancialYearLabel = () => call<{ label: string }>("/financial-years/next");
/** Starting a new year needs the admin password; the backend also verifies it. */
export const createFinancialYear = (input: { label: string; password: string }) =>
  call<FinancialYearState>("/financial-years", "POST", input);
export const activateFinancialYear = (id: string, password: string) =>
  call<FinancialYearState>(`/financial-years/${encodeURIComponent(id)}/activate`, "POST", { password });

export const getPendingCarryChanges = (from?: string, to?: string) =>
  call<PendingChangesResult>(`/financial-years/pending-changes${from ? `?from=${encodeURIComponent(from)}` : ""}`);

export const carryForwardFinancialYear = (input: { fromYear: string; toYear: string }) =>
  call<CarryForwardResult>("/financial-years/carry-forward", "POST", input);

// ------------------------------------------------------------------- IMEI ----

export interface ImeiHistory {
  imei: string;
  found: boolean;
  count: number;
  years: string[];
  purchases: Array<{
    id: string;
    financialYear: string | null;
    phoneName: string;
    model: string;
    imei: string;
    condition: string;
    date: string;
    amount: number;
    paymentMethod: string | null;
    seller: { name: string; phone: string; address: string; id_proof_type: string; id_number: string } | null;
    archived: boolean;
  }>;
  sales: Array<{
    id: string;
    financialYear: string | null;
    soldDate: string | null;
    amount: number;
    customer: { name: string; phone: string; address: string; id_proof_type: string; id_number: string } | null;
    returned: boolean;
  }>;
  returns: Array<{ id: string; financialYear: string | null; return_type: string; return_amount: number; return_reason: string; return_date: string }>;
  invoices: Array<{ id: string; financialYear: string | null; invoice_number: string; invoice_type: string; amount: number; issued_at: string }>;
  totals: { purchased: number; sold: number; returned: number };
}

export const getImeiHistory = (imei: string) => call<ImeiHistory>(`/imei-history?imei=${encodeURIComponent(imei)}`);
