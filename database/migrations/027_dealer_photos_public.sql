-- 027_dealer_photos_public.sql
-- Mark all dealer photos and dealer signatures as public so they render in admin and B2B invoices

UPDATE files SET is_public = 1 WHERE category LIKE '%dealer%' OR relative_path LIKE '%dealer%';
