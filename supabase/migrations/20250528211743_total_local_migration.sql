create table "public"."invoices" (
    "id" uuid not null default gen_random_uuid(),
    "invoice_code" text not null,
    "subtotal" double precision,
    "discount" double precision,
    "delivery_fees" double precision,
    "total_price" double precision not null,
    "user_email" text,
    "user_phone" text,
    "user_name" text,
    "user_address" text,
    "is_deleted" boolean default false,
    "created_at" timestamp with time zone default now(),
    "updated_at" timestamp with time zone default now(),
    "deleted_at" timestamp with time zone,
    "created_by" text,
    "updated_by" text,
    "deleted_by" text,
    "reviews" bigint,
    "notes" text,
    "user_notes" text,
    "order_code" text,
    "products" jsonb[]
);


alter table "public"."addresses" alter column "created_by" set data type text using "created_by"::text;

alter table "public"."addresses" alter column "deleted_by" set data type text using "deleted_by"::text;

alter table "public"."addresses" alter column "updated_by" set data type text using "updated_by"::text;

alter table "public"."products" add column "sku" text;

CREATE UNIQUE INDEX cart_items_user_product_variant_unique ON public.cart_items USING btree (user_id, product_id, size, color) WHERE (is_deleted = false);

CREATE INDEX idx_invoices_created_at ON public.invoices USING btree (created_at);

CREATE INDEX idx_invoices_invoice_code ON public.invoices USING btree (invoice_code);

CREATE INDEX idx_invoices_is_deleted ON public.invoices USING btree (is_deleted);

CREATE INDEX idx_invoices_notes ON public.invoices USING btree (notes) WHERE (notes IS NOT NULL);

CREATE INDEX idx_invoices_order_code ON public.invoices USING btree (order_code) WHERE (order_code IS NOT NULL);

CREATE INDEX idx_invoices_reviews ON public.invoices USING btree (reviews);

CREATE INDEX idx_invoices_user_email ON public.invoices USING btree (user_email);

CREATE INDEX idx_invoices_user_notes ON public.invoices USING btree (user_notes) WHERE (user_notes IS NOT NULL);

CREATE INDEX idx_products_sku ON public.products USING btree (sku);

CREATE UNIQUE INDEX invoices_invoice_code_key ON public.invoices USING btree (invoice_code);

CREATE UNIQUE INDEX invoices_pkey ON public.invoices USING btree (id);

CREATE UNIQUE INDEX products_sku_key ON public.products USING btree (sku);

alter table "public"."invoices" add constraint "invoices_pkey" PRIMARY KEY using index "invoices_pkey";

alter table "public"."invoices" add constraint "invoices_invoice_code_key" UNIQUE using index "invoices_invoice_code_key";

alter table "public"."products" add constraint "products_sku_key" UNIQUE using index "products_sku_key";

set check_function_bodies = off;

CREATE OR REPLACE FUNCTION public.auto_create_invoice_on_delivery()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
    -- Check if the status is being changed to 'delivered'
    IF NEW.status = 'delivered' AND (OLD.status IS NULL OR OLD.status != 'delivered') THEN
        -- Check if order_code exists
        IF NEW.order_code IS NOT NULL AND NEW.order_code != '' THEN
            -- Check if invoice already exists for this order
            IF NOT EXISTS (
                SELECT 1 FROM invoices 
                WHERE order_code = NEW.order_code
                AND is_deleted = false
            ) THEN
                -- Create invoice from order
                BEGIN
                    PERFORM create_bill_from_order(NEW.order_code);
                    
                    -- Log successful invoice creation
                    RAISE NOTICE 'Invoice created successfully for order %', NEW.order_code;
                    
                EXCEPTION WHEN OTHERS THEN
                    -- Log error but don't fail the order update
                    RAISE WARNING 'Failed to create invoice for order %: %', NEW.order_code, SQLERRM;
                END;
            END IF;
        ELSE
            -- Log warning if order_code is missing
            RAISE WARNING 'Cannot create invoice for order ID % - order_code is missing', NEW.id;
        END IF;
    END IF;
    
    RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.create_bill_from_order(order_code_param text)
 RETURNS uuid
 LANGUAGE plpgsql
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public.generate_invoice_code(input_code text DEFAULT NULL::text)
 RETURNS text
 LANGUAGE plpgsql
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public.get_invoice_by_code(invoice_code_param text)
 RETURNS TABLE(id uuid, invoice_code text, order_code text, subtotal double precision, discount double precision, delivery_fees double precision, total_price double precision, products jsonb, user_email text, user_phone text, user_name text, user_address text, reviews bigint, notes text, user_notes text, is_deleted boolean, created_at timestamp with time zone, updated_at timestamp with time zone, created_by text)
 LANGUAGE plpgsql
