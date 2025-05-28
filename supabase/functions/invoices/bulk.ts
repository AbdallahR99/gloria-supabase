/**
 * Invoice Bulk Operations Handlers
 * File: functions/invoices/bulk.ts
 * 
 * This file handles bulk operations for invoices in the e-commerce system.
 * It includes bulk creation and bulk deletion with comprehensive validation
 * and error handling for each operation.
 * 
 * Features:
 * - Bulk invoice creation with individual validation
 * - Bulk invoice deletion (soft delete)
 * - Products array validation (sku, name, quantity, price, old_price)
 * - Optional subtotal, discount, and delivery_fees fields
 * - Transaction-like error handling
 * - Detailed success/failure reporting
 * - Invoice code generation and validation
 */

/**
 * Handles bulk creation of invoices
 * 
 * @param {Request} req - The HTTP request object containing array of invoice data
 * @param {SupabaseClient} supabase - Supabase client instance for database operations
 * @param {User} user - Authenticated user object
 * @param {Error|null} authError - Authentication error if any
 * @returns {Response} JSON response with bulk creation results
 */
export async function handleBulkCreateInvoices(req, supabase, user, authError) {
  try {
    // Check if user is authenticated and authorized
    if (authError || !user) throw new Error("Unauthorized");
    
    // Parse the request body to get invoices array
    const body = await req.json();
    
    // Validate request structure
    if (!body.invoices || !Array.isArray(body.invoices)) {
      return json({
        error: "Request must contain 'invoices' array"
      }, 400);
    }
    
    if (body.invoices.length === 0) {
      return json({
        error: "Invoices array cannot be empty"
      }, 400);
    }
    
    if (body.invoices.length > 100) {
      return json({
        error: "Maximum 100 invoices allowed per bulk operation"
      }, 400);
    }
    
    const results = {
      successful: [],
      failed: [],
      total: body.invoices.length,
      successful_count: 0,
      failed_count: 0
    };
    
    const timestamp = new Date().toISOString();
    
    // Process each invoice individually
    for (let i = 0; i < body.invoices.length; i++) {
      const invoiceData = body.invoices[i];
      const invoiceIndex = i + 1;
      
      try {        // Validate required fields - only total_price and products are required now
        const requiredFields = ['total_price', 'products'];
        for (const field of requiredFields) {
          if (invoiceData[field] === undefined || invoiceData[field] === null) {
            throw new Error(`Missing required field: ${field}`);
          }
        }
        
        // Validate total_price
        if (typeof invoiceData.total_price !== 'number' || invoiceData.total_price < 0) {
          throw new Error("Invalid total_price: must be a non-negative number");
        }
        
        // Validate optional numeric fields (subtotal, discount, delivery_fees)
        const optionalNumericFields = ['subtotal', 'discount', 'delivery_fees'];
        for (const field of optionalNumericFields) {
          if (invoiceData[field] !== undefined && invoiceData[field] !== null) {
            if (typeof invoiceData[field] !== 'number' || invoiceData[field] < 0) {
              throw new Error(`Invalid ${field}: must be a non-negative number`);
            }
          }
        }
        
        // Validate products array
        if (!Array.isArray(invoiceData.products) || invoiceData.products.length === 0) {
          throw new Error("products must be a non-empty array");
        }
        
        // Validate each product in the array
        for (let productIndex = 0; productIndex < invoiceData.products.length; productIndex++) {
          const product = invoiceData.products[productIndex];
          
          // Required product fields
          const requiredProductFields = ['sku', 'name', 'quantity', 'price'];
          for (const field of requiredProductFields) {
            if (product[field] === undefined || product[field] === null) {
              throw new Error(`Missing required field '${field}' in product at index ${productIndex}`);
            }
          }
          
          // Validate product field types
          if (typeof product.sku !== 'string' || product.sku.trim().length === 0) {
            throw new Error(`Invalid sku in product at index ${productIndex}: must be a non-empty string`);
          }
          
          if (typeof product.name !== 'string' || product.name.trim().length === 0) {
            throw new Error(`Invalid name in product at index ${productIndex}: must be a non-empty string`);
          }
          
          if (typeof product.quantity !== 'number' || product.quantity <= 0 || !Number.isInteger(product.quantity)) {
            throw new Error(`Invalid quantity in product at index ${productIndex}: must be a positive integer`);
          }
          
          if (typeof product.price !== 'number' || product.price < 0) {
            throw new Error(`Invalid price in product at index ${productIndex}: must be a non-negative number`);
          }
          
          // Validate optional old_price field
          if (product.old_price !== undefined && product.old_price !== null) {
            if (typeof product.old_price !== 'number' || product.old_price < 0) {
              throw new Error(`Invalid old_price in product at index ${productIndex}: must be a non-negative number`);
            }
          }
        }
        
        // Validate total calculation if subtotal, discount, and delivery_fees are provided
        if (invoiceData.subtotal !== undefined && invoiceData.subtotal !== null && 
            invoiceData.discount !== undefined && invoiceData.discount !== null && 
            invoiceData.delivery_fees !== undefined && invoiceData.delivery_fees !== null) {
          const calculatedTotal = invoiceData.subtotal - invoiceData.discount + invoiceData.delivery_fees;
          if (Math.abs(calculatedTotal - invoiceData.total_price) > 0.01) {
            throw new Error(`Total price mismatch. Expected: ${calculatedTotal.toFixed(2)}, Received: ${invoiceData.total_price}`);
          }
        }
        
        // Generate or validate invoice code
        let invoiceCode = invoiceData.invoice_code;
        
        if (invoiceCode) {
          // Validate provided invoice code format
          if (typeof invoiceCode !== 'string' || invoiceCode.trim().length === 0) {
            throw new Error("Invalid invoice code format");
          }
          
          // Check if code already exists
          const { data: existingInvoice } = await supabase
            .from('invoices')
            .select('id')
            .eq('invoice_code', invoiceCode)
            .eq('is_deleted', false)
            .single();
          
          if (existingInvoice) {
            throw new Error(`Invoice code '${invoiceCode}' already exists`);
          }
        } else {
          // Generate invoice code using database function
          const { data: generatedCode, error: codeError } = await supabase
            .rpc('generate_invoice_code', { input_code: null });
          
          if (codeError) throw codeError;
          invoiceCode = generatedCode;
        }
          // Prepare invoice data
        const finalInvoiceData = {
          invoice_code: invoiceCode,
          subtotal: invoiceData.subtotal || null,
          discount: invoiceData.discount || null,
          delivery_fees: invoiceData.delivery_fees || null,
          total_price: invoiceData.total_price,
          products: invoiceData.products,
          user_email: invoiceData.user_email || null,
          user_phone: invoiceData.user_phone || null,
          user_name: invoiceData.user_name || null,
          user_address: invoiceData.user_address || null,
          notes: invoiceData.notes || null,
          user_notes: invoiceData.user_notes || null,
          reviews: invoiceData.reviews || null,
          created_at: timestamp,
          updated_at: timestamp,
          created_by: user.email || user.id
        };
        
        // Insert the invoice
        const { data: invoice, error } = await supabase
          .from('invoices')
          .insert(finalInvoiceData)
          .select()
          .single();
        
        if (error) throw error;
        
        results.successful.push({
          index: invoiceIndex,
          invoice
        });
        results.successful_count++;
        
      } catch (error) {
        results.failed.push({
          index: invoiceIndex,
          error: error.message,
          invoice_data: invoiceData
        });
        results.failed_count++;
      }
    }
    
    const statusCode = results.failed_count > 0 ? 207 : 201; // 207 Multi-Status if some failed
    
    return json({
      message: `Bulk invoice creation completed. ${results.successful_count} successful, ${results.failed_count} failed.`,
      results
    }, statusCode);
    
  } catch (error) {
    console.error('Error in handleBulkCreateInvoices:', error);
    return json({
      error: error.message || "Internal server error"
    }, 500);
  }
}

