/**
 * Invoice Deletion Handler
 * File: functions/invoices/delete.ts
 * 
 * This file handles the deletion of invoices in the e-commerce system.
 * It implements soft deletion to maintain data integrity and audit trails.
 * 
 * Features:
 * - Soft deletion with is_deleted flag
 * - Invoice existence validation
 * - Audit trail with deleted_by and deleted_at tracking
 * - Prevention of double deletion
 * - Comprehensive error handling
 */

/**
 * Handles the soft deletion of an existing invoice
 * 
 * @param {Request} req - The HTTP request object containing invoice identifier
 * @param {SupabaseClient} supabase - Supabase client instance for database operations
 * @param {User} user - Authenticated user object
 * @param {Error|null} authError - Authentication error if any
 * @returns {Response} JSON response with deletion confirmation or error
 */
export async function handleDeleteInvoice(req, supabase, user, authError) {
  try {
    // Check if user is authenticated and authorized
    if (authError || !user) throw new Error("Unauthorized");
    
    // Parse the request body to get invoice identifier
    const body = await req.json();
    
    // Validate required invoice identifier
    if (!body.id && !body.invoice_code) {
      return json({
        error: "Invoice ID or invoice_code is required"
      }, 400);
    }
    
    // First, verify the invoice exists and is not already deleted
    let existingInvoice;
    
    if (body.id) {
      // Check by ID including deleted invoices to provide appropriate error messages
      const { data, error } = await supabase
        .from('invoices')
        .select('id, invoice_code, is_deleted')
        .eq('id', body.id)
        .single();
      
      if (error && error.code === 'PGRST116') {
        return json({
          error: "Invoice not found"
        }, 404);
      }
      
      if (error) throw error;
      existingInvoice = data;
    } else {
      // Check by invoice code including deleted invoices
      const { data, error } = await supabase
        .from('invoices')
        .select('id, invoice_code, is_deleted')
        .eq('invoice_code', body.invoice_code)
        .single();
      
      if (error && error.code === 'PGRST116') {
        return json({
          error: "Invoice not found"
        }, 404);
      }
      
      if (error) throw error;
      existingInvoice = data;
    }
    
    if (!existingInvoice) {
      return json({
        error: "Invoice not found"
      }, 404);
    }
    
    // Check if invoice is already deleted
    if (existingInvoice.is_deleted) {
      return json({
        error: "Invoice is already deleted"
      }, 400);
    }
    
    // Prepare deletion data (soft delete)
    const deletionData = {
      is_deleted: true,
      deleted_at: new Date().toISOString(),
      deleted_by: user.email || user.id,
      updated_at: new Date().toISOString(),
      updated_by: user.email || user.id
    };
    
    // Perform the soft deletion
    const { data: deletedInvoice, error } = await supabase
      .from('invoices')
      .update(deletionData)
      .eq('id', existingInvoice.id)
      .select('id, invoice_code, is_deleted, deleted_at, deleted_by')
      .single();
    
    if (error) throw error;
    
    return json({
      message: "Invoice deleted successfully",
      invoice: {
        id: deletedInvoice.id,
        invoice_code: deletedInvoice.invoice_code,
        is_deleted: deletedInvoice.is_deleted,
        deleted_at: deletedInvoice.deleted_at,
        deleted_by: deletedInvoice.deleted_by
      }
    });
    
  } catch (error) {
    console.error('Error in handleDeleteInvoice:', error);
    return json({
      error: error.message || "Internal server error"
    }, 500);
  }
}

/**
 * Handles the permanent deletion of an invoice (hard delete)
 * This function should be used with extreme caution and typically only by system administrators
 * 
 * @param {Request} req - The HTTP request object containing invoice identifier
 * @param {SupabaseClient} supabase - Supabase client instance for database operations
 * @param {User} user - Authenticated user object
 * @param {Error|null} authError - Authentication error if any
 * @returns {Response} JSON response with deletion confirmation or error
 */
export async function handlePermanentDeleteInvoice(req, supabase, user, authError) {
  try {
    // Check if user is authenticated and authorized
    if (authError || !user) throw new Error("Unauthorized");
    
    // Additional authorization check for permanent deletion
    // You might want to add role-based access control here
    // For now, we'll allow any authenticated user, but consider restricting this
    
    // Parse the request body to get invoice identifier and confirmation
    const body = await req.json();
    
    // Validate required invoice identifier
    if (!body.id && !body.invoice_code) {
      return json({
        error: "Invoice ID or invoice_code is required"
      }, 400);
    }
    
    // Require explicit confirmation for permanent deletion
    if (!body.confirm_permanent_deletion) {
      return json({
        error: "Permanent deletion requires explicit confirmation (confirm_permanent_deletion: true)"
      }, 400);
    }
    
    // First, verify the invoice exists
    let existingInvoice;
    
    if (body.id) {
      const { data, error } = await supabase
        .from('invoices')
        .select('id, invoice_code, is_deleted')
        .eq('id', body.id)
        .single();
      
      if (error && error.code === 'PGRST116') {
        return json({
          error: "Invoice not found"
        }, 404);
      }
      
      if (error) throw error;
      existingInvoice = data;
    } else {
      const { data, error } = await supabase
        .from('invoices')
        .select('id, invoice_code, is_deleted')
        .eq('invoice_code', body.invoice_code)
        .single();
      
      if (error && error.code === 'PGRST116') {
        return json({
          error: "Invoice not found"
        }, 404);
      }
      
      if (error) throw error;
      existingInvoice = data;
    }
    
    if (!existingInvoice) {
      return json({
        error: "Invoice not found"
      }, 404);
    }
    
    // Perform the permanent deletion
    const { error } = await supabase
      .from('invoices')
      .delete()
      .eq('id', existingInvoice.id);
    
    if (error) throw error;
    
    return json({
      message: "Invoice permanently deleted",
      invoice: {
        id: existingInvoice.id,
        invoice_code: existingInvoice.invoice_code,
        permanently_deleted: true,
        deleted_by: user.email || user.id,
        deleted_at: new Date().toISOString()
      }
    });
    
  } catch (error) {
    console.error('Error in handlePermanentDeleteInvoice:', error);
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
