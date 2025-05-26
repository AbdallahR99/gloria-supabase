// File: functions/invoices/get.ts

/**
 * Handle getting invoice details by invoice number or ID.
 * Retrieves comprehensive invoice information including items and customer details.
 * 
 * @param {Request} req - HTTP request object
 * @param {SupabaseClient} supabase - Supabase client instance
 * @param {Object|null} user - Authenticated user object
 * @param {Error|null} authError - Authentication error if any
 * @returns {Response} JSON response with invoice details
 * 
 * @throws {Error} Unauthorized access (401)
 * @throws {Error} Invoice not found (404)
 * @throws {Error} Database query errors (500)
 * 
 * URL Parameters:
 * - identifier: Invoice number (e.g., "INV-2024-01-15-0001") or UUID
 * 
 * Query Parameters:
 * - include_items: "true" to include invoice items (default: true)
 * - include_order: "true" to include linked order details (default: false)
 * 
 * Response Format:
 * {
 *   "id": "invoice_uuid",
 *   "invoice_number": "INV-2024-01-15-0001",
 *   "order_id": "order_uuid",
 *   "order_code": "ORD-A1B2C3D4",
 *   "invoice_type": "online",
 *   "status": "paid",
 *   "customer_name": "John Smith",
 *   "customer_email": "john@example.com",
 *   "customer_phone": "+1234567890",
 *   "customer_address": "123 Main St, City, State",
 *   "subtotal": 150.00,
 *   "tax_amount": 15.00,
 *   "tax_rate": 10.00,
 *   "discount_amount": 10.00,
 *   "shipping_amount": 5.00,
 *   "total_amount": 160.00,
 *   "payment_method": "card",
 *   "payment_status": "paid",
 *   "payment_date": "2024-01-15T14:30:00Z",
 *   "payment_reference": "txn_123456789",
 *   "invoice_date": "2024-01-15T10:00:00Z",
 *   "due_date": "2024-02-14T10:00:00Z",
 *   "notes": "Thank you for your business",
 *   "internal_notes": "Customer called about delivery",
 *   "created_at": "2024-01-15T10:00:00Z",
 *   "updated_at": "2024-01-15T14:30:00Z",
 *   "items": [
 *     {
 *       "id": "item_uuid",
 *       "sku": "PERFUME-001",
 *       "product_name": "Luxury Perfume",
 *       "product_name_ar": "عطر فاخر",
 *       "quantity": 2,
 *       "unit_price": 75.00,
 *       "total_price": 150.00,
 *       "size": "50ml",
 *       "color": null
 *     }
 *   ]
 * }
 * 
 * Usage Examples:
 * 
 * 1. Get invoice by invoice number:
 * curl -X GET "https://your-project.supabase.co/functions/v1/invoices/INV-2024-01-15-0001" \
 *   -H "Authorization: Bearer YOUR_JWT_TOKEN"
 * 
 * 2. Get invoice by ID with order details:
 * curl -X GET "https://your-project.supabase.co/functions/v1/invoices/123e4567-e89b-12d3-a456-426614174000?include_order=true" \
 *   -H "Authorization: Bearer YOUR_JWT_TOKEN"
 * 
 * 3. Get invoice without items:
 * curl -X GET "https://your-project.supabase.co/functions/v1/invoices/INV-2024-01-15-0001?include_items=false" \
 *   -H "Authorization: Bearer YOUR_JWT_TOKEN"
 * 
 * Error Responses:
 * 
 * Unauthorized access (401):
 * {
 *   "error": "Unauthorized"
 * }
 * 
 * Invoice not found (404):
 * {
 *   "error": "Invoice not found"
 * }
 * 
 * Invalid identifier format (400):
 * {
 *   "error": "Invalid invoice identifier"
 * }
 * 
 * Notes:
 * - Supports both invoice number (INV-YYYY-MM-DD-XXXX) and UUID identification
 * - Returns comprehensive invoice data including calculated totals
 * - Item details include product snapshots at time of invoice creation
 * - Payment information tracks transaction history
 * - Internal notes are visible only to authenticated staff
 * - Order linking provides audit trail from order to invoice
 */
