// File: functions/invoices/items.ts

/**
 * Handle invoice item management operations.
 * Provides functionality to add, update, and delete line items from invoices.
 * Automatically recalculates invoice totals when items are modified.
 * 
 * Features:
 * - Add new items to existing invoices with SKU validation
 * - Update item quantities, prices, and product variants
 * - Delete individual items from invoices
 * - Automatic invoice total recalculation
 * - Product information lookup via SKU
 * - Business rule enforcement (paid invoice protection)
 * 
 * Dependencies:
 * - Products table for SKU validation and product details
 * - Invoice items table for line item storage
 * - Invoices table for total recalculation
 */

function json(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    headers: { "Content-Type": "application/json" },
    status
  });
}

/**
 * Add a new item to an existing invoice.
 * Creates a new line item with product details looked up by SKU.
 * 
 * @param {Request} req - HTTP request object containing item data
 * @param {SupabaseClient} supabase - Supabase client instance
 * @param {Object|null} user - Authenticated user object
 * @param {Error|null} authError - Authentication error if any
 * @returns {Response} JSON response with created item details
 * 
 * @throws {Error} Unauthorized access (401)
 * @throws {Error} Missing required fields (400)
 * @throws {Error} Invoice not found or paid (404/400)
 * @throws {Error} Product/SKU not found (404)
 * @throws {Error} Database errors (500)
 * 
 * Request Body:
 * {
 *   "invoice_id": "invoice_uuid",           // Target invoice ID (required)
 *   "sku": "PROD-001",                      // Product SKU (required)
 *   "quantity": 2,                          // Item quantity (required)
 *   "unit_price": 29.99,                    // Price per unit (optional, from product)
 *   "size": "L",                            // Product size variant (optional)
 *   "color": "Blue"                         // Product color variant (optional)
 * }
 * 
 * Response Format:
 * {
 *   "id": "item_uuid",
 *   "invoice_id": "invoice_uuid",
 *   "sku": "PROD-001",
 *   "product_name": "Premium T-Shirt",
 *   "quantity": 2,
 *   "unit_price": 29.99,
 *   "total_price": 59.98,
 *   "size": "L",
 *   "color": "Blue"
 * }
 * 
 * Business Rules:
 * - Cannot add items to paid or cancelled invoices
 * - SKU must exist in products table
 * - Unit price defaults to product price if not specified
 * - Total price is calculated automatically (quantity × unit_price)
 * - Invoice totals are recalculated after item addition
 * 
 * Usage Examples:
 * 
 * 1. Add basic item to invoice:
 * curl -X POST "https://your-project.supabase.co/functions/v1/invoices/items" \
 *   -H "Content-Type: application/json" \
 *   -H "Authorization: Bearer YOUR_JWT_TOKEN" \
 *   -d '{
 *     "invoice_id": "123e4567-e89b-12d3-a456-426614174000",
 *     "sku": "SHIRT-001",
 *     "quantity": 2
 *   }'
 * 
 * 2. Add item with custom price and variants:
 * curl -X POST "https://your-project.supabase.co/functions/v1/invoices/items" \
 *   -H "Content-Type: application/json" \
 *   -H "Authorization: Bearer YOUR_JWT_TOKEN" \
 *   -d '{
 *     "invoice_id": "123e4567-e89b-12d3-a456-426614174000",
 *     "sku": "SHIRT-002",
 *     "quantity": 1,
 *     "unit_price": 35.00,
 *     "size": "XL",
 *     "color": "Red"
 *   }'
 */
