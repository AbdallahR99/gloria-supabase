-- Modify invoices table to update audit columns and add new fields

-- Update audit columns to allow null values and add new fields
ALTER TABLE "public"."invoices" 
  ALTER COLUMN "is_deleted" DROP NOT NULL,
  ALTER COLUMN "is_deleted" SET DEFAULT false,
  ALTER COLUMN "created_at" DROP NOT NULL,
  ALTER COLUMN "created_at" SET DEFAULT now(),
  ALTER COLUMN "updated_at" DROP NOT NULL,
  ALTER COLUMN "updated_at" SET DEFAULT now(),
  ALTER COLUMN "deleted_at" DROP DEFAULT,
  ALTER COLUMN "created_by" DROP NOT NULL,
  ALTER COLUMN "updated_by" DROP NOT NULL,
  ALTER COLUMN "deleted_by" DROP NOT NULL;

-- Add new columns
ALTER TABLE "public"."invoices"
  ADD COLUMN "reviews" bigint NULL,
  ADD COLUMN "notes" text NULL,
  ADD COLUMN "user_notes" text NULL;

-- Create indexes for new columns
CREATE INDEX idx_invoices_reviews ON "public"."invoices"("reviews");
CREATE INDEX idx_invoices_notes ON "public"."invoices"("notes") WHERE "notes" IS NOT NULL;
CREATE INDEX idx_invoices_user_notes ON "public"."invoices"("user_notes") WHERE "user_notes" IS NOT NULL;
