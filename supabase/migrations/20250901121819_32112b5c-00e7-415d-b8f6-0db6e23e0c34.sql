-- Fix function search path security warnings
-- All functions should have a stable search_path to prevent injection attacks

-- Fix the update_returns_updated_at_column function
CREATE OR REPLACE FUNCTION public.update_returns_updated_at_column()
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

-- Fix the process_phone_return function  
CREATE OR REPLACE FUNCTION public.process_phone_return(p_phone_id uuid, p_return_type text, p_return_amount numeric, p_return_reason text, p_notes text DEFAULT ''::text, p_customer_id uuid DEFAULT NULL::uuid, p_seller_id uuid DEFAULT NULL::uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  -- Insert into returns table
  INSERT INTO public.returns (
    phone_id,
    return_type,
    return_amount,
    return_reason,
    notes,
    customer_id,
    seller_id,
    processed_by,
    original_transaction_date
  )
  SELECT 
    p_phone_id,
    p_return_type,
    p_return_amount,
    p_return_reason,
    p_notes,
    p_customer_id,
    p_seller_id,
    'Admin',
    CASE 
      WHEN p_return_type = 'sales_return' THEN phones.sold_date
      ELSE phones.purchase_date::timestamp with time zone
    END
  FROM phones 
  WHERE phones.id = p_phone_id;

  -- Update phone record based on return type
  IF p_return_type = 'sales_return' THEN
    -- Sales return: phone goes back to inventory
    UPDATE public.phones 
    SET 
      is_sold = FALSE,
      sold_date = NULL,
      customer_id = NULL,
      return_status = 'sales_returned',
      return_reason = p_return_reason,
      return_amount = p_return_amount,
      return_processed_date = NOW(),
      return_type = p_return_type,
      updated_at = NOW()
    WHERE id = p_phone_id;
  ELSE
    -- Purchase return: phone is removed from inventory
    UPDATE public.phones 
    SET 
      return_status = 'purchase_returned',
      return_reason = p_return_reason,
      return_amount = p_return_amount,
      return_processed_date = NOW(),
      return_type = p_return_type,
      updated_at = NOW()
    WHERE id = p_phone_id;
  END IF;

  RETURN TRUE;
EXCEPTION
  WHEN OTHERS THEN
    RETURN FALSE;
END;
$function$;