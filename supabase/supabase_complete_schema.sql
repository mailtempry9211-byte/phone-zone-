-- ============================================================================
-- PHONEZONE ERP & STORE MANAGER - COMPLETE SUPABASE CONSOLIDATED SCHEMA
-- ============================================================================
-- Run this script once in the Supabase SQL Editor (Dashboard -> SQL Editor -> New Query -> Run)
-- to create all tables, enums, storage buckets, and security policies.
-- ============================================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ----------------------------------------------------------------------------
-- 1. ENUMS
-- ----------------------------------------------------------------------------
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'phone_condition') THEN
        CREATE TYPE public.phone_condition AS ENUM ('excellent', 'good', 'fair', 'poor');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'id_proof_type') THEN
        CREATE TYPE public.id_proof_type AS ENUM ('aadhaar', 'pan', 'driving_license', 'voter_id');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'payment_method') THEN
        CREATE TYPE public.payment_method AS ENUM ('cash', 'upi', 'bank_transfer', 'card', 'UPI', 'Cash', 'Card', 'Bank Transfer');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'app_role') THEN
        CREATE TYPE public.app_role AS ENUM ('admin', 'staff', 'viewer');
    END IF;
END $$;

-- ----------------------------------------------------------------------------
-- 2. TABLES
-- ----------------------------------------------------------------------------

-- A. SELLERS
CREATE TABLE IF NOT EXISTS public.sellers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    phone TEXT NOT NULL,
    address TEXT NOT NULL,
    id_proof_type id_proof_type NOT NULL DEFAULT 'aadhaar',
    id_number TEXT NOT NULL,
    seller_photo_url TEXT,
    aadhaar_photo_url TEXT,
    bank_account_number TEXT,
    bank_ifsc TEXT,
    bank_name TEXT,
    account_holder_name TEXT,
    is_verified INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- B. CUSTOMERS
CREATE TABLE IF NOT EXISTS public.customers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    phone TEXT NOT NULL,
    address TEXT NOT NULL,
    id_proof_type id_proof_type NOT NULL DEFAULT 'aadhaar',
    id_number TEXT NOT NULL,
    customer_photo_url TEXT,
    aadhaar_photo_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- C. DEALERS (B2B Suppliers)
CREATE TABLE IF NOT EXISTS public.dealers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shop_name TEXT NOT NULL,
    proprietor_name TEXT NOT NULL,
    phone TEXT NOT NULL,
    alternate_phone TEXT,
    email TEXT,
    address TEXT,
    city TEXT DEFAULT 'Sitapur',
    state TEXT DEFAULT 'Uttar Pradesh',
    pincode TEXT DEFAULT '261001',
    gst_number TEXT,
    pan_number TEXT,
    photo_url TEXT,
    signature_url TEXT,
    notes TEXT,
    is_active INTEGER DEFAULT 1,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- D. DEALER BATCHES (Wholesale Purchases)
