-- Add SKU column to products table
-- This migration adds a unique SKU (Stock Keeping Unit) column to the products table

-- Add the sku column to the products table
ALTER TABLE public.products 
ADD COLUMN sku text;

-- Add a unique constraint to the sku column
ALTER TABLE public.products 
ADD CONSTRAINT products_sku_key UNIQUE (sku);

-- Add a comment to document the column
COMMENT ON COLUMN public.products.sku IS 'Stock Keeping Unit - unique identifier for inventory management';

-- Create an index for better performance on SKU queries
CREATE INDEX idx_products_sku ON public.products(sku);