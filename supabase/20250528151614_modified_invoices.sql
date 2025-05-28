alter table "public"."invoices" drop column "table_name";

alter table "public"."invoices" add column "products" jsonb[];

alter table "public"."invoices" alter column "delivery_fees" drop not null;

alter table "public"."invoices" alter column "discount" drop not null;

alter table "public"."invoices" alter column "subtotal" drop not null;


