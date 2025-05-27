-- Create trigger function to automatically create invoice when order status becomes "delivered"
CREATE OR REPLACE FUNCTION "public"."auto_create_invoice_on_delivery"()
RETURNS TRIGGER
LANGUAGE "plpgsql"
AS $$
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
$$;

-- Grant permissions on the trigger function
GRANT EXECUTE ON FUNCTION "public"."auto_create_invoice_on_delivery"() TO "anon";
GRANT EXECUTE ON FUNCTION "public"."auto_create_invoice_on_delivery"() TO "authenticated";
GRANT EXECUTE ON FUNCTION "public"."auto_create_invoice_on_delivery"() TO "service_role";

-- Create trigger on orders table
DROP TRIGGER IF EXISTS trigger_auto_create_invoice_on_delivery ON "public"."orders";

CREATE TRIGGER trigger_auto_create_invoice_on_delivery
    AFTER INSERT OR UPDATE OF status
    ON "public"."orders"
    FOR EACH ROW
    WHEN (NEW.status = 'delivered' AND NEW.is_deleted = false)
    EXECUTE FUNCTION "public"."auto_create_invoice_on_delivery"();

-- Add comment to document the trigger
COMMENT ON TRIGGER trigger_auto_create_invoice_on_delivery ON "public"."orders" IS 
'Automatically creates an invoice when an order status becomes "delivered"';
