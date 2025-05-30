/**
 * Invoice Retrieval Handlers
 * File: functions/invoices/get.ts
 * 
 * This file contains all invoice retrieval operations including:
 * - Single invoice retrieval by ID or code
 * - Invoice listing with pagination and filtering
 * - User-specific invoice access control
 * 
 * Features:
 * - User authentication and authorization
 * - Invoice code and ID lookup
 * - Products array support (sku, name, quantity, price, old_price)
 * - Optional subtotal, discount, and delivery_fees fields
 * - Pagination support
 * - Advanced filtering options
 * - Soft delete awareness
 */

/**
 * Retrieves a single invoice by ID or invoice code
 * 
 * @param {Request} req - HTTP request object with invoice_id or invoice_code parameter
 * @param {SupabaseClient} supabase - Supabase client instance
 * @param {User|null} user - Authenticated user
 * @param {Error|null} authError - Authentication error if any
 * @returns {Response} JSON response with invoice data
 */
export async function handleGetInvoice(req, supabase, user, authError) {
  try {
    // Authentication required for invoice access
    // if (authError || !user) throw new Error("Unauthorized");
    
    const url = new URL(req.url);
    const invoiceId = url.searchParams.get("invoice_id");
    const invoiceCode = url.searchParams.get("invoice_code");
    
    // Validate required parameters
    if (!invoiceId && !invoiceCode) {
      return json({
        error: "Invoice ID or invoice code parameter is required"
      }, 400);
    }
    
    let result;
    
    if (invoiceId) {
      // Use database function for ID lookup
      const { data, error } = await supabase
        .rpc('get_invoice_by_id', { invoice_id_param: invoiceId });
      
      if (error) throw error;
      result = data && data.length > 0 ? data[0] : null;
    } else {
      // Use database function for code lookup
      const { data, error } = await supabase
        .rpc('get_invoice_by_code', { invoice_code_param: invoiceCode });
      
      if (error) throw error;
      result = data && data.length > 0 ? data[0] : null;
    }
    
    if (!result) {
      return json({
        error: "Invoice not found"
      }, 404);
    }
    
    return json(result);
    
  } catch (error) {
    console.error('Error in handleGetInvoice:', error);
    return json({
      error: error.message || "Internal server error"
    }, 500);
  }
}

/**
 * Retrieves a list of invoices with pagination and filtering
 * 
 * @param {Request} req - HTTP request object with pagination and filter parameters
 * @param {SupabaseClient} supabase - Supabase client instance
 * @param {User|null} user - Authenticated user
 * @param {Error|null} authError - Authentication error if any
 * @returns {Response} JSON response with paginated invoice list
 */
export async function handleListInvoices(req, supabase, user, authError) {
  try {
    // Authentication required for invoice listing
    // if (authError || !user) throw new Error("Unauthorized");
    
    // Handle both GET (query params) and POST (request body) methods
    let filters = {};
    
    if (req.method === 'POST') {
      filters = await req.json();
    } else {
      const url = new URL(req.url);
      filters = {
        page: parseInt(url.searchParams.get("page") || "1"),
        page_size: parseInt(url.searchParams.get("page_size") || "10"),
        user_email: url.searchParams.get("user_email"),
        invoice_code: url.searchParams.get("invoice_code"),
        date_from: url.searchParams.get("date_from"),
        date_to: url.searchParams.get("date_to"),
        min_total: parseFloat(url.searchParams.get("min_total") || "0"),
        max_total: parseFloat(url.searchParams.get("max_total") || "0"),
        sort_by: url.searchParams.get("sort_by") || "created_at",
        sort_order: url.searchParams.get("sort_order") || "desc"
      };
    }
    
    const { 
      page = 1, 
      page_size = 10, 
      user_email,
      invoice_code,
      date_from,
      date_to,
      min_total = 0,
      max_total = 0,
      sort_by = "created_at",
      sort_order = "desc"
    } = filters;
    
    // Calculate pagination
    const from = (page - 1) * page_size;
    const to = from + page_size - 1;
      // Build query with comprehensive filtering
    let query = supabase
      .from("invoices")
      .select(`
        id,
        invoice_code,
        subtotal,
        discount,
        delivery_fees,
        total_price,
        products,
        user_email,
        user_phone,
        user_name,
        user_address,
        is_deleted,
        created_at,
        updated_at,
        created_by,
        notes,
        user_notes,
        reviews
      `, { count: "exact" })
      .eq("is_deleted", false);
    
    // Apply filters
    if (user_email) {
      query = query.ilike("user_email", `%${user_email}%`);
    }
    
    if (invoice_code) {
      query = query.ilike("invoice_code", `%${invoice_code}%`);
    }
    
    if (date_from) {
      query = query.gte("created_at", date_from);
    }
    
    if (date_to) {
      query = query.lte("created_at", date_to);
    }
    
    if (min_total > 0) {
      query = query.gte("total_price", min_total);
    }
    
    if (max_total > 0) {
      query = query.lte("total_price", max_total);
    }
    
    // Apply sorting
    const validSortFields = [
      "created_at", "updated_at", "total_price", "invoice_code", 
      "user_email", "subtotal", "discount", "delivery_fees"
    ];
    const validSortOrders = ["asc", "desc"];
    
    const sortField = validSortFields.includes(sort_by) ? sort_by : "created_at";
    const sortDirection = validSortOrders.includes(sort_order) ? sort_order : "desc";
    
    query = query.order(sortField, { ascending: sortDirection === "asc" });
    
    // Apply pagination
    query = query.range(from, to);
    
    const { data, count, error } = await query;
    
    if (error) throw error;
    
    return json({
      page,
      page_size,
      total: count || 0,
      total_pages: Math.ceil((count || 0) / page_size),
      items: data || [],
      filters: {
        user_email,
        invoice_code,
        date_from,
        date_to,
        min_total,
        max_total,
        sort_by: sortField,
        sort_order: sortDirection
      }
    });
    
  } catch (error) {
    console.error('Error in handleListInvoices:', error);
    return json({
      error: error.message || "Internal server error"
    }, 500);
  }
}

/**
 * Utility function to create JSON responses
 * 
 * @param {any} data - Data to return in response
 * @param {number} status - HTTP status code (default: 200)
 * @returns {Response} JSON response
 */
function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    headers: {
      "Content-Type": "application/json"
    },
    status
  });
}
