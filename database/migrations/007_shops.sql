-- Migration 007 - Multiple shops (one business, several counters)
--
-- Design notes
--   * `shops` is a plain lookup table: every phone is stamped with the shop it
--     belongs to, so the Inventory / add-phone / sale screens can be filtered
--     per shop without duplicating any accounting data.
--   * The first shop is seeded as 'shop_1' and existing phones are backfilled to
--     it, so a database that already has inventory keeps showing that inventory
--     instead of emptying out the moment the shop filter is used.
--   * Nothing is ever moved or deleted - switching the shop filter only narrows
--     what is listed.

CREATE TABLE IF NOT EXISTS shops (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  address TEXT,
  phone TEXT,
  email TEXT,
  logo_url TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Every phone belongs to exactly one shop.
ALTER TABLE phones ADD COLUMN shop_id TEXT;
CREATE INDEX IF NOT EXISTS idx_phones_shop_id ON phones(shop_id);

INSERT OR IGNORE INTO shops (id, name, address, phone, email) VALUES (
  'shop_1',
  'MOBILE WORLD',
  'sitapur',
  '8418944572',
  'mohdzubair4572@naviaxis'
);

-- Pre-existing rows (and any row created before the shop picker existed) belong
-- to the first shop, which is exactly how the backend treats a NULL shop_id.
UPDATE phones SET shop_id = 'shop_1' WHERE shop_id IS NULL;
-- No down migration: dropping the column would orphan phones from their shop.
