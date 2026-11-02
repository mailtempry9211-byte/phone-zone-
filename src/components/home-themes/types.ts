import { ContactInfo } from "@/lib/data/types";
import { HomepageConfig, RepairItem } from "@/components/admin/StorefrontCustomizerTab";

export type ThemeDesignId =
  | "neon"
  | "apple_minimal"
  | "glassmorphism"
  | "luxury"
  | "phonezone_signature"
  | "bento_pro"
  | "compact_retail"
  | "brutalist"
  | "fluid_carousel"
  | "split_slider";

export interface ThemeProps {
  contact: ContactInfo | null;
  phones: any[];
  repairs: RepairItem[];
  config: HomepageConfig;
  onOpenAdmin: (dept?: "sales" | "repairs") => void;
  onNavigateTrack: () => void;
  onSelectPhone?: (phone: any) => void;
  whatsappNumber: string;
  phonePrimary: string;
}

