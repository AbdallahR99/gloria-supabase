// File: functions/invoices/delete.ts

/**
 * Handle deleting invoices with soft delete functionality.
 * Supports both single invoice deletion and validation of business rules.
 * 
 * @param {Request} req - HTTP request object containing deletion criteria
 * @param {SupabaseClient} supabase - Supabase client instance
 * @param {Object|null} user - Authenticated user object
 * @param {Error|null} authError - Authentication error if any
 * @returns {Response} JSON response with deletion status
 * 
 * @throws {Error} Unauthorized access (401)
 * @throws {Error} Invoice not found (404)
 * @throws {Error} Cannot delete paid invoice (400)
 * @throws {Error} Database deletion errors (500)
 * 
 * Request Body:
 * {
 *   "invoice_id": "invoice_uuid",        // Invoice ID to delete (required)
 *   "force_delete": false,               // Force delete even if paid (optional, admin only)
 *   "deletion_reason": "Customer request" // Reason for deletion (optional)
 * }
 * 
 * Response Format:
 * {
 *   "success": true,
 *   "message": "Invoice deleted successfully",
 *   "invoice_id": "invoice_uuid",
 *   "invoice_number": "INV-2024-01-15-0001",
 *   "deleted_at": "2024-01-16T10:30:00Z",
 *   "deleted_by": "admin@example.com"
 * }
 * 
 * Deletion Rules:
 * - Only draft and sent invoices can be deleted normally
 * - Paid invoices require force_delete flag (admin only)
 * - Cancelled invoices can be deleted freely
 * - Refunded invoices require force_delete flag
 * - Soft delete preserves data for audit purposes
 * - Associated invoice items are also soft deleted
 * - Deletion reason is logged for compliance
 * 
 * Business Rules:
 * - Cannot delete if linked to a completed order (unless forced)
 * - Cannot delete if payment has been processed (unless forced)
 * - Must provide reason for force deletion
 * - Automatic cleanup of related data references
 * 
 * Usage Examples:
 * 
 * 1. Delete draft invoice:
 * curl -X DELETE "https://your-project.supabase.co/functions/v1/invoices" \
 *   -H "Content-Type: application/json" \
 *   -H "Authorization: Bearer YOUR_JWT_TOKEN" \
 *   -d '{
 *     "invoice_id": "123e4567-e89b-12d3-a456-426614174000",
 *     "deletion_reason": "Duplicate invoice created by mistake"
 *   }'
 * 
 * 2. Force delete paid invoice (admin only):
 * curl -X DELETE "https://your-project.supabase.co/functions/v1/invoices" \
 *   -H "Content-Type: application/json" \
 *   -H "Authorization: Bearer YOUR_ADMIN_JWT_TOKEN" \
 *   -d '{
 *     "invoice_id": "456e7890-e12b-34d5-a678-901234567890",
 *     "force_delete": true,
 *     "deletion_reason": "Legal requirement - customer data removal request"
 *   }'
 * 
 * 3. Delete cancelled invoice:
 * curl -X DELETE "https://your-project.supabase.co/functions/v1/invoices" \
 *   -H "Content-Type: application/json" \
 *   -H "Authorization: Bearer YOUR_JWT_TOKEN" \
 *   -d '{
 *     "invoice_id": "789e0123-e45b-67d8-a901-234567890123",
 *     "deletion_reason": "Invoice was cancelled and no longer needed"
 *   }'
 * 
 * Error Responses:
 * 
 * Unauthorized access (401):
 * {
 *   "error": "Unauthorized"
 * }
 * 
 * Invoice not found (404):
 * {
 *   "error": "Invoice not found"
 * }
 * 
 * Cannot delete paid invoice (400):
 * {
 *   "error": "Cannot delete paid invoice without force_delete flag"
 * }
 * 
 * Missing deletion reason for force delete (400):
 * {
 *   "error": "Deletion reason is required for force delete"
 * }
 * 
 * Insufficient permissions (403):
 * {
 *   "error": "Insufficient permissions for force delete"
 * }
 * 
 * Invoice linked to completed order (400):
 * {
 *   "error": "Cannot delete invoice linked to completed order"
 * }
 * 
 * Notes:
 * - Soft delete preserves data integrity and audit trails
 * - Force delete should be used sparingly and with proper authorization
 * - Deletion cascades to invoice items automatically
 * - Deleted invoices can potentially be restored by database administrators
 * - All deletion actions are logged with timestamp and user information
 * - Related order references are preserved for historical accuracy
 */
