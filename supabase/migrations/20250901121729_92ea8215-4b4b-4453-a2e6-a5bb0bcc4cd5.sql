-- Fix critical security vulnerability: Restrict access to all sensitive tables
-- Currently all tables allow public access which exposes personal information

-- Drop existing insecure policies
DROP POLICY IF EXISTS "Allow all operations on sellers" ON public.sellers;
DROP POLICY IF EXISTS "Allow all operations on customers" ON public.customers;  
DROP POLICY IF EXISTS "Allow all operations on phones" ON public.phones;
DROP POLICY IF EXISTS "Allow all operations on returns" ON public.returns;
DROP POLICY IF EXISTS "Allow all operations on messages" ON public.messages;
DROP POLICY IF EXISTS "Allow all operations on admin_settings" ON public.admin_settings;

-- Create secure policies that require authentication
-- Sellers table - contains sensitive personal information
CREATE POLICY "Authenticated users can view sellers" ON public.sellers
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert sellers" ON public.sellers  
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update sellers" ON public.sellers
  FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Authenticated users can delete sellers" ON public.sellers
  FOR DELETE TO authenticated USING (true);

-- Customers table - contains sensitive personal information  
CREATE POLICY "Authenticated users can view customers" ON public.customers
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert customers" ON public.customers
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update customers" ON public.customers  
  FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Authenticated users can delete customers" ON public.customers
  FOR DELETE TO authenticated USING (true);

-- Phones table - contains business data
CREATE POLICY "Authenticated users can view phones" ON public.phones
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert phones" ON public.phones
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update phones" ON public.phones
  FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Authenticated users can delete phones" ON public.phones  
  FOR DELETE TO authenticated USING (true);

-- Returns table - contains financial data
CREATE POLICY "Authenticated users can view returns" ON public.returns
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert returns" ON public.returns
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update returns" ON public.returns
  FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Authenticated users can delete returns" ON public.returns
  FOR DELETE TO authenticated USING (true);

-- Messages table - contact form submissions can remain public for website functionality
CREATE POLICY "Anyone can insert messages" ON public.messages
  FOR INSERT TO anon, authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can view messages" ON public.messages  
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can update messages" ON public.messages
  FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Authenticated users can delete messages" ON public.messages
  FOR DELETE TO authenticated USING (true);

-- Admin settings - business configuration data
CREATE POLICY "Authenticated users can view admin_settings" ON public.admin_settings
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert admin_settings" ON public.admin_settings
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update admin_settings" ON public.admin_settings
  FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Authenticated users can delete admin_settings" ON public.admin_settings
  FOR DELETE TO authenticated USING (true);