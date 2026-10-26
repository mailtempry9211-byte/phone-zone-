-- Migration 010 - backfill the public flag for product photos.
--
-- Why: uploads that arrive through the PostgREST-compatible storage bucket store
-- the whole object path in `files.category` ("product-photos/1729-abc.jpg"), so
-- the old `is_public` check (which compared the whole string) never matched and
-- every row - including customer-facing product photos - was stored as private.
--
-- The storage service now derives the flag from the TOP-LEVEL folder. This
-- migration brings already-stored product photos and business assets in line, so
-- the customer homepage (and the invoice logo) keep loading for visitors who are
-- not signed in. Documents stay private: purchase documents, payment proofs and
-- Aadhaar copies are deliberately NOT touched here.

UPDATE files
   SET is_public = 1
 WHERE owner_type = 'bucket'
   AND is_public = 0
   AND (
     lower(category) LIKE 'product-photos/%'
     OR lower(category) LIKE 'images/%'
     OR lower(category) = 'logo'
     OR lower(category) = 'signature'
   );

-- No down migration: re-hiding these rows would break the public catalogue.
