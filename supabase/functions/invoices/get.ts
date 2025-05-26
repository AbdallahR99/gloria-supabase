// File: functions/invoices/get.js

export async function handleGetInvoice(req, supabase, user, authError) {
  if (authError || !user) throw new Error("Unauthorized");
  
  const url = new URL(req.url);
  const pathParts = url.pathname.split('/');
  const invoiceId = pathParts[pathParts.length - 1];
  
  if (!invoiceId) {
    return json({ message: "Invoice ID is required" }, 400);
  }

  // Get invoice with related data (no external FK dependencies in new invoices module)
  const { data: invoice, error: invoiceError } = await supabase
    .from("invoices")
    .select(`
      *,
      invoice_items(*)
    `)
    .eq("id", invoiceId)
    .eq("is_deleted", false)
    .single();

  if (invoiceError) {
    console.error("Error fetching invoice:", invoiceError);
    throw invoiceError;
  }

  if (!invoice) {
    return json({ message: "Invoice not found" }, 404);
  }

  // Check if user can access this invoice (own invoice or staff)
  if (invoice.user_id !== user.id) {
    // TODO: Add staff role check here if needed
    throw new Error("Unauthorized to access this invoice");
  }

  return json({ data: invoice });
}

export async function handleGetInvoiceByCode(req, supabase, user, authError) {
  if (authError || !user) throw new Error("Unauthorized");
  
  const url = new URL(req.url);
  const pathParts = url.pathname.split('/');
  const invoiceCode = pathParts[pathParts.length - 1];
  
  if (!invoiceCode) {
    return json({ message: "Invoice code is required" }, 400);
  }

  // Get invoice with related data by invoice_code
  const { data: invoice, error: invoiceError } = await supabase
    .from("invoices")
    .select(`
      *,
      invoice_items(*)
    `)
    .eq("invoice_code", invoiceCode)
    .eq("is_deleted", false)
    .single();

  if (invoiceError) {
    console.error("Error fetching invoice by code:", invoiceError);
    throw invoiceError;
  }

  if (!invoice) {
    return json({ message: "Invoice not found" }, 404);
  }

  // Check if user can access this invoice (own invoice or staff)
  if (invoice.user_id !== user.id) {
    // TODO: Add staff role check here if needed
    throw new Error("Unauthorized to access this invoice");
  }

  return json({ data: invoice });
}

export async function handleListInvoices(req, supabase, user, authError) {
  if (authError || !user) throw new Error("Unauthorized");
  
  const url = new URL(req.url);
  const params = url.searchParams;
  
  // Parse query parameters
  const page = parseInt(params.get('page') || '1');
  const limit = Math.min(parseInt(params.get('limit') || '10'), 100);
  const offset = (page - 1) * limit;
  const payment_status = params.get('payment_status');
  const order_code = params.get('order_code');
  const start_date = params.get('start_date');
  const end_date = params.get('end_date');
  const user_id = params.get('user_id'); // For staff to query specific users    let query = supabase
    .from("invoices")
    .select(`
      *,
      invoice_items(
        id,
        product_sku,
        product_name_en,
        product_name_ar,
        quantity,
        unit_price,
        total_price,
        size,
        color
      )
    `, { count: 'exact' })
    .eq("is_deleted", false)
    .order('created_at', { ascending: false });

  // Filter by user (own invoices unless staff queries for specific user)
  const targetUserId = user_id || user.id;
  query = query.eq("user_id", targetUserId);

  // Apply filters
  if (payment_status) {
    query = query.eq("payment_status", payment_status);
  }
  
  if (order_code) {
    query = query.eq("order_code", order_code);
  }
  
  if (start_date) {
    query = query.gte("invoice_date", start_date);
  }
  
  if (end_date) {
    query = query.lte("invoice_date", end_date);
  }

  // Apply pagination
  query = query.range(offset, offset + limit - 1);

  const { data: invoices, error: invoicesError, count } = await query;

  if (invoicesError) {
    console.error("Error fetching invoices:", invoicesError);
    throw invoicesError;
  }

  // Calculate pagination info
  const totalPages = Math.ceil((count || 0) / limit);
  const hasNextPage = page < totalPages;
  const hasPrevPage = page > 1;

  return json({
    data: invoices,
    pagination: {
      page,
      limit,
      total: count,
      totalPages,
      hasNextPage,
      hasPrevPage
    }
  });
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
    },
  });
}
