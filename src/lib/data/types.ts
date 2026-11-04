/** Shape shared by both drivers. Kept loose so existing UI code keeps working. */
export interface PublicPhone {
  id: string;
  phone_name: string;
  model: string;
  variant?: string | null;
  colour?: string | null;
  condition: string;
  selling_price: number;
  rating?: number | null;
  bill_available?: boolean;
  box_available?: boolean;
  charger_available?: boolean;
  features?: string[] | null;
  product_photos?: string[] | null;
  created_at: string;
  [key: string]: unknown;
}

export interface ContactInfo {
  phone_primary: string;
  phone_secondary: string;
  email: string;
  instagram: string;
  address: string;
  business_name: string;
  business_tagline: string;
  // Extended fields
  logo_url?: string;
  udyam_number?: string;
  show_udyam?: boolean;
  google_business_url?: string;
  show_google_business?: boolean;
  google_business_verified?: boolean;
  owner_name?: string;
  bank_name?: string;
  account_holder_name?: string;
  account_number?: string;
  ifsc_code?: string;
  terms_and_conditions?: string;
  terms_and_conditions_sale?: string;
  terms_and_conditions_purchase?: string;
  whatsapp_number?: string;
  homepage_theme?: string;
  homepage_config?: {
    showHero?: boolean;
    showTrustBar?: boolean;
    showPhones?: boolean;
    showRepairs?: boolean;
    showFeatures?: boolean;
    showContact?: boolean;
    showHours?: boolean;
    phoneDisplayMode?: string;
    heroHeadline?: string;
    heroSubheadline?: string;
  };
  repair_services?: Array<{
    id?: string;
    icon: string;
    title: string;
    price: string;
    duration: string;
    description: string;
    active?: boolean;
  }>;
}

export interface AdminStats {
  totalPhones: number;
  totalCustomers: number;
  totalSellers: number;
  totalRevenue: number;
}

export interface ContactMessageInput {
  name: string;
  email: string;
  phone?: string;
  message: string;
}

export interface DataDriver {
  readonly mode: "online" | "offline";
  listPublicPhones(limit?: number): Promise<PublicPhone[]>;
  getContactInfo(): Promise<ContactInfo>;
  getAdminStats(): Promise<AdminStats>;
  submitContactMessage(input: ContactMessageInput): Promise<void>;
}

export const DEFAULT_CONTACT: ContactInfo = {
  phone_primary: "",
  phone_secondary: "",
  email: "",
  instagram: "",
  address: "",
  business_name: "",
  business_tagline: "",
};
