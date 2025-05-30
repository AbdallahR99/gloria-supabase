/**
 * Voucher Deletion Handler
 * File: functions/vouchers/delete.ts
 * 
 * This file handles the deletion of vouchers in the e-commerce system.
 * It implements hard deletion since vouchers don't require soft delete functionality.
 * 
 * Features:
 * - Hard deletion of vouchers
 * - Voucher existence validation
 * - No authentication required
 * - Comprehensive error handling
 */

// Helper function to create JSON response
function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" }
  });
}

/**
 * Handles the deletion of an existing voucher
 * 
 * @param {Request} req - The HTTP request object containing voucher identifier
 * @param {SupabaseClient} supabase - Supabase client instance for database operations
 * @param {User|null} user - Authenticated user object (optional)
 * @param {Error|null} authError - Authentication error if any
 * @returns {Response} JSON response with deletion confirmation or error
 */
export async function handleDeleteVoucher(req, supabase, user, authError) {
  try {
    // No authentication required
    
    // Parse the request body to get voucher identifier
    const body = await req.json();
    
    // Validate required voucher identifier
    if (!body.id && !body.voucher_code) {
      return json({
        error: "Voucher ID or voucher_code is required"
      }, 400);
    }
    
    // First, verify the voucher exists
    let existingVoucher;
    
    if (body.id) {
      // Check by ID
      const { data, error } = await supabase
        .from('vouchers')
        .select('id, voucher_code, user_name, user_email')
        .eq('id', body.id)
        .single();
      
      if (error && error.code === 'PGRST116') {
        return json({
          error: "Voucher not found"
        }, 404);
      }
      
      if (error) throw error;
      existingVoucher = data;
    } else {
      // Check by voucher code
      const { data, error } = await supabase
        .from('vouchers')
        .select('id, voucher_code, user_name, user_email')
        .eq('voucher_code', body.voucher_code)
        .single();
      
      if (error && error.code === 'PGRST116') {
        return json({
          error: "Voucher not found"
        }, 404);
      }
      
      if (error) throw error;
      existingVoucher = data;
    }
    
    // Store voucher information for response
    const deletedVoucherInfo = {
      id: existingVoucher.id,
      voucher_code: existingVoucher.voucher_code,
      user_name: existingVoucher.user_name,
      user_email: existingVoucher.user_email
    };
    
    // Perform hard deletion
    const { error: deleteError } = await supabase
      .from('vouchers')
      .delete()
      .eq('id', existingVoucher.id);
    
    if (deleteError) {
      throw deleteError;
    }
    
    return json({
      success: true,
      message: "Voucher deleted successfully",
      data: {
        deleted_voucher: deletedVoucherInfo,
        deleted_at: new Date().toISOString()
      }
    });
    
  } catch (error) {
    console.error('Error deleting voucher:', error);
    
    // Handle specific database errors
    if (error.code === '23503') {
      return json({
        error: "Cannot delete voucher: it is referenced by other records"
      }, 409);
    }
    
    return json({
      error: "Failed to delete voucher",
      details: error.message
    }, 500);
  }
}
