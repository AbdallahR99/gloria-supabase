// File: functions/invoices/create.ts

/**
 * Handle creating new invoices manually or automatically from orders.
 * Supports both online order invoices and manual in-store invoices.
 * 
 * @param {Request} req - HTTP request object containing invoice data
 * @param {SupabaseClient} supabase - Supabase client instance
 * @param {Object|null} user - Authenticated user object
 * @param {Error|null} authError - Authentication error if any
 * @returns {Response} JSON response with created invoice data
 * 
 * @throws {Error} Unauthorized access (401)
 * @throws {Error} Missing required fields (400)
 * @throws {Error} Invalid SKU references (400)
 * @throws {Error} Database constraint violations (400/500)
 */
export async function handleCreateInvoice(req, supabase, user, authError) {
  if (authError || !user) throw new Error("Unauthorized");

  const body = await req.json();
  const now = new Date().toISOString();
  
  // Validate required fields
  if (!body.customer_name || !body.customer_email || !body.items || !Array.isArray(body.items) || body.items.length === 0) {
    return json({ message: "Missing required fields: customer_name, customer_email, items" }, 400);
  }

  // Validate invoice items and SKUs
  for (const item of body.items) {
    if (!item.sku || !item.quantity || !item.unit_price) {
      return json({ message: "Each item must have sku, quantity, and unit_price" }, 400);
    }
  }

  // Verify SKUs exist in products
  const skus = body.items.map(item => item.sku);
  const { data: products, error: productsError } = await supabase
    .from('products')
    .select('sku, id, name_en, name_ar, price')
    .in('sku', skus)
    .eq('is_deleted', false);

  if (productsError) throw productsError;

  const productMap = new Map(products.map(p => [p.sku, p]));
  
  // Check for missing SKUs
  const missingSKUs = skus.filter(sku => !productMap.has(sku));
  if (missingSKUs.length > 0) {
    return json({ message: `Invalid SKUs: ${missingSKUs.join(', ')}` }, 400);
  }

  // Create invoice
  const invoiceData = {
    invoice_type: body.invoice_type || 'manual',
    status: body.status || 'draft',
    customer_name: body.customer_name,
    customer_email: body.customer_email,
    customer_phone: body.customer_phone,
    customer_address: body.customer_address,
    tax_rate: body.tax_rate || 0,
    discount_amount: body.discount_amount || 0,
    shipping_amount: body.shipping_amount || 0,
    payment_method: body.payment_method,
    payment_status: body.payment_status || 'pending',
    invoice_date: body.invoice_date || now,
    due_date: body.due_date || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    notes: body.notes,
    internal_notes: body.internal_notes,
    created_at: now,
    updated_at: now,
    created_by: user.email,
    updated_by: user.email,
    is_deleted: false
  };

  // If order reference provided, link it
  if (body.order_id) {
    invoiceData.order_id = body.order_id;
  }
  if (body.order_code) {
    invoiceData.order_code = body.order_code;
  }

  const { data: invoice, error: invoiceError } = await supabase
    .from('invoices')
    .insert(invoiceData)
    .select()
    .single();

  if (invoiceError) throw invoiceError;

  // Create invoice items
  const invoiceItems = body.items.map(item => {
    const product = productMap.get(item.sku);
    return {
      invoice_id: invoice.id,
      product_id: product.id,
      sku: item.sku,
      product_name: item.product_name || product.name_en,
      product_name_ar: item.product_name_ar || product.name_ar,
      quantity: item.quantity,
      unit_price: item.unit_price,
      total_price: item.quantity * item.unit_price,
      size: item.size,
      color: item.color,
      created_at: now,
      updated_at: now,
      is_deleted: false
    };
  });

  const { error: itemsError } = await supabase
    .from('invoice_items')
    .insert(invoiceItems);

  if (itemsError) throw itemsError;

  // Get the complete invoice with items
  const { data: completeInvoice, error: fetchError } = await supabase
    .from('invoice_details')
    .select(`
      *,
      items:invoice_items_details(*)
    `)
    .eq('id', invoice.id)
    .single();

  if (fetchError) throw fetchError;

  return json(completeInvoice, 201);
}

/**
 * Handle creating invoices automatically from completed orders.
 * Extracts order details and creates corresponding invoice with items.
 */
