create table "public"."vouchers" (
    "id" uuid not null default gen_random_uuid(),
    "created_at" timestamp with time zone not null default now(),
    "created_by" text,
    "user_name" text,
    "user_email" text,
    "user_phone" text,
    "voucher_code" text,
    "notes" text
);


CREATE UNIQUE INDEX vouchers_pkey ON public.vouchers USING btree (id);

alter table "public"."vouchers" add constraint "vouchers_pkey" PRIMARY KEY using index "vouchers_pkey";

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

grant delete on table "public"."vouchers" to "anon";

grant insert on table "public"."vouchers" to "anon";

grant references on table "public"."vouchers" to "anon";

grant select on table "public"."vouchers" to "anon";

grant trigger on table "public"."vouchers" to "anon";

grant truncate on table "public"."vouchers" to "anon";

grant update on table "public"."vouchers" to "anon";

grant delete on table "public"."vouchers" to "authenticated";

grant insert on table "public"."vouchers" to "authenticated";

grant references on table "public"."vouchers" to "authenticated";

grant select on table "public"."vouchers" to "authenticated";

grant trigger on table "public"."vouchers" to "authenticated";

grant truncate on table "public"."vouchers" to "authenticated";

grant update on table "public"."vouchers" to "authenticated";

grant delete on table "public"."vouchers" to "service_role";

grant insert on table "public"."vouchers" to "service_role";

grant references on table "public"."vouchers" to "service_role";

grant select on table "public"."vouchers" to "service_role";

grant trigger on table "public"."vouchers" to "service_role";

grant truncate on table "public"."vouchers" to "service_role";

grant update on table "public"."vouchers" to "service_role";


