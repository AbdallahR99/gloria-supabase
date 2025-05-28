/**
 * Invoice Update Handler
 * File: functions/invoices/update.ts
 * 
 * This file handles the updating of existing invoices in the e-commerce system.
 * It includes validation for invoice existence, field validation,
 * audit trail maintenance, and comprehensive error handling.
 * 
 * Features:
 * - Invoice field updates with validation
 * - Invoice code uniqueness validation
 * - Products array validation (sku, name, quantity, price, old_price)
 * - Optional subtotal, discount, and delivery_fees fields
 * - Soft delete awareness
 * - Audit trail with updated_by tracking
 * - Comprehensive field validation
 */

/**
 * Handles the updating of an existing invoice
 * 
 * @param {Request} req - The HTTP request object containing invoice data and ID
 * @param {SupabaseClient} supabase - Supabase client instance for database operations
 * @param {User} user - Authenticated user object
 * @param {Error|null} authError - Authentication error if any
 * @returns {Response} JSON response with updated invoice data or error
 */
export async function handleUpdateInvoice(req, supabase, user, authError) {
  try {
    // Check if user is authenticated and authorized
    if (authError || !user) throw new Error("Unauthorized");
    
    // Parse the request body to get invoice data
    const body = await req.json();
    
    // Validate required invoice identifier
    if (!body.id && !body.invoice_code) {
      return json({
        error: "Invoice ID or invoice_code is required"
      }, 400);
    }
    
    // First, verify the invoice exists and is not deleted
    let existingInvoice;
    
    if (body.id) {
      const { data, error } = await supabase
        .rpc('get_invoice_by_id', { invoice_id_param: body.id });
      
      if (error) throw error;
      existingInvoice = data && data.length > 0 ? data[0] : null;
    } else {
      const { data, error } = await supabase
        .rpc('get_invoice_by_code', { invoice_code_param: body.invoice_code });
      
      if (error) throw error;
      existingInvoice = data && data.length > 0 ? data[0] : null;
    }
    
    if (!existingInvoice) {
      return json({
        error: "Invoice not found"
      }, 404);
    }
      // Prepare update data - only include fields that can be updated
    const updatableFields = [
      'subtotal', 'discount', 'delivery_fees', 'total_price', 
      'products', 'user_email', 'user_phone', 'user_name', 
      'user_address', 'notes', 'user_notes', 'reviews'
    ];
    
    const updateData = {};
    let hasUpdates = false;
    
    // Validate and prepare updatable fields
    for (const field of updatableFields) {
      if (body[field] !== undefined) {
        hasUpdates = true;
          // Special validation for numeric fields (make them optional)
        if (['subtotal', 'discount', 'delivery_fees', 'total_price', 'reviews'].includes(field)) {
          if (body[field] !== null && body[field] !== undefined && (typeof body[field] !== 'number' || body[field] < 0)) {
            return json({
              error: `Invalid ${field}: must be a non-negative number or null`
            }, 400);
          }
        }
        
        // Special validation for products array
        if (field === 'products') {
          if (body[field] !== null && body[field] !== undefined) {
            if (!Array.isArray(body[field]) || body[field].length === 0) {
              return json({
                error: "products must be a non-empty array or null"
              }, 400);
            }
            
            // Validate each product in the array
            for (let i = 0; i < body[field].length; i++) {
              const product = body[field][i];
              
              // Required product fields
              const requiredProductFields = ['sku', 'name', 'quantity', 'price'];
              for (const productField of requiredProductFields) {
                if (product[productField] === undefined || product[productField] === null) {
                  return json({
                    error: `Missing required field '${productField}' in product at index ${i}`
                  }, 400);
                }
              }
              
              // Validate product field types
              if (typeof product.sku !== 'string' || product.sku.trim().length === 0) {
                return json({
                  error: `Invalid sku in product at index ${i}: must be a non-empty string`
                }, 400);
              }
              
              if (typeof product.name !== 'string' || product.name.trim().length === 0) {
                return json({
                  error: `Invalid name in product at index ${i}: must be a non-empty string`
                }, 400);
              }
              
              if (typeof product.quantity !== 'number' || product.quantity <= 0 || !Number.isInteger(product.quantity)) {
                return json({
                  error: `Invalid quantity in product at index ${i}: must be a positive integer`
                }, 400);
              }
              
              if (typeof product.price !== 'number' || product.price < 0) {
                return json({
                  error: `Invalid price in product at index ${i}: must be a non-negative number`
                }, 400);
              }
              
              // Validate optional old_price field
              if (product.old_price !== undefined && product.old_price !== null) {
                if (typeof product.old_price !== 'number' || product.old_price < 0) {
                  return json({
                    error: `Invalid old_price in product at index ${i}: must be a non-negative number`
                  }, 400);
                }
              }
            }
          }
        }
        
        updateData[field] = body[field];
      }
    }
    
    // Handle invoice_code updates separately (requires special validation)
    if (body.invoice_code && body.invoice_code !== existingInvoice.invoice_code) {
      // Validate new invoice code format
      if (typeof body.invoice_code !== 'string' || body.invoice_code.trim().length === 0) {
        return json({
          error: "Invalid invoice code format"
        }, 400);
      }
      
      // Check if new code already exists
      const { data: codeCheck } = await supabase
        .from('invoices')
        .select('id')
        .eq('invoice_code', body.invoice_code)
        .eq('is_deleted', false)
        .single();
      
      if (codeCheck) {
        return json({
          error: `Invoice code '${body.invoice_code}' already exists`
        }, 400);
      }
      
      updateData.invoice_code = body.invoice_code;
      hasUpdates = true;
    }
    
    if (!hasUpdates) {
      return json({
        error: "No valid fields to update"
      }, 400);
    }
      // Validate total calculation if relevant fields are being updated (only if all values are provided)
    const subtotal = updateData.subtotal !== undefined ? updateData.subtotal : existingInvoice.subtotal;
    const discount = updateData.discount !== undefined ? updateData.discount : existingInvoice.discount;
    const deliveryFees = updateData.delivery_fees !== undefined ? updateData.delivery_fees : existingInvoice.delivery_fees;
    const totalPrice = updateData.total_price !== undefined ? updateData.total_price : existingInvoice.total_price;
    
    // Only validate calculation if all required fields are present and not null
    if (subtotal !== null && subtotal !== undefined && 
        discount !== null && discount !== undefined && 
        deliveryFees !== null && deliveryFees !== undefined && 
        totalPrice !== null && totalPrice !== undefined) {
      const calculatedTotal = subtotal - discount + deliveryFees;
      if (Math.abs(calculatedTotal - totalPrice) > 0.01) {
        return json({
          error: `Total price mismatch. Expected: ${calculatedTotal.toFixed(2)}, Received: ${totalPrice}`
        }, 400);
      }
    }
    
    // Add audit fields
    updateData.updated_at = new Date().toISOString();
    updateData.updated_by = user.email || user.id;
    
    // Perform the update
    const { data: updatedInvoice, error } = await supabase
      .from('invoices')
      .update(updateData)
      .eq('id', existingInvoice.id)
      .select()
      .single();
    
    if (error) throw error;
    
    return json({
      message: "Invoice updated successfully",
      invoice: updatedInvoice,
      updated_fields: Object.keys(updateData).filter(key => !['updated_at', 'updated_by'].includes(key))
    });
    
  } catch (error) {
    console.error('Error in handleUpdateInvoice:', error);
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
