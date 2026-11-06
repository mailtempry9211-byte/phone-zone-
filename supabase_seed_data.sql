-- ============================================================================
-- PHONEZONE: SYNC ALL PHONES, SHOP SETTINGS & DEALERS TO SUPABASE
-- Run in Supabase SQL Editor: https://supabase.com/dashboard/project/rkhzhozrslrfsqlpgjav/sql
-- ============================================================================

-- 1. Add any missing columns so queries never fail
ALTER TABLE public.admin_settings ADD COLUMN IF NOT EXISTS ai_provider TEXT DEFAULT 'gemini';
ALTER TABLE public.admin_settings ADD COLUMN IF NOT EXISTS ai_model TEXT DEFAULT 'gemini-2.5-flash-lite';
ALTER TABLE public.admin_settings ADD COLUMN IF NOT EXISTS ai_api_key TEXT;
ALTER TABLE public.admin_settings ADD COLUMN IF NOT EXISTS ai_custom_url TEXT;
ALTER TABLE public.admin_settings ADD COLUMN IF NOT EXISTS ai_voice_enabled INTEGER DEFAULT 0;
ALTER TABLE public.admin_settings ADD COLUMN IF NOT EXISTS ai_auto_speak INTEGER DEFAULT 0;
ALTER TABLE public.admin_settings ADD COLUMN IF NOT EXISTS ocr_engine TEXT DEFAULT 'auto';
ALTER TABLE public.admin_settings ADD COLUMN IF NOT EXISTS udyam_number TEXT;
ALTER TABLE public.admin_settings ADD COLUMN IF NOT EXISTS google_business_url TEXT;
ALTER TABLE public.dealers ADD COLUMN IF NOT EXISTS shop_name TEXT;
ALTER TABLE public.dealers ADD COLUMN IF NOT EXISTS proprietor_name TEXT;

-- 2. Store Settings (MOBILE ZONE - Shuaib Ansari)
INSERT INTO public.admin_settings (
  id, business_name, business_tagline, owner_name, address, phone_primary, phone_secondary,
  email, instagram, whatsapp_number, udyam_number, bank_name, account_holder_name,
  account_number, ifsc_code, ai_provider, ai_model, ai_api_key, setup_completed
) VALUES (
  '00000000-0000-0000-0000-000000000001',
  'MOBILE ZONE', 'ZONE OF MOBILES', 'SHUAIB ANSARI',
  '219 , QAZIYARA 
PANI TANKI
261001', '8090748182', '7860737276',
  'mailtempry@gmail.com', 'ansari_boyz_050', '8090748182',
  'UDYAM-98555-751', 'AIRTEL PAYMENTS BANK ', 'SHAUIB ANSARI',
  '918418944572', 'AIRPB015543', 'gemini', 'gemini-2.5-flash-lite',
  'REPLACE_WITH_YOUR_GEMINI_KEY', 1
) ON CONFLICT (id) DO UPDATE SET
  business_name = EXCLUDED.business_name,
  business_tagline = EXCLUDED.business_tagline,
  owner_name = EXCLUDED.owner_name,
  address = EXCLUDED.address,
  phone_primary = EXCLUDED.phone_primary,
  phone_secondary = EXCLUDED.phone_secondary,
  email = EXCLUDED.email,
  instagram = EXCLUDED.instagram,
  whatsapp_number = EXCLUDED.whatsapp_number,
  udyam_number = EXCLUDED.udyam_number,
  bank_name = EXCLUDED.bank_name,
  account_holder_name = EXCLUDED.account_holder_name,
  account_number = EXCLUDED.account_number,
  ifsc_code = EXCLUDED.ifsc_code,
  ai_provider = EXCLUDED.ai_provider,
  ai_model = EXCLUDED.ai_model,
  ai_api_key = EXCLUDED.ai_api_key,
  setup_completed = 1;

