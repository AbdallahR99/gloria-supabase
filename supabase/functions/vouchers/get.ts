/**
 * Voucher Retrieval Handlers
 * File: functions/vouchers/get.ts
 * 
 * This file contains all voucher retrieval operations including:
 * - Single voucher retrieval by ID or code
 * - Voucher listing with pagination and filtering
 * - No authentication required
 * 
 * Features:
 * - Voucher code and ID lookup
 * - Pagination support
 * - Advanced filtering options
 * - Search by user information
 */

// Helper function to create JSON response
function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" }
  });
}

/**
 * Retrieves a single voucher by ID or voucher code
 * 
 * @param {Request} req - HTTP request object with voucher_id or voucher_code parameter
 * @param {SupabaseClient} supabase - Supabase client instance
 * @param {User|null} user - Authenticated user (optional)
 * @param {Error|null} authError - Authentication error if any
 * @returns {Response} JSON response with voucher data
 */
export async function handleGetVoucher(req, supabase, user, authError) {
  try {
    // No authentication required
    
    const url = new URL(req.url);
    const voucherId = url.searchParams.get("voucher_id");
    const voucherCode = url.searchParams.get("voucher_code");
    
    // Validate required parameters
    if (!voucherId && !voucherCode) {
      return json({
        error: "Voucher ID or voucher code parameter is required"
      }, 400);
    }
    
    let query = supabase
      .from('vouchers')
      .select('*');
    
    if (voucherId) {
      query = query.eq('id', voucherId);
    } else {
      query = query.eq('voucher_code', voucherCode);
    }
    
    const { data, error } = await query.single();
    
    if (error) {
      if (error.code === 'PGRST116') {
        return json({
          error: "Voucher not found"
        }, 404);
      }
      throw error;
    }
    
    return json(data);
    
  } catch (error) {
    console.error('Error retrieving voucher:', error);
    return json({
      error: "Failed to retrieve voucher",
      details: error.message
    }, 500);
  }
}

/**
 * Retrieves multiple vouchers with pagination and filtering
 * 
 * @param {Request} req - HTTP request object with optional query parameters
 * @param {SupabaseClient} supabase - Supabase client instance
 * @param {User|null} user - Authenticated user (optional)
 * @param {Error|null} authError - Authentication error if any
 * @returns {Response} JSON response with vouchers array and pagination info
 */
export async function handleListVouchers(req, supabase, user, authError) {
  try {
    // No authentication required
    
    const url = new URL(req.url);
    
    // Pagination parameters
    const page = parseInt(url.searchParams.get("page") || "1");
    const limit = Math.min(parseInt(url.searchParams.get("limit") || "20"), 100);
    const offset = (page - 1) * limit;
    
    // Filter parameters
    const userEmail = url.searchParams.get("user_email");
    const userPhone = url.searchParams.get("user_phone");
    const userName = url.searchParams.get("user_name");
    const voucherCode = url.searchParams.get("voucher_code");
    const createdBy = url.searchParams.get("created_by");
    
    // Date range filtering
    const createdAfter = url.searchParams.get("created_after");
    const createdBefore = url.searchParams.get("created_before");
    
    // Search parameter for general text search
    const search = url.searchParams.get("search");
    
    // Sorting
    const sortBy = url.searchParams.get("sort_by") || "created_at";
    const sortOrder = url.searchParams.get("sort_order") || "desc";
    
    // Handle POST request for complex filtering
    let filters = {};
    if (req.method === 'POST') {
      try {
        const body = await req.json();
        filters = body.filters || {};
      } catch (e) {
        // If JSON parsing fails, continue with URL parameters
      }
    }
    
    // Build the query
    let query = supabase
      .from('vouchers')
      .select('*', { count: 'exact' });
    
    // Apply filters from URL parameters
    if (userEmail) {
      query = query.ilike('user_email', `%${userEmail}%`);
    }
    
    if (userPhone) {
      query = query.ilike('user_phone', `%${userPhone}%`);
    }
    
    if (userName) {
      query = query.ilike('user_name', `%${userName}%`);
    }
    
    if (voucherCode) {
      query = query.ilike('voucher_code', `%${voucherCode}%`);
    }
    
    if (createdBy) {
      query = query.ilike('created_by', `%${createdBy}%`);
    }
    
    // Date range filtering
    if (createdAfter) {
      query = query.gte('created_at', createdAfter);
    }
    
    if (createdBefore) {
      query = query.lte('created_at', createdBefore);
    }
    
    // Apply filters from POST body
    if (filters.user_email) {
      query = query.ilike('user_email', `%${filters.user_email}%`);
    }
    
    if (filters.user_phone) {
      query = query.ilike('user_phone', `%${filters.user_phone}%`);
    }
    
    if (filters.user_name) {
      query = query.ilike('user_name', `%${filters.user_name}%`);
    }
    
    if (filters.voucher_code) {
      query = query.ilike('voucher_code', `%${filters.voucher_code}%`);
    }
    
    if (filters.created_by) {
      query = query.ilike('created_by', `%${filters.created_by}%`);
    }
    
    if (filters.created_after) {
      query = query.gte('created_at', filters.created_after);
    }
    
    if (filters.created_before) {
      query = query.lte('created_at', filters.created_before);
    }
    
    // General search across multiple fields
    if (search) {
      query = query.or(`user_name.ilike.%${search}%,user_email.ilike.%${search}%,user_phone.ilike.%${search}%,voucher_code.ilike.%${search}%,notes.ilike.%${search}%`);
    }
    
    // Apply search from POST body
    if (filters.search) {
      query = query.or(`user_name.ilike.%${filters.search}%,user_email.ilike.%${filters.search}%,user_phone.ilike.%${filters.search}%,voucher_code.ilike.%${filters.search}%,notes.ilike.%${filters.search}%`);
    }
    
    // Apply sorting
    const validSortFields = ['created_at', 'user_name', 'user_email', 'voucher_code'];
    const actualSortBy = validSortFields.includes(sortBy) ? sortBy : 'created_at';
    const actualSortOrder = ['asc', 'desc'].includes(sortOrder) ? sortOrder : 'desc';
    
    query = query.order(actualSortBy, { ascending: actualSortOrder === 'asc' });
    
    // Apply pagination
    query = query.range(offset, offset + limit - 1);
    
    const { data, error, count } = await query;
    
    if (error) {
      throw error;
    }
    
    // Calculate pagination metadata
    const totalPages = Math.ceil((count || 0) / limit);
    const hasNextPage = page < totalPages;
    const hasPreviousPage = page > 1;
    
    return json({
      success: true,
      data: data || [],
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages,
        hasNextPage,
        hasPreviousPage
      }
    });
    
  } catch (error) {
    console.error('Error listing vouchers:', error);
    return json({
      error: "Failed to retrieve vouchers",
      details: error.message
    }, 500);
  }
}
