import Database from '../backend/node_modules/better-sqlite3/lib/index.js';
import fs from 'fs';

const db = new Database('database/phonezone.db');

function esc(val) {
  if (val === null || val === undefined) return 'NULL';
  if (typeof val === 'number') return val;
  if (typeof val === 'boolean') return val ? 'true' : 'false';
  return "'" + String(val).replace(/'/g, "''") + "'";
}

function escArray(val) {
  if (!val) return "ARRAY[]::TEXT[]";
  try {
    const arr = typeof val === 'string' ? JSON.parse(val) : val;
    if (Array.isArray(arr) && arr.length > 0) {
      const items = arr.map(x => "'" + String(x).replace(/'/g, "''") + "'").join(',');
      return "ARRAY[" + items + "]::TEXT[]";
    }
  } catch {}
  return "ARRAY[]::TEXT[]";
}

let sql = '';
sql += `-- ============================================================================\n`;
sql += `-- PHONEZONE: SYNC ALL PHONES, SHOP SETTINGS & DEALERS TO SUPABASE\n`;
sql += `-- Run in Supabase SQL Editor: https://supabase.com/dashboard/project/rkhzhozrslrfsqlpgjav/sql\n`;
sql += `-- ============================================================================\n\n`;

sql += `-- 1. Add any missing columns so queries never fail\n`;
sql += `ALTER TABLE public.admin_settings ADD COLUMN IF NOT EXISTS ai_provider TEXT DEFAULT 'gemini';\n`;
sql += `ALTER TABLE public.admin_settings ADD COLUMN IF NOT EXISTS ai_model TEXT DEFAULT 'gemini-2.5-flash-lite';\n`;
sql += `ALTER TABLE public.admin_settings ADD COLUMN IF NOT EXISTS ai_api_key TEXT;\n`;
sql += `ALTER TABLE public.admin_settings ADD COLUMN IF NOT EXISTS ai_custom_url TEXT;\n`;
sql += `ALTER TABLE public.admin_settings ADD COLUMN IF NOT EXISTS ai_voice_enabled INTEGER DEFAULT 0;\n`;
sql += `ALTER TABLE public.admin_settings ADD COLUMN IF NOT EXISTS ai_auto_speak INTEGER DEFAULT 0;\n`;
sql += `ALTER TABLE public.admin_settings ADD COLUMN IF NOT EXISTS ocr_engine TEXT DEFAULT 'auto';\n`;
sql += `ALTER TABLE public.admin_settings ADD COLUMN IF NOT EXISTS udyam_number TEXT;\n`;
sql += `ALTER TABLE public.admin_settings ADD COLUMN IF NOT EXISTS google_business_url TEXT;\n`;
sql += `ALTER TABLE public.dealers ADD COLUMN IF NOT EXISTS shop_name TEXT;\n`;
sql += `ALTER TABLE public.dealers ADD COLUMN IF NOT EXISTS proprietor_name TEXT;\n\n`;

const s = db.prepare('SELECT * FROM admin_settings LIMIT 1').get();
sql += `-- 2. Store Settings (MOBILE ZONE - Shuaib Ansari)\n`;
sql += `INSERT INTO public.admin_settings (
  id, business_name, business_tagline, owner_name, address, phone_primary, phone_secondary,
  email, instagram, whatsapp_number, udyam_number, bank_name, account_holder_name,
  account_number, ifsc_code, ai_provider, ai_model, ai_api_key, setup_completed
) VALUES (
  '00000000-0000-0000-0000-000000000001',
  ${esc(s.business_name)}, ${esc(s.business_tagline)}, ${esc(s.owner_name)},
  ${esc(s.address)}, ${esc(s.phone_primary)}, ${esc(s.phone_secondary)},
  ${esc(s.email)}, ${esc(s.instagram)}, ${esc(s.whatsapp_number)},
  ${esc(s.udyam_number)}, ${esc(s.bank_name)}, ${esc(s.account_holder_name)},
  ${esc(s.account_number)}, ${esc(s.ifsc_code)}, 'gemini', 'gemini-2.5-flash-lite',
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
  setup_completed = 1;\n\n`;

sql += `-- 3. Dealers (B2B Partners)\n`;
const dealers = db.prepare('SELECT * FROM dealers').all();
dealers.forEach(d => {
  sql += `INSERT INTO public.dealers (
  id, shop_name, proprietor_name, phone, alternate_phone, email, address, city, state, pincode, is_active
) VALUES (
  ${esc(d.id)}, ${esc(d.shop_name)}, ${esc(d.proprietor_name)}, ${esc(d.phone)},
  ${esc(d.alternate_phone || '')}, ${esc(d.email || '')}, ${esc(d.address || '')},
  ${esc(d.city || 'Sitapur')}, ${esc(d.state || 'Uttar Pradesh')}, ${esc(d.pincode || '261001')}, 1
) ON CONFLICT (id) DO UPDATE SET
  shop_name = EXCLUDED.shop_name,
  proprietor_name = EXCLUDED.proprietor_name,
  phone = EXCLUDED.phone;\n`;
});

sql += `\n-- 4. Dealer Batches (Wholesale Invoices)\n`;
const batches = db.prepare('SELECT * FROM dealer_batches').all();
batches.forEach(b => {
  sql += `INSERT INTO public.dealer_batches (
  id, dealer_id, invoice_number, purchase_date, total_phones, total_amount, payment_method, payment_status
) VALUES (
  ${esc(b.id)}, ${esc(b.dealer_id)}, ${esc(b.invoice_number)}, ${esc(b.purchase_date)},
  ${b.total_phones || 1}, ${b.total_amount || 0}, ${esc(b.payment_method || 'cash')}, ${esc(b.payment_status || 'completed')}
) ON CONFLICT (id) DO NOTHING;\n`;
});

sql += `\n-- 5. Phones (6 Inventory & Sold Devices)\n`;
const phones = db.prepare('SELECT * FROM phones').all();
phones.forEach(p => {
  const cond = ['excellent','good','fair','poor'].includes((p.condition||'').toLowerCase()) ? p.condition.toLowerCase() : 'good';
  const pay = ['cash','upi','bank_transfer','card'].includes((p.payment_method||'').toLowerCase()) ? p.payment_method.toLowerCase() : 'cash';
  // Verify batch_purchase_id is a valid UUID
  const isValidUuid = (id) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
  const batchId = isValidUuid(p.batch_purchase_id) ? esc(p.batch_purchase_id) : 'NULL';

  sql += `INSERT INTO public.phones (
  id, phone_name, model, imei_number, condition, purchase_price, selling_price,
  purchase_date, rating, bill_available, box_available, charger_available,
  features, product_photos, payment_proof_photos, payment_method,
  seller_id, customer_id, dealer_id, is_dealer, batch_purchase_id,
  is_sold, sold_date, financial_year, color, storage
) VALUES (
  ${esc(p.id)}, ${esc(p.phone_name || p.brand || 'Smartphone')}, ${esc(p.model || 'Unknown')},
  ${esc(p.imei_number)}, '${cond}', ${p.purchase_price || 0}, ${p.selling_price || 0},
  ${esc(p.purchase_date || '2026-10-30')}, ${p.rating || 5.0}, ${p.bill_available ? 'true' : 'false'},
  ${p.box_available ? 'true' : 'false'}, ${p.charger_available ? 'true' : 'false'},
  ${escArray(p.features)}, ${escArray(p.product_photos)}, ${escArray(p.payment_proof_photos)},
  '${pay}', ${esc(p.seller_id)}, ${esc(p.customer_id)}, ${esc(p.dealer_id)}, ${p.is_dealer ? 1 : 0},
  ${batchId}, ${p.is_sold ? 'true' : 'false'}, ${esc(p.sold_date)},
  ${esc(p.financial_year || '2026-27')}, ${esc(p.colour || p.color || '')}, ${esc(p.variant || p.storage || '')}
) ON CONFLICT (id) DO UPDATE SET
  phone_name = EXCLUDED.phone_name,
  model = EXCLUDED.model,
  imei_number = EXCLUDED.imei_number,
  purchase_price = EXCLUDED.purchase_price,
  selling_price = EXCLUDED.selling_price,
  is_sold = EXCLUDED.is_sold,
  sold_date = EXCLUDED.sold_date;\n`;
});

fs.writeFileSync('supabase_seed_data.sql', sql, 'utf8');
console.log('Successfully generated supabase_seed_data.sql');
