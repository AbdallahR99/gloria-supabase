// File: functions/invoices/update-status.ts

/**
 * Handle updating invoice status with validation and business logic.
 * Manages invoice lifecycle and payment status transitions.
 * 
 * @param {Request} req - HTTP request object containing status update data
 * @param {SupabaseClient} supabase - Supabase client instance
 * @param {Object|null} user - Authenticated user object
 * @param {Error|null} authError - Authentication error if any
 * @returns {Response} JSON response with updated status information
 * 
 * @throws {Error} Unauthorized access (401)
 * @throws {Error} Invoice not found (404)
 * @throws {Error} Invalid status transition (400)
 * @throws {Error} Database update errors (500)
 */

/**
 * Handle updating invoice status.
 * Updates invoice status with validation of allowed transitions.
 * 
 * Request Body:
 * {
 *   "invoice_id": "invoice_uuid",        // Invoice ID to update (required)
 *   "new_status": "sent",                // New status value (required)
 *   "status_reason": "Sent to customer", // Reason for status change (optional)
 *   "notify_customer": true              // Send notification to customer (optional)
 * }
 * 
 * Valid Status Transitions:
 * - draft → sent, cancelled
 * - sent → paid, overdue, cancelled
 * - paid → refunded
 * - overdue → paid, cancelled
 * - cancelled → (no transitions allowed)
 * - refunded → (no transitions allowed)
 * 
 * Response Format:
 * {
 *   "success": true,
 *   "invoice_id": "invoice_uuid",
 *   "invoice_number": "INV-2024-01-15-0001",
 *   "old_status": "draft",
 *   "new_status": "sent",
 *   "updated_at": "2024-01-16T10:30:00Z",
 *   "updated_by": "admin@example.com"
 * }
 * 
 * Usage Examples:
 * 
 * 1. Send draft invoice to customer:
 * curl -X PATCH "https://your-project.supabase.co/functions/v1/invoices/status" \
 *   -H "Content-Type: application/json" \
 *   -H "Authorization: Bearer YOUR_JWT_TOKEN" \
 *   -d '{
 *     "invoice_id": "123e4567-e89b-12d3-a456-426614174000",
 *     "new_status": "sent",
 *     "status_reason": "Invoice sent via email to customer",
 *     "notify_customer": true
 *   }'
 * 
 * 2. Mark invoice as overdue:
 * curl -X PATCH "https://your-project.supabase.co/functions/v1/invoices/status" \
 *   -H "Content-Type: application/json" \
 *   -H "Authorization: Bearer YOUR_JWT_TOKEN" \
 *   -d '{
 *     "invoice_id": "456e7890-e12b-34d5-a678-901234567890",
 *     "new_status": "overdue",
 *     "status_reason": "Invoice past due date"
 *   }'
 * 
 * 3. Cancel invoice:
 * curl -X PATCH "https://your-project.supabase.co/functions/v1/invoices/status" \
 *   -H "Content-Type: application/json" \
 *   -H "Authorization: Bearer YOUR_JWT_TOKEN" \
 *   -d '{
 *     "invoice_id": "789e0123-e45b-67d8-a901-234567890123",
 *     "new_status": "cancelled",
 *     "status_reason": "Customer cancelled order"
 *   }'
 */
