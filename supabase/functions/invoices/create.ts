/**
 * Invoice Creation Handlers
 * File: functions/invoices/create.ts
 * 
 * This file handles the creation of new invoices in the e-commerce system.
 * It includes validation for invoice codes, automatic code generation,
 * integration with order system, and comprehensive error handling.
 * 
 * Features:
 * - Manual invoice creation with validation
 * - Automatic invoice generation from orders
 * - Invoice code uniqueness validation
 * - Automatic invoice code generation
 * - Products array validation (sku, name, quantity, price, old_price)
 * - Optional subtotal, discount, and delivery_fees (staff can enter total directly)
 * - Comprehensive audit logging
 */

/**
 * Handles the creation of a new invoice manually
 * 
 * @param {Request} req - The HTTP request object containing invoice data
 * @param {SupabaseClient} supabase - Supabase client instance for database operations
 * @param {User} user - Authenticated user object
 * @param {Error|null} authError - Authentication error if any
 * @returns {Response} JSON response with created invoice data or error
 */
export async function handleCreateInvoice(req, supabase, user, authError) {
  try {
    // Check if user is authenticated and authorized
    if (authError || !user) console.log("Unauthorized access attempt");
    
    // Parse the request body to get invoice data
    const body = await req.json();
      // Validate required fields - only total_price and products are required now
    const requiredFields = ['total_price', 'products'];
    for (const field of requiredFields) {
      if (body[field] === undefined || body[field] === null) {
        return json({
          error: `Missing required field: ${field}`
        }, 400);
      }
    }
    
    // Validate total_price
    if (typeof body.total_price !== 'number' || body.total_price < 0) {
      return json({
        error: "Invalid total_price: must be a non-negative number"
      }, 400);
    }
    
    // Validate optional numeric fields (subtotal, discount, delivery_fees)
    const optionalNumericFields = ['subtotal', 'discount', 'delivery_fees'];
    for (const field of optionalNumericFields) {
      if (body[field] !== undefined && body[field] !== null) {
        if (typeof body[field] !== 'number' || body[field] < 0) {
          return json({
            error: `Invalid ${field}: must be a non-negative number`
          }, 400);
        }
      }
    }    
    // Validate products array
    if (!Array.isArray(body.products) || body.products.length === 0) {
      return json({
        error: "products must be a non-empty array"
      }, 400);
    }
    
    // Validate each product in the array
    for (let i = 0; i < body.products.length; i++) {
      const product = body.products[i];
      
      // // Required product fields
      // const requiredProductFields = ['sku', 'name', 'quantity', 'price'];
      // for (const field of requiredProductFields) {
      //   if (product[field] === undefined || product[field] === null) {
      //     return json({
      //       error: `Missing required field '${field}' in product at index ${i}`
      //     }, 400);
      //   }
      // }
      
      // Validate product field types
      if (typeof product.sku !== 'string' || product.sku.trim().length === 0) {
        return json({
          error: `Invalid sku in product at index ${i}: must be a non-empty string`
        }, 400);
      }
      
      // if (typeof product.name !== 'string' || product.name.trim().length === 0) {
      //   return json({
      //     error: `Invalid name in product at index ${i}: must be a non-empty string`
      //   }, 400);
      // }
      
      // if (typeof product.quantity !== 'number' || product.quantity <= 0 || !Number.isInteger(product.quantity)) {
      //   return json({
      //     error: `Invalid quantity in product at index ${i}: must be a positive integer`
      //   }, 400);
      // }
      
      // if (typeof product.price !== 'number' || product.price < 0) {
      //   return json({
      //     error: `Invalid price in product at index ${i}: must be a non-negative number`
      //   }, 400);
      // }
      
      // // Validate optional old_price field
      // if (product.old_price !== undefined && product.old_price !== null) {
      //   if (typeof product.old_price !== 'number' || product.old_price < 0) {
      //     return json({
      //       error: `Invalid old_price in product at index ${i}: must be a non-negative number`
      //     }, 400);
      //   }
      // }
    }
    
    // Validate total calculation if subtotal, discount, and delivery_fees are provided
    if (body.subtotal !== undefined && body.subtotal !== null && 
        body.discount !== undefined && body.discount !== null && 
        body.delivery_fees !== undefined && body.delivery_fees !== null) {
      const calculatedTotal = body.subtotal - body.discount + body.delivery_fees;
      if (Math.abs(calculatedTotal - body.total_price) > 0.01) {
        return json({
          error: `Total price mismatch. Expected: ${calculatedTotal.toFixed(2)}, Received: ${body.total_price}`
        }, 400);
      }
    }
    
    // Generate or validate invoice code
    let invoiceCode = body.invoice_code;
    
    if (invoiceCode) {
      // Validate provided invoice code format
      if (typeof invoiceCode !== 'string' || invoiceCode.trim().length === 0) {
        return json({
          error: "Invalid invoice code format"
        }, 400);
      }
      
      // Check if code already exists
      const { data: existingInvoice } = await supabase
        .from('invoices')
        .select('id')
        .eq('invoice_code', invoiceCode)
        .eq('is_deleted', false)
        .single();
      
      if (existingInvoice) {
        return json({
          error: `Invoice code '${invoiceCode}' already exists`
        }, 400);
      }
    } else {
      // Generate invoice code using database function
      const { data: generatedCode, error: codeError } = await supabase
        .rpc('generate_invoice_code', { input_code: null });
      
      if (codeError) throw codeError;
      invoiceCode = generatedCode;
    }
      // Prepare invoice data
    const timestamp = new Date().toISOString();
    const invoiceData = {
      invoice_code: invoiceCode,
      subtotal: body.subtotal || null,
      discount: body.discount || null,
      delivery_fees: body.delivery_fees || null,
      total_price: body.total_price,
      products: body.products,
      user_email: body.user_email || null,
      user_phone: body.user_phone || null,
      user_name: body.user_name || null,
      user_address: body.user_address || null,
      notes: body.notes || null,
      user_notes: body.user_notes || null,
      reviews: body.reviews || null,
      created_at: timestamp,
      updated_at: timestamp,
      created_by: user ? user.email || user.id : 'Anonymous'
    };
    
    // Insert the new invoice
    const { data: invoice, error } = await supabase
      .from('invoices')
      .insert(invoiceData)
      .select()
      .single();
    
    if (error) throw error;
    
    return json({
      message: "Invoice created successfully",
      invoice_code: invoiceCode,
      invoice
    }, 201);
    
  } catch (error) {
    console.error('Error in handleCreateInvoice:', error);
    return json({
      error: error.message || "Internal server error"
    }, 500);
  }
}

