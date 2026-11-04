/** Online driver - unchanged Supabase behaviour used by the live site and preview. */
import { supabase } from "@/integrations/supabase/client";
import {
  DEFAULT_CONTACT,
  type AdminStats,
  type ContactInfo,
  type ContactMessageInput,
  type DataDriver,
  type PublicPhone,
} from "./types";

export const supabaseDriver: DataDriver = {
  mode: "online",

  async listPublicPhones(limit = 12) {
    const { data, error } = await supabase
      .from("phones")
      .select(`*, sellers (name, phone, address)`)
      .eq("is_sold", false)
      .order("created_at", { ascending: false })
      .limit(limit);
    if (error) throw error;
    return (data || []) as unknown as PublicPhone[];
  },

  async getContactInfo(): Promise<ContactInfo> {
    const { data, error } = await supabase.from("admin_settings").select("*").single();
    if (error) throw error;
    return {
      phone_primary: data?.phone_primary || DEFAULT_CONTACT.phone_primary,
      phone_secondary: data?.phone_secondary || DEFAULT_CONTACT.phone_secondary,
      email: data?.email || DEFAULT_CONTACT.email,
      instagram: data?.instagram || DEFAULT_CONTACT.instagram,
      address: data?.address || DEFAULT_CONTACT.address,
      business_name: data?.business_name || DEFAULT_CONTACT.business_name,
      business_tagline: data?.business_tagline || DEFAULT_CONTACT.business_tagline,
      logo_url: data?.logo_url || "",
      udyam_number: data?.udyam_number || "",
      show_udyam: !!(data as any)?.show_udyam,
      google_business_url: data?.google_business_url || "",
      show_google_business: !!data?.show_google_business,
      google_business_verified: !!data?.google_business_verified,
      whatsapp_number: data?.whatsapp_number || "",
      homepage_theme: (data as any)?.homepage_theme || "modern",
      homepage_config: (() => {
        try { return (data as any)?.homepage_config ? JSON.parse((data as any).homepage_config) : null; } catch { return null; }
      })(),
      repair_services: (() => {
        try { return (data as any)?.repair_services_catalog ? JSON.parse((data as any).repair_services_catalog) : []; } catch { return []; }
      })(),
    };
  },

  async getAdminStats(): Promise<AdminStats> {
    const [phonesResult, customersResult, sellersResult, soldResult] = await Promise.all([
      supabase.from("phones").select("*", { count: "exact" }).eq("is_sold", false),
      supabase.from("customers").select("*", { count: "exact" }),
      supabase.from("sellers").select("*", { count: "exact" }),
      supabase.from("phones").select("selling_price").eq("is_sold", true),
    ]);
    const totalRevenue =
      soldResult.data?.reduce((sum, phone: { selling_price: number }) => sum + Number(phone.selling_price), 0) || 0;
    return {
      totalPhones: phonesResult.count || 0,
      totalCustomers: customersResult.count || 0,
      totalSellers: sellersResult.count || 0,
      totalRevenue,
    };
  },

  async submitContactMessage(input: ContactMessageInput) {
    const { error } = await supabase.from("messages").insert({
      name: input.name,
      email: input.email,
      phone: input.phone || null,
      message: input.message,
    });
    if (error) throw error;
  },
};
