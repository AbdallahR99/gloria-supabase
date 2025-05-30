/**
 * Voucher Bulk Operations Handlers
 * File: functions/vouchers/bulk.ts
 * 
 * This file handles bulk operations for vouchers in the e-commerce system.
 * It includes bulk creation and bulk deletion with comprehensive validation
 * and error handling for each operation.
 * 
 * Features:
 * - Bulk voucher creation with individual validation
 * - Bulk voucher deletion (hard delete)
 * - Transaction-like error handling
 * - Detailed success/failure reporting
 * - Voucher code generation and validation
 * - No authentication required
 */

// Helper function to create JSON response
function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" }
  });
}

/**
 * Generates a unique voucher code
 * 
 * @param {SupabaseClient} supabase - Supabase client instance
 * @returns {Promise<string>} Unique voucher code
 */
async function generateUniqueVoucherCode(supabase) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let attempts = 0;
  const maxAttempts = 10;
  
  while (attempts < maxAttempts) {
    // Generate random code (format: VOC-XXXXXX)
    let code = 'VOC-';
    for (let i = 0; i < 6; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    
    // Check if code already exists
    const { data, error } = await supabase
      .from('vouchers')
      .select('voucher_code')
      .eq('voucher_code', code)
      .single();
    
    if (error && error.code === 'PGRST116') {
      // Code doesn't exist, we can use it
      return code;
    }
    
    if (error && error.code !== 'PGRST116') {
      throw error;
    }
    
    attempts++;
  }
  
  throw new Error('Failed to generate unique voucher code after maximum attempts');
}

/**
 * Handles bulk creation of vouchers
 * 
 * @param {Request} req - The HTTP request object containing array of voucher data
 * @param {SupabaseClient} supabase - Supabase client instance for database operations
 * @param {User|null} user - Authenticated user object (optional)
 * @param {Error|null} authError - Authentication error if any
 * @returns {Response} JSON response with bulk creation results
 */
export async function handleBulkCreateVouchers(req, supabase, user, authError) {
  try {
    // No authentication required
    
    // Parse the request body to get vouchers array
    const body = await req.json();
    
    // Validate request structure
    if (!body.vouchers || !Array.isArray(body.vouchers)) {
      return json({
        error: "Request must contain 'vouchers' array"
      }, 400);
    }
    
    if (body.vouchers.length === 0) {
      return json({
        error: "Vouchers array cannot be empty"
      }, 400);
    }
    
    if (body.vouchers.length > 100) {
      return json({
        error: "Maximum 100 vouchers allowed per bulk operation"
      }, 400);
    }
    
    const results = {
      successful: [],
      failed: [],
      total: body.vouchers.length,
      successful_count: 0,
      failed_count: 0
    };
    
    // Process each voucher individually
    for (let i = 0; i < body.vouchers.length; i++) {
      const voucherData = body.vouchers[i];
      
      try {
        // Validate voucher data
        const validationErrors = [];
        
        // Validate voucher_code if provided
        if (voucherData.voucher_code) {
          if (typeof voucherData.voucher_code !== 'string' || voucherData.voucher_code.trim().length === 0) {
            validationErrors.push("voucher_code must be a non-empty string");
          } else {
            // Check if voucher code already exists
            const { data: existingVoucher, error: checkError } = await supabase
              .from('vouchers')
              .select('voucher_code')
              .eq('voucher_code', voucherData.voucher_code.trim())
              .single();
            
            if (checkError && checkError.code !== 'PGRST116') {
              throw checkError;
            }
            
            if (existingVoucher) {
              validationErrors.push("Voucher code already exists");
            }
          }
        }
        
        // Validate optional fields
        if (voucherData.user_name !== undefined && voucherData.user_name !== null) {
          if (typeof voucherData.user_name !== 'string') {
            validationErrors.push("user_name must be a string");
          }
        }
        
        if (voucherData.user_email !== undefined && voucherData.user_email !== null) {
          if (typeof voucherData.user_email !== 'string') {
            validationErrors.push("user_email must be a string");
          } else if (voucherData.user_email.trim().length > 0) {
            // Basic email validation
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(voucherData.user_email.trim())) {
              validationErrors.push("user_email must be a valid email address");
            }
          }
        }
        
        if (voucherData.user_phone !== undefined && voucherData.user_phone !== null) {
          if (typeof voucherData.user_phone !== 'string') {
            validationErrors.push("user_phone must be a string");
          }
        }
        
        if (voucherData.notes !== undefined && voucherData.notes !== null) {
          if (typeof voucherData.notes !== 'string') {
            validationErrors.push("notes must be a string");
          }
        }
        
        if (voucherData.created_by !== undefined && voucherData.created_by !== null) {
          if (typeof voucherData.created_by !== 'string') {
            validationErrors.push("created_by must be a string");
          }
        }
        
        if (validationErrors.length > 0) {
          results.failed.push({
            index: i,
            data: voucherData,
            error: "Validation failed",
            details: validationErrors
          });
          results.failed_count++;
          continue;
        }
        
        // Prepare voucher data for insertion
        const preparedVoucherData = {
          voucher_code: voucherData.voucher_code?.trim() || await generateUniqueVoucherCode(supabase),
          user_name: voucherData.user_name?.trim() || null,
          user_email: voucherData.user_email?.trim() || null,
          user_phone: voucherData.user_phone?.trim() || null,
          notes: voucherData.notes?.trim() || null,
          created_by: voucherData.created_by?.trim() || (user ? user.email : null)
        };
        
        // Insert the voucher
        const { data, error } = await supabase
          .from('vouchers')
          .insert([preparedVoucherData])
          .select()
          .single();
        
        if (error) {
          // Handle specific database errors
          if (error.code === '23505') {
            results.failed.push({
              index: i,
              data: voucherData,
              error: "Voucher code already exists"
            });
          } else {
            results.failed.push({
              index: i,
              data: voucherData,
              error: error.message
            });
          }
          results.failed_count++;
          continue;
        }
        
        results.successful.push({
          index: i,
          original_data: voucherData,
          created_data: data
        });
        results.successful_count++;
        
      } catch (error) {
        console.error(`Error processing voucher at index ${i}:`, error);
        results.failed.push({
          index: i,
          data: voucherData,
          error: error.message
        });
        results.failed_count++;
      }
    }
    
    const statusCode = results.failed_count > 0 ? (results.successful_count > 0 ? 207 : 400) : 201;
    
    return json({
      success: results.successful_count > 0,
      message: `Bulk voucher creation completed. ${results.successful_count} successful, ${results.failed_count} failed.`,
      results: results
    }, statusCode);
    
  } catch (error) {
    console.error('Error in bulk voucher creation:', error);
    return json({
      error: "Failed to process bulk voucher creation",
      details: error.message
    }, 500);
  }
}

