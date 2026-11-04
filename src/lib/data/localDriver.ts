/** Offline driver - talks to the local Express + SQLite backend on 127.0.0.1. */
import { LOCAL_API_BASE } from "./config";
import {
  DEFAULT_CONTACT,
  type AdminStats,
  type ContactInfo,
  type ContactMessageInput,
  type DataDriver,
  type PublicPhone,
} from "./types";

export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${LOCAL_API_BASE}${path}`, {
    credentials: "include",
    headers: init.body instanceof FormData ? undefined : { "Content-Type": "application/json" },
    ...init,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as { error?: string }).error || "Something went wrong. Please try again.");
  }
  return res.status === 204 ? (undefined as T) : ((await res.json()) as T);
}

export const localDriver: DataDriver = {
  mode: "offline",

  async listPublicPhones(limit = 12) {
    const rows = await api<PublicPhone[]>("/public/inventory");
    return rows.slice(0, limit);
  },

  async getContactInfo(): Promise<ContactInfo> {
    const cfg = await api<Record<string, any>>("/config");
    // /config returns flat camelCase properties from settingsService.getSettings()
    return {
      phone_primary: cfg.primaryPhone || DEFAULT_CONTACT.phone_primary,
      phone_secondary: cfg.secondaryPhone || DEFAULT_CONTACT.phone_secondary,
      email: cfg.email || DEFAULT_CONTACT.email,
      instagram: cfg.instagram || DEFAULT_CONTACT.instagram,
      address: cfg.address || DEFAULT_CONTACT.address,
      business_name: cfg.businessName || DEFAULT_CONTACT.business_name,
      business_tagline: cfg.businessTagline || DEFAULT_CONTACT.business_tagline,
      // Extra fields used by the homepage / invoice templates
      logo_url: cfg.logoUrl || "",
      udyam_number: cfg.udyamNumber || "",
      show_udyam: cfg.showUdyam || false,
      google_business_url: cfg.googleBusinessUrl || "",
      show_google_business: cfg.showGoogleBusiness || false,
      google_business_verified: cfg.googleBusinessVerified || false,
      owner_name: cfg.ownerName || "",
      // Bank details
      bank_name: cfg.bankName || "",
      account_holder_name: cfg.accountHolderName || "",
      account_number: cfg.accountNumber || "",
      ifsc_code: cfg.ifscCode || "",
      // Terms
      terms_and_conditions: cfg.termsAndConditions || "",
      terms_and_conditions_sale: cfg.termsAndConditionsSale || "",
      terms_and_conditions_purchase: cfg.termsAndConditionsPurchase || "",
      whatsapp_number: cfg.whatsappNumber || "",
      homepage_theme: cfg.homepageTheme || "modern",
      homepage_config: cfg.homepageConfig || null,
      repair_services: cfg.repairServices || [],
    };
  },

  async getAdminStats(): Promise<AdminStats> {
    const d = await api<any>("/dashboard");
    return {
      totalPhones: d.inventory?.available ?? 0,
      totalCustomers: d.counts?.customers ?? 0,
      totalSellers: d.counts?.sellers ?? 0,
      totalRevenue: d.finance?.revenue ?? 0,
    };
  },

  async submitContactMessage(input: ContactMessageInput) {
    await api("/public/messages", { method: "POST", body: JSON.stringify(input) });
  },
};
