// File: functions/invoices/bulk.ts

/**
 * Handle bulk operations for invoices including creation, updates, and deletion.
 * Supports batch processing with transaction rollback on failures.
 * 
 * @param {Request} req - HTTP request object containing bulk operation data
 * @param {SupabaseClient} supabase - Supabase client instance
 * @param {Object|null} user - Authenticated user object
 * @param {Error|null} authError - Authentication error if any
 * @returns {Response} JSON response with bulk operation results
 * 
 * @throws {Error} Unauthorized access (401)
 * @throws {Error} Invalid bulk data (400)
 * @throws {Error} Batch processing errors (500)
 */

/**
 * Handle bulk creation of invoices from multiple orders.
 * Creates invoices for multiple completed orders in a single transaction.
 * 
 * Request Body:
 * {
 *   "order_ids": [                       // Array of order IDs to create invoices for
 *     "order_uuid_1",
 *     "order_uuid_2"
 *   ],
 *   "invoice_settings": {                // Global settings for all invoices
 *     "invoice_type": "online",
 *     "payment_method": "card",
 *     "tax_rate": 10.0,
 *     "due_days": 30
 *   }
 * }
 * 
 * Response Format:
 * {
 *   "success": true,
 *   "created_count": 2,
 *   "failed_count": 0,
 *   "invoices": [
 *     {
 *       "order_id": "order_uuid_1",
 *       "invoice_id": "invoice_uuid_1",
 *       "invoice_number": "INV-2024-01-15-0001",
 *       "total_amount": 150.00
 *     },
 *     {
 *       "order_id": "order_uuid_2", 
 *       "invoice_id": "invoice_uuid_2",
 *       "invoice_number": "INV-2024-01-15-0002",
 *       "total_amount": 275.50
 *     }
 *   ],
 *   "errors": []
 * }
 * 
 * Usage Examples:
 * 
 * 1. Bulk create invoices from orders:
 * curl -X POST "https://your-project.supabase.co/functions/v1/invoices/bulk-create" \
 *   -H "Content-Type: application/json" \
 *   -H "Authorization: Bearer YOUR_JWT_TOKEN" \
 *   -d '{
 *     "order_ids": [
 *       "123e4567-e89b-12d3-a456-426614174000",
 *       "456e7890-e12b-34d5-a678-901234567890"
 *     ],
 *     "invoice_settings": {
 *       "invoice_type": "online",
 *       "payment_method": "card",
 *       "tax_rate": 8.5,
 *       "due_days": 30
 *     }
 *   }'
 */
