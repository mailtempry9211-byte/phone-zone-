-- Remove the public access policy that exposes sensitive business data
DROP POLICY IF EXISTS "Anyone can view unsold phones" ON public.phones;

-- Create a secure view for public phone listings that only exposes customer-safe information
CREATE OR REPLACE VIEW public.public_phone_listings AS
SELECT 
    id,
    phone_name,
    model,
    condition,
    selling_price,
    features,
    product_photos,
    created_at,
    is_sold
FROM public.phones 
WHERE is_sold = false;

-- Enable RLS on the view (inherits from base table but we want to be explicit)
-- Views inherit RLS from their base tables, but we create a policy for clarity
CREATE POLICY "Anyone can view public phone listings" 
ON public.public_phone_listings 
FOR SELECT 
USING (is_sold = false);

-- Note: Since this is a view, we don't need to enable RLS directly on it
-- The RLS will be enforced through the underlying phones table