CREATE TABLE IF NOT EXISTS public.dealer_batches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    dealer_id UUID NOT NULL REFERENCES public.dealers(id) ON DELETE CASCADE,
    invoice_number TEXT NOT NULL,
    purchase_date DATE NOT NULL DEFAULT CURRENT_DATE,
    total_phones INTEGER NOT NULL DEFAULT 1,
    total_amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
    payment_method TEXT DEFAULT 'UPI',
    payment_status TEXT DEFAULT 'completed',
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- E. PHONES (Inventory & Sales)
CREATE TABLE IF NOT EXISTS public.phones (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    phone_name TEXT NOT NULL,
    model TEXT NOT NULL,
    imei_number TEXT NOT NULL UNIQUE,
    condition phone_condition NOT NULL DEFAULT 'good',
    purchase_price NUMERIC(10, 2) NOT NULL DEFAULT 0,
    selling_price NUMERIC(10, 2) NOT NULL DEFAULT 0,
    purchase_date DATE NOT NULL DEFAULT CURRENT_DATE,
    rating NUMERIC(2, 1) CHECK (rating >= 0 AND rating <= 5) DEFAULT 5.0,
    bill_available BOOLEAN DEFAULT false,
    box_available BOOLEAN DEFAULT false,
    charger_available BOOLEAN DEFAULT false,
    features TEXT[] DEFAULT ARRAY[]::TEXT[],
    product_photos TEXT[] DEFAULT ARRAY[]::TEXT[],
    payment_proof_photos TEXT[] DEFAULT ARRAY[]::TEXT[],
    payment_method payment_method NOT NULL DEFAULT 'cash',
    seller_id UUID REFERENCES public.sellers(id) ON DELETE SET NULL,
    customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
    dealer_id UUID REFERENCES public.dealers(id) ON DELETE SET NULL,
    is_dealer INTEGER DEFAULT 0,
    batch_purchase_id UUID REFERENCES public.dealer_batches(id) ON DELETE SET NULL,
    is_sold BOOLEAN DEFAULT false,
    sold_date TIMESTAMPTZ,
    financial_year TEXT,
    color TEXT,
    storage TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- F. REPAIR CUSTOMERS
CREATE TABLE IF NOT EXISTS public.repair_customers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    phone TEXT NOT NULL UNIQUE,
    address TEXT,
    id_proof_type TEXT DEFAULT 'aadhaar',
    id_number TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- G. REPAIR JOBS (Workshop Tickets)
CREATE TABLE IF NOT EXISTS public.repair_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_no TEXT NOT NULL UNIQUE,
    customer_name TEXT NOT NULL,
    customer_phone TEXT NOT NULL,
    customer_address TEXT,
    device_brand TEXT,
    device_model TEXT,
    imei TEXT,
    problem TEXT NOT NULL,
    estimate NUMERIC(10, 2) DEFAULT 0,
    advance_paid NUMERIC(10, 2) DEFAULT 0,
    parts_cost NUMERIC(10, 2) DEFAULT 0,
    labour_cost NUMERIC(10, 2) DEFAULT 0,
    final_price NUMERIC(10, 2) DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'received' CHECK (status IN ('received','diagnosing','waiting_parts','in_progress','ready','delivered','cancelled')),
    payment_status TEXT DEFAULT 'unpaid' CHECK (payment_status IN ('unpaid','partial','paid')),
    warranty_days INTEGER DEFAULT 7,
    received_at TIMESTAMPTZ DEFAULT now(),
    delivered_at TIMESTAMPTZ,
    notes TEXT,
    technician_notes TEXT,
    financial_year TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- H. REPAIR JOB ITEMS (Parts & Labour Breakdown)
CREATE TABLE IF NOT EXISTS public.repair_job_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_id UUID NOT NULL REFERENCES public.repair_jobs(id) ON DELETE CASCADE,
    kind TEXT NOT NULL CHECK (kind IN ('part', 'labour')),
    description TEXT NOT NULL,
    qty NUMERIC(6, 2) DEFAULT 1,
    unit_price NUMERIC(10, 2) NOT NULL DEFAULT 0,
    total_price NUMERIC(10, 2) NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- I. RETURNS
CREATE TABLE IF NOT EXISTS public.returns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    phone_id UUID NOT NULL REFERENCES public.phones(id) ON DELETE CASCADE,
    return_date TIMESTAMPTZ NOT NULL DEFAULT now(),
    reason TEXT NOT NULL,
    refund_amount NUMERIC(10, 2) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- J. MESSAGES (Contact Form & Alerts)
CREATE TABLE IF NOT EXISTS public.messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    phone TEXT,
    message TEXT NOT NULL,
    is_read BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- K. ADMIN SETTINGS
CREATE TABLE IF NOT EXISTS public.admin_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_name TEXT DEFAULT 'PhoneZone',
    business_tagline TEXT DEFAULT 'Store & Repair Solutions',
    address TEXT DEFAULT 'Main Market, Sitapur, Uttar Pradesh 261001',
    phone_primary TEXT DEFAULT '+91 9999999999',
    phone_secondary TEXT DEFAULT '',
    email TEXT DEFAULT 'info@phonezone.in',
    instagram TEXT DEFAULT '@phonezone',
    whatsapp_number TEXT DEFAULT '919999999999',
    currency_code TEXT DEFAULT 'INR',
    owner_name TEXT DEFAULT 'Mohd Zubair',
    signature_url TEXT,
    logo_url TEXT,
    terms_and_conditions TEXT DEFAULT 'All devices carry specified testing warranty.',
    terms_and_conditions_purchase TEXT,
    terms_and_conditions_sale TEXT,
    bank_name TEXT,
    account_number TEXT,
    ifsc_code TEXT,
    account_holder_name TEXT,
    setup_completed INTEGER DEFAULT 1,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- L. AUDIT LOGS
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT,
    action TEXT NOT NULL,
    entity TEXT,
    entity_id TEXT,
    details JSONB,
    ip_address TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- M. USER ROLES
CREATE TABLE IF NOT EXISTS public.user_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    role app_role NOT NULL DEFAULT 'staff',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE (user_id, role)
);

