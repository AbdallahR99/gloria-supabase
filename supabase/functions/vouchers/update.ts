/**
 * Voucher Update Handler
 * File: functions/vouchers/update.ts
 * 
 * This file handles the updating of existing vouchers in the e-commerce system.
 * It includes validation for voucher existence, field validation,
 * and comprehensive error handling.
 * 
 * Features:
 * - Voucher field updates with validation
 * - Voucher code uniqueness validation
 * - No authentication required
 * - Comprehensive field validation
 */

// Helper function to create JSON response
function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" }
  });
}

/**
 * Handles the updating of an existing voucher
 * 
 * @param {Request} req - The HTTP request object containing voucher data and ID
 * @param {SupabaseClient} supabase - Supabase client instance for database operations
 * @param {User|null} user - Authenticated user object (optional)
 * @param {Error|null} authError - Authentication error if any
 * @returns {Response} JSON response with updated voucher data or error
 */
export async function handleUpdateVoucher(req, supabase, user, authError) {
  try {
    // No authentication required
    
    // Parse the request body to get voucher data
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
      const { data, error } = await supabase
        .from('vouchers')
        .select('*')
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
      const { data, error } = await supabase
        .from('vouchers')
        .select('*')
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
    
    // Prepare update data - only include fields that can be updated
    const updatableFields = [
      'user_name', 'user_email', 'user_phone', 'notes', 'voucher_code'
    ];
    
    const updateData = {};
    let hasUpdates = false;
    
    // Validate and prepare updatable fields
    for (const field of updatableFields) {
      if (body[field] !== undefined) {
        hasUpdates = true;
        
        // Special validation for voucher_code
        if (field === 'voucher_code') {
          if (body[field] !== null && body[field] !== undefined) {
            if (typeof body[field] !== 'string' || body[field].trim().length === 0) {
              return json({
                error: "voucher_code must be a non-empty string"
              }, 400);
            }
            
            // Check if the new voucher code already exists (and is not the current voucher)
            const { data: existingCode, error: checkError } = await supabase
              .from('vouchers')
              .select('id, voucher_code')
              .eq('voucher_code', body[field].trim())
              .neq('id', existingVoucher.id)
              .single();
            
            if (checkError && checkError.code !== 'PGRST116') {
              throw checkError;
            }
            
            if (existingCode) {
              return json({
                error: "Voucher code already exists"
              }, 409);
            }
            
            updateData[field] = body[field].trim();
          } else {
            updateData[field] = null;
          }
        }
        // Validation for email
        else if (field === 'user_email') {
          if (body[field] !== null && body[field] !== undefined) {
            if (typeof body[field] !== 'string') {
              return json({
                error: "user_email must be a string"
              }, 400);
            }
            
            if (body[field].trim().length > 0) {
              // Basic email validation
              const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
              if (!emailRegex.test(body[field].trim())) {
                return json({
                  error: "user_email must be a valid email address"
                }, 400);
              }
            }
            
            updateData[field] = body[field].trim();
          } else {
            updateData[field] = null;
          }
        }
        // Validation for string fields
        else if (['user_name', 'user_phone', 'notes'].includes(field)) {
          if (body[field] !== null && body[field] !== undefined) {
            if (typeof body[field] !== 'string') {
              return json({
                error: `${field} must be a string`
              }, 400);
            }
            updateData[field] = body[field].trim();
          } else {
            updateData[field] = null;
          }
        }
      }
    }
    
    // Check if there are any updates to apply
    if (!hasUpdates) {
      return json({
        error: "No valid fields provided for update"
      }, 400);
    }
    
    // Add audit trail
    updateData.updated_at = new Date().toISOString();
    
    // Perform the update
    const { data, error } = await supabase
      .from('vouchers')
      .update(updateData)
      .eq('id', existingVoucher.id)
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
      message: "Voucher updated successfully",
      data: data,
      updated_fields: Object.keys(updateData).filter(key => key !== 'updated_at')
    });
    
  } catch (error) {
    console.error('Error updating voucher:', error);
    return json({
      error: "Failed to update voucher",
      details: error.message
    }, 500);
  }
}
