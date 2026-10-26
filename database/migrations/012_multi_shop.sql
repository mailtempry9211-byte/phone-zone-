-- Migration 012: Multi-shop scoping for users, shops, invoices, and returns

ALTER TABLE users ADD COLUMN shop_id TEXT;
ALTER TABLE shops ADD COLUMN shop_code TEXT;
ALTER TABLE invoices ADD COLUMN shop_id TEXT;
ALTER TABLE returns ADD COLUMN shop_id TEXT;

-- Default existing users and shops
UPDATE shops SET shop_code = 'MAIN' WHERE id = 'shop_1' AND shop_code IS NULL;
UPDATE users SET shop_id = 'shop_1' WHERE shop_id IS NULL;
UPDATE invoices SET shop_id = 'shop_1' WHERE shop_id IS NULL;
UPDATE returns SET shop_id = 'shop_1' WHERE shop_id IS NULL;
UPDATE phones SET shop_id = 'shop_1' WHERE shop_id IS NULL;