-- 3. Dealers (B2B Partners)
INSERT INTO public.dealers (
  id, shop_name, proprietor_name, phone, alternate_phone, email, address, city, state, pincode, is_active
) VALUES (
  'c0b3c939-0b67-4044-9799-c65b81bfb64a', 'test', 'twsat', '9192859674',
  '', '', 'vdsgvdsfgvsdgdf',
  'Sitapur', 'Uttar Pradesh', '261001', 1
) ON CONFLICT (id) DO UPDATE SET
  shop_name = EXCLUDED.shop_name,
  proprietor_name = EXCLUDED.proprietor_name,
  phone = EXCLUDED.phone;
INSERT INTO public.dealers (
  id, shop_name, proprietor_name, phone, alternate_phone, email, address, city, state, pincode, is_active
) VALUES (
  '6c85d0b8-ac78-4b79-ab35-0a8e54aceeaf', 'zubair telecom', 'mohd zaid ansari', '7275451525',
  '', '', 'lucknow',
  'Sitapur', 'Uttar Pradesh', '261001', 1
) ON CONFLICT (id) DO UPDATE SET
  shop_name = EXCLUDED.shop_name,
  proprietor_name = EXCLUDED.proprietor_name,
  phone = EXCLUDED.phone;

-- 4. Dealer Batches (Wholesale Invoices)
INSERT INTO public.dealer_batches (
  id, dealer_id, invoice_number, purchase_date, total_phones, total_amount, payment_method, payment_status
) VALUES (
  'c20464a5-34bb-4a7f-a37a-83bfe84242b1', '6c85d0b8-ac78-4b79-ab35-0a8e54aceeaf', 'PUR-B2B-961786', '2026-10-30',
  2, 27000, 'upi', 'completed'
) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.dealer_batches (
  id, dealer_id, invoice_number, purchase_date, total_phones, total_amount, payment_method, payment_status
) VALUES (
  'a4115d46-ec9b-43d9-9a0f-5a1e3e3f21a9', '6c85d0b8-ac78-4b79-ab35-0a8e54aceeaf', 'PUR-B2B-639127', '2026-10-31',
  1, 12000, 'cash', 'completed'
) ON CONFLICT (id) DO NOTHING;

-- 5. Phones (6 Inventory & Sold Devices)
INSERT INTO public.phones (
  id, phone_name, model, imei_number, condition, purchase_price, selling_price,
  purchase_date, rating, bill_available, box_available, charger_available,
  features, product_photos, payment_proof_photos, payment_method,
  seller_id, customer_id, dealer_id, is_dealer, batch_purchase_id,
  is_sold, sold_date, financial_year, color, storage
) VALUES (
  'e4649e03-0898-4f31-8fb3-cc8867080d5b', 'Tecno', 'Tecno Pova Curve 5G',
  '355603861338855', 'excellent', 10000, 11000,
  '2026-10-27', 5, true,
  true, true,
  ARRAY['display changed']::TEXT[], ARRAY['/api/public/files/ed63c0ee-907c-4b8f-9329-4db07f612ee8','/api/public/files/c7412acc-c782-43f6-992a-b09b30735e22','/api/public/files/980693bb-5bcd-468a-a572-53cab3126846','/api/public/files/8b8ebe1b-fb1f-4228-ad0e-0fa5adab9c31']::TEXT[], ARRAY['/api/public/files/0724df12-d367-4049-990b-38f532660602']::TEXT[],
  'cash', 'a6e17c4a-17e6-43ea-84e6-82a0d2c47941', NULL, NULL, 0,
  NULL, false, NULL,
  '2026-27', 'White', '8GB / 128GB'
) ON CONFLICT (id) DO UPDATE SET
  phone_name = EXCLUDED.phone_name,
  model = EXCLUDED.model,
  imei_number = EXCLUDED.imei_number,
  purchase_price = EXCLUDED.purchase_price,
  selling_price = EXCLUDED.selling_price,
  is_sold = EXCLUDED.is_sold,
  sold_date = EXCLUDED.sold_date;