export async function handleGetInvoice(req, supabase, user, authError) {
  if (authError || !user) throw new Error("Unauthorized");
  
  const url = new URL(req.url);
  const identifier = url.pathname.split('/').pop();
  const includeItems = url.searchParams.get('include_items') !== 'false';
  const includeOrder = url.searchParams.get('include_order') === 'true';
  
  if (!identifier) {
    return json({ error: "Invoice identifier is required" }, 400);
  }
  
  // Build query based on identifier type (UUID or invoice number)
  let query = supabase.from('invoices').select(`
    id,
    invoice_number,
    order_id,
    order_code,
    invoice_type,
    status,
    customer_name,
    customer_email,
    customer_phone,
    customer_address,
    subtotal,
    tax_amount,
    tax_rate,
    discount_amount,
    shipping_amount,
    total_amount,
    payment_method,
    payment_status,
    payment_date,
    payment_reference,
    invoice_date,
    due_date,
    notes,
    internal_notes,
    created_at,
    updated_at,
    created_by,
    updated_by
    ${includeOrder ? ',order:orders(id,order_code,status,total_price,created_at,user_id)' : ''}
  `).eq('is_deleted', false);
  
  // Check if identifier is UUID format
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (uuidRegex.test(identifier)) {
    query = query.eq('id', identifier);
  } else {
    query = query.eq('invoice_number', identifier);
  }
  
  const { data: invoice, error } = await query.maybeSingle();
  
  if (error) throw error;
  if (!invoice) {
    return json({ error: "Invoice not found" }, 404);
  }
  
  // Get invoice items if requested
  if (includeItems) {
    const { data: items, error: itemsError } = await supabase
      .from('invoice_items')
      .select(`
        id,
        sku,
        product_name,
        product_name_ar,
        quantity,
        unit_price,
        total_price,
        size,
        color,
        created_at
      `)
      .eq('invoice_id', invoice.id)
      .eq('is_deleted', false)
      .order('created_at', { ascending: true });
    
    if (itemsError) throw itemsError;
    
    invoice.items = items || [];
  }
  
  return json(invoice);
}

/**
 * Handle listing invoices with pagination and filtering.
 * Supports filtering by status, date range, customer, and payment status.
 * 
 * @param {Request} req - HTTP request object containing filter criteria
 * @param {SupabaseClient} supabase - Supabase client instance
 * @param {Object|null} user - Authenticated user object
 * @param {Error|null} authError - Authentication error if any
 * @returns {Response} JSON response with paginated invoice list
 * 
 * @throws {Error} Unauthorized access (401)
 * @throws {Error} Invalid filter parameters (400)
 * @throws {Error} Database query errors (500)
 * 
 * Request Body:
 * {
 *   "page": 1,                           // Page number (optional, default: 1)
 *   "page_size": 20,                     // Items per page (optional, default: 20)
 *   "status": "paid",                    // Invoice status filter (optional)
 *   "payment_status": "paid",            // Payment status filter (optional)
 *   "invoice_type": "online",            // Invoice type filter (optional)
 *   "customer_email": "john@example.com", // Customer email filter (optional)
 *   "date_from": "2024-01-01",           // Start date filter (optional)
 *   "date_to": "2024-01-31",             // End date filter (optional)
 *   "order_code": "ORD-A1B2C3D4",        // Linked order code filter (optional)
 *   "sort_by": "invoice_date",           // Sort field (optional, default: created_at)
 *   "sort_order": "desc"                 // Sort direction (optional, default: desc)
 * }
 * 
 * Response Format:
 * {
 *   "data": [
 *     {
 *       "id": "invoice_uuid",
 *       "invoice_number": "INV-2024-01-15-0001",
 *       "order_code": "ORD-A1B2C3D4",
 *       "invoice_type": "online",
 *       "status": "paid",
 *       "customer_name": "John Smith",
 *       "customer_email": "john@example.com",
 *       "total_amount": 160.00,
 *       "payment_status": "paid",
 *       "payment_date": "2024-01-15T14:30:00Z",
 *       "invoice_date": "2024-01-15T10:00:00Z",
 *       "due_date": "2024-02-14T10:00:00Z",
 *       "created_at": "2024-01-15T10:00:00Z"
 *     }
 *   ],
 *   "pagination": {
 *     "page": 1,
 *     "page_size": 20,
 *     "total": 45,
 *     "total_pages": 3
 *   }
 * }
 * 
 * Usage Examples:
 * 
 * 1. List all invoices (first page):
 * curl -X POST "https://your-project.supabase.co/functions/v1/invoices/list" \
 *   -H "Content-Type: application/json" \
 *   -H "Authorization: Bearer YOUR_JWT_TOKEN" \
 *   -d '{}'
 * 
 * 2. Filter paid invoices from specific month:
 * curl -X POST "https://your-project.supabase.co/functions/v1/invoices/list" \
 *   -H "Content-Type: application/json" \
 *   -H "Authorization: Bearer YOUR_JWT_TOKEN" \
 *   -d '{
 *     "status": "paid",
 *     "date_from": "2024-01-01",
 *     "date_to": "2024-01-31",
 *     "page_size": 50
 *   }'
 * 
 * 3. Search by customer email:
 * curl -X POST "https://your-project.supabase.co/functions/v1/invoices/list" \
 *   -H "Content-Type: application/json" \
 *   -H "Authorization: Bearer YOUR_JWT_TOKEN" \
 *   -d '{
 *     "customer_email": "john@example.com",
 *     "sort_by": "invoice_date",
 *     "sort_order": "asc"
 *   }'
 */
