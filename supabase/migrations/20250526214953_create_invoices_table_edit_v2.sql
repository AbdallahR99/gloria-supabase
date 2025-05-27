-- Add new columns
ALTER TABLE "public"."invoices"
  ADD COLUMN "order_code" text NULL;

-- Create indexes for new columns
CREATE INDEX idx_invoices_order_code ON "public"."invoices"("order_code") WHERE "order_code" IS NOT NULL;

-- Drop existing functions before recreating with new return types
DROP FUNCTION IF EXISTS "public"."get_invoice_by_id"(uuid);
DROP FUNCTION IF EXISTS "public"."get_invoice_by_code"(text);

-- Update create_bill_from_order function to include order_code and construct address
CREATE OR REPLACE FUNCTION "public"."create_bill_from_order"(order_code_param "text")
RETURNS "uuid"
LANGUAGE "plpgsql"
AS $$
DECLARE
    order_record RECORD;
    address_record RECORD;
    order_items_data RECORD;
    calculated_subtotal numeric(10,2) := 0;
    calculated_discount numeric(10,2) := 0;
    calculated_delivery_fees numeric(10,2) := 0;
    calculated_total numeric(10,2) := 0;
    new_invoice_id uuid;
    generated_invoice_code text;
    sku_array text[];
    constructed_address text := '';
    user_full_name text := '';
    user_phone_value text := '';
BEGIN
    -- Get order details
    SELECT * INTO order_record
    FROM orders 
    WHERE order_code = order_code_param 
    AND is_deleted = false;
    
    IF order_record IS NULL THEN
        RAISE EXCEPTION 'Order with code % not found or is deleted', order_code_param;
    END IF;
    
    -- Check if invoice already exists for this order
    IF EXISTS (
        SELECT 1 FROM invoices 
        WHERE order_code = order_code_param
        AND is_deleted = false
    ) THEN
        RAISE EXCEPTION 'Invoice already exists for order code %', order_code_param;
    END IF;
    
    -- Get address details if address_id exists
    IF order_record.address_id IS NOT NULL THEN
        SELECT 
            a.*,
            s.code as state_code
        INTO address_record
        FROM addresses a
        LEFT JOIN states s ON s.id = a.state
        WHERE a.id = order_record.address_id
        AND a.is_deleted = false;
        
        -- Construct user full name from address
        IF address_record.first_name IS NOT NULL OR address_record.last_name IS NOT NULL THEN
            user_full_name := TRIM(COALESCE(address_record.first_name, '') || ' ' || COALESCE(address_record.last_name, ''));
        END IF;
        
        -- Get phone from address
        user_phone_value := address_record.phone;
        
        -- Construct address string
        constructed_address := '';
        
        IF address_record.building IS NOT NULL AND address_record.building != '' THEN
            constructed_address := constructed_address || address_record.building;
        END IF;
        
        IF address_record.apartment IS NOT NULL AND address_record.apartment != '' THEN
            IF constructed_address != '' THEN
                constructed_address := constructed_address || ', ';
            END IF;
            constructed_address := constructed_address || 'Apt ' || address_record.apartment;
        END IF;
        
        IF address_record.street IS NOT NULL AND address_record.street != '' THEN
            IF constructed_address != '' THEN
                constructed_address := constructed_address || ', ';
            END IF;
            constructed_address := constructed_address || address_record.street;
        END IF;
        
        IF address_record.area IS NOT NULL AND address_record.area != '' THEN
            IF constructed_address != '' THEN
                constructed_address := constructed_address || ', ';
            END IF;
            constructed_address := constructed_address || address_record.area;
        END IF;
        
        IF address_record.city IS NOT NULL AND address_record.city != '' THEN
            IF constructed_address != '' THEN
                constructed_address := constructed_address || ', ';
            END IF;
            constructed_address := constructed_address || address_record.city;
        END IF;
        
        IF address_record.state_code IS NOT NULL AND address_record.state_code != '' THEN
            IF constructed_address != '' THEN
                constructed_address := constructed_address || ', ';
            END IF;
            constructed_address := constructed_address || address_record.state_code;
        END IF;
        
        -- Add notes if available
        IF address_record.notes IS NOT NULL AND address_record.notes != '' THEN
            IF constructed_address != '' THEN
                constructed_address := constructed_address || ' (' || address_record.notes || ')';
            ELSE
                constructed_address := address_record.notes;
            END IF;
        END IF;
    END IF;
    
    -- Initialize SKU array
    sku_array := ARRAY[]::text[];
    
    -- Collect product SKUs and calculate totals from order items
    FOR order_items_data IN 
        SELECT oi.*, p.sku, p.price
        FROM order_items oi
        LEFT JOIN products p ON p.id = oi.product_id
        WHERE oi.order_id = order_record.id
        AND oi.is_deleted = false
    LOOP
        -- Add SKU to array
        IF order_items_data.sku IS NOT NULL THEN
            sku_array := array_append(sku_array, order_items_data.sku);
        END IF;
        
        -- Calculate subtotal (quantity * price)
        calculated_subtotal := calculated_subtotal + (COALESCE(order_items_data.quantity, 1) * COALESCE(order_items_data.price, 0));
    END LOOP;
    
    -- Get discount and delivery fees from order
    calculated_discount := COALESCE(order_record.discount_amount, 0);
    calculated_delivery_fees := COALESCE(order_record.delivery_fee, 0);
    
    -- Calculate total
    calculated_total := calculated_subtotal - calculated_discount + calculated_delivery_fees;
    
    -- Generate invoice code
    generated_invoice_code := generate_invoice_code(NULL);
    
    -- Insert new invoice
    INSERT INTO invoices (
        invoice_code,
        order_code,
        subtotal,
        discount,
        delivery_fees,
        total_price,
        product_skus,
        user_email,
        user_phone,
        user_name,
        user_address,
        created_by
    ) VALUES (
        generated_invoice_code,
        order_code_param,
        calculated_subtotal,
        calculated_discount,
        calculated_delivery_fees,
        calculated_total,
        sku_array,
        order_record.user_email,
        COALESCE(user_phone_value, order_record.user_phone),
        COALESCE(user_full_name, order_record.user_name),
        NULLIF(TRIM(constructed_address), ''),
        'system'
    ) RETURNING id INTO new_invoice_id;
    
    RETURN new_invoice_id;
