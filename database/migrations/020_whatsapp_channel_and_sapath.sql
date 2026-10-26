-- 020_whatsapp_channel_and_sapath.sql
-- Adds central WhatsApp dispatch channel selector and seller photo/signature fields

ALTER TABLE admin_settings ADD COLUMN whatsapp_channel TEXT DEFAULT 'click_to_chat';
ALTER TABLE phones ADD COLUMN seller_photo_url TEXT;
ALTER TABLE phones ADD COLUMN seller_signature_url TEXT;
ALTER TABLE phones ADD COLUMN sapath_patra_language TEXT DEFAULT 'both';

