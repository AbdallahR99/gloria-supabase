

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE EXTENSION IF NOT EXISTS "pg_graphql" WITH SCHEMA "graphql";






CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "wrappers" WITH SCHEMA "extensions";






CREATE TYPE "public"."order_status" AS ENUM (
    'pending',
    'confirmed',
    'processing',
    'shipped',
    'delivered',
    'cancelled',
    'failed',
    'refunded',
    'returned'
);


ALTER TYPE "public"."order_status" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_rating_distribution"("product_id_input" "uuid") RETURNS TABLE("star" integer, "count" integer)
    LANGUAGE "sql"
    AS $$
  select gs.star, count(r.rating) as count
  from generate_series(1, 5) as gs(star)
  left join reviews r on r.product_id = product_id_input and r.rating = gs.star and r.is_deleted = false
  group by gs.star
  order by gs.star desc;
$$;


ALTER FUNCTION "public"."get_rating_distribution"("product_id_input" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_product_rating"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
    avg_rating double precision;
    review_count bigint;
BEGIN
    -- Calculate the average rating and review count for the product
    SELECT AVG(rating), COUNT(*)
    INTO avg_rating, review_count
    FROM reviews
    WHERE product_id = NEW.product_id AND is_deleted = false;

    -- Update the product's stars and reviews count
    UPDATE products
    SET stars = COALESCE(avg_rating, 0), reviews = COALESCE(review_count, 0)
    WHERE id = NEW.product_id;

    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_product_rating"() OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."addresses" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "label" "text",
    "first_name" "text",
    "last_name" "text",
    "phone" "text",
    "city" "text",
    "state" "uuid",
    "area" "text",
    "street" "text",
    "building" "text",
    "apartment" "text",
    "notes" "text",
    "is_default" boolean DEFAULT false,
    "is_deleted" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "deleted_at" timestamp with time zone,
    "created_by" "uuid",
    "updated_by" "uuid",
    "deleted_by" "uuid"
);


ALTER TABLE "public"."addresses" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."bundles" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "bundle_name" "text",
    "product_id" "uuid",
    "old_price" double precision,
    "price" double precision,
    "meta_title_en" "text",
    "meta_title_ar" "text",
    "meta_description_en" "text",
    "meta_description_ar" "text",
    "is_active" boolean DEFAULT true,
    "is_deleted" boolean DEFAULT false,
    "is_banned" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "deleted_at" timestamp with time zone,
    "created_by" "text",
    "updated_by" "text",
    "deleted_by" "text"
);


ALTER TABLE "public"."bundles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."cart_items" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "product_id" "uuid",
    "quantity" integer,
    "color" "text",
    "size" "text",
    "is_deleted" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "deleted_at" timestamp with time zone,
    "created_by" "uuid",
    "updated_by" "uuid",
    "deleted_by" "uuid"
);


ALTER TABLE "public"."cart_items" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."categories" (
    "table_name" "text" DEFAULT 'categories'::"text",
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name_en" "text",
    "name_ar" "text",
    "slug" "text" NOT NULL,
    "slug_ar" "text" NOT NULL,
    "image" "text",
    "meta_title_en" "text",
    "meta_title_ar" "text",
    "meta_description_en" "text",
    "meta_description_ar" "text",
    "is_deleted" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "deleted_at" timestamp with time zone,
    "created_by" "text",
    "updated_by" "text"
);


ALTER TABLE "public"."categories" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."countries" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name_en" "text" NOT NULL,
    "code" "text" NOT NULL,
    "currency" "text" NOT NULL,
    "symbol_en" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "created_by" "uuid",
    "updated_by" "uuid",
    "name_ar" "text",
    "symbol_ar" "text"
);


ALTER TABLE "public"."countries" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."favorites" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "product_id" "uuid" NOT NULL,
    "is_deleted" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    "updated_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" timestamp with time zone,
    "created_by" "text",
    "updated_by" "text",
    "deleted_by" "text"
);


ALTER TABLE "public"."favorites" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."inspired_products" (
    "table_name" "text" DEFAULT 'inspired_products'::"text",
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name_en" "text",
    "name_ar" "text",
    "description_en" "text",
    "description_ar" "text",
    "image" "text",
    "meta_title_en" "text",
    "meta_title_ar" "text",
    "meta_description_en" "text",
    "meta_description_ar" "text",
    "is_deleted" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "deleted_at" timestamp with time zone,
    "created_by" "text",
    "updated_by" "text"
);


ALTER TABLE "public"."inspired_products" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."order_items" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "order_id" "uuid",
    "product_id" "uuid",
    "quantity" integer,
    "price" double precision,
    "color" "text",
    "size" "text",
    "is_deleted" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "deleted_at" timestamp with time zone,
    "created_by" "text",
    "updated_by" "text",
    "deleted_by" "text"
);


