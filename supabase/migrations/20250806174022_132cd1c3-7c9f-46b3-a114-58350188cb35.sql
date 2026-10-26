-- Add return tracking tables and update existing schema

-- Create returns table to track all return transactions
CREATE TABLE IF NOT EXISTS public.returns (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  phone_id UUID NOT NULL REFERENCES phones(id),
  return_type TEXT NOT NULL CHECK (return_type IN ('sales_return', 'purchase_return')),
  return_amount NUMERIC NOT NULL,
  return_reason TEXT NOT NULL,
  return_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  processed_by TEXT,
  customer_id UUID REFERENCES customers(id),
  seller_id UUID REFERENCES sellers(id),
  original_transaction_date TIMESTAMP WITH TIME ZONE,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on returns table
ALTER TABLE public.returns ENABLE ROW LEVEL SECURITY;

-- Create policy for returns table
CREATE POLICY "Allow all operations on returns" 
ON public.returns 
FOR ALL 
USING (true);

-- Add additional return tracking fields to phones table if not exists
DO $$ 
BEGIN
  -- Add return_amount column if it doesn't exist
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'phones' AND column_name = 'return_amount') THEN
    ALTER TABLE public.phones ADD COLUMN return_amount NUMERIC;
  END IF;
  
  -- Add return_processed_date column if it doesn't exist
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'phones' AND column_name = 'return_processed_date') THEN
    ALTER TABLE public.phones ADD COLUMN return_processed_date TIMESTAMP WITH TIME ZONE;
  END IF;
  
  -- Add return_type column if it doesn't exist
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'phones' AND column_name = 'return_type') THEN
    ALTER TABLE public.phones ADD COLUMN return_type TEXT;
  END IF;
END $$;

-- Create trigger function for updating timestamps
CREATE OR REPLACE FUNCTION public.update_returns_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for returns table
DROP TRIGGER IF EXISTS update_returns_updated_at ON public.returns;
CREATE TRIGGER update_returns_updated_at
  BEFORE UPDATE ON public.returns
  FOR EACH ROW
  EXECUTE FUNCTION public.update_returns_updated_at_column();

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_returns_phone_id ON public.returns(phone_id);
CREATE INDEX IF NOT EXISTS idx_returns_return_type ON public.returns(return_type);
CREATE INDEX IF NOT EXISTS idx_returns_return_date ON public.returns(return_date);
CREATE INDEX IF NOT EXISTS idx_phones_return_status ON public.phones(return_status);