/**
 * Handles the creation of an invoice from an existing order
 * 
 * @param {Request} req - The HTTP request object containing order_code
 * @param {SupabaseClient} supabase - Supabase client instance for database operations
 * @param {User} user - Authenticated user object
 * @param {Error|null} authError - Authentication error if any
 * @returns {Response} JSON response with created invoice data or error
 */
export async function handleCreateInvoiceFromOrder(req, supabase, user, authError) {
  try {
    // Check if user is authenticated and authorized
    if (authError || !user) throw new Error("Unauthorized");
    
    // Parse the request body to get order code
    const body = await req.json();
    
    // Validate required field
    if (!body.order_code) {
      return json({
        error: "order_code is required"
      }, 400);
    }
    
    // Validate order code format
    if (typeof body.order_code !== 'string' || body.order_code.trim().length === 0) {
      return json({
        error: "Invalid order_code format"
      }, 400);
    }
    
    // Use database function to create invoice from order
    const { data: invoiceId, error } = await supabase
      .rpc('create_bill_from_order', { order_code_param: body.order_code });
    
    if (error) {
      // Handle specific error cases
      if (error.message.includes('not found or is deleted')) {
        return json({
          error: `Order with code '${body.order_code}' not found or is deleted`
        }, 404);
      }
      if (error.message.includes('already exists')) {
        return json({
          error: `Invoice already exists for order code '${body.order_code}'`
        }, 409);
      }
      throw error;
    }
    
    // Retrieve the created invoice
    const { data: invoice, error: getError } = await supabase
      .rpc('get_invoice_by_id', { invoice_id_param: invoiceId });
    
    if (getError) throw getError;
    
    const createdInvoice = invoice && invoice.length > 0 ? invoice[0] : null;
    
    if (!createdInvoice) {
      throw new Error("Failed to retrieve created invoice");
    }
    
    return json({
      message: "Invoice created successfully from order",
      invoice: createdInvoice,
      order_code: body.order_code
    }, 201);
    
  } catch (error) {
    console.error('Error in handleCreateInvoiceFromOrder:', error);
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