export async function handleListInvoices(req, supabase, user, authError) {
  if (authError || !user) throw new Error("Unauthorized");
  
  const body = await req.json();
  const {
    page = 1,
    page_size = 20,
    status,
    payment_status,
    invoice_type,
    customer_email,
    date_from,
    date_to,
    order_code,
    sort_by = 'created_at',
    sort_order = 'desc'
  } = body;
  
  const from = (page - 1) * page_size;
  const to = from + page_size - 1;
  
  let query = supabase
    .from('invoices')
    .select(`
      id,
      invoice_number,
      order_code,
      invoice_type,
      status,
      customer_name,
      customer_email,
      total_amount,
      payment_status,
      payment_date,
      invoice_date,
      due_date,
      created_at
    `, { count: 'exact' })
    .eq('is_deleted', false);
  
  // Apply filters
  if (status) query = query.eq('status', status);
  if (payment_status) query = query.eq('payment_status', payment_status);
  if (invoice_type) query = query.eq('invoice_type', invoice_type);
  if (customer_email) query = query.ilike('customer_email', `%${customer_email}%`);
  if (order_code) query = query.eq('order_code', order_code);
  
  // Date range filters
  if (date_from) query = query.gte('invoice_date', date_from);
  if (date_to) query = query.lte('invoice_date', date_to);
  
  // Apply sorting and pagination
  const ascending = sort_order === 'asc';
  query = query.order(sort_by, { ascending }).range(from, to);
  
  const { data, count, error } = await query;
  
  if (error) throw error;
  
  return json({
    data: data || [],
    pagination: {
      page,
      page_size,
      total: count || 0,
      total_pages: Math.ceil((count || 0) / page_size)
    }
  });
}

/**
 * Handle advanced invoice filtering with complex criteria.
 * Supports multiple filter combinations and search across invoice data.
 * 
 * @param {Request} req - HTTP request object containing advanced filter criteria
 * @param {SupabaseClient} supabase - Supabase client instance
 * @param {Object|null} user - Authenticated user object
 * @param {Error|null} authError - Authentication error if any
 * @returns {Response} JSON response with filtered invoice results
 * 
 * Request Body:
 * {
 *   "search": "John Smith",              // Search across customer name, email, invoice number
 *   "amount_min": 100.00,                // Minimum total amount
 *   "amount_max": 1000.00,               // Maximum total amount
 *   "overdue_only": true,                // Show only overdue invoices
 *   "unpaid_only": false,                // Show only unpaid invoices
 *   "has_order": true,                   // Filter by whether invoice is linked to an order
 *   "created_by": "admin@example.com",   // Filter by creator
 *   "page": 1,
 *   "page_size": 20
 * }
 */
export async function handleFilterInvoices(req, supabase, user, authError) {
  if (authError || !user) throw new Error("Unauthorized");
  
  const body = await req.json();
  const {
    search,
    amount_min,
    amount_max,
    overdue_only,
    unpaid_only,
    has_order,
    created_by,
    page = 1,
    page_size = 20
  } = body;
  
  const from = (page - 1) * page_size;
  const to = from + page_size - 1;
  
  let query = supabase
    .from('invoices')
    .select(`
      id,
      invoice_number,
      order_code,
      invoice_type,
      status,
      customer_name,
      customer_email,
      total_amount,
      payment_status,
      payment_date,
      invoice_date,
      due_date,
      created_at
    `, { count: 'exact' })
    .eq('is_deleted', false);
  
  // Text search across multiple fields
  if (search) {
    query = query.or(`customer_name.ilike.%${search}%,customer_email.ilike.%${search}%,invoice_number.ilike.%${search}%`);
  }
  
  // Amount range filters
  if (amount_min) query = query.gte('total_amount', amount_min);
  if (amount_max) query = query.lte('total_amount', amount_max);
  
  // Special filters
  if (overdue_only) {
    query = query.lt('due_date', new Date().toISOString()).neq('payment_status', 'paid');
  }
  
  if (unpaid_only) {
    query = query.neq('payment_status', 'paid');
  }
  
  if (has_order !== undefined) {
    if (has_order) {
      query = query.not('order_id', 'is', null);
    } else {
      query = query.is('order_id', null);
    }
  }
  
  if (created_by) {
    query = query.eq('created_by', created_by);
  }
  
  // Apply pagination
  query = query.order('created_at', { ascending: false }).range(from, to);
  
  const { data, count, error } = await query;
  
  if (error) throw error;
  
  return json({
    data: data || [],
    pagination: {
      page,
      page_size,
      total: count || 0,
      total_pages: Math.ceil((count || 0) / page_size)
    }
  });
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    headers: { "Content-Type": "application/json" },
    status
  });
}
