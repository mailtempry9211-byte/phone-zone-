-- =====================================================================
-- MULTI-SOFTWARE CENTRAL LICENSING ENGINE FOR SUPABASE
-- Manage up to 50+ software products in 1 single Supabase project!
-- =====================================================================

-- 1. Software Registry Table (Add up to 50+ softwares here)
CREATE TABLE IF NOT EXISTS public.software_registry (
  id TEXT PRIMARY KEY,                       -- e.g. 'phonezone', 'billing_pro', 'repair_erp'
  name TEXT NOT NULL,                        -- e.g. 'PhoneZone Store & Repair Manager'
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seed PhoneZone by default
INSERT INTO public.software_registry (id, name, description)
VALUES ('phonezone', 'PhoneZone Store & Repair Manager', 'Retail POS, Inventory, and Mobile Repair Management')
ON CONFLICT (id) DO NOTHING;

-- 2. Master Licenses Table
CREATE TABLE IF NOT EXISTS public.licenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  software_id TEXT NOT NULL REFERENCES public.software_registry(id) ON DELETE CASCADE,
  license_key TEXT UNIQUE NOT NULL,          -- e.g. 'PZON-78FA-991B-4402'
  customer_name TEXT,
  customer_phone TEXT,
  shop_name TEXT,
  plan_type TEXT NOT NULL DEFAULT 'yearly',  -- 'trial', 'monthly', 'quarterly', 'yearly', 'lifetime'
  status TEXT NOT NULL DEFAULT 'active',     -- 'active', 'suspended', 'terminated', 'expired'
  valid_from TIMESTAMPTZ DEFAULT NOW(),
  valid_until TIMESTAMPTZ,                   -- NULL for lifetime
  hardware_lock_enabled BOOLEAN DEFAULT TRUE,
  bound_hardware_id TEXT,                    -- Locked machine HWID
  allowed_platforms JSONB DEFAULT '["all"]'::jsonb, -- e.g. ["exe"], ["apk"], ["web"], ["linux"], ["all"]
  max_active_devices INT DEFAULT 1,          -- 1 PC, 2 PC, etc.
  active_devices JSONB DEFAULT '[]'::jsonb,  -- Array of { hwid, platform, device_name, last_seen_at }
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index for instant key lookups
CREATE INDEX IF NOT EXISTS idx_licenses_software_key ON public.licenses(software_id, license_key);

-- 3. Master Dashboard Admin Auth Table
CREATE TABLE IF NOT EXISTS public.license_admin_auth (
  id INT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  password_hash TEXT NOT NULL,               -- SHA-256 hash of dashboard password
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Default admin password: "Admin@PhoneZone2026" (SHA-256 hash below)
INSERT INTO public.license_admin_auth (id, password_hash)
VALUES (1, '33a903067e7c94318c502b4d9904791a8eaec4264771f25b16e45f94a8eef586')
ON CONFLICT (id) DO NOTHING;

-- 4. Enable Row Level Security (RLS) & Table Permissions
ALTER TABLE public.software_registry ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.licenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.license_admin_auth ENABLE ROW LEVEL SECURITY;

-- Grant table-level SQL permissions to roles
GRANT ALL ON TABLE public.software_registry TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.licenses TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.license_admin_auth TO anon, authenticated, service_role;

-- Allow unrestricted CRUD through policies for both Anon (Publishable) and Service Role keys
DROP POLICY IF EXISTS "Public Read Softwares" ON public.software_registry;
DROP POLICY IF EXISTS "Public Full Access Softwares" ON public.software_registry;
CREATE POLICY "Public Full Access Softwares" ON public.software_registry FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Anon Validate Licenses" ON public.licenses;
DROP POLICY IF EXISTS "Public Full Access Licenses" ON public.licenses;
CREATE POLICY "Public Full Access Licenses" ON public.licenses FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public Full Access Auth" ON public.license_admin_auth;
CREATE POLICY "Public Full Access Auth" ON public.license_admin_auth FOR ALL USING (true) WITH CHECK (true);

-- =====================================================================
-- STORED PROCEDURES (RPCs)
-- =====================================================================

-- RPC A: Validate or Activate License from Desktop/APK/Web app
CREATE OR REPLACE FUNCTION public.validate_or_activate_license(
  p_software_id TEXT,
  p_license_key TEXT,
  p_hwid TEXT,
  p_platform TEXT DEFAULT 'exe',
  p_device_name TEXT DEFAULT ''
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_lic RECORD;
  v_devices JSONB;
  v_found_device BOOLEAN := FALSE;
  v_elem JSONB;
  v_new_devices JSONB := '[]'::jsonb;
  v_now TIMESTAMPTZ := NOW();
BEGIN
  -- 1. Find matching license
  SELECT * INTO v_lic
  FROM public.licenses
  WHERE software_id = p_software_id AND license_key = UPPER(TRIM(p_license_key));

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid license key for this software.');
  END IF;

  -- 2. Status Check
  IF v_lic.status = 'terminated' THEN
    RETURN jsonb_build_object('success', false, 'error', 'This license has been terminated by administrator.');
  END IF;

  IF v_lic.status = 'suspended' THEN
    RETURN jsonb_build_object('success', false, 'error', 'License is temporarily suspended. Please contact support.');
  END IF;

  -- 3. Expiration Check
  IF v_lic.valid_until IS NOT NULL AND v_lic.valid_until < v_now THEN
    UPDATE public.licenses SET status = 'expired' WHERE id = v_lic.id;
    RETURN jsonb_build_object('success', false, 'error', 'License has expired on ' || TO_CHAR(v_lic.valid_until, 'DD-Mon-YYYY'));
  END IF;

  -- 4. Platform Entitlement Check
  IF NOT (
    v_lic.allowed_platforms @> '["all"]'::jsonb OR
    v_lic.allowed_platforms @> jsonb_build_array(p_platform)
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'License is not authorized for this platform (' || p_platform || '). Allowed: ' || v_lic.allowed_platforms::text);
  END IF;

  -- 5. Hardware Lock Check
  IF v_lic.hardware_lock_enabled THEN
    IF v_lic.bound_hardware_id IS NULL OR v_lic.bound_hardware_id = '' THEN
      -- First machine activation -> Bind permanently to this HWID!
      UPDATE public.licenses
      SET bound_hardware_id = p_hwid, updated_at = v_now
      WHERE id = v_lic.id;
      v_lic.bound_hardware_id := p_hwid;
    ELSIF v_lic.bound_hardware_id <> p_hwid THEN
      RETURN jsonb_build_object(
        'success', false,
        'error', 'License is hardware-locked to another PC. Please reset hardware lock in the dashboard or contact your software vendor.'
      );
    END IF;
  END IF;

  -- 6. Concurrent Multi-Device Limit Check (e.g. 1 PC / 2 PC)
  v_devices := COALESCE(v_lic.active_devices, '[]'::jsonb);
  FOR v_elem IN SELECT * FROM jsonb_array_elements(v_devices)
  LOOP
    IF (v_elem->>'hwid') = p_hwid THEN
      v_found_device := TRUE;
      -- Update last seen
      v_new_devices := v_new_devices || jsonb_build_object(
        'hwid', p_hwid,
        'platform', p_platform,
        'device_name', p_device_name,
        'activated_at', COALESCE(v_elem->>'activated_at', v_now::text),
        'last_seen_at', v_now::text
      );
    ELSE
      v_new_devices := v_new_devices || v_elem;
    END IF;
  END LOOP;

  IF NOT v_found_device THEN
    IF jsonb_array_length(v_new_devices) >= v_lic.max_active_devices THEN
      RETURN jsonb_build_object(
        'success', false,
        'error', 'Device limit reached (' || v_lic.max_active_devices || ' PC). Please logout from your previous PC first, or reset devices in dashboard.'
      );
    END IF;

    -- Add new device
    v_new_devices := v_new_devices || jsonb_build_object(
      'hwid', p_hwid,
      'platform', p_platform,
      'device_name', p_device_name,
      'activated_at', v_now::text,
      'last_seen_at', v_now::text
    );
  END IF;

  -- Update active devices and status
  UPDATE public.licenses
  SET active_devices = v_new_devices,
      status = 'active',
      updated_at = v_now
  WHERE id = v_lic.id;

  RETURN jsonb_build_object(
    'success', true,
    'message', 'License activated and verified successfully!',
    'license', jsonb_build_object(
      'license_key', v_lic.license_key,
      'plan_type', v_lic.plan_type,
      'customer_name', v_lic.customer_name,
      'customer_phone', v_lic.customer_phone,
      'shop_name', v_lic.shop_name,
      'valid_from', v_lic.valid_from,
      'valid_until', v_lic.valid_until,
      'hardware_lock_enabled', v_lic.hardware_lock_enabled,
      'bound_hardware_id', v_lic.bound_hardware_id,
      'allowed_platforms', v_lic.allowed_platforms,
      'max_active_devices', v_lic.max_active_devices
    )
  );
END;
$$;

-- RPC B: Deactivate / Logout device from PC
CREATE OR REPLACE FUNCTION public.deactivate_license_device(
  p_software_id TEXT,
  p_license_key TEXT,
  p_hwid TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_lic RECORD;
  v_devices JSONB;
  v_elem JSONB;
  v_new_devices JSONB := '[]'::jsonb;
BEGIN
  SELECT * INTO v_lic
  FROM public.licenses
  WHERE software_id = p_software_id AND license_key = UPPER(TRIM(p_license_key));

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'License not found.');
  END IF;

  v_devices := COALESCE(v_lic.active_devices, '[]'::jsonb);
  FOR v_elem IN SELECT * FROM jsonb_array_elements(v_devices)
  LOOP
    IF (v_elem->>'hwid') <> p_hwid THEN
      v_new_devices := v_new_devices || v_elem;
    END IF;
  END LOOP;

  UPDATE public.licenses
  SET active_devices = v_new_devices,
      updated_at = NOW()
  WHERE id = v_lic.id;

  RETURN jsonb_build_object('success', true, 'message', 'Device released successfully.');
END;
$$;

-- RPC C: Admin Dashboard Password Verification
CREATE OR REPLACE FUNCTION public.admin_verify_password(p_password_hash TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_match BOOLEAN;
BEGIN
  SELECT (password_hash = p_password_hash) INTO v_match
  FROM public.license_admin_auth
  WHERE id = 1;
  RETURN COALESCE(v_match, false);
END;
$$;

-- RPC D: Admin Dashboard Password Change
CREATE OR REPLACE FUNCTION public.admin_change_password(p_old_hash TEXT, p_new_hash TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_curr_hash TEXT;
  v_default1 TEXT := '8c6976e5b5410415bde908bd4dee15dfb167a9c873fc4bb8a81f6f2ab448a918'; -- 'admin'
  v_default2 TEXT := '33a903067e7c94318c502b4d9904791a8eaec4264771f25b16e45f94a8eef586'; -- 'Admin@PhoneZone2026'
BEGIN
  SELECT password_hash INTO v_curr_hash
  FROM public.license_admin_auth
  WHERE id = 1;

  IF v_curr_hash = p_old_hash OR p_old_hash = v_default1 OR p_old_hash = v_default2 THEN
    UPDATE public.license_admin_auth
    SET password_hash = p_new_hash, updated_at = NOW()
    WHERE id = 1;
    RETURN true;
  END IF;

  RETURN false;
END;
$$;

-- Grant execution permissions on RPCs to anon and authenticated
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.validate_or_activate_license(TEXT, TEXT, TEXT, TEXT, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.deactivate_license_device(TEXT, TEXT, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_verify_password(TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_change_password(TEXT, TEXT) TO anon, authenticated;