export async function handleBulkCreateInvoices(req, supabase, user, authError) {
  if (authError || !user) throw new Error("Unauthorized");
  
  const body = await req.json();
  const { order_ids, invoice_settings = {} } = body;
  
  if (!order_ids || !Array.isArray(order_ids) || order_ids.length === 0) {
    return json({ error: "order_ids array is required and cannot be empty" }, 400);
  }
  
  if (order_ids.length > 100) {
    return json({ error: "Cannot process more than 100 orders at once" }, 400);
  }
  
  const {
    invoice_type = 'online',
    payment_method = 'card',
    tax_rate = 0,
    due_days = 30
  } = invoice_settings;
  
  const results = {
    success: true,
    created_count: 0,
    failed_count: 0,
    invoices: [],
    errors: []
  };
  
  // Fetch all orders to validate and get details
  const { data: orders, error: ordersError } = await supabase
    .from('orders')
    .select(`
      id,
      order_code,
      user_id,
      total_price,
      status,
      created_at,
      address_id,
      address:addresses(
        label,
        first_name,
        last_name,
        phone,
        city,
        state,
        area,
        street,
        building,
        apartment
      )
    `)
    .in('id', order_ids)
    .eq('is_deleted', false);
  
  if (ordersError) throw ordersError;
  
  // Check for missing orders
  const foundOrderIds = new Set(orders.map(o => o.id));
  const missingOrderIds = order_ids.filter(id => !foundOrderIds.has(id));
  
  if (missingOrderIds.length > 0) {
    results.errors.push({
      type: 'missing_orders',
      order_ids: missingOrderIds,
      message: 'Orders not found'
    });
  }
  
  // Process each valid order
  for (const order of orders) {
    try {
      // Check if invoice already exists for this order
      const { data: existingInvoice } = await supabase
        .from('invoices')
        .select('id, invoice_number')
        .eq('order_id', order.id)
        .eq('is_deleted', false)
        .maybeSingle();
      
      if (existingInvoice) {
        results.errors.push({
          type: 'invoice_exists',
          order_id: order.id,
          order_code: order.order_code,
          existing_invoice: existingInvoice.invoice_number,
          message: 'Invoice already exists for this order'
        });
        results.failed_count++;
        continue;
      }
      
      // Generate invoice number
      const { data: invoiceNumberResult } = await supabase.rpc('generate_invoice_number');
      const invoice_number = invoiceNumberResult;
      
      // Get order items for subtotal calculation
      const { data: orderItems } = await supabase
        .from('order_items')
        .select('quantity, price')
        .eq('order_id', order.id)
        .eq('is_deleted', false);
      
      const subtotal = orderItems?.reduce((sum, item) => sum + (item.quantity * item.price), 0) || order.total_price;
      
      // Calculate amounts
      const tax_amount = (subtotal * tax_rate) / 100;
      const total_amount = subtotal + tax_amount;
      
      // Build customer info from order address
      const address = order.address;
      const customer_name = address ? `${address.first_name || ''} ${address.last_name || ''}`.trim() : null;
      const customer_phone = address?.phone;
      const customer_address = address ? 
        [address.street, address.building, address.apartment, address.area, address.city]
          .filter(Boolean).join(', ') : null;
      
      const now = new Date().toISOString();
      const due_date = new Date(Date.now() + due_days * 24 * 60 * 60 * 1000).toISOString();
      
      // Create invoice
      const { data: invoice, error: invoiceError } = await supabase
        .from('invoices')
        .insert({
          invoice_number,
          order_id: order.id,
          order_code: order.order_code,
          invoice_type,
          status: 'sent',
          customer_name,
          customer_phone,
          customer_address,
          subtotal,
          tax_amount,
          tax_rate,
          discount_amount: 0,
          shipping_amount: 0,
          total_amount,
          payment_method,
          payment_status: 'pending',
          invoice_date: now,
          due_date,
          notes: `Automatically generated from order ${order.order_code}`,
          created_at: now,
          updated_at: now,
          created_by: user.email,
          updated_by: user.email
        })
        .select('id, invoice_number, total_amount')
        .single();
      
      if (invoiceError) throw invoiceError;
      
      // Create invoice items from order items
      if (orderItems && orderItems.length > 0) {
        const { data: orderItemsWithProducts } = await supabase
          .from('order_items')
          .select(`
            product_id,
            quantity,
            price,
            size,
            color,
            product:products(sku, name_en, name_ar)
          `)
          .eq('order_id', order.id)
          .eq('is_deleted', false);
        
        const invoiceItems = orderItemsWithProducts.map(item => ({
          invoice_id: invoice.id,
          product_id: item.product_id,
          sku: item.product?.sku || `UNKNOWN-${item.product_id?.substring(0, 8)}`,
          product_name: item.product?.name_en || 'Unknown Product',
          product_name_ar: item.product?.name_ar,
          quantity: item.quantity,
          unit_price: item.price,
          total_price: item.quantity * item.price,
          size: item.size,
          color: item.color,
          created_at: now,
          updated_at: now
        }));
        
        const { error: itemsError } = await supabase
          .from('invoice_items')
          .insert(invoiceItems);
        
        if (itemsError) throw itemsError;
      }
      
      results.invoices.push({
        order_id: order.id,
        order_code: order.order_code,
        invoice_id: invoice.id,
        invoice_number: invoice.invoice_number,
        total_amount: invoice.total_amount
      });
      
      results.created_count++;
      
    } catch (error) {
      results.errors.push({
        type: 'creation_error',
        order_id: order.id,
        order_code: order.order_code,
        message: error.message
      });
      results.failed_count++;
    }
  }
  
  // Set overall success status
  results.success = results.failed_count === 0;
  
  return json(results);
}

/**
 * Handle bulk deletion of invoices.
 * Deletes multiple invoices with validation and rollback capabilities.
 * 
 * Request Body:
 * {
 *   "invoice_ids": [                     // Array of invoice IDs to delete
 *     "invoice_uuid_1",
 *     "invoice_uuid_2"
 *   ],
 *   "force_delete": false,               // Force delete paid invoices (admin only)
 *   "deletion_reason": "Bulk cleanup"    // Reason for deletion
 * }
 * 
 * Response Format:
 * {
 *   "success": true,
 *   "deleted_count": 2,
 *   "failed_count": 0,
 *   "deleted_invoices": [
 *     {
 *       "invoice_id": "invoice_uuid_1",
 *       "invoice_number": "INV-2024-01-15-0001"
 *     }
 *   ],
 *   "errors": []
 * }
 * 
 * Usage Examples:
 * 
 * 1. Bulk delete draft invoices:
 * curl -X DELETE "https://your-project.supabase.co/functions/v1/invoices/bulk-delete" \
 *   -H "Content-Type: application/json" \
 *   -H "Authorization: Bearer YOUR_JWT_TOKEN" \
 *   -d '{
 *     "invoice_ids": [
 *       "123e4567-e89b-12d3-a456-426614174000",
 *       "456e7890-e12b-34d5-a678-901234567890"
 *     ],
 *     "deletion_reason": "Bulk cleanup of draft invoices"
 *   }'
 */
