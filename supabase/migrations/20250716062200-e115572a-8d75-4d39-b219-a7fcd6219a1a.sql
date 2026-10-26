
-- Create enum types
CREATE TYPE phone_condition AS ENUM ('excellent', 'good', 'fair', 'poor');
CREATE TYPE id_proof_type AS ENUM ('aadhaar', 'pan', 'driving_license', 'voter_id');
CREATE TYPE payment_method AS ENUM ('cash', 'upi', 'bank_transfer', 'card');

-- Create sellers table
CREATE TABLE public.sellers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  address TEXT NOT NULL,
  id_proof_type id_proof_type NOT NULL,
  id_number TEXT NOT NULL,
  seller_photo_url TEXT,
  aadhaar_photo_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create customers table
CREATE TABLE public.customers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  address TEXT NOT NULL,
  id_proof_type id_proof_type NOT NULL,
  id_number TEXT NOT NULL,
  customer_photo_url TEXT,
  aadhaar_photo_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create phones table
CREATE TABLE public.phones (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  phone_name TEXT NOT NULL,
  model TEXT NOT NULL,
  imei_number TEXT NOT NULL UNIQUE,
  condition phone_condition NOT NULL,
  purchase_price DECIMAL(10,2) NOT NULL,
  selling_price DECIMAL(10,2) NOT NULL,
  purchase_date DATE NOT NULL,
  rating DECIMAL(2,1) CHECK (rating >= 0 AND rating <= 5),
  bill_available BOOLEAN DEFAULT false,
  box_available BOOLEAN DEFAULT false,
  charger_available BOOLEAN DEFAULT false,
  features TEXT[],
  product_photos TEXT[],
  payment_proof_photos TEXT[],
  payment_method payment_method NOT NULL,
  seller_id UUID REFERENCES public.sellers(id) NOT NULL,
  customer_id UUID REFERENCES public.customers(id),
  is_sold BOOLEAN DEFAULT false,
  sold_date TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create messages table
CREATE TABLE public.messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  message TEXT NOT NULL,
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create admin_settings table
CREATE TABLE public.admin_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  signature_url TEXT,
  business_name TEXT DEFAULT '',
  business_tagline TEXT DEFAULT '',
  address TEXT DEFAULT ''
  phone_primary TEXT DEFAULT '',
  phone_secondary TEXT DEFAULT '',
  email TEXT DEFAULT '',
  instagram TEXT DEFAULT '',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Insert default admin settings
INSERT INTO public.admin_settings (id) VALUES (gen_random_uuid());

-- Enable Row Level Security
ALTER TABLE public.sellers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.phones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_settings ENABLE ROW LEVEL SECURITY;

-- Create RLS policies (allowing public access for now, will be restricted later with admin auth)
CREATE POLICY "Allow all operations on sellers" ON public.sellers FOR ALL USING (true);
CREATE POLICY "Allow all operations on customers" ON public.customers FOR ALL USING (true);
CREATE POLICY "Allow all operations on phones" ON public.phones FOR ALL USING (true);
CREATE POLICY "Allow all operations on messages" ON public.messages FOR ALL USING (true);
CREATE POLICY "Allow all operations on admin_settings" ON public.admin_settings FOR ALL USING (true);

-- Create storage bucket for uploads
INSERT INTO storage.buckets (id, name, public) VALUES ('phonezone-uploads', 'phonezone-uploads', true);

-- Create storage policies
CREATE POLICY "Allow public uploads" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'phonezone-uploads');
CREATE POLICY "Allow public downloads" ON storage.objects FOR SELECT USING (bucket_id = 'phonezone-uploads');
CREATE POLICY "Allow public updates" ON storage.objects FOR UPDATE USING (bucket_id = 'phonezone-uploads');
CREATE POLICY "Allow public deletes" ON storage.objects FOR DELETE USING (bucket_id = 'phonezone-uploads');
