-- 026_batch_sales_and_public_sale_docs.sql
-- 1. Support grouped multi-phone sales (batch sales)
ALTER TABLE phones ADD COLUMN batch_sale_id TEXT;
CREATE INDEX IF NOT EXISTS idx_phones_batch_sale_id ON phones(batch_sale_id);

-- 2. Ensure all uploaded sale documents are public so they can be embedded on invoices and previews
UPDATE files SET is_public = 1 WHERE is_public = 0 AND (category LIKE '%sale-document%' OR relative_path LIKE '%sale-document%');