export async function handleDeleteInvoice(req, supabase, user, authError) {
  if (authError || !user) throw new Error("Unauthorized");
  
  const body = await req.json();
  const { invoice_id, force_delete = false, deletion_reason } = body;
  
  if (!invoice_id) {
    return json({ error: "Invoice ID is required" }, 400);
  }
  
  // Get current invoice to validate deletion
  const { data: invoice, error: fetchError } = await supabase
    .from('invoices')
    .select(`
      id,
      invoice_number,
      status,
      payment_status,
      order_id,
      order_code,
      total_amount
    `)
    .eq('id', invoice_id)
    .eq('is_deleted', false)
    .maybeSingle();
  
  if (fetchError) throw fetchError;
  if (!invoice) {
    return json({ error: "Invoice not found" }, 404);
  }
  
  // Check deletion permissions and rules
  const canNormalDelete = ['draft', 'sent', 'cancelled'].includes(invoice.status) && 
                         invoice.payment_status !== 'paid';
  
  const needsForceDelete = !canNormalDelete;
  
  if (needsForceDelete && !force_delete) {
    return json({ 
      error: "Cannot delete paid invoice without force_delete flag" 
    }, 400);
  }
  
  if (force_delete && !deletion_reason) {
    return json({ 
      error: "Deletion reason is required for force delete" 
    }, 400);
  }
  
  // Check if user has admin permissions for force delete
  if (force_delete) {
    const { data: userRoles } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id);
    
    const isAdmin = userRoles?.some(r => ['admin', 'super_admin'].includes(r.role));
    
    if (!isAdmin) {
      return json({ 
        error: "Insufficient permissions for force delete" 
      }, 403);
    }
  }
  
  // Check if linked to completed order (additional protection)
  if (invoice.order_id && !force_delete) {
    const { data: order } = await supabase
      .from('orders')
      .select('status')
      .eq('id', invoice.order_id)
      .single();
    
    if (order && ['delivered', 'completed'].includes(order.status)) {
      return json({ 
        error: "Cannot delete invoice linked to completed order" 
      }, 400);
    }
  }
  
  const now = new Date().toISOString();
  
  // Perform soft delete of invoice items first
  const { error: itemsDeleteError } = await supabase
    .from('invoice_items')
    .update({
      is_deleted: true,
      updated_at: now
    })
    .eq('invoice_id', invoice_id);
  
  if (itemsDeleteError) throw itemsDeleteError;
  
  // Perform soft delete of invoice
  const updateData = {
    is_deleted: true,
    updated_at: now,
    updated_by: user.email
  };
  
  // Add deletion reason to internal notes if provided
  if (deletion_reason) {
    const { data: currentInvoice } = await supabase
      .from('invoices')
      .select('internal_notes')
      .eq('id', invoice_id)
      .single();
    
    const existingNotes = currentInvoice?.internal_notes || '';
    const deletionNote = `\n[DELETED ${now}] Reason: ${deletion_reason}`;
    updateData.internal_notes = existingNotes + deletionNote;
  }
  
  const { error: deleteError } = await supabase
    .from('invoices')
    .update(updateData)
    .eq('id', invoice_id);
  
  if (deleteError) throw deleteError;
  
  // Log deletion action (optional - could be added to audit log table)
  try {
    await supabase
      .from('audit_logs')
      .insert({
        table_name: 'invoices',
        record_id: invoice_id,
        action: force_delete ? 'force_delete' : 'delete',
        old_values: { invoice_number: invoice.invoice_number, status: invoice.status },
        new_values: { is_deleted: true },
        user_id: user.id,
        user_email: user.email,
        metadata: { 
          deletion_reason, 
          force_delete,
          total_amount: invoice.total_amount 
        },
        created_at: now
      });
  } catch (auditError) {
    // Audit logging failure shouldn't prevent deletion
    console.warn('Failed to log deletion to audit table:', auditError);
  }
  
  return json({
    success: true,
    message: "Invoice deleted successfully",
    invoice_id: invoice.id,
    invoice_number: invoice.invoice_number,
    deleted_at: now,
    deleted_by: user.email
  });
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    headers: { "Content-Type": "application/json" },
    status
  });
}