END;
$$;

-- Recreate get_invoice_by_id function with new return type
CREATE OR REPLACE FUNCTION "public"."get_invoice_by_id"(invoice_id_param "uuid")
RETURNS TABLE(
    id uuid,
    invoice_code text,
    order_code text,
    subtotal numeric,
    discount numeric,
    delivery_fees numeric,
    total_price numeric,
    product_skus text[],
    user_email text,
    user_phone text,
    user_name text,
    user_address text,
    reviews bigint,
    notes text,
    user_notes text,
    is_deleted boolean,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    created_by text
)
LANGUAGE "plpgsql"
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        i.id,
        i.invoice_code,
        i.order_code,
        i.subtotal,
        i.discount,
        i.delivery_fees,
        i.total_price,
        i.product_skus,
        i.user_email,
        i.user_phone,
        i.user_name,
        i.user_address,
        i.reviews,
        i.notes,
        i.user_notes,
        i.is_deleted,
        i.created_at,
        i.updated_at,
        i.created_by
    FROM invoices i
    WHERE i.id = invoice_id_param
    AND i.is_deleted = false;
END;
$$;

-- Recreate get_invoice_by_code function with new return type
CREATE OR REPLACE FUNCTION "public"."get_invoice_by_code"(invoice_code_param "text")
RETURNS TABLE(
    id uuid,
    invoice_code text,
    order_code text,
    subtotal numeric,
    discount numeric,
    delivery_fees numeric,
    total_price numeric,
    product_skus text[],
    user_email text,
    user_phone text,
    user_name text,
    user_address text,
    reviews bigint,
    notes text,
    user_notes text,
    is_deleted boolean,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    created_by text
)
LANGUAGE "plpgsql"
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        i.id,
        i.invoice_code,
        i.order_code,
        i.subtotal,
        i.discount,
        i.delivery_fees,
        i.total_price,
        i.product_skus,
        i.user_email,
        i.user_phone,
        i.user_name,
        i.user_address,
        i.reviews,
        i.notes,
        i.user_notes,
        i.is_deleted,
        i.created_at,
        i.updated_at,
        i.created_by
    FROM invoices i
    WHERE i.invoice_code = invoice_code_param
    AND i.is_deleted = false;
END;
$$;

-- Add function to get invoice by order code
CREATE OR REPLACE FUNCTION "public"."get_invoice_by_order_code"(order_code_param "text")
RETURNS TABLE(
    id uuid,
    invoice_code text,
    order_code text,
    subtotal numeric,
    discount numeric,
    delivery_fees numeric,
    total_price numeric,
    product_skus text[],
    user_email text,
    user_phone text,
    user_name text,
    user_address text,
    reviews bigint,
    notes text,
    user_notes text,
    is_deleted boolean,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    created_by text
)
LANGUAGE "plpgsql"
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        i.id,
        i.invoice_code,
        i.order_code,
        i.subtotal,
        i.discount,
        i.delivery_fees,
        i.total_price,
        i.product_skus,
        i.user_email,
        i.user_phone,
        i.user_name,
        i.user_address,
        i.reviews,
        i.notes,
        i.user_notes,
        i.is_deleted,
        i.created_at,
        i.updated_at,
        i.created_by
    FROM invoices i
    WHERE i.order_code = order_code_param
    AND i.is_deleted = false;
END;
$$;

-- Grant permissions on recreated functions
GRANT ALL ON FUNCTION "public"."get_invoice_by_id"("uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_invoice_by_id"("uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_invoice_by_id"("uuid") TO "service_role";

GRANT ALL ON FUNCTION "public"."get_invoice_by_code"("text") TO "anon";
GRANT ALL ON FUNCTION "public"."get_invoice_by_code"("text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_invoice_by_code"("text") TO "service_role";

GRANT ALL ON FUNCTION "public"."get_invoice_by_order_code"("text") TO "anon";
GRANT ALL ON FUNCTION "public"."get_invoice_by_order_code"("text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_invoice_by_order_code"("text") TO "service_role";
