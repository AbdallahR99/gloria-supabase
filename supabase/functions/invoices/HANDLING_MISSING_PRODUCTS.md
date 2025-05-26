# Handling Missing Products in Invoices Module

## Overview

The invoices module is designed to be resilient against missing or deleted products. When creating invoices, the system handles cases where products may not exist in the products table by using fallback strategies.

## Product Independence Strategy

### 1. Data Cloning
- Invoice items store cloned product data (names, prices) at creation time
- This makes invoices independent of future changes to the products table
- Invoices remain valid even if products are deleted or modified

### 2. Fallback Mechanisms

#### For Manual Invoice Creation (`POST /invoices`)
```json
{
  "user_id": "123",
  "items": [
    {
      "product_sku": "DELETED_PRODUCT_001",
      "product_name_en": "Custom Product Name",
      "product_name_ar": "اسم المنتج المخصص", 
      "quantity": 2,
      "unit_price": 50.00
    }
  ]
}
```

**Behavior:**
- If product exists: Uses product data from database
- If product missing: Uses provided names, generates fallback if not provided
- Fallback names: `"Product {SKU}"` (EN) and `"منتج {SKU}"` (AR)
- Requires manual `unit_price` if product not found and no price provided

#### For Order-to-Invoice Conversion (`POST /invoices/from-order`)
```json
{
  "order_code": "ORD-2025-05-27-0001"
}
```

**Behavior:**
- Uses data already stored in `order_items` table
- No dependency on products table during conversion
- All product data is already cloned in order items

## Error Handling Examples

### Successful Cases

#### 1. Product Exists
```bash
curl -X POST https://your-supabase-url/functions/v1/invoices \
-H "Authorization: Bearer $TOKEN" \
-H "Content-Type: application/json" \
-d '{
  "user_id": "user123",
  "items": [
    {
      "product_sku": "AMBER_MUSK_50ML",
      "quantity": 1
    }
  ]
}'
```

Response: Product data fetched from database automatically.

#### 2. Product Missing, Manual Data Provided
```bash
curl -X POST https://your-supabase-url/functions/v1/invoices \
-H "Authorization: Bearer $TOKEN" \
-H "Content-Type: application/json" \
-d '{
  "user_id": "user123",
  "items": [
    {
      "product_sku": "DISCONTINUED_PRODUCT",
      "product_name_en": "Discontinued Perfume",
      "product_name_ar": "عطر متوقف",
      "quantity": 1,
      "unit_price": 75.00
    }
  ]
}'
```

Response: Uses provided manual data.

#### 3. Product Missing, Fallback Names Used
```bash
curl -X POST https://your-supabase-url/functions/v1/invoices \
-H "Authorization: Bearer $TOKEN" \
-H "Content-Type: application/json" \
-d '{
  "user_id": "user123",
  "items": [
    {
      "product_sku": "UNKNOWN_SKU_123",
      "quantity": 1,
      "unit_price": 25.00
    }
  ]
}'
```

Response: Uses fallback names "Product UNKNOWN_SKU_123" and "منتج UNKNOWN_SKU_123".

### Error Cases

#### 1. Missing Product, No Price Provided
```bash
curl -X POST https://your-supabase-url/functions/v1/invoices \
-H "Authorization: Bearer $TOKEN" \
-H "Content-Type: application/json" \
-d '{
  "user_id": "user123",
  "items": [
    {
      "product_sku": "MISSING_PRODUCT",
      "quantity": 1
    }
  ]
}'
```

Response:
```json
{
  "message": "Product with SKU 'MISSING_PRODUCT' not found. Please provide unit_price manually.",
  "status": 400
}
```

## Database Schema Benefits

### Invoice Items Independence
The `invoice_items` table stores:
- `product_sku`: SKU code for reference
- `product_name_en`: Cloned English name
- `product_name_ar`: Cloned Arabic name  
- `unit_price`: Price at time of invoice creation
- `size`, `color`: Product variant information

This design ensures:
- ✅ Invoices remain valid if products are deleted
- ✅ Historical pricing is preserved
- ✅ Product names are preserved in both languages
- ✅ No broken foreign key constraints

## Best Practices

### For Frontend Applications
1. **Product Validation**: Check if products exist before creating invoices
2. **Manual Entry**: Allow staff to provide product details for missing items
3. **Warning Messages**: Show warnings when using products that don't exist
4. **Price Requirements**: Always provide unit_price for unknown SKUs

### For API Integration
1. **Batch Validation**: Use bulk endpoints to validate multiple SKUs
2. **Error Handling**: Handle 400 errors for missing prices gracefully
3. **Fallback UI**: Show SKU codes when product names are generated
4. **Audit Trail**: Log when fallback names are used

### For Data Migration
1. **Preserve History**: Never delete invoices when products are removed
2. **SKU Consistency**: Maintain SKU format consistency
3. **Data Export**: Export invoice data before major product cleanups
4. **Backup Strategy**: Regular backups of invoice data

## Migration Scenarios

### When Removing Products
```sql
-- Don't delete immediately, mark as deleted
UPDATE products 
SET is_deleted = true, deleted_at = NOW()
WHERE sku = 'OLD_PRODUCT_SKU';

-- Invoices and orders with this SKU remain intact
-- New invoices will require manual product details
```

### When Updating Product Information
```sql
-- Product updates don't affect existing invoices
UPDATE products 
SET name_en = 'New Product Name'
WHERE sku = 'EXISTING_SKU';

-- Existing invoice_items retain original names
-- New invoices will use updated names
```

This design ensures maximum flexibility and data integrity for the invoices module.