export async function handleUpdateInvoiceStatus(req, supabase, user, authError) {
  if (authError || !user) throw new Error("Unauthorized");
  
  const body = await req.json();
  const { invoice_id, new_status, status_reason, notify_customer = false } = body;
  
  if (!invoice_id || !new_status) {
    return json({ error: "invoice_id and new_status are required" }, 400);
  }
  
  const validStatuses = ['draft', 'sent', 'paid', 'overdue', 'cancelled', 'refunded'];
  if (!validStatuses.includes(new_status)) {
    return json({ error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` }, 400);
  }
  
  // Get current invoice
  const { data: invoice, error: fetchError } = await supabase
    .from('invoices')
    .select('id, invoice_number, status, payment_status, customer_email, total_amount')
    .eq('id', invoice_id)
    .eq('is_deleted', false)
    .maybeSingle();
  
  if (fetchError) throw fetchError;
  if (!invoice) {
    return json({ error: "Invoice not found" }, 404);
  }
  
  // Define valid status transitions
  const statusTransitions = {
    'draft': ['sent', 'cancelled'],
    'sent': ['paid', 'overdue', 'cancelled'],
    'paid': ['refunded'],
    'overdue': ['paid', 'cancelled'],
    'cancelled': [],
    'refunded': []
  };
  
  // Check if transition is allowed
  const allowedTransitions = statusTransitions[invoice.status] || [];
  if (!allowedTransitions.includes(new_status)) {
    return json({ 
      error: `Cannot transition from ${invoice.status} to ${new_status}. Allowed transitions: ${allowedTransitions.join(', ') || 'none'}` 
    }, 400);
  }
  
  const now = new Date().toISOString();
  
  // Build update data
  const updateData = {
    status: new_status,
    updated_at: now,
    updated_by: user.email
  };
  
  // Add status reason to internal notes
  if (status_reason) {
    const { data: currentInvoice } = await supabase
      .from('invoices')
      .select('internal_notes')
      .eq('id', invoice_id)
      .single();
    
    const existingNotes = currentInvoice?.internal_notes || '';
    const statusNote = `\n[STATUS CHANGE ${now}] ${invoice.status} → ${new_status}: ${status_reason}`;
    updateData.internal_notes = existingNotes + statusNote;
  }
  
  // Update payment status based on status
  if (new_status === 'paid') {
    updateData.payment_status = 'paid';
    updateData.payment_date = now;
  } else if (new_status === 'refunded') {
    updateData.payment_status = 'refunded';
  } else if (new_status === 'cancelled') {
    updateData.payment_status = 'failed';
  }
  
  // Perform the update
  const { error: updateError } = await supabase
    .from('invoices')
    .update(updateData)
    .eq('id', invoice_id);
  
  if (updateError) throw updateError;
  
  // Log status change (optional audit trail)
  try {
    await supabase
      .from('invoice_status_history')
      .insert({
        invoice_id,
        old_status: invoice.status,
        new_status,
        reason: status_reason,
        changed_by: user.email,
        changed_at: now
      });
  } catch (historyError) {
    // History logging failure shouldn't prevent status update
    console.warn('Failed to log status change to history:', historyError);
  }
  
  // Send notification if requested
  if (notify_customer && invoice.customer_email) {
    try {
      await sendInvoiceStatusNotification(supabase, {
        email: invoice.customer_email,
        invoice_number: invoice.invoice_number,
        old_status: invoice.status,
        new_status,
        total_amount: invoice.total_amount
      });
    } catch (notificationError) {
      console.warn('Failed to send customer notification:', notificationError);
    }
  }
  
  return json({
    success: true,
    invoice_id: invoice.id,
    invoice_number: invoice.invoice_number,
    old_status: invoice.status,
    new_status,
    updated_at: now,
    updated_by: user.email
  });
}

/**
 * Handle marking invoice as paid with payment details.
 * Records payment information and updates invoice status to paid.
 * 
 * Request Body:
 * {
 *   "invoice_id": "invoice_uuid",        // Invoice ID to mark as paid (required)
 *   "payment_method": "card",            // Payment method used (required)
 *   "payment_reference": "TXN123456",    // Payment transaction reference (optional)
 *   "payment_amount": 150.00,            // Amount paid (optional, defaults to total_amount)
 *   "payment_date": "2024-01-16",        // Payment date (optional, defaults to now)
 *   "payment_notes": "Paid in full"      // Payment notes (optional)
 * }
 * 
 * Response Format:
 * {
 *   "success": true,
 *   "invoice_id": "invoice_uuid",
 *   "invoice_number": "INV-2024-01-15-0001",
 *   "payment_status": "paid",
 *   "payment_amount": 150.00,
 *   "payment_date": "2024-01-16T14:30:00Z",
 *   "payment_method": "card",
 *   "payment_reference": "TXN123456"
 * }
 * 
 * Usage Examples:
 * 
 * 1. Mark invoice as paid with card payment:
 * curl -X PATCH "https://your-project.supabase.co/functions/v1/invoices/mark-paid" \
 *   -H "Content-Type: application/json" \
 *   -H "Authorization: Bearer YOUR_JWT_TOKEN" \
 *   -d '{
 *     "invoice_id": "123e4567-e89b-12d3-a456-426614174000",
 *     "payment_method": "card",
 *     "payment_reference": "txn_1234567890",
 *     "payment_notes": "Payment processed successfully"
 *   }'
 * 
 * 2. Record cash payment:
 * curl -X PATCH "https://your-project.supabase.co/functions/v1/invoices/mark-paid" \
 *   -H "Content-Type: application/json" \
 *   -H "Authorization: Bearer YOUR_JWT_TOKEN" \
 *   -d '{
 *     "invoice_id": "456e7890-e12b-34d5-a678-901234567890",
 *     "payment_method": "cash",
 *     "payment_amount": 100.00,
 *     "payment_date": "2024-01-16T10:00:00Z"
 *   }'
 * 
 * 3. Record partial payment:
 * curl -X PATCH "https://your-project.supabase.co/functions/v1/invoices/mark-paid" \
 *   -H "Content-Type: application/json" \
 *   -H "Authorization: Bearer YOUR_JWT_TOKEN" \
 *   -d '{
 *     "invoice_id": "789e0123-e45b-67d8-a901-234567890123",
 *     "payment_method": "bank_transfer",
 *     "payment_amount": 75.00,
 *     "payment_reference": "WIRE789123"
 *   }'
 */
export async function handleMarkInvoicePaid(req, supabase, user, authError) {
  if (authError || !user) throw new Error("Unauthorized");
  
  const body = await req.json();
  const { 
    invoice_id, 
    payment_method, 
    payment_reference, 
    payment_amount,
    payment_date,
    payment_notes 
  } = body;
  
  if (!invoice_id || !payment_method) {
    return json({ error: "invoice_id and payment_method are required" }, 400);
  }
  
  const validPaymentMethods = ['cash', 'card', 'online', 'bank_transfer', 'check', 'other'];
  if (!validPaymentMethods.includes(payment_method)) {
    return json({ 
      error: `Invalid payment method. Must be one of: ${validPaymentMethods.join(', ')}` 
    }, 400);
  }
  
  // Get current invoice
  const { data: invoice, error: fetchError } = await supabase
    .from('invoices')
    .select('id, invoice_number, status, payment_status, total_amount, customer_email')
    .eq('id', invoice_id)
    .eq('is_deleted', false)
    .maybeSingle();
  
  if (fetchError) throw fetchError;
  if (!invoice) {
    return json({ error: "Invoice not found" }, 404);
  }
  
  // Check if invoice can be marked as paid
  if (invoice.payment_status === 'paid') {
    return json({ error: "Invoice is already marked as paid" }, 400);
  }
  
  if (invoice.status === 'cancelled') {
    return json({ error: "Cannot mark cancelled invoice as paid" }, 400);
  }
  
  const now = new Date().toISOString();
  const finalPaymentDate = payment_date ? new Date(payment_date).toISOString() : now;
  const finalPaymentAmount = payment_amount || invoice.total_amount;
  
  // Determine payment status based on amount
  let payment_status = 'paid';
  if (finalPaymentAmount < invoice.total_amount) {
    payment_status = 'partial';
  }
  
  // Build update data
  const updateData = {
    status: payment_status === 'paid' ? 'paid' : invoice.status,
    payment_status,
    payment_method,
    payment_date: finalPaymentDate,
    payment_reference,
    updated_at: now,
    updated_by: user.email
  };
  
  // Add payment notes to internal notes
  if (payment_notes) {
    const { data: currentInvoice } = await supabase
      .from('invoices')
      .select('internal_notes')
      .eq('id', invoice_id)
      .single();
    
    const existingNotes = currentInvoice?.internal_notes || '';
    const paymentNote = `\n[PAYMENT ${now}] ${payment_method.toUpperCase()}: $${finalPaymentAmount} (${payment_status}) - ${payment_notes}`;
    updateData.internal_notes = existingNotes + paymentNote;
  }
  
  // Perform the update
  const { error: updateError } = await supabase
    .from('invoices')
    .update(updateData)
    .eq('id', invoice_id);
  
  if (updateError) throw updateError;
  
  // Log payment (optional audit trail)
  try {
    await supabase
      .from('invoice_payments')
      .insert({
        invoice_id,
        payment_method,
        payment_amount: finalPaymentAmount,
        payment_date: finalPaymentDate,
        payment_reference,
        notes: payment_notes,
        created_by: user.email,
        created_at: now
      });
  } catch (paymentLogError) {
    console.warn('Failed to log payment to payments table:', paymentLogError);
  }
  
  // Send payment confirmation if customer email exists
  if (invoice.customer_email && payment_status === 'paid') {
    try {
      await sendPaymentConfirmation(supabase, {
        email: invoice.customer_email,
        invoice_number: invoice.invoice_number,
        payment_amount: finalPaymentAmount,
        payment_method,
        payment_date: finalPaymentDate
      });
    } catch (notificationError) {
      console.warn('Failed to send payment confirmation:', notificationError);
    }
  }
  
  return json({
    success: true,
    invoice_id: invoice.id,
    invoice_number: invoice.invoice_number,
    payment_status,
    payment_amount: finalPaymentAmount,
    payment_date: finalPaymentDate,
    payment_method,
    payment_reference
  });
}

// Helper function to send invoice status notifications
async function sendInvoiceStatusNotification(supabase, data) {
  // This would integrate with your email service (SendGrid, Mailgun, etc.)
  // For now, we'll just log the notification
  console.log('Invoice status notification:', data);
  
  // Example implementation:
  // await supabase.functions.invoke('send-email', {
  //   body: {
  //     to: data.email,
  //     template: 'invoice-status-change',
  //     data: {
  //       invoice_number: data.invoice_number,
  //       old_status: data.old_status,
  //       new_status: data.new_status,
  //       total_amount: data.total_amount
  //     }
  //   }
  // });
}

// Helper function to send payment confirmations
async function sendPaymentConfirmation(supabase, data) {
  // This would integrate with your email service
  console.log('Payment confirmation:', data);
  
  // Example implementation:
  // await supabase.functions.invoke('send-email', {
  //   body: {
  //     to: data.email,
  //     template: 'payment-confirmation',
  //     data: {
  //       invoice_number: data.invoice_number,
  //       payment_amount: data.payment_amount,
  //       payment_method: data.payment_method,
  //       payment_date: data.payment_date
  //     }
  //   }
  // });
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    headers: { "Content-Type": "application/json" },
    status
  });
}