export async function handleAddInvoiceItem(req: Request, supabase: any, user: any, authError: any) {
  if (authError || !user) throw new Error("Unauthorized");
  
  const body = await req.json();
  const { invoice_id, sku, quantity, unit_price, size, color } = body;
  
  // Validate required fields
  if (!invoice_id || !sku || !quantity) {
    return json({
      error: "Missing required fields: invoice_id, sku, quantity"
    }, 400);
  }
  
  if (quantity <= 0) {
    return json({
      error: "Quantity must be a positive number"
    }, 400);
  }
  
  // Check if invoice exists and is editable
  const { data: invoice, error: invoiceError } = await supabase
    .from('invoices')
    .select('id, status, payment_status')
    .eq('id', invoice_id)
    .eq('is_deleted', false)
    .single();
    
  if (invoiceError || !invoice) {
    return json({
      error: "Invoice not found"
    }, 404);
  }
  
  // Prevent modification of paid invoices
  if (invoice.payment_status === 'paid' || invoice.status === 'paid') {
    return json({
      error: "Cannot modify items on paid invoices"
    }, 400);
  }
  
  // Look up product by SKU
  const { data: product, error: productError } = await supabase
    .from('products')
    .select('id, name_en, name_ar, price, sku')
    .eq('sku', sku)
    .eq('is_deleted', false)
    .single();
    
  if (productError || !product) {
    return json({
      error: `Product not found for SKU: ${sku}`
    }, 404);
  }
  
  // Use provided unit price or default to product price
  const finalUnitPrice = unit_price || product.price;
  const totalPrice = quantity * finalUnitPrice;
  
  const now = new Date().toISOString();
  
  // Create invoice item
  const itemData = {
    invoice_id,
    product_id: product.id,
    sku: product.sku,
    product_name: product.name_en,
    product_name_ar: product.name_ar,
    quantity,
    unit_price: finalUnitPrice,
    total_price: totalPrice,
    size: size || null,
    color: color || null,
    created_at: now,
    updated_at: now,
    created_by: user.email,
    updated_by: user.email,
    is_deleted: false
  };
  
  const { data: createdItem, error: createError } = await supabase
    .from('invoice_items')
    .insert([itemData])
    .select()
    .single();
    
  if (createError) throw createError;
  
  // Recalculate invoice totals
  await recalculateInvoiceTotals(supabase, invoice_id);
  
  return json(createdItem, 201);
}

/**
 * Update an existing invoice item.
 * Modifies item details and recalculates totals.
 * 
 * @param {Request} req - HTTP request object containing update data
 * @param {SupabaseClient} supabase - Supabase client instance
 * @param {Object|null} user - Authenticated user object
 * @param {Error|null} authError - Authentication error if any
 * @returns {Response} JSON response with updated item details
 * 
 * Request Body:
 * {
 *   "item_id": "item_uuid",                 // Item ID to update (required)
 *   "quantity": 3,                          // New quantity (optional)
 *   "unit_price": 32.99,                    // New unit price (optional)
 *   "size": "M",                            // New size (optional)
 *   "color": "Green"                        // New color (optional)
 * }
 * 
 * Usage Example:
 * curl -X PUT "https://your-project.supabase.co/functions/v1/invoices/items" \
 *   -H "Content-Type: application/json" \
 *   -H "Authorization: Bearer YOUR_JWT_TOKEN" \
 *   -d '{
 *     "item_id": "456e7890-e12b-34d5-a678-901234567890",
 *     "quantity": 3,
 *     "unit_price": 27.99
 *   }'
 */
export async function handleUpdateInvoiceItem(req: Request, supabase: any, user: any, authError: any) {
  if (authError || !user) throw new Error("Unauthorized");
  
  const body = await req.json();
  const { item_id, quantity, unit_price, size, color } = body;
  
  if (!item_id) {
    return json({
      error: "Missing required field: item_id"
    }, 400);
  }
  
  // Get existing item and check invoice status
  const { data: existingItem, error: fetchError } = await supabase
    .from('invoice_items')
    .select(`
      id,
      invoice_id,
      quantity,
      unit_price,
      invoices!inner(id, status, payment_status)
    `)
    .eq('id', item_id)
    .eq('is_deleted', false)
    .single();
    
  if (fetchError || !existingItem) {
    return json({
      error: "Invoice item not found"
    }, 404);
  }
  
  // Check if invoice is editable
  const invoice = existingItem.invoices;
  if (invoice.payment_status === 'paid' || invoice.status === 'paid') {
    return json({
      error: "Cannot modify items on paid invoices"
    }, 400);
  }
  
  // Build update data
  const updateData: any = {
    updated_at: new Date().toISOString(),
    updated_by: user.email
  };
  
  if (quantity !== undefined) {
    if (quantity <= 0) {
      return json({
        error: "Quantity must be a positive number"
      }, 400);
    }
    updateData.quantity = quantity;
  }
  
  if (unit_price !== undefined) {
    if (unit_price < 0) {
      return json({
        error: "Unit price cannot be negative"
      }, 400);
    }
    updateData.unit_price = unit_price;
  }
  
  if (size !== undefined) updateData.size = size;
  if (color !== undefined) updateData.color = color;
  
  // Calculate new total price if quantity or unit_price changed
  const finalQuantity = quantity !== undefined ? quantity : existingItem.quantity;
  const finalUnitPrice = unit_price !== undefined ? unit_price : existingItem.unit_price;
  updateData.total_price = finalQuantity * finalUnitPrice;
  
  // Update the item
  const { data: updatedItem, error: updateError } = await supabase
    .from('invoice_items')
    .update(updateData)
    .eq('id', item_id)
    .select()
    .single();
    
  if (updateError) throw updateError;
  
  // Recalculate invoice totals
  await recalculateInvoiceTotals(supabase, existingItem.invoice_id);
  
  return json(updatedItem);
}

