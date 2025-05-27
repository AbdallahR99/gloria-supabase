-- Create invoices table with static values and no relationships
-- This migration creates the invoices table with audit columns following existing patterns

-- Create invoices table
CREATE TABLE IF NOT EXISTS "public"."invoices" (
    "table_name" "text" DEFAULT 'invoices'::"text",
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "invoice_code" "text" UNIQUE NOT NULL,
    
    -- Financial Information
    "subtotal" double precision not null,
    "discount" double precision not null,
    "delivery_fees" double precision not null,
    "total_price" double precision not null,
    
    -- Products Information
    "product_skus" "text"[] NOT NULL, -- Array of product SKUs
    
    -- User Information (Static values, no relationships)
    "user_email" "text",
    "user_phone" "text",
    "user_name" "text",
    "user_address" "text",
    
    -- Audit columns following existing pattern
    "is_deleted" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "deleted_at" timestamp with time zone,
    "created_by" "text",
    "updated_by" "text",
    "deleted_by" "text"
);

ALTER TABLE "public"."invoices" OWNER TO "postgres";

-- Add primary key
ALTER TABLE ONLY "public"."invoices"
    ADD CONSTRAINT "invoices_pkey" PRIMARY KEY ("id");

-- Create indexes for performance
CREATE INDEX idx_invoices_invoice_code ON "public"."invoices"("invoice_code");
CREATE INDEX idx_invoices_user_email ON "public"."invoices"("user_email");
CREATE INDEX idx_invoices_created_at ON "public"."invoices"("created_at");
CREATE INDEX idx_invoices_is_deleted ON "public"."invoices"("is_deleted");

-- Grant permissions on table
GRANT ALL ON TABLE "public"."invoices" TO "anon";
GRANT ALL ON TABLE "public"."invoices" TO "authenticated";
GRANT ALL ON TABLE "public"."invoices" TO "service_role";

-- Function to generate invoice code
CREATE OR REPLACE FUNCTION "public"."generate_invoice_code"(input_code "text" DEFAULT NULL) 
RETURNS "text"
LANGUAGE "plpgsql"
AS $$
DECLARE
    current_year text;
    current_month text;
    invoice_count integer;
    generated_code text;
BEGIN
    -- If input_code is provided and not empty, return it
    IF input_code IS NOT NULL AND input_code != '' THEN
        -- Check if the code already exists
        IF EXISTS (SELECT 1 FROM invoices WHERE invoice_code = input_code AND is_deleted = false) THEN
            RAISE EXCEPTION 'Invoice code % already exists', input_code;
        END IF;
        RETURN input_code;
    END IF;
    
    -- Auto-generate invoice code if null or empty
    current_year := EXTRACT(YEAR FROM NOW())::text;
    current_month := LPAD(EXTRACT(MONTH FROM NOW())::text, 2, '0');
    
    -- Count existing invoices for this month
    SELECT COUNT(*) + 1
    INTO invoice_count
    FROM invoices
    WHERE EXTRACT(YEAR FROM created_at) = EXTRACT(YEAR FROM NOW())
    AND EXTRACT(MONTH FROM created_at) = EXTRACT(MONTH FROM NOW())
    AND is_deleted = false;
    
    -- Format: INV-YYYY-MM-NNNN
    generated_code := 'INV-' || current_year || '-' || current_month || '-' || LPAD(invoice_count::text, 4, '0');
    
    -- Ensure uniqueness in case of concurrent inserts
    WHILE EXISTS (SELECT 1 FROM invoices WHERE invoice_code = generated_code AND is_deleted = false) LOOP
        invoice_count := invoice_count + 1;
        generated_code := 'INV-' || current_year || '-' || current_month || '-' || LPAD(invoice_count::text, 4, '0');
    END LOOP;
    
    RETURN generated_code;
END;
$$;

ALTER FUNCTION "public"."generate_invoice_code"("text") OWNER TO "postgres";