/**
 * Handles bulk deletion of invoices (soft delete)
 * 
 * @param {Request} req - The HTTP request object containing array of invoice identifiers
 * @param {SupabaseClient} supabase - Supabase client instance for database operations
 * @param {User} user - Authenticated user object
 * @param {Error|null} authError - Authentication error if any
 * @returns {Response} JSON response with bulk deletion results
 */
export async function handleBulkDeleteInvoices(req, supabase, user, authError) {
  try {
    // Check if user is authenticated and authorized
    if (authError || !user) throw new Error("Unauthorized");
    
    // Parse the request body to get identifiers array
    const body = await req.json();
    
    // Validate request structure - support both ids and invoice_codes
    if (!body.ids && !body.invoice_codes) {
      return json({
        error: "Request must contain either 'ids' or 'invoice_codes' array"
      }, 400);
    }
    
    let identifiers = [];
    let identifierType = '';
    
    if (body.ids) {
      if (!Array.isArray(body.ids) || body.ids.length === 0) {
        return json({
          error: "ids must be a non-empty array"
        }, 400);
      }
      identifiers = body.ids;
      identifierType = 'id';
    } else {
      if (!Array.isArray(body.invoice_codes) || body.invoice_codes.length === 0) {
        return json({
          error: "invoice_codes must be a non-empty array"
        }, 400);
      }
      identifiers = body.invoice_codes;
      identifierType = 'invoice_code';
    }
    
    if (identifiers.length > 100) {
      return json({
        error: "Maximum 100 invoices allowed per bulk deletion"
      }, 400);
    }
    
    const results = {
      successful: [],
      failed: [],
      total: identifiers.length,
      successful_count: 0,
      failed_count: 0
    };
    
    const timestamp = new Date().toISOString();
    
    // Process each identifier individually
    for (let i = 0; i < identifiers.length; i++) {
      const identifier = identifiers[i];
      const identifierIndex = i + 1;
      
      try {
        // Validate identifier
        if (!identifier || (typeof identifier !== 'string' && typeof identifier !== 'number')) {
          throw new Error(`Invalid ${identifierType} format`);
        }
        
        // Find the invoice
        let query = supabase
          .from('invoices')
          .select('id, invoice_code, is_deleted')
          .eq(identifierType, identifier);
        
        const { data: invoice, error: findError } = await query.single();
        
        if (findError && findError.code === 'PGRST116') {
          throw new Error("Invoice not found");
        }
        
        if (findError) throw findError;
        
        if (!invoice) {
          throw new Error("Invoice not found");
        }
        
        // Check if already deleted
        if (invoice.is_deleted) {
          throw new Error("Invoice is already deleted");
        }
        
        // Prepare deletion data
        const deletionData = {
          is_deleted: true,
          deleted_at: timestamp,
          deleted_by: user.email || user.id,
          updated_at: timestamp,
          updated_by: user.email || user.id
        };
        
        // Perform the soft deletion
        const { data: deletedInvoice, error: deleteError } = await supabase
          .from('invoices')
          .update(deletionData)
          .eq('id', invoice.id)
          .select('id, invoice_code, is_deleted, deleted_at, deleted_by')
          .single();
        
        if (deleteError) throw deleteError;
        
        results.successful.push({
          index: identifierIndex,
          identifier,
          invoice: {
            id: deletedInvoice.id,
            invoice_code: deletedInvoice.invoice_code,
            is_deleted: deletedInvoice.is_deleted,
            deleted_at: deletedInvoice.deleted_at,
            deleted_by: deletedInvoice.deleted_by
          }
        });
        results.successful_count++;
        
      } catch (error) {
        results.failed.push({
          index: identifierIndex,
          identifier,
          error: error.message
        });
        results.failed_count++;
      }
    }
    
    const statusCode = results.failed_count > 0 ? 207 : 200; // 207 Multi-Status if some failed
    
    return json({
      message: `Bulk invoice deletion completed. ${results.successful_count} successful, ${results.failed_count} failed.`,
      results
    }, statusCode);
    
  } catch (error) {
    console.error('Error in handleBulkDeleteInvoices:', error);
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