ALTER TABLE "public"."order_items" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."order_status_history" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "order_id" "uuid" NOT NULL,
    "status" "public"."order_status" NOT NULL,
    "changed_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "changed_by" "text",
    "note" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."order_status_history" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."orders" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "address_id" "uuid",
    "note" "text",
    "total_price" double precision,
    "is_deleted" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "deleted_at" timestamp with time zone,
    "created_by" "text",
    "updated_by" "text",
    "deleted_by" "text",
    "order_code" "text",
    "status" "public"."order_status" DEFAULT 'pending'::"public"."order_status",
    "user_note" "text"
);


ALTER TABLE "public"."orders" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."product_bundles" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "bundle_id" "uuid",
    "product_id" "uuid",
    "is_deleted" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "deleted_at" timestamp with time zone,
    "created_by" "text",
    "updated_by" "text",
    "deleted_by" "text"
);


ALTER TABLE "public"."product_bundles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."products" (
    "table_name" "text" DEFAULT 'products'::"text",
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name_en" "text",
    "name_ar" "text",
    "description_en" "text",
    "description_ar" "text",
    "slug" "text",
    "slug_ar" "text",
    "stars" double precision,
    "price" double precision,
    "old_price" double precision,
    "quantity" bigint,
    "thumbnail" "text",
    "images" "text"[],
    "sizes" "text"[],
    "colors" "jsonb"[],
    "category_id" "uuid",
    "inspired_by_id" "uuid",
    "meta_title_en" "text",
    "meta_title_ar" "text",
    "meta_description_en" "text",
    "meta_description_ar" "text",
    "is_banned" boolean DEFAULT false,
    "is_deleted" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "deleted_at" timestamp with time zone DEFAULT "now"(),
    "created_by" "text",
    "updated_by" "text",
    "deleted_by" "text",
    "reviews" bigint,
    "keywords" "text"
);


ALTER TABLE "public"."products" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."reviews" (
    "table_name" "text" DEFAULT 'reviews'::"text",
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "product_id" "uuid",
    "rating" double precision,
    "comment" "text",
    "images" "text"[],
    "is_approved" boolean DEFAULT true,
    "is_deleted" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone,
    "deleted_at" timestamp with time zone,
    "created_by" "text",
    "updated_by" "text",
    "deleted_by" "text"
);


ALTER TABLE "public"."reviews" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."product_reviews_with_user" AS
 SELECT "r"."id" AS "review_id",
    "r"."product_id",
    "p"."slug",
    "p"."slug_ar",
    "r"."rating",
    "r"."comment",
    "r"."images",
    "r"."created_at",
    "u"."id" AS "user_id",
    "u"."email",
    ("u"."raw_user_meta_data" ->> 'first_name'::"text") AS "first_name",
    ("u"."raw_user_meta_data" ->> 'last_name'::"text") AS "last_name",
    ("u"."raw_user_meta_data" ->> 'avatar'::"text") AS "avatar"
   FROM (("public"."reviews" "r"
     JOIN "public"."products" "p" ON (("r"."product_id" = "p"."id")))
     JOIN "auth"."users" "u" ON (("r"."user_id" = "u"."id")))
  WHERE ("r"."is_deleted" = false);


ALTER TABLE "public"."product_reviews_with_user" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."states" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "country_id" "uuid" NOT NULL,
    "name_ar" "text" NOT NULL,
    "code" "text" NOT NULL,
    "delivery_fee" numeric NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "created_by" "uuid",
    "updated_by" "uuid",
    "name_en" "text"
);


ALTER TABLE "public"."states" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."state_codes" AS
 SELECT "states"."id",
    "states"."code",
    "states"."name_en",
    "states"."name_ar",
    "countries"."code" AS "country_code",
    "countries"."name_en" AS "country_name_en",
    "countries"."name_ar" AS "country_name_ar",
    "countries"."currency",
    "countries"."symbol_en",
    "countries"."symbol_ar",
    "concat"("countries"."code", '_', "states"."code") AS "country_state_code"
   FROM ("public"."states"
     JOIN "public"."countries" ON (("states"."country_id" = "countries"."id")));


ALTER TABLE "public"."state_codes" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."user_profiles" AS
 SELECT "users"."id" AS "user_id",
    "users"."email",
    ("users"."raw_user_meta_data" ->> 'first_name'::"text") AS "first_name",
    ("users"."raw_user_meta_data" ->> 'last_name'::"text") AS "last_name",
    ("users"."raw_user_meta_data" ->> 'avatar'::"text") AS "avatar",
    "users"."created_at",
    COALESCE("users"."phone", ("users"."raw_user_meta_data" ->> 'phone'::"text")) AS "phone"
   FROM "auth"."users";