-- ----------------------------------------------------------------------------
-- 3. SEED DEFAULT ADMIN SETTINGS
-- ----------------------------------------------------------------------------
INSERT INTO public.admin_settings (id, business_name, business_tagline, setup_completed)
SELECT gen_random_uuid(), 'PhoneZone', 'Second Hand Mobile & Repair Hub', 1
WHERE NOT EXISTS (SELECT 1 FROM public.admin_settings);

-- ----------------------------------------------------------------------------
-- 4. ENABLE ROW LEVEL SECURITY (RLS)
-- ----------------------------------------------------------------------------
ALTER TABLE public.sellers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dealers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dealer_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.phones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.repair_customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.repair_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.repair_job_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.returns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Allow all operations for authenticated app clients (with anon access for frontend store)
DO $$ 
BEGIN
    DROP POLICY IF EXISTS "Public access to sellers" ON public.sellers;
    CREATE POLICY "Public access to sellers" ON public.sellers FOR ALL USING (true) WITH CHECK (true);

    DROP POLICY IF EXISTS "Public access to customers" ON public.customers;
    CREATE POLICY "Public access to customers" ON public.customers FOR ALL USING (true) WITH CHECK (true);

    DROP POLICY IF EXISTS "Public access to dealers" ON public.dealers;
    CREATE POLICY "Public access to dealers" ON public.dealers FOR ALL USING (true) WITH CHECK (true);

    DROP POLICY IF EXISTS "Public access to dealer_batches" ON public.dealer_batches;
    CREATE POLICY "Public access to dealer_batches" ON public.dealer_batches FOR ALL USING (true) WITH CHECK (true);

    DROP POLICY IF EXISTS "Public access to phones" ON public.phones;
    CREATE POLICY "Public access to phones" ON public.phones FOR ALL USING (true) WITH CHECK (true);

    DROP POLICY IF EXISTS "Public access to repair_jobs" ON public.repair_jobs;
    CREATE POLICY "Public access to repair_jobs" ON public.repair_jobs FOR ALL USING (true) WITH CHECK (true);

    DROP POLICY IF EXISTS "Public access to repair_job_items" ON public.repair_job_items;
    CREATE POLICY "Public access to repair_job_items" ON public.repair_job_items FOR ALL USING (true) WITH CHECK (true);

    DROP POLICY IF EXISTS "Public access to returns" ON public.returns;
    CREATE POLICY "Public access to returns" ON public.returns FOR ALL USING (true) WITH CHECK (true);

    DROP POLICY IF EXISTS "Public access to messages" ON public.messages;
    CREATE POLICY "Public access to messages" ON public.messages FOR ALL USING (true) WITH CHECK (true);

    DROP POLICY IF EXISTS "Public access to admin_settings" ON public.admin_settings;
    CREATE POLICY "Public access to admin_settings" ON public.admin_settings FOR ALL USING (true) WITH CHECK (true);

    DROP POLICY IF EXISTS "Public access to audit_logs" ON public.audit_logs;
    CREATE POLICY "Public access to audit_logs" ON public.audit_logs FOR ALL USING (true) WITH CHECK (true);