AS $function$
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
        COALESCE(
            jsonb_agg(
                jsonb_build_object(
                    'name', p->>'name',
                    'sku', p->>'sku',
                    'quantity', p->>'quantity',
                    'price', p->>'price',
                    'old_price', p->>'old_price'
                )
            ) FILTER (WHERE p IS NOT NULL),
            '[]'::jsonb
        ) AS products,
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
    LEFT JOIN LATERAL unnest(i.products) AS p ON true
    WHERE i.invoice_code = invoice_code_param
      AND i.is_deleted = false
    GROUP BY 
        i.id, i.invoice_code, i.order_code, i.subtotal, i.discount, 
        i.delivery_fees, i.total_price, i.user_email, i.user_phone, 
        i.user_name, i.user_address, i.reviews, i.notes, i.user_notes, 
        i.is_deleted, i.created_at, i.updated_at, i.created_by;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.get_invoice_by_id(invoice_id_param uuid)
 RETURNS TABLE(id uuid, invoice_code text, order_code text, subtotal numeric, discount numeric, delivery_fees numeric, total_price numeric, product_skus text[], user_email text, user_phone text, user_name text, user_address text, reviews bigint, notes text, user_notes text, is_deleted boolean, created_at timestamp with time zone, updated_at timestamp with time zone, created_by text)
 LANGUAGE plpgsql
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public.get_invoice_by_order_code(order_code_param text)
 RETURNS TABLE(id uuid, invoice_code text, order_code text, subtotal numeric, discount numeric, delivery_fees numeric, total_price numeric, product_skus text[], user_email text, user_phone text, user_name text, user_address text, reviews bigint, notes text, user_notes text, is_deleted boolean, created_at timestamp with time zone, updated_at timestamp with time zone, created_by text)
 LANGUAGE plpgsql
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public.get_rating_distribution_by_slug(product_slug_input text)
 RETURNS TABLE(star integer, count bigint)
 LANGUAGE sql
AS $function$
  select 
    gs.star, 
    count(pr.rating) as count
  from generate_series(1, 5) as gs(star)
  left join product_reviews_with_user pr 
    on (pr.slug = product_slug_input or pr.slug_ar = product_slug_input) 
    and pr.rating = gs.star
  group by gs.star
  order by gs.star desc;
$function$
;

grant delete on table "public"."invoices" to "anon";

grant insert on table "public"."invoices" to "anon";

grant references on table "public"."invoices" to "anon";

grant select on table "public"."invoices" to "anon";

grant trigger on table "public"."invoices" to "anon";

grant truncate on table "public"."invoices" to "anon";

grant update on table "public"."invoices" to "anon";

grant delete on table "public"."invoices" to "authenticated";

grant insert on table "public"."invoices" to "authenticated";

grant references on table "public"."invoices" to "authenticated";

grant select on table "public"."invoices" to "authenticated";

grant trigger on table "public"."invoices" to "authenticated";

grant truncate on table "public"."invoices" to "authenticated";

grant update on table "public"."invoices" to "authenticated";

grant delete on table "public"."invoices" to "service_role";

grant insert on table "public"."invoices" to "service_role";

grant references on table "public"."invoices" to "service_role";

grant select on table "public"."invoices" to "service_role";

grant trigger on table "public"."invoices" to "service_role";

grant truncate on table "public"."invoices" to "service_role";

grant update on table "public"."invoices" to "service_role";

CREATE TRIGGER trigger_auto_create_invoice_on_delivery AFTER INSERT OR UPDATE OF status ON public.orders FOR EACH ROW WHEN (((new.status = 'delivered'::order_status) AND (new.is_deleted = false))) EXECUTE FUNCTION auto_create_invoice_on_delivery();