export async function handleCreateInvoiceFromOrder(req, supabase, user, authError) {
  if (authError || !user) throw new Error("Unauthorized");

  const body = await req.json();
  const { order_id } = body;
  
  if (!order_id) {
    return json({ message: "Missing required field: order_id" }, 400);
  }

  // Get order details with items
  const { data: order, error: orderError } = await supabase
    .from('orders')
    .select(`
      *,
      user:user_profiles(*),
      items:order_items(
        *,
        product:products(*)
      )
    `)
    .eq('id', order_id)
    .single();

  if (orderError) throw orderError;
  
  if (!order) {
    return json({ message: "Order not found" }, 404);
  }

  // Check if invoice already exists for this order
  const { data: existingInvoice } = await supabase
    .from('invoices')
    .select('id, invoice_number')
    .eq('order_id', order_id)
    .eq('is_deleted', false)
    .single();

  if (existingInvoice) {
    return json({ 
      message: "Invoice already exists for this order", 
      invoice_number: existingInvoice.invoice_number 
    }, 409);
  }

  const now = new Date().toISOString();

  // Create invoice from order
  const invoiceData = {
    order_id: order.id,
    order_code: order.order_code,
    invoice_type: 'online',
    status: 'sent',
    customer_name: `${order.user?.first_name || ''} ${order.user?.last_name || ''}`.trim(),
    customer_email: order.user?.email || order.billing_email,
    customer_phone: order.user?.phone || order.billing_phone,
    customer_address: order.billing_address,
    subtotal: order.subtotal || 0,
    tax_amount: order.tax_amount || 0,
    tax_rate: order.tax_rate || 0,
    discount_amount: order.discount_amount || 0,
    shipping_amount: order.shipping_amount || 0,
    total_amount: order.total_amount,
    payment_method: order.payment_method,
    payment_status: order.payment_status === 'paid' ? 'paid' : 'pending',
    payment_date: order.payment_status === 'paid' ? now : null,
    payment_reference: order.payment_reference,
    invoice_date: now,
    due_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    notes: `Auto-generated from order ${order.order_code}`,
    created_at: now,
    updated_at: now,
    created_by: user.email,
    updated_by: user.email,
    is_deleted: false
  };

  const { data: invoice, error: invoiceError } = await supabase
    .from('invoices')
    .insert(invoiceData)
    .select()
    .single();

  if (invoiceError) throw invoiceError;

  // Create invoice items from order items
  const invoiceItems = order.items.map(item => ({
    invoice_id: invoice.id,
    product_id: item.product_id,
    sku: item.product?.sku || `SKU-${item.product_id}`,
    product_name: item.product?.name_en || 'Unknown Product',
    product_name_ar: item.product?.name_ar,
    quantity: item.quantity,
    unit_price: item.price,
    total_price: item.quantity * item.price,
    size: item.size,
    color: item.color,
    created_at: now,
    updated_at: now,
    is_deleted: false
  }));

  const { error: itemsError } = await supabase
    .from('invoice_items')
    .insert(invoiceItems);

  if (itemsError) throw itemsError;

  // Get the complete invoice with items
  const { data: completeInvoice, error: fetchError } = await supabase
    .from('invoice_details')
    .select(`
      *,
      items:invoice_items_details(*)
    `)
    .eq('id', invoice.id)
    .single();

  if (fetchError) throw fetchError;

  return json(completeInvoice, 201);
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    headers: { "Content-Type": "application/json" },
    status
  });
}

/**
 * Usage Examples:
 * 
 * 1. Create manual invoice for in-store purchase:
 * curl -X POST "https://your-project.supabase.co/functions/v1/invoices" \
 *   -H "Content-Type: application/json" \
 *   -H "Authorization: Bearer YOUR_JWT_TOKEN" \
 *   -d '{
 *     "customer_name": "John Doe",
 *     "customer_email": "john@example.com",
 *     "customer_phone": "+1234567890",
 *     "invoice_type": "instore",
 *     "payment_method": "cash",
 *     "payment_status": "paid",
 *     "tax_rate": 10,
 *     "items": [
 *       {
 *         "sku": "PERF-001",
 *         "quantity": 2,
 *         "unit_price": 50.00,
 *         "size": "50ml"
 *       },
 *       {
 *         "sku": "SKIN-002", 
 *         "quantity": 1,
 *         "unit_price": 25.00
 *       }
 *     ]
 *   }'
 * 
 * 2. Create invoice from existing order:
 * curl -X POST "https://your-project.supabase.co/functions/v1/invoices/from-order" \
 *   -H "Content-Type: application/json" \
 *   -H "Authorization: Bearer YOUR_JWT_TOKEN" \
 *   -d '{
 *     "order_id": "123e4567-e89b-12d3-a456-426614174000"
 *   }'
 * 
 * 3. Create draft invoice for quote:
 * curl -X POST "https://your-project.supabase.co/functions/v1/invoices" \
 *   -H "Content-Type: application/json" \
 *   -H "Authorization: Bearer YOUR_JWT_TOKEN" \
 *   -d '{
 *     "customer_name": "Jane Smith",
 *     "customer_email": "jane@example.com", 
 *     "invoice_type": "manual",
 *     "status": "draft",
 *     "payment_status": "pending",
 *     "items": [
 *       {
 *         "sku": "BUNDLE-001",
 *         "quantity": 1,
 *         "unit_price": 100.00,
 *         "product_name": "Perfume Bundle Special"
 *       }
 *     ]
 *   }'
 */
