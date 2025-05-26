# Invoices Module

A comprehensive invoicing system for Gloria Perfumes that integrates with products (via SKU codes) and orders (via order codes). Supports both automatic invoice generation from completed orders and manual invoice creation for in-store purchases.

## Features

### Core Functionality
- ✅ **Full CRUD Operations** - Create, read, update, delete invoices
- ✅ **SKU Integration** - Link products via SKU codes with automatic product lookup
- ✅ **Order Integration** - Generate invoices from completed orders
- ✅ **Manual Invoicing** - Create invoices for in-store purchases
- ✅ **Status Management** - Track invoice lifecycle with proper transitions
- ✅ **Payment Tracking** - Monitor payment status and history
- ✅ **Bulk Operations** - Process multiple invoices simultaneously
- ✅ **Item Management** - Add, update, delete individual invoice items
- ✅ **PDF Generation** - Create professional invoice PDFs
- ✅ **Audit Trail** - Complete history tracking for compliance

### Database Features
- 🔄 **PostgreSQL Enums** - Type-safe status management
- 🔄 **Auto-numbering** - Sequential invoice numbers (INV-YYYY-MM-DD-XXXX)
- 🔄 **Automatic Calculations** - Totals calculated via database triggers
- 🔄 **Soft Deletes** - Preserve data with deletion flags
- 🔄 **Performance Indexes** - Optimized for common query patterns
- 🔄 **RLS Security** - Row-level security for multi-tenant access

## Database Schema

### Enums
```sql
CREATE TYPE invoice_type_enum AS ENUM ('online', 'instore', 'manual');
CREATE TYPE invoice_status_enum AS ENUM ('draft', 'sent', 'paid', 'overdue', 'cancelled', 'refunded');
CREATE TYPE payment_status_enum AS ENUM ('pending', 'paid', 'partial', 'failed', 'refunded');
CREATE TYPE payment_method_enum AS ENUM ('cash', 'card', 'online', 'bank_transfer', 'check', 'other');
```

### Tables
- `invoices` - Main invoice records with billing information
- `invoice_items` - Line items linked by SKU codes

### Views
- `invoice_details` - Invoices with order and customer information
- `invoice_items_details` - Items with current product information

## API Endpoints

### Base URL
```
POST|GET|PUT|DELETE /functions/v1/invoices
```

### Core Operations

#### Create Invoice
```bash
# Manual invoice for in-store purchase
curl -X POST "http://localhost:54321/functions/v1/invoices" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "invoice_type": "instore",
    "customer_name": "Ahmed Ali",
    "customer_email": "ahmed@example.com",
    "customer_phone": "+966501234567",
    "tax_rate": 15,
    "payment_method": "cash",
    "items": [
      {
        "sku": "PERF-001",
        "quantity": 2,
        "unit_price": 150.00
      }
    ]
  }'

# Auto-generate from order
curl -X POST "http://localhost:54321/functions/v1/invoices" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "order_id": "123e4567-e89b-12d3-a456-426614174000"
  }'
```

#### Get Invoice
```bash
# Get by invoice number
curl "http://localhost:54321/functions/v1/invoices/INV-2025-05-26-0001" \
  -H "Authorization: Bearer YOUR_TOKEN"

# Get by ID with items
curl "http://localhost:54321/functions/v1/invoices/123e4567-e89b-12d3-a456-426614174000?include_items=true" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

#### List Invoices
```bash
# List with pagination
curl "http://localhost:54321/functions/v1/invoices?page=1&limit=10" \
  -H "Authorization: Bearer YOUR_TOKEN"

# Filter by status and date
curl "http://localhost:54321/functions/v1/invoices?status=paid&date_from=2025-05-01&date_to=2025-05-31" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

#### Update Invoice
```bash
curl -X PUT "http://localhost:54321/functions/v1/invoices/INV-2025-05-26-0001" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "customer_phone": "+966501234568",
    "notes": "Updated contact information"
  }'
```

#### Delete Invoice
```bash
# Soft delete
curl -X DELETE "http://localhost:54321/functions/v1/invoices/INV-2025-05-26-0001" \
  -H "Authorization: Bearer YOUR_TOKEN"

# Force delete (admin only)
curl -X DELETE "http://localhost:54321/functions/v1/invoices/INV-2025-05-26-0001?force=true" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Advanced Operations

#### Bulk Operations
```bash
# Bulk create from orders
curl -X POST "http://localhost:54321/functions/v1/invoices/bulk" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "action": "create",
    "order_ids": ["order1", "order2", "order3"]
  }'

# Bulk delete
curl -X POST "http://localhost:54321/functions/v1/invoices/bulk" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "action": "delete",
    "invoice_ids": ["inv1", "inv2"],
    "reason": "Cancelled orders"
  }'
