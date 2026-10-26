-- Migration 005 - Variant (RAM/Storage) and Colour for phones
-- Existing rows stay NULL; the UI shows "-" for them.

ALTER TABLE phones ADD COLUMN variant TEXT;
ALTER TABLE phones ADD COLUMN colour  TEXT;
