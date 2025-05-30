/**
 * Voucher Creation Handlers
 * File: functions/vouchers/create.ts
 * 
 * This file handles the creation of new vouchers in the e-commerce system.
 * It includes validation for voucher codes, automatic code generation,
 * and comprehensive error handling.
 * 
 * Features:
 * - Manual voucher creation with validation
 * - Voucher code uniqueness validation
 * - Automatic voucher code generation
 * - No authentication required
 * - Comprehensive audit logging
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
 * Handles the creation of a new voucher
 * 
 * @param {Request} req - The HTTP request object containing voucher data
 * @param {SupabaseClient} supabase - Supabase client instance for database operations
 * @param {User|null} user - Authenticated user object (optional)
 * @param {Error|null} authError - Authentication error if any
 * @returns {Response} JSON response with created voucher data or error
 */
export async function handleCreateVoucher(req, supabase, user, authError) {
  try {
    // No authentication required
    
    // Parse the request body to get voucher data
    const body = await req.json();
    
    // Validate voucher_code if provided
    if (body.voucher_code) {
      if (typeof body.voucher_code !== 'string' || body.voucher_code.trim().length === 0) {
        return json({
          error: "voucher_code must be a non-empty string"
        }, 400);
      }
      
      // Check if voucher code already exists
      const { data: existingVoucher, error: checkError } = await supabase
        .from('vouchers')
        .select('voucher_code')
        .eq('voucher_code', body.voucher_code.trim())
        .single();
      
      if (checkError && checkError.code !== 'PGRST116') {
        throw checkError;
      }
      
      if (existingVoucher) {
        return json({
          error: "Voucher code already exists"
        }, 409);
      }
    }
    
    // Validate optional fields
    const validationErrors = [];
    
    // if (body.user_name !== undefined && body.user_name !== null) {
    //   if (typeof body.user_name !== 'string') {
    //     validationErrors.push("user_name must be a string");
    //   }
    // }
    
    // if (body.user_email !== undefined && body.user_email !== null) {
    //   if (typeof body.user_email !== 'string') {
    //     validationErrors.push("user_email must be a string");
    //   } else if (body.user_email.trim().length > 0) {
    //     // Basic email validation
    //     const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    //     if (!emailRegex.test(body.user_email.trim())) {
    //       validationErrors.push("user_email must be a valid email address");
    //     }
    //   }
    // }
    
    // if (body.user_phone !== undefined && body.user_phone !== null) {
    //   if (typeof body.user_phone !== 'string') {
    //     validationErrors.push("user_phone must be a string");
    //   }
    // }
    
    // if (body.notes !== undefined && body.notes !== null) {
    //   if (typeof body.notes !== 'string') {
    //     validationErrors.push("notes must be a string");
    //   }
    // }
    
    // if (body.created_by !== undefined && body.created_by !== null) {
    //   if (typeof body.created_by !== 'string') {
    //     validationErrors.push("created_by must be a string");
    //   }
    // }
    
    if (validationErrors.length > 0) {
      return json({
        error: "Validation failed",
        details: validationErrors
      }, 400);
    }
    
    // Prepare voucher data for insertion
    const voucherData = {
      voucher_code: body.voucher_code?.trim() || await generateUniqueVoucherCode(supabase),
      user_name: body.user_name?.trim() || null,
      user_email: body.user_email?.trim() || null,
      user_phone: body.user_phone?.trim() || null,
      notes: body.notes?.trim() || null,
      created_by: body.created_by?.trim() || (user ? user.email : null)
    };
    
    // Insert the voucher
    const { data, error } = await supabase
      .from('vouchers')
      .insert([voucherData])
      .select()
      .single();
    
    if (error) {
      // Handle specific database errors
      if (error.code === '23505') {
        return json({
          error: "Voucher code already exists"
        }, 409);
      }
      throw error;
    }
    
    return json({
      success: true,
      message: "Voucher created successfully",
      data: data,
      voucher_code: voucherData.voucher_code,
    }, 201);
    
  } catch (error) {
    console.error('Error creating voucher:', error);
    
    // Handle specific error types
    if (error.message.includes('unique voucher code')) {
      return json({
        error: "Failed to generate unique voucher code"
      }, 500);
    }
    
    return json({
      error: "Failed to create voucher",
      details: error.message
    }, 500);
  }
}