END $$;

-- ----------------------------------------------------------------------------
-- 6. LIVE QUOTA MONITOR RPC (Database 500 MB, Storage 1 GB, Table Counts)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_supabase_quota_metrics()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    db_size_bytes bigint := 0;
    storage_size_bytes bigint := 0;
    storage_files_count bigint := 0;
    phones_count bigint := 0;
    repairs_count bigint := 0;
    audit_count bigint := 0;
BEGIN
    -- Real Database size in bytes
    SELECT pg_database_size(current_database()) INTO db_size_bytes;

    -- Real Storage size from storage.objects in bytes
    SELECT 
        COALESCE(SUM((metadata->>'size')::bigint), 0),
        COUNT(*)
    INTO storage_size_bytes, storage_files_count
    FROM storage.objects;

    -- Row counts
    SELECT COUNT(*) INTO phones_count FROM public.phones;
    SELECT COUNT(*) INTO repairs_count FROM public.repair_jobs;
    SELECT COUNT(*) INTO audit_count FROM public.audit_logs;

    RETURN jsonb_build_object(
        'database', jsonb_build_object(
            'usedBytes', db_size_bytes,
            'limitBytes', 524288000, -- 500 MB
            'usedMb', round((db_size_bytes::numeric / (1024 * 1024)), 2),
            'limitMb', 500,
            'percentage', round(((db_size_bytes::numeric / 524288000) * 100), 1)
        ),
        'storage', jsonb_build_object(
            'usedBytes', storage_size_bytes,
            'limitBytes', 1048576000, -- 1 GB
            'usedMb', round((storage_size_bytes::numeric / (1024 * 1024)), 2),
            'limitMb', 1000,
            'fileCount', storage_files_count,
            'percentage', round(((storage_size_bytes::numeric / 1048576000) * 100), 1)
        ),
        'bandwidth', jsonb_build_object(
            'limitMb', 2000,
            'status', 'healthy'
        ),
        'tableCounts', jsonb_build_object(
            'phones', phones_count,
            'repairJobs', repairs_count,
            'auditLogs', audit_count
        )
    );
END;
$$;

INSERT INTO storage.buckets (id, name, public)
VALUES 
    ('phonezone-uploads', 'phonezone-uploads', true),
    ('dealer-photos', 'dealer-photos', true),
    ('signatures', 'signatures', true),
    ('sale-documents', 'sale-documents', true),
    ('purchase-documents', 'purchase-documents', true)
ON CONFLICT (id) DO NOTHING;

-- Storage RLS policies
DROP POLICY IF EXISTS "Allow public uploads in phonezone storage" ON storage.objects;
CREATE POLICY "Allow public uploads in phonezone storage" ON storage.objects
    FOR INSERT WITH CHECK (bucket_id IN ('phonezone-uploads', 'dealer-photos', 'signatures', 'sale-documents', 'purchase-documents'));

DROP POLICY IF EXISTS "Allow public reads in phonezone storage" ON storage.objects;
CREATE POLICY "Allow public reads in phonezone storage" ON storage.objects
    FOR SELECT USING (bucket_id IN ('phonezone-uploads', 'dealer-photos', 'signatures', 'sale-documents', 'purchase-documents'));

DROP POLICY IF EXISTS "Allow public updates in phonezone storage" ON storage.objects;
CREATE POLICY "Allow public updates in phonezone storage" ON storage.objects
    FOR UPDATE USING (bucket_id IN ('phonezone-uploads', 'dealer-photos', 'signatures', 'sale-documents', 'purchase-documents'));

DROP POLICY IF EXISTS "Allow public deletes in phonezone storage" ON storage.objects;
CREATE POLICY "Allow public deletes in phonezone storage" ON storage.objects
    FOR DELETE USING (bucket_id IN ('phonezone-uploads', 'dealer-photos', 'signatures', 'sale-documents', 'purchase-documents'));