ALTER TABLE "public"."user_profiles" OWNER TO "postgres";


ALTER TABLE ONLY "public"."addresses"
    ADD CONSTRAINT "addresses_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."bundles"
    ADD CONSTRAINT "bundles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."cart_items"
    ADD CONSTRAINT "cart_items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."categories"
    ADD CONSTRAINT "categories_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."categories"
    ADD CONSTRAINT "categories_slug_ar_key" UNIQUE ("slug_ar");



ALTER TABLE ONLY "public"."categories"
    ADD CONSTRAINT "categories_slug_key" UNIQUE ("slug");



ALTER TABLE ONLY "public"."countries"
    ADD CONSTRAINT "countries_code_key" UNIQUE ("code");



ALTER TABLE ONLY "public"."countries"
    ADD CONSTRAINT "countries_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."favorites"
    ADD CONSTRAINT "favorites_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."favorites"
    ADD CONSTRAINT "favorites_user_id_product_id_key" UNIQUE ("user_id", "product_id");



ALTER TABLE ONLY "public"."inspired_products"
    ADD CONSTRAINT "inspired_products_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."order_items"
    ADD CONSTRAINT "order_items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."order_status_history"
    ADD CONSTRAINT "order_status_history_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."orders"
    ADD CONSTRAINT "orders_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."product_bundles"
    ADD CONSTRAINT "product_bundles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."products"
    ADD CONSTRAINT "products_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."products"
    ADD CONSTRAINT "products_slug_ar_key" UNIQUE ("slug_ar");



ALTER TABLE ONLY "public"."products"
    ADD CONSTRAINT "products_slug_key" UNIQUE ("slug");



ALTER TABLE ONLY "public"."reviews"
    ADD CONSTRAINT "reviews_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."states"
    ADD CONSTRAINT "states_code_key" UNIQUE ("code");



ALTER TABLE ONLY "public"."states"
    ADD CONSTRAINT "states_pkey" PRIMARY KEY ("id");



CREATE OR REPLACE TRIGGER "trigger_update_product_rating" AFTER INSERT OR UPDATE ON "public"."reviews" FOR EACH ROW EXECUTE FUNCTION "public"."update_product_rating"();



ALTER TABLE ONLY "public"."addresses"
    ADD CONSTRAINT "addresses_state_fkey" FOREIGN KEY ("state") REFERENCES "public"."states"("id") ON UPDATE CASCADE ON DELETE SET NULL;



ALTER TABLE ONLY "public"."addresses"
    ADD CONSTRAINT "addresses_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."bundles"
    ADD CONSTRAINT "bundles_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id");



ALTER TABLE ONLY "public"."cart_items"
    ADD CONSTRAINT "cart_items_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."cart_items"
    ADD CONSTRAINT "cart_items_deleted_by_fkey" FOREIGN KEY ("deleted_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."cart_items"
    ADD CONSTRAINT "cart_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id");



ALTER TABLE ONLY "public"."cart_items"
    ADD CONSTRAINT "cart_items_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."cart_items"
    ADD CONSTRAINT "cart_items_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."favorites"
    ADD CONSTRAINT "favorites_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."favorites"
    ADD CONSTRAINT "favorites_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."order_items"
    ADD CONSTRAINT "order_items_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id");



ALTER TABLE ONLY "public"."order_items"
    ADD CONSTRAINT "order_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id");



ALTER TABLE ONLY "public"."order_status_history"
    ADD CONSTRAINT "order_status_history_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."orders"
    ADD CONSTRAINT "orders_address_id_fkey" FOREIGN KEY ("address_id") REFERENCES "public"."addresses"("id");



ALTER TABLE ONLY "public"."orders"
    ADD CONSTRAINT "orders_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."product_bundles"
    ADD CONSTRAINT "product_bundles_bundle_id_fkey" FOREIGN KEY ("bundle_id") REFERENCES "public"."bundles"("id");



ALTER TABLE ONLY "public"."product_bundles"
    ADD CONSTRAINT "product_bundles_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id");



ALTER TABLE ONLY "public"."products"
    ADD CONSTRAINT "products_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON UPDATE CASCADE ON DELETE SET NULL;



ALTER TABLE ONLY "public"."products"
    ADD CONSTRAINT "products_inspired_by_id_fkey" FOREIGN KEY ("inspired_by_id") REFERENCES "public"."inspired_products"("id") ON UPDATE CASCADE ON DELETE SET NULL;