INSERT INTO public.phones (
  id, phone_name, model, imei_number, condition, purchase_price, selling_price,
  purchase_date, rating, bill_available, box_available, charger_available,
  features, product_photos, payment_proof_photos, payment_method,
  seller_id, customer_id, dealer_id, is_dealer, batch_purchase_id,
  is_sold, sold_date, financial_year, color, storage
) VALUES (
  '089fc91d-5729-437b-8b36-279ac6052b74', 'Vivo', 'Vivo T2 Pro 5G',
  '864718077004515', 'good', 12000, 13800,
  '2026-10-30', 5, true,
  true, true,
  ARRAY['All Original']::TEXT[], ARRAY['/api/public/files/1ed36550-e93d-4d85-bc7d-e8d85ed09236','/api/public/files/02c2371b-4482-4a26-92b3-e5265fce6759']::TEXT[], ARRAY[]::TEXT[],
  'upi', '6c85d0b8-ac78-4b79-ab35-0a8e54aceeaf', NULL, '6c85d0b8-ac78-4b79-ab35-0a8e54aceeaf', 1,
  'c20464a5-34bb-4a7f-a37a-83bfe84242b1', false, NULL,
  '2026-27', 'white', '4/128'
) ON CONFLICT (id) DO UPDATE SET
  phone_name = EXCLUDED.phone_name,
  model = EXCLUDED.model,
  imei_number = EXCLUDED.imei_number,
  purchase_price = EXCLUDED.purchase_price,
  selling_price = EXCLUDED.selling_price,
  is_sold = EXCLUDED.is_sold,
  sold_date = EXCLUDED.sold_date;
INSERT INTO public.phones (
  id, phone_name, model, imei_number, condition, purchase_price, selling_price,
  purchase_date, rating, bill_available, box_available, charger_available,
  features, product_photos, payment_proof_photos, payment_method,
  seller_id, customer_id, dealer_id, is_dealer, batch_purchase_id,
  is_sold, sold_date, financial_year, color, storage
) VALUES (
  'ce846918-5e83-4914-b678-0c02a6e1899a', 'Infinix Hot 60i 5G', 'INFINIX HOT 60I 5G',
  '354944603415150', 'good', 15000, 17250,
  '2026-10-30', 5, true,
  true, true,
  ARRAY['All Original']::TEXT[], ARRAY['/api/public/files/db090ed7-acd6-48ba-bb46-88cf5d9fc1a6','/api/public/files/5359f16c-e53d-49db-84dc-953abe0b2130']::TEXT[], ARRAY[]::TEXT[],
  'upi', '6c85d0b8-ac78-4b79-ab35-0a8e54aceeaf', NULL, '6c85d0b8-ac78-4b79-ab35-0a8e54aceeaf', 1,
  'c20464a5-34bb-4a7f-a37a-83bfe84242b1', false, NULL,
  '2026-27', '', ''
) ON CONFLICT (id) DO UPDATE SET
  phone_name = EXCLUDED.phone_name,
  model = EXCLUDED.model,
  imei_number = EXCLUDED.imei_number,
  purchase_price = EXCLUDED.purchase_price,
  selling_price = EXCLUDED.selling_price,
  is_sold = EXCLUDED.is_sold,
  sold_date = EXCLUDED.sold_date;
INSERT INTO public.phones (
  id, phone_name, model, imei_number, condition, purchase_price, selling_price,
  purchase_date, rating, bill_available, box_available, charger_available,
  features, product_photos, payment_proof_photos, payment_method,
  seller_id, customer_id, dealer_id, is_dealer, batch_purchase_id,
  is_sold, sold_date, financial_year, color, storage
) VALUES (
  '30dbfae7-ec38-4e3e-a81c-6809c66b7323', 'Apple', 'Apple Iphone XS Max',
  '357279093274909', 'excellent', 20000, 25000,
  '2026-10-30', 4, true,
  true, true,
  ARRAY['all working']::TEXT[], ARRAY['/api/public/files/6e0e9f7b-54e0-45bc-9ade-16a513eeb5cb','/api/public/files/54f5c9cc-6616-4404-888c-161a9995703d','/api/public/files/4d2d22af-9da9-4c3b-bf7e-e5653a9c91b7','/api/public/files/52e5f649-1f9d-47e9-af50-1ec68f92cec0']::TEXT[], ARRAY['/api/public/files/4295380c-8a45-4edf-b32e-0839475c1437']::TEXT[],
  'cash', 'be05b747-f7da-488c-9fea-f8a6169e466f', 'de997151-1a94-497a-a1ea-122dfa06b92a', NULL, 0,
  NULL, true, '2026-10-30T18:30:00.000Z',
  '2026-27', 'Black', '6GB / 128GB'
) ON CONFLICT (id) DO UPDATE SET
  phone_name = EXCLUDED.phone_name,
  model = EXCLUDED.model,
  imei_number = EXCLUDED.imei_number,
  purchase_price = EXCLUDED.purchase_price,
  selling_price = EXCLUDED.selling_price,
  is_sold = EXCLUDED.is_sold,
  sold_date = EXCLUDED.sold_date;