/**
 * Handles bulk deletion of vouchers
 * 
 * @param {Request} req - The HTTP request object containing array of voucher identifiers
 * @param {SupabaseClient} supabase - Supabase client instance for database operations
 * @param {User|null} user - Authenticated user object (optional)
 * @param {Error|null} authError - Authentication error if any
 * @returns {Response} JSON response with bulk deletion results
 */
export async function handleBulkDeleteVouchers(req, supabase, user, authError) {
  try {
    // No authentication required
    
    // Parse the request body to get voucher identifiers
    const body = await req.json();
    
    // Validate request structure
    if ((!body.ids || !Array.isArray(body.ids)) && (!body.voucher_codes || !Array.isArray(body.voucher_codes))) {
      return json({
        error: "Request must contain either 'ids' array or 'voucher_codes' array"
      }, 400);
    }
    
    let identifiers = [];
    let identifierType = '';
    
    if (body.ids && Array.isArray(body.ids) && body.ids.length > 0) {
      identifiers = body.ids;
      identifierType = 'id';
    } else if (body.voucher_codes && Array.isArray(body.voucher_codes) && body.voucher_codes.length > 0) {
      identifiers = body.voucher_codes;
      identifierType = 'voucher_code';
    } else {
      return json({
        error: "Identifiers array cannot be empty"
      }, 400);
    }
    
    if (identifiers.length > 100) {
      return json({
        error: "Maximum 100 vouchers allowed per bulk deletion"
      }, 400);
    }
    
    const results = {
      successful: [],
      failed: [],
      total: identifiers.length,
      successful_count: 0,
      failed_count: 0
    };
    
    // Process each voucher individually
    for (let i = 0; i < identifiers.length; i++) {
      const identifier = identifiers[i];
      
      try {
        // First, verify the voucher exists
        let existingVoucher;
        
        const { data, error } = await supabase
          .from('vouchers')
          .select('id, voucher_code, user_name, user_email')
          .eq(identifierType, identifier)
          .single();
        
        if (error && error.code === 'PGRST116') {
          results.failed.push({
            index: i,
            identifier: identifier,
            error: "Voucher not found"
          });
          results.failed_count++;
          continue;
        }
        
        if (error) {
          throw error;
        }
        
        existingVoucher = data;
        
        // Perform hard deletion
        const { error: deleteError } = await supabase
          .from('vouchers')
          .delete()
          .eq('id', existingVoucher.id);
        
        if (deleteError) {
          throw deleteError;
        }
        
        results.successful.push({
          index: i,
          identifier: identifier,
          deleted_voucher: {
            id: existingVoucher.id,
            voucher_code: existingVoucher.voucher_code,
            user_name: existingVoucher.user_name,
            user_email: existingVoucher.user_email
          }
        });
        results.successful_count++;
        
      } catch (error) {
        console.error(`Error deleting voucher at index ${i}:`, error);
        
        // Handle specific database errors
        if (error.code === '23503') {
          results.failed.push({
            index: i,
            identifier: identifier,
            error: "Cannot delete voucher: it is referenced by other records"
          });
        } else {
          results.failed.push({
            index: i,
            identifier: identifier,
            error: error.message
          });
        }
        results.failed_count++;
      }
    }
    
    const statusCode = results.failed_count > 0 ? (results.successful_count > 0 ? 207 : 400) : 200;
    
    return json({
      success: results.successful_count > 0,
      message: `Bulk voucher deletion completed. ${results.successful_count} successful, ${results.failed_count} failed.`,
      results: results,
      deleted_at: new Date().toISOString()
    }, statusCode);
    
  } catch (error) {
    console.error('Error in bulk voucher deletion:', error);
    return json({
      error: "Failed to process bulk voucher deletion",
      details: error.message
    }, 500);
  }
}
