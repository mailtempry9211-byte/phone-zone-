-- Create the process_phone_return function
CREATE OR REPLACE FUNCTION public.process_phone_return(
  p_phone_id UUID,
  p_return_type TEXT,
  p_return_amount NUMERIC,
  p_return_reason TEXT,
  p_notes TEXT DEFAULT '',
  p_customer_id UUID DEFAULT NULL,
  p_seller_id UUID DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
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
$$;