-- Grant permissions on the function
GRANT ALL ON FUNCTION "public"."generate_invoice_code"("text") TO "anon";
GRANT ALL ON FUNCTION "public"."generate_invoice_code"("text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."generate_invoice_code"("text") TO "service_role";

-- Function to create bill from order details
CREATE OR REPLACE FUNCTION "public"."create_bill_from_order"(order_code_param "text")
RETURNS "uuid"
LANGUAGE "plpgsql"
AS $$
DECLARE
    order_record RECORD;
    order_items_data RECORD;
    calculated_subtotal numeric(10,2) := 0;
    calculated_discount numeric(10,2) := 0;
    calculated_delivery_fees numeric(10,2) := 0;
    calculated_total numeric(10,2) := 0;
    new_invoice_id uuid;
    generated_invoice_code text;
    sku_array text[];
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
        WHERE order_code_param = ANY(product_skus)
        AND is_deleted = false
    ) THEN
        RAISE EXCEPTION 'Invoice already exists for order code %', order_code_param;
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
        calculated_subtotal,
        calculated_discount,
        calculated_delivery_fees,        calculated_total,
        sku_array,
        order_record.user_email,
        order_record.user_phone,
        order_record.user_name,
        order_record.user_address,
        'system'
    ) RETURNING id INTO new_invoice_id;
    
    RETURN new_invoice_id;
END;
$$;

ALTER FUNCTION "public"."create_bill_from_order"("text") OWNER TO "postgres";

-- Grant permissions on the function
GRANT ALL ON FUNCTION "public"."create_bill_from_order"("text") TO "anon";
GRANT ALL ON FUNCTION "public"."create_bill_from_order"("text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_bill_from_order"("text") TO "service_role";

-- Function to get invoice by ID
CREATE OR REPLACE FUNCTION "public"."get_invoice_by_id"(invoice_id_param "uuid")
RETURNS TABLE(
    id uuid,
    invoice_code text,
    subtotal numeric,
    discount numeric,
    delivery_fees numeric,
    total_price numeric,
    product_skus text[],
    user_email text,
    user_phone text,
    user_name text,
    user_address text,
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
        i.subtotal,
        i.discount,
        i.delivery_fees,
        i.total_price,
        i.product_skus,
        i.user_email,
        i.user_phone,
        i.user_name,
        i.user_address,
        i.is_deleted,
        i.created_at,
        i.updated_at,
        i.created_by
    FROM invoices i
    WHERE i.id = invoice_id_param
    AND i.is_deleted = false;
END;
$$;

ALTER FUNCTION "public"."get_invoice_by_id"("uuid") OWNER TO "postgres";

-- Grant permissions on the function
GRANT ALL ON FUNCTION "public"."get_invoice_by_id"("uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_invoice_by_id"("uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_invoice_by_id"("uuid") TO "service_role";

-- Function to get invoice by code
CREATE OR REPLACE FUNCTION "public"."get_invoice_by_code"(invoice_code_param "text")
RETURNS TABLE(
    id uuid,
    invoice_code text,
    subtotal numeric,
    discount numeric,
    delivery_fees numeric,
    total_price numeric,
    product_skus text[],
    user_email text,
    user_phone text,
    user_name text,
    user_address text,
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
        i.subtotal,
        i.discount,
        i.delivery_fees,
        i.total_price,
        i.product_skus,
        i.user_email,
        i.user_phone,
        i.user_name,
        i.user_address,
        i.is_deleted,
        i.created_at,
        i.updated_at,
        i.created_by
    FROM invoices i
    WHERE i.invoice_code = invoice_code_param
    AND i.is_deleted = false;
END;
$$;

ALTER FUNCTION "public"."get_invoice_by_code"("text") OWNER TO "postgres";

-- Grant permissions on the function
GRANT ALL ON FUNCTION "public"."get_invoice_by_code"("text") TO "anon";
GRANT ALL ON FUNCTION "public"."get_invoice_by_code"("text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_invoice_by_code"("text") TO "service_role";