-- Update RLS policy for phones table to allow public viewing of unsold phones
-- Drop the existing restrictive SELECT policy
DROP POLICY IF EXISTS "Authorized personnel can view phones" ON public.phones;

-- Create a new policy that allows everyone to view unsold phones
CREATE POLICY "Anyone can view unsold phones" 
ON public.phones 
FOR SELECT 
USING (is_sold = false);

-- Also allow authorized personnel to view all phones (including sold ones)
CREATE POLICY "Authorized personnel can view all phones" 
ON public.phones 
FOR SELECT 
USING (is_authorized_personnel(auth.uid()));