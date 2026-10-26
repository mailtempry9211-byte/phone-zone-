-- Implement role-based access control for sensitive customer/seller data
-- Handle existing app_role type if it exists

-- Create role enum (if it doesn't exist)
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'app_role') THEN
        CREATE TYPE public.app_role AS ENUM ('admin', 'staff', 'viewer');
    END IF;
END $$;

-- Create user roles table (if it doesn't exist)
CREATE TABLE IF NOT EXISTS public.user_roles (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    role app_role NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    UNIQUE (user_id, role)
);

-- Enable RLS on user_roles table
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Create security definer function to check user roles
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT exists (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- Create function to check if user has admin or staff role
CREATE OR REPLACE FUNCTION public.is_authorized_personnel(_user_id uuid)
RETURNS boolean  
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT exists (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role IN ('admin', 'staff')
  )
$$;

-- Drop existing policies for user_roles and recreate
DROP POLICY IF EXISTS "Users can view their own roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can manage all roles" ON public.user_roles;

-- Create policies for user_roles table
CREATE POLICY "Users can view their own roles" ON public.user_roles
  FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE POLICY "Admins can manage all roles" ON public.user_roles
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Update customer policies with role-based access
DROP POLICY IF EXISTS "Authenticated users can view customers" ON public.customers;
DROP POLICY IF EXISTS "Authenticated users can insert customers" ON public.customers;
DROP POLICY IF EXISTS "Authenticated users can update customers" ON public.customers;
DROP POLICY IF EXISTS "Authenticated users can delete customers" ON public.customers;
DROP POLICY IF EXISTS "Authorized personnel can view customers" ON public.customers;
DROP POLICY IF EXISTS "Authorized personnel can insert customers" ON public.customers;
DROP POLICY IF EXISTS "Authorized personnel can update customers" ON public.customers;
DROP POLICY IF EXISTS "Authorized personnel can delete customers" ON public.customers;

CREATE POLICY "Authorized personnel can view customers" ON public.customers
  FOR SELECT TO authenticated USING (public.is_authorized_personnel(auth.uid()));

CREATE POLICY "Authorized personnel can insert customers" ON public.customers
  FOR INSERT TO authenticated WITH CHECK (public.is_authorized_personnel(auth.uid()));

CREATE POLICY "Authorized personnel can update customers" ON public.customers
  FOR UPDATE TO authenticated USING (public.is_authorized_personnel(auth.uid()));

CREATE POLICY "Authorized personnel can delete customers" ON public.customers
  FOR DELETE TO authenticated USING (public.is_authorized_personnel(auth.uid()));

-- Update seller policies with role-based access  
DROP POLICY IF EXISTS "Authenticated users can view sellers" ON public.sellers;
DROP POLICY IF EXISTS "Authenticated users can insert sellers" ON public.sellers;
DROP POLICY IF EXISTS "Authenticated users can update sellers" ON public.sellers;
DROP POLICY IF EXISTS "Authenticated users can delete sellers" ON public.sellers;
DROP POLICY IF EXISTS "Authorized personnel can view sellers" ON public.sellers;
DROP POLICY IF EXISTS "Authorized personnel can insert sellers" ON public.sellers;
DROP POLICY IF EXISTS "Authorized personnel can update sellers" ON public.sellers;
DROP POLICY IF EXISTS "Authorized personnel can delete sellers" ON public.sellers;

CREATE POLICY "Authorized personnel can view sellers" ON public.sellers
  FOR SELECT TO authenticated USING (public.is_authorized_personnel(auth.uid()));

CREATE POLICY "Authorized personnel can insert sellers" ON public.sellers
  FOR INSERT TO authenticated WITH CHECK (public.is_authorized_personnel(auth.uid()));

CREATE POLICY "Authorized personnel can update sellers" ON public.sellers
  FOR UPDATE TO authenticated USING (public.is_authorized_personnel(auth.uid()));

CREATE POLICY "Authorized personnel can delete sellers" ON public.sellers
  FOR DELETE TO authenticated USING (public.is_authorized_personnel(auth.uid()));

-- Update phones policies with role-based access
DROP POLICY IF EXISTS "Authenticated users can view phones" ON public.phones;
DROP POLICY IF EXISTS "Authenticated users can insert phones" ON public.phones;
DROP POLICY IF EXISTS "Authenticated users can update phones" ON public.phones;
DROP POLICY IF EXISTS "Authenticated users can delete phones" ON public.phones;
DROP POLICY IF EXISTS "Authorized personnel can view phones" ON public.phones;
DROP POLICY IF EXISTS "Authorized personnel can insert phones" ON public.phones;
DROP POLICY IF EXISTS "Authorized personnel can update phones" ON public.phones;
DROP POLICY IF EXISTS "Authorized personnel can delete phones" ON public.phones;

CREATE POLICY "Authorized personnel can view phones" ON public.phones
  FOR SELECT TO authenticated USING (public.is_authorized_personnel(auth.uid()));

CREATE POLICY "Authorized personnel can insert phones" ON public.phones
  FOR INSERT TO authenticated WITH CHECK (public.is_authorized_personnel(auth.uid()));

CREATE POLICY "Authorized personnel can update phones" ON public.phones
  FOR UPDATE TO authenticated USING (public.is_authorized_personnel(auth.uid()));

CREATE POLICY "Authorized personnel can delete phones" ON public.phones
  FOR DELETE TO authenticated USING (public.is_authorized_personnel(auth.uid()));

-- Update returns policies with role-based access
DROP POLICY IF EXISTS "Authenticated users can view returns" ON public.returns;
DROP POLICY IF EXISTS "Authenticated users can insert returns" ON public.returns;
DROP POLICY IF EXISTS "Authenticated users can update returns" ON public.returns;
DROP POLICY IF EXISTS "Authenticated users can delete returns" ON public.returns;
DROP POLICY IF EXISTS "Authorized personnel can view returns" ON public.returns;
DROP POLICY IF EXISTS "Authorized personnel can insert returns" ON public.returns;
DROP POLICY IF EXISTS "Authorized personnel can update returns" ON public.returns;
DROP POLICY IF EXISTS "Authorized personnel can delete returns" ON public.returns;

CREATE POLICY "Authorized personnel can view returns" ON public.returns
  FOR SELECT TO authenticated USING (public.is_authorized_personnel(auth.uid()));

CREATE POLICY "Authorized personnel can insert returns" ON public.returns
  FOR INSERT TO authenticated WITH CHECK (public.is_authorized_personnel(auth.uid()));

CREATE POLICY "Authorized personnel can update returns" ON public.returns
  FOR UPDATE TO authenticated USING (public.is_authorized_personnel(auth.uid()));

CREATE POLICY "Authorized personnel can delete returns" ON public.returns
  FOR DELETE TO authenticated USING (public.is_authorized_personnel(auth.uid()));

-- Update admin_settings policies with role-based access
DROP POLICY IF EXISTS "Authenticated users can view admin_settings" ON public.admin_settings;
DROP POLICY IF EXISTS "Authenticated users can insert admin_settings" ON public.admin_settings;
DROP POLICY IF EXISTS "Authenticated users can update admin_settings" ON public.admin_settings;
DROP POLICY IF EXISTS "Authenticated users can delete admin_settings" ON public.admin_settings;
DROP POLICY IF EXISTS "Authorized personnel can view admin_settings" ON public.admin_settings;
DROP POLICY IF EXISTS "Admins can insert admin_settings" ON public.admin_settings;
DROP POLICY IF EXISTS "Admins can update admin_settings" ON public.admin_settings;
DROP POLICY IF EXISTS "Admins can delete admin_settings" ON public.admin_settings;

CREATE POLICY "Authorized personnel can view admin_settings" ON public.admin_settings
  FOR SELECT TO authenticated USING (public.is_authorized_personnel(auth.uid()));

CREATE POLICY "Admins can insert admin_settings" ON public.admin_settings
  FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update admin_settings" ON public.admin_settings
  FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete admin_settings" ON public.admin_settings
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Update messages policies - keep current authorized personnel access
DROP POLICY IF EXISTS "Authenticated users can view messages" ON public.messages;
DROP POLICY IF EXISTS "Authenticated users can update messages" ON public.messages;
DROP POLICY IF EXISTS "Authenticated users can delete messages" ON public.messages;
DROP POLICY IF EXISTS "Authorized personnel can view messages" ON public.messages;
DROP POLICY IF EXISTS "Authorized personnel can update messages" ON public.messages;
DROP POLICY IF EXISTS "Authorized personnel can delete messages" ON public.messages;

CREATE POLICY "Authorized personnel can view messages" ON public.messages
  FOR SELECT TO authenticated USING (public.is_authorized_personnel(auth.uid()));

CREATE POLICY "Authorized personnel can update messages" ON public.messages
  FOR UPDATE TO authenticated USING (public.is_authorized_personnel(auth.uid()));

CREATE POLICY "Authorized personnel can delete messages" ON public.messages
  FOR DELETE TO authenticated USING (public.is_authorized_personnel(auth.uid()));

-- Create trigger for updating user_roles updated_at (if not exists)
CREATE OR REPLACE FUNCTION public.update_user_roles_updated_at_column()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$;

-- Drop trigger if it exists and recreate
DROP TRIGGER IF EXISTS update_user_roles_updated_at ON public.user_roles;
CREATE TRIGGER update_user_roles_updated_at
  BEFORE UPDATE ON public.user_roles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_user_roles_updated_at_column();