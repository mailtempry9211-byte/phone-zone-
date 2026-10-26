
-- Add purchase_documents column to phones table to store documents uploaded during phone addition
ALTER TABLE public.phones 
ADD COLUMN purchase_documents text[] DEFAULT NULL;

-- Add comment for clarity
COMMENT ON COLUMN public.phones.purchase_documents IS 'Documents uploaded during phone purchase/addition process';