ALTER TABLE ONLY "public"."reviews"
    ADD CONSTRAINT "reviews_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON UPDATE CASCADE ON DELETE CASCADE;



ALTER TABLE ONLY "public"."reviews"
    ADD CONSTRAINT "reviews_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON UPDATE CASCADE ON DELETE CASCADE;



ALTER TABLE ONLY "public"."states"
    ADD CONSTRAINT "states_country_id_fkey" FOREIGN KEY ("country_id") REFERENCES "public"."countries"("id") ON DELETE CASCADE;





ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";


GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";














































































































































































































































































GRANT ALL ON FUNCTION "public"."get_rating_distribution"("product_id_input" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_rating_distribution"("product_id_input" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_rating_distribution"("product_id_input" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."update_product_rating"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_product_rating"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_product_rating"() TO "service_role";





















GRANT ALL ON TABLE "public"."addresses" TO "anon";
GRANT ALL ON TABLE "public"."addresses" TO "authenticated";
GRANT ALL ON TABLE "public"."addresses" TO "service_role";



GRANT ALL ON TABLE "public"."bundles" TO "anon";
GRANT ALL ON TABLE "public"."bundles" TO "authenticated";
GRANT ALL ON TABLE "public"."bundles" TO "service_role";



GRANT ALL ON TABLE "public"."cart_items" TO "anon";
GRANT ALL ON TABLE "public"."cart_items" TO "authenticated";
GRANT ALL ON TABLE "public"."cart_items" TO "service_role";



GRANT ALL ON TABLE "public"."categories" TO "anon";
GRANT ALL ON TABLE "public"."categories" TO "authenticated";
GRANT ALL ON TABLE "public"."categories" TO "service_role";



GRANT ALL ON TABLE "public"."countries" TO "anon";
GRANT ALL ON TABLE "public"."countries" TO "authenticated";
GRANT ALL ON TABLE "public"."countries" TO "service_role";



GRANT ALL ON TABLE "public"."favorites" TO "anon";
GRANT ALL ON TABLE "public"."favorites" TO "authenticated";
GRANT ALL ON TABLE "public"."favorites" TO "service_role";



GRANT ALL ON TABLE "public"."inspired_products" TO "anon";
GRANT ALL ON TABLE "public"."inspired_products" TO "authenticated";
GRANT ALL ON TABLE "public"."inspired_products" TO "service_role";



GRANT ALL ON TABLE "public"."order_items" TO "anon";
GRANT ALL ON TABLE "public"."order_items" TO "authenticated";
GRANT ALL ON TABLE "public"."order_items" TO "service_role";



GRANT ALL ON TABLE "public"."order_status_history" TO "anon";
GRANT ALL ON TABLE "public"."order_status_history" TO "authenticated";
GRANT ALL ON TABLE "public"."order_status_history" TO "service_role";



GRANT ALL ON TABLE "public"."orders" TO "anon";
GRANT ALL ON TABLE "public"."orders" TO "authenticated";
GRANT ALL ON TABLE "public"."orders" TO "service_role";



GRANT ALL ON TABLE "public"."product_bundles" TO "anon";
GRANT ALL ON TABLE "public"."product_bundles" TO "authenticated";
GRANT ALL ON TABLE "public"."product_bundles" TO "service_role";



GRANT ALL ON TABLE "public"."products" TO "anon";
GRANT ALL ON TABLE "public"."products" TO "authenticated";
GRANT ALL ON TABLE "public"."products" TO "service_role";



GRANT ALL ON TABLE "public"."reviews" TO "anon";
GRANT ALL ON TABLE "public"."reviews" TO "authenticated";
GRANT ALL ON TABLE "public"."reviews" TO "service_role";



GRANT ALL ON TABLE "public"."product_reviews_with_user" TO "anon";
GRANT ALL ON TABLE "public"."product_reviews_with_user" TO "authenticated";
GRANT ALL ON TABLE "public"."product_reviews_with_user" TO "service_role";



GRANT ALL ON TABLE "public"."states" TO "anon";
GRANT ALL ON TABLE "public"."states" TO "authenticated";
GRANT ALL ON TABLE "public"."states" TO "service_role";



GRANT ALL ON TABLE "public"."state_codes" TO "anon";
GRANT ALL ON TABLE "public"."state_codes" TO "authenticated";
GRANT ALL ON TABLE "public"."state_codes" TO "service_role";



GRANT ALL ON TABLE "public"."user_profiles" TO "anon";
GRANT ALL ON TABLE "public"."user_profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."user_profiles" TO "service_role";









ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES  TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES  TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES  TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES  TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS  TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS  TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS  TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS  TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES  TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES  TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES  TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES  TO "service_role";






























RESET ALL;
