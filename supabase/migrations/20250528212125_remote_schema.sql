set check_function_bodies = off;

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