```

#### Status Management
```bash
# Update status
curl -X PUT "http://localhost:54321/functions/v1/invoices/INV-2025-05-26-0001/status" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "new_status": "sent",
    "notify_customer": true
  }'

# Mark as paid
curl -X PUT "http://localhost:54321/functions/v1/invoices/INV-2025-05-26-0001/paid" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "payment_method": "card",
    "payment_reference": "TXN123456",
    "notes": "Payment received via credit card"
  }'
```

#### Item Management
```bash
# Add item
curl -X POST "http://localhost:54321/functions/v1/invoices/INV-2025-05-26-0001/items" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "sku": "PERF-002",
    "quantity": 1,
    "size": "50ml"
  }'

# Update item
curl -X PUT "http://localhost:54321/functions/v1/invoices/INV-2025-05-26-0001/items/item-id" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "quantity": 3,
    "unit_price": 180.00
  }'

# Delete item
curl -X DELETE "http://localhost:54321/functions/v1/invoices/INV-2025-05-26-0001/items/item-id" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

#### PDF Generation
```bash
# Generate PDF
curl "http://localhost:54321/functions/v1/invoices/INV-2025-05-26-0001/pdf" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Accept: application/pdf" \
  --output invoice.pdf
```

## Business Rules

### Status Transitions
- `draft` → `sent`, `cancelled`
- `sent` → `paid`, `overdue`, `cancelled`
- `paid` → `refunded`
- `overdue` → `paid`, `cancelled`
- `cancelled` → (no transitions)
- `refunded` → (no transitions)

### Financial Protection
- Paid invoices cannot be modified (financial fields)
- Only totals and notes can be updated for paid invoices
- Force delete requires admin permissions

### Automatic Calculations
- Item totals: `quantity × unit_price`
- Subtotal: Sum of all item totals
- Tax amount: `subtotal × (tax_rate / 100)`
- Total: `subtotal + tax_amount + shipping_amount - discount_amount`

## Deployment

### Prerequisites
- Supabase CLI installed and configured
- PostgreSQL database access
- Proper environment variables set

### Deploy Database Schema
```powershell
# Apply migration (from gloria-supabase directory)
supabase db reset
```

### Deploy Functions
```powershell
# Deploy all invoice functions
supabase functions deploy invoices
```

### Test Deployment
```powershell
# Run the test script
.\test-invoices-deployment.ps1
```

## Security

### Row Level Security (RLS)
- Users can only view invoices for their own orders
- Admin/staff can view all invoices
- Only admin/staff can create/modify invoices
- Only admin can force delete invoices

### API Security
- JWT token authentication required
- Role-based permissions (admin, staff, user)
- Input validation and sanitization
- SQL injection protection via parameterized queries

## Error Handling

### Common HTTP Status Codes
- `200` - Success
- `201` - Created
- `400` - Bad Request (validation errors)
- `401` - Unauthorized
- `403` - Forbidden (insufficient permissions)
- `404` - Not Found
- `409` - Conflict (business rule violations)
- `500` - Internal Server Error

### Error Response Format
```json
{
  "success": false,
  "error": "Error message",
  "details": "Additional error details"
}
```

## Integration

### With Products System
- Automatic SKU validation
- Product price fetching
- Stock level checking
- Product information snapshots

### With Orders System
- Automatic invoice generation
- Order status synchronization
- Customer information inheritance
- Payment status mapping

### With Notifications
- Customer invoice notifications
- Payment confirmations
- Status change alerts
- PDF delivery via email

## Monitoring

### Logs
```powershell
# View function logs
supabase functions logs invoices
```

### Database Queries
```sql
-- Active invoices by status
SELECT status, COUNT(*) FROM invoices WHERE is_deleted = false GROUP BY status;

-- Revenue by month
SELECT DATE_TRUNC('month', invoice_date) as month, SUM(total_amount) 
FROM invoices 
WHERE status = 'paid' AND is_deleted = false 
GROUP BY month 
ORDER BY month;

-- Top SKUs by quantity
SELECT ii.sku, SUM(ii.quantity) as total_quantity 
FROM invoice_items ii 
JOIN invoices i ON ii.invoice_id = i.id 
WHERE i.status = 'paid' AND ii.is_deleted = false 
GROUP BY ii.sku 
ORDER BY total_quantity DESC;
```

## Support

### Common Issues
1. **SKU not found** - Ensure product exists and has valid SKU
2. **Permission denied** - Check user role and RLS policies
3. **Status transition error** - Verify valid status transition rules
4. **Calculation mismatch** - Database triggers handle automatic calculations

### Troubleshooting
1. Check function logs for detailed error messages
2. Verify database schema is up to date
3. Ensure proper authentication tokens
4. Test with curl commands for API validation

For additional support, refer to the function-specific documentation in each TypeScript file.