/**
 * Delete an invoice item.
 * Removes the item from the invoice and recalculates totals.
 * 
 * @param {Request} req - HTTP request object containing item ID
 * @param {SupabaseClient} supabase - Supabase client instance
 * @param {Object|null} user - Authenticated user object
 * @param {Error|null} authError - Authentication error if any
 * @returns {Response} JSON response with deletion status
 * 
 * Request Body:
 * {
 *   "item_id": "item_uuid"                  // Item ID to delete (required)
 * }
 * 
 * Usage Example:
 * curl -X DELETE "https://your-project.supabase.co/functions/v1/invoices/items" \
 *   -H "Content-Type: application/json" \
 *   -H "Authorization: Bearer YOUR_JWT_TOKEN" \
 *   -d '{
 *     "item_id": "456e7890-e12b-34d5-a678-901234567890"
 *   }'
 */
export async function handleDeleteInvoiceItem(req: Request, supabase: any, user: any, authError: any) {
  if (authError || !user) throw new Error("Unauthorized");
  
  const body = await req.json();
  const { item_id } = body;
  
  if (!item_id) {
    return json({
      error: "Missing required field: item_id"
    }, 400);
  }
  
  // Get existing item and check invoice status
  const { data: existingItem, error: fetchError } = await supabase
    .from('invoice_items')
    .select(`
      id,
      invoice_id,
      invoices!inner(id, status, payment_status)
    `)
    .eq('id', item_id)
    .eq('is_deleted', false)
    .single();
    
  if (fetchError || !existingItem) {
    return json({
      error: "Invoice item not found"
    }, 404);
  }
  
  // Check if invoice is editable
  const invoice = existingItem.invoices;
  if (invoice.payment_status === 'paid' || invoice.status === 'paid') {
    return json({
      error: "Cannot delete items from paid invoices"
    }, 400);
  }
  
  // Soft delete the item
  const { error: deleteError } = await supabase
    .from('invoice_items')
    .update({
      is_deleted: true,
      updated_at: new Date().toISOString(),
      updated_by: user.email
    })
    .eq('id', item_id);
    
  if (deleteError) throw deleteError;
  
  // Recalculate invoice totals
  await recalculateInvoiceTotals(supabase, existingItem.invoice_id);
  
  return json({
    status: "deleted",
    message: "Invoice item deleted successfully"
  });
}

/**
 * Recalculate invoice totals based on current items.
 * Updates subtotal and total_amount fields in invoices table.
 */
async function recalculateInvoiceTotals(supabase: any, invoiceId: string) {
  // Get all non-deleted items for this invoice
  const { data: items, error: itemsError } = await supabase
    .from('invoice_items')
    .select('total_price')
    .eq('invoice_id', invoiceId)
    .eq('is_deleted', false);
    
  if (itemsError) throw itemsError;
  
  // Calculate new subtotal
  const subtotal = items.reduce((sum: number, item: any) => sum + (item.total_price || 0), 0);
  
  // Get current invoice to preserve tax and shipping amounts
  const { data: invoice, error: invoiceError } = await supabase
    .from('invoices')
    .select('tax_amount, discount_amount, shipping_amount')
    .eq('id', invoiceId)
    .single();
    
  if (invoiceError) throw invoiceError;
  
  // Calculate new total
  const taxAmount = invoice.tax_amount || 0;
  const discountAmount = invoice.discount_amount || 0;
  const shippingAmount = invoice.shipping_amount || 0;
  const totalAmount = subtotal + taxAmount + shippingAmount - discountAmount;
  
  // Update invoice totals
  const { error: updateError } = await supabase
    .from('invoices')
    .update({
      subtotal: subtotal,
      total_amount: totalAmount,
      updated_at: new Date().toISOString()
    })
    .eq('id', invoiceId);
    
  if (updateError) throw updateError;
}