INSERT INTO public.phones (
  id, phone_name, model, imei_number, condition, purchase_price, selling_price,
  purchase_date, rating, bill_available, box_available, charger_available,
  features, product_photos, payment_proof_photos, payment_method,
  seller_id, customer_id, dealer_id, is_dealer, batch_purchase_id,
  is_sold, sold_date, financial_year, color, storage
) VALUES (
  '393cda9c-7e47-4888-8c41-9729ee09166d', 'vivo', 'v250',
  '357917276985482', 'good', 1000, 2000,
  '2026-10-30', 5, true,
  true, true,
  ARRAY[]::TEXT[], ARRAY['/api/public/files/5537bae6-c108-4759-a3b4-f12d7f98a005','/api/public/files/aff7df48-a173-4627-ab17-f03e21bad63a']::TEXT[], ARRAY['/api/public/files/4295380c-8a45-4edf-b32e-0839475c1437']::TEXT[],
  'cash', 'be05b747-f7da-488c-9fea-f8a6169e466f', 'a5b303fc-0d53-4066-9a6c-db193d3bdc16', NULL, 0,
  NULL, true, '2026-10-31T12:12:22.747Z',
  '2026-27', 'white', '8/128'
) ON CONFLICT (id) DO UPDATE SET
  phone_name = EXCLUDED.phone_name,
  model = EXCLUDED.model,
  imei_number = EXCLUDED.imei_number,
  purchase_price = EXCLUDED.purchase_price,
  selling_price = EXCLUDED.selling_price,
  is_sold = EXCLUDED.is_sold,
  sold_date = EXCLUDED.sold_date;
INSERT INTO public.phones (
  id, phone_name, model, imei_number, condition, purchase_price, selling_price,
  purchase_date, rating, bill_available, box_available, charger_available,
  features, product_photos, payment_proof_photos, payment_method,
  seller_id, customer_id, dealer_id, is_dealer, batch_purchase_id,
  is_sold, sold_date, financial_year, color, storage
) VALUES (
  '878dee71-8c8a-4c74-92e0-8f19fc0e10ae', 'Realme', 'Realme 12X 5G',
  '860580078718756', 'good', 12000, 13800,
  '2026-10-31', 5, true,
  true, true,
  ARRAY['All Original']::TEXT[], ARRAY['/api/public/files/7e40331c-ee16-4281-b3fb-eb76c2d6dae9']::TEXT[], ARRAY[]::TEXT[],
  'cash', '6c85d0b8-ac78-4b79-ab35-0a8e54aceeaf', 'de997151-1a94-497a-a1ea-122dfa06b92a', '6c85d0b8-ac78-4b79-ab35-0a8e54aceeaf', 1,
  'a4115d46-ec9b-43d9-9a0f-5a1e3e3f21a9', true, '2026-10-30T18:30:00.000Z',
  '2026-27', 'white', '6/128'
) ON CONFLICT (id) DO UPDATE SET
  phone_name = EXCLUDED.phone_name,
  model = EXCLUDED.model,
  imei_number = EXCLUDED.imei_number,
  purchase_price = EXCLUDED.purchase_price,
  selling_price = EXCLUDED.selling_price,
  is_sold = EXCLUDED.is_sold,
  sold_date = EXCLUDED.sold_date;