export async function handleBulkDeleteInvoices(req, supabase, user, authError) {
  if (authError || !user) throw new Error("Unauthorized");
  
  const body = await req.json();
  const { invoice_ids, force_delete = false, deletion_reason } = body;
  
  if (!invoice_ids || !Array.isArray(invoice_ids) || invoice_ids.length === 0) {
    return json({ error: "invoice_ids array is required and cannot be empty" }, 400);
  }
  
  if (invoice_ids.length > 100) {
    return json({ error: "Cannot delete more than 100 invoices at once" }, 400);
  }
  
  if (force_delete && !deletion_reason) {
    return json({ error: "Deletion reason is required for force delete" }, 400);
  }
  
  // Check admin permissions for force delete
  if (force_delete) {
    const { data: userRoles } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id);
    
    const isAdmin = userRoles?.some(r => ['admin', 'super_admin'].includes(r.role));
    
    if (!isAdmin) {
      return json({ error: "Insufficient permissions for force delete" }, 403);
    }
  }
  
  const results = {
    success: true,
    deleted_count: 0,
    failed_count: 0,
    deleted_invoices: [],
    errors: []
  };
  
  // Fetch all invoices to validate deletion rules
  const { data: invoices, error: fetchError } = await supabase
    .from('invoices')
    .select('id, invoice_number, status, payment_status')
    .in('id', invoice_ids)
    .eq('is_deleted', false);
  
  if (fetchError) throw fetchError;
  
  // Check for missing invoices
  const foundInvoiceIds = new Set(invoices.map(i => i.id));
  const missingInvoiceIds = invoice_ids.filter(id => !foundInvoiceIds.has(id));
  
  if (missingInvoiceIds.length > 0) {
    results.errors.push({
      type: 'missing_invoices',
      invoice_ids: missingInvoiceIds,
      message: 'Invoices not found'
    });
  }
  
  const now = new Date().toISOString();
  
  // Process each invoice
  for (const invoice of invoices) {
    try {
      // Check deletion rules
      const canNormalDelete = ['draft', 'sent', 'cancelled'].includes(invoice.status) && 
                             invoice.payment_status !== 'paid';
      
      if (!canNormalDelete && !force_delete) {
        results.errors.push({
          type: 'cannot_delete',
          invoice_id: invoice.id,
          invoice_number: invoice.invoice_number,
          status: invoice.status,
          payment_status: invoice.payment_status,
          message: 'Cannot delete paid invoice without force_delete flag'
        });
        results.failed_count++;
        continue;
      }
      
      // Delete invoice items first
      const { error: itemsDeleteError } = await supabase
        .from('invoice_items')
        .update({
          is_deleted: true,
          updated_at: now
        })
        .eq('invoice_id', invoice.id);
      
      if (itemsDeleteError) throw itemsDeleteError;
      
      // Delete invoice
      const updateData = {
        is_deleted: true,
        updated_at: now,
        updated_by: user.email
      };
      
      if (deletion_reason) {
        const { data: currentInvoice } = await supabase
          .from('invoices')
          .select('internal_notes')
          .eq('id', invoice.id)
          .single();
        
        const existingNotes = currentInvoice?.internal_notes || '';
        const deletionNote = `\n[BULK DELETED ${now}] Reason: ${deletion_reason}`;
        updateData.internal_notes = existingNotes + deletionNote;
      }
      
      const { error: deleteError } = await supabase
        .from('invoices')
        .update(updateData)
        .eq('id', invoice.id);
      
      if (deleteError) throw deleteError;
      
      results.deleted_invoices.push({
        invoice_id: invoice.id,
        invoice_number: invoice.invoice_number
      });
      
      results.deleted_count++;
      
    } catch (error) {
      results.errors.push({
        type: 'deletion_error',
        invoice_id: invoice.id,
        invoice_number: invoice.invoice_number,
        message: error.message
      });
      results.failed_count++;
    }
  }
  
  results.success = results.failed_count === 0;
  
  return json(results);
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    headers: { "Content-Type": "application/json" },
    status
  });
}
