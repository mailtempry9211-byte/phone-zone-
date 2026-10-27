export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "12.2.3 (519615d)"
  }
  public: {
    Tables: {
      admin_settings: {
        Row: {
          account_holder_name: string | null
          account_number: string | null
          address: string | null
          bank_name: string | null
          business_hours: string | null
          business_name: string | null
          business_tagline: string | null
          created_at: string
          currency_code: string | null
          email: string | null
          google_business_url: string | null
          id: string
          ifsc_code: string | null
          instagram: string | null
          invoice_prefix_purchase: string | null
          invoice_prefix_return: string | null
          invoice_prefix_sale: string | null
          logo_url: string | null
          owner_name: string | null
          phone_primary: string | null
          phone_secondary: string | null
          setup_completed: number | null
          signature_url: string | null
          tac_fetch_mode: string
          terms_and_conditions: string | null
          terms_and_conditions_purchase: string | null
          terms_and_conditions_sale: string | null
          updated_at: string
          udyam_number: string | null
          udyam_verified: number | null
          whatsapp_number: string | null
          google_business_verified: number | null
          show_google_business: number | null
        }
        Insert: {
          account_holder_name?: string | null
          account_number?: string | null
          address?: string | null
          bank_name?: string | null
          business_hours?: string | null
          business_name?: string | null
          business_tagline?: string | null
          created_at?: string
          currency_code?: string | null
          email?: string | null
          google_business_url?: string | null
          id?: string
          ifsc_code?: string | null
          instagram?: string | null
          invoice_prefix_purchase?: string | null
          invoice_prefix_return?: string | null
          invoice_prefix_sale?: string | null
          logo_url?: string | null
          owner_name?: string | null
          phone_primary?: string | null
          phone_secondary?: string | null
          setup_completed?: number | null
          signature_url?: string | null
          tac_fetch_mode?: string
          terms_and_conditions?: string | null
          terms_and_conditions_purchase?: string | null
          terms_and_conditions_sale?: string | null
          updated_at?: string
          udyam_number?: string | null
          udyam_verified?: number | null
          whatsapp_number?: string | null
          google_business_verified?: number | null
          show_google_business?: number | null
        }
        Update: {
          account_holder_name?: string | null
          account_number?: string | null
          address?: string | null
          bank_name?: string | null
          business_hours?: string | null
          business_name?: string | null
          business_tagline?: string | null
          created_at?: string
          currency_code?: string | null
          email?: string | null
          google_business_url?: string | null
          id?: string
          ifsc_code?: string | null
          instagram?: string | null
          invoice_prefix_purchase?: string | null
          invoice_prefix_return?: string | null
          invoice_prefix_sale?: string | null
          logo_url?: string | null
          owner_name?: string | null
          phone_primary?: string | null
          phone_secondary?: string | null
          setup_completed?: number | null
          signature_url?: string | null
          tac_fetch_mode?: string
          terms_and_conditions?: string | null
          terms_and_conditions_purchase?: string | null
          terms_and_conditions_sale?: string | null
          updated_at?: string
          udyam_number?: string | null
          udyam_verified?: number | null
          whatsapp_number?: string | null
          google_business_verified?: number | null
          show_google_business?: number | null
        }
        Relationships: []
      }
      customers: {
        Row: {
          aadhaar_photo_url: string | null
          address: string
          created_at: string
          customer_photo_url: string | null
          id: string
          id_number: string
          id_proof_type: Database["public"]["Enums"]["id_proof_type"]
          name: string
          phone: string
          updated_at: string
        }
        Insert: {
          aadhaar_photo_url?: string | null
          address: string
          created_at?: string
          customer_photo_url?: string | null
          id?: string
          id_number: string
          id_proof_type: Database["public"]["Enums"]["id_proof_type"]
          name: string
          phone: string
          updated_at?: string
        }
        Update: {
          aadhaar_photo_url?: string | null
          address?: string
          created_at?: string
          customer_photo_url?: string | null
          id?: string
          id_number?: string
          id_proof_type?: Database["public"]["Enums"]["id_proof_type"]
          name?: string
          phone?: string
          updated_at?: string
        }
        Relationships: []
      }
      messages: {
        Row: {
          created_at: string
          email: string
          id: string
          is_read: boolean | null
          message: string
          name: string
          phone: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          is_read?: boolean | null
          message: string
          name: string
          phone?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          is_read?: boolean | null
          message?: string
          name?: string
          phone?: string | null
        }
        Relationships: []
      }
      phones: {
        Row: {
          bill_available: boolean | null
          box_available: boolean | null
          charger_available: boolean | null
          colour: string | null
          condition: Database["public"]["Enums"]["phone_condition"]
          created_at: string
          customer_id: string | null
          features: string[] | null
          id: string
          imei_number: string
          is_sold: boolean | null
          model: string
          payment_method: Database["public"]["Enums"]["payment_method"]
          payment_proof_photos: string[] | null
          phone_name: string
          product_photos: string[] | null
          purchase_date: string
          purchase_documents: string[] | null
          purchase_price: number
          rating: number | null
          return_amount: number | null
          return_date: string | null
          return_processed_date: string | null
          return_reason: string | null
          return_status: string | null
          return_type: string | null
          seller_id: string
          selling_price: number
          shop_id: string | null
          sold_date: string | null
          updated_at: string
          variant: string | null
          is_dealer?: boolean | number | null
          dealer_id?: string | null
          dealers?: any | null
          batch_purchase_id?: string | null
          seller_photo_url?: string | null
          seller_signature_url?: string | null
          sapath_patra_language?: string | null
        }
        Insert: {
          bill_available?: boolean | null
          box_available?: boolean | null
          charger_available?: boolean | null
          colour?: string | null
          condition: Database["public"]["Enums"]["phone_condition"]
          created_at?: string
          customer_id?: string | null
          features?: string[] | null
          id?: string
          imei_number: string
          is_sold?: boolean | null
          model: string
          payment_method: Database["public"]["Enums"]["payment_method"]
          payment_proof_photos?: string[] | null
          phone_name: string
          product_photos?: string[] | null
          purchase_date: string
          purchase_documents?: string[] | null
          purchase_price: number
          rating?: number | null
          return_amount?: number | null
          return_date?: string | null
          return_processed_date?: string | null
          return_reason?: string | null
          return_status?: string | null
          return_type?: string | null
          seller_id?: string | null
          selling_price: number
          shop_id?: string | null
          sold_date?: string | null
          updated_at?: string
          variant?: string | null
          is_dealer?: boolean | number | null
          dealer_id?: string | null
          dealers?: any | null
          batch_purchase_id?: string | null
          seller_photo_url?: string | null
          seller_signature_url?: string | null
          sapath_patra_language?: string | null
        }
        Update: {
          bill_available?: boolean | null
          box_available?: boolean | null
          charger_available?: boolean | null
          colour?: string | null
          condition?: Database["public"]["Enums"]["phone_condition"]
          created_at?: string
          customer_id?: string | null
          features?: string[] | null
          id?: string
          imei_number?: string
          is_sold?: boolean | null
          model?: string
          payment_method?: Database["public"]["Enums"]["payment_method"]
          payment_proof_photos?: string[] | null
          phone_name?: string
          product_photos?: string[] | null
          purchase_date?: string
          purchase_documents?: string[] | null
          purchase_price?: number
          rating?: number | null
          return_amount?: number | null
          return_date?: string | null
          return_processed_date?: string | null
          return_reason?: string | null
          return_status?: string | null
          return_type?: string | null
          seller_id?: string | null
          selling_price?: number
          shop_id?: string | null
          sold_date?: string | null
          updated_at?: string
          variant?: string | null
          is_dealer?: boolean | number | null
          dealer_id?: string | null
          dealers?: any | null
          batch_purchase_id?: string | null
          seller_photo_url?: string | null
          seller_signature_url?: string | null
          sapath_patra_language?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "phones_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "phones_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "sellers"
            referencedColumns: ["id"]
          },
        ]
      }
      returns: {
        Row: {
          created_at: string
          customer_id: string | null
          id: string
          notes: string | null
          original_transaction_date: string | null
          phone_id: string
          processed_by: string | null
          return_amount: number
          return_date: string
          return_reason: string
          return_type: string
          seller_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          customer_id?: string | null
          id?: string
          notes?: string | null
          original_transaction_date?: string | null
          phone_id: string
          processed_by?: string | null
          return_amount: number
          return_date?: string
          return_reason: string
          return_type: string
          seller_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          customer_id?: string | null
          id?: string
          notes?: string | null
          original_transaction_date?: string | null
          phone_id?: string
          processed_by?: string | null
          return_amount?: number
          return_date?: string
          return_reason?: string
          return_type?: string
          seller_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "returns_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "returns_phone_id_fkey"
            columns: ["phone_id"]
            isOneToOne: false
            referencedRelation: "phones"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "returns_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "sellers"
            referencedColumns: ["id"]
          },
        ]
      }
      sellers: {
        Row: {
          aadhaar_photo_url: string | null
          address: string
          created_at: string
          id: string
          id_number: string
          id_proof_type: Database["public"]["Enums"]["id_proof_type"]
          name: string
          phone: string
          seller_photo_url: string | null
          updated_at: string
        }
        Insert: {
          aadhaar_photo_url?: string | null
          address: string
          created_at?: string
          id?: string
          id_number: string
          id_proof_type: Database["public"]["Enums"]["id_proof_type"]
          name: string
          phone: string
          seller_photo_url?: string | null
          updated_at?: string
        }
        Update: {
          aadhaar_photo_url?: string | null
          address?: string
          created_at?: string
          id?: string
          id_number?: string
          id_proof_type?: Database["public"]["Enums"]["id_proof_type"]
          name?: string
          phone?: string
          seller_photo_url?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      shops: {
        Row: {
          address: string | null
          created_at: string
          email: string | null
          id: string
          logo_url: string | null
          name: string
          phone: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          created_at?: string
          email?: string | null
          id?: string
          logo_url?: string | null
          name: string
          phone?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          created_at?: string
          email?: string | null
          id?: string
          logo_url?: string | null
          name?: string
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_authorized_personnel: { Args: { _user_id: string }; Returns: boolean }
      process_phone_return: {
        Args: {
          p_customer_id?: string
          p_notes?: string
          p_phone_id: string
          p_return_amount: number
          p_return_reason: string
          p_return_type: string
          p_seller_id?: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "staff" | "viewer"
      id_proof_type: "aadhaar" | "pan" | "driving_license" | "voter_id"
      payment_method: "cash" | "upi" | "bank_transfer" | "card"
      phone_condition: "excellent" | "good" | "fair" | "poor"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "staff", "viewer"],
      id_proof_type: ["aadhaar", "pan", "driving_license", "voter_id"],
      payment_method: ["cash", "upi", "bank_transfer", "card"],
      phone_condition: ["excellent", "good", "fair", "poor"],
    },
  },
} as const
