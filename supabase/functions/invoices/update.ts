// File: functions/invoices/update.ts

/**
 * Handle updating invoice information.
 * Allows modification of invoice details, customer information, and payment data.
 * 
 * @param {Request} req - HTTP request object containing update data
 * @param {SupabaseClient} supabase - Supabase client instance
 * @param {Object|null} user - Authenticated user object
 * @param {Error|null} authError - Authentication error if any
 * @returns {Response} JSON response with updated invoice data
 * 
 * @throws {Error} Unauthorized access (401)
 * @throws {Error} Invoice not found (404)
 * @throws {Error} Invalid update data (400)
 * @throws {Error} Business rule violations (400)
 * @throws {Error} Database update errors (500)
 * 
 * Request Body:
 * {
 *   "invoice_id": "invoice_uuid",        // Invoice ID to update (required)
 *   "customer_name": "Jane Smith",       // Updated customer name (optional)
 *   "customer_email": "jane@example.com", // Updated customer email (optional)
 *   "customer_phone": "+1234567890",     // Updated customer phone (optional)
 *   "customer_address": "456 Oak St",    // Updated customer address (optional)
 *   "tax_rate": 8.5,                     // Updated tax rate percentage (optional)
 *   "discount_amount": 25.00,            // Updated discount amount (optional)
 *   "shipping_amount": 10.00,            // Updated shipping amount (optional)
 *   "payment_method": "bank_transfer",   // Updated payment method (optional)
 *   "payment_reference": "TXN789123",    // Updated payment reference (optional)
 *   "due_date": "2024-02-28",            // Updated due date (optional)
 *   "notes": "Updated customer notes",   // Updated customer notes (optional)
 *   "internal_notes": "Staff notes here", // Updated internal notes (optional)
 *   "recalculate_totals": true           // Whether to recalculate totals (optional, default: true)
 * }
 * 
 * Response Format:
 * {
 *   "id": "invoice_uuid",
 *   "invoice_number": "INV-2024-01-15-0001",
 *   "status": "draft",
 *   "customer_name": "Jane Smith",
 *   "customer_email": "jane@example.com",
 *   "customer_phone": "+1234567890",
 *   "customer_address": "456 Oak St",
 *   "subtotal": 150.00,
 *   "tax_amount": 12.75,
 *   "tax_rate": 8.5,
 *   "discount_amount": 25.00,
 *   "shipping_amount": 10.00,
 *   "total_amount": 147.75,
 *   "payment_method": "bank_transfer",
 *   "payment_reference": "TXN789123",
 *   "due_date": "2024-02-28T00:00:00Z",
 *   "notes": "Updated customer notes",
 *   "internal_notes": "Staff notes here",
 *   "updated_at": "2024-01-16T09:15:00Z",
 *   "updated_by": "admin@example.com"
 * }
 * 
 * Update Rules:
 * - Only draft and sent invoices can be modified
 * - Paid invoices cannot be edited (except notes and internal notes)
 * - Cancelled invoices cannot be modified
 * - Tax rate must be between 0 and 100
 * - Discount and shipping amounts must be non-negative
 * - Due date cannot be in the past for draft invoices
 * - Totals are automatically recalculated when financial fields change
 * 
 * Usage Examples:
 * 
 * 1. Update customer information:
 * curl -X PUT "https://your-project.supabase.co/functions/v1/invoices" \
 *   -H "Content-Type: application/json" \
 *   -H "Authorization: Bearer YOUR_JWT_TOKEN" \
 *   -d '{
 *     "invoice_id": "123e4567-e89b-12d3-a456-426614174000",
 *     "customer_name": "Jane Smith",
 *     "customer_email": "jane.smith@email.com",
 *     "customer_phone": "+1-555-987-6543"
 *   }'
 * 
 * 2. Update financial details:
 * curl -X PUT "https://your-project.supabase.co/functions/v1/invoices" \
 *   -H "Content-Type: application/json" \
 *   -H "Authorization: Bearer YOUR_JWT_TOKEN" \
 *   -d '{
 *     "invoice_id": "123e4567-e89b-12d3-a456-426614174000",
 *     "tax_rate": 10.0,
 *     "discount_amount": 50.00,
 *     "shipping_amount": 15.00,
 *     "recalculate_totals": true
 *   }'
 * 
 * 3. Update payment information:
 * curl -X PUT "https://your-project.supabase.co/functions/v1/invoices" \
 *   -H "Content-Type: application/json" \
 *   -H "Authorization: Bearer YOUR_JWT_TOKEN" \
 *   -d '{
 *     "invoice_id": "123e4567-e89b-12d3-a456-426614174000",
 *     "payment_method": "cash",
 *     "payment_reference": "CASH-001",
 *     "due_date": "2024-03-15"
 *   }'
 * 
 * 4. Update notes only (allowed for paid invoices):
 * curl -X PUT "https://your-project.supabase.co/functions/v1/invoices" \
 *   -H "Content-Type: application/json" \
 *   -H "Authorization: Bearer YOUR_JWT_TOKEN" \
 *   -d '{
 *     "invoice_id": "123e4567-e89b-12d3-a456-426614174000",
 *     "notes": "Customer requested copy of invoice",
 *     "internal_notes": "Customer called on 2024-01-16"
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
 * Cannot modify paid invoice (400):
 * {
 *   "error": "Cannot modify financial details of paid invoice"
 * }
 * 
 * Invalid tax rate (400):
 * {
 *   "error": "Tax rate must be between 0 and 100"
 * }
 * 
 * Due date in past (400):
 * {
 *   "error": "Due date cannot be in the past"
 * }
 * 
 * Notes:
 * - Automatically recalculates totals when financial fields are updated
 * - Preserves audit trail with updated_by and updated_at timestamps
 * - Validates business rules before applying updates
 * - Supports partial updates - only provided fields are modified
 * - Notes and internal notes can be updated for any invoice status
 * - Financial details can only be modified for draft and sent invoices
 */
export async function handleUpdateInvoice(req, supabase, user, authError) {
  if (authError || !user) throw new Error("Unauthorized");
  
  const body = await req.json();
  const {
    invoice_id,
    customer_name,
    customer_email,
    customer_phone,
    customer_address,
    tax_rate,
    discount_amount,
    shipping_amount,
    payment_method,
    payment_reference,
    due_date,
    notes,
    internal_notes,
    recalculate_totals = true
  } = body;
  
  if (!invoice_id) {
    return json({ error: "Invoice ID is required" }, 400);
  }
  
  // Get current invoice to check status and validate updates
  const { data: currentInvoice, error: fetchError } = await supabase
    .from('invoices')
    .select('id, status, payment_status, subtotal')
    .eq('id', invoice_id)
    .eq('is_deleted', false)
    .maybeSingle();
  
  if (fetchError) throw fetchError;
  if (!currentInvoice) {
    return json({ error: "Invoice not found" }, 404);
  }
  
  // Check if financial updates are allowed
  const isFinancialUpdate = tax_rate !== undefined || discount_amount !== undefined || 
                           shipping_amount !== undefined || payment_method !== undefined ||
                           payment_reference !== undefined || due_date !== undefined ||
                           customer_name !== undefined || customer_email !== undefined ||
                           customer_phone !== undefined || customer_address !== undefined;
  
  const canModifyFinancials = ['draft', 'sent'].includes(currentInvoice.status) && 
                             currentInvoice.payment_status !== 'paid';
  
  if (isFinancialUpdate && !canModifyFinancials) {
    return json({ error: "Cannot modify financial details of paid invoice" }, 400);
  }
  
  // Validate input values
  if (tax_rate !== undefined && (tax_rate < 0 || tax_rate > 100)) {
    return json({ error: "Tax rate must be between 0 and 100" }, 400);
  }
  
  if (discount_amount !== undefined && discount_amount < 0) {
    return json({ error: "Discount amount cannot be negative" }, 400);
  }
  
  if (shipping_amount !== undefined && shipping_amount < 0) {
    return json({ error: "Shipping amount cannot be negative" }, 400);
  }
  
  if (due_date !== undefined) {
    const dueDateObj = new Date(due_date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    if (dueDateObj < today && currentInvoice.status === 'draft') {
      return json({ error: "Due date cannot be in the past" }, 400);
    }
  }
  
  // Build update object
  const updateData = {
    updated_at: new Date().toISOString(),
    updated_by: user.email
  };
  
  // Add fields that can always be updated
  if (notes !== undefined) updateData.notes = notes;
  if (internal_notes !== undefined) updateData.internal_notes = internal_notes;
  
  // Add financial fields if allowed
  if (canModifyFinancials) {
    if (customer_name !== undefined) updateData.customer_name = customer_name;
    if (customer_email !== undefined) updateData.customer_email = customer_email;
    if (customer_phone !== undefined) updateData.customer_phone = customer_phone;
    if (customer_address !== undefined) updateData.customer_address = customer_address;
    if (tax_rate !== undefined) updateData.tax_rate = tax_rate;
    if (discount_amount !== undefined) updateData.discount_amount = discount_amount;
    if (shipping_amount !== undefined) updateData.shipping_amount = shipping_amount;
    if (payment_method !== undefined) updateData.payment_method = payment_method;
    if (payment_reference !== undefined) updateData.payment_reference = payment_reference;
    if (due_date !== undefined) updateData.due_date = new Date(due_date).toISOString();
    
    // Recalculate totals if financial fields changed and requested
    if (recalculate_totals && (tax_rate !== undefined || discount_amount !== undefined || shipping_amount !== undefined)) {
      const newTaxRate = tax_rate !== undefined ? tax_rate : (await getCurrentTaxRate(supabase, invoice_id));
      const newDiscountAmount = discount_amount !== undefined ? discount_amount : (await getCurrentDiscountAmount(supabase, invoice_id));
      const newShippingAmount = shipping_amount !== undefined ? shipping_amount : (await getCurrentShippingAmount(supabase, invoice_id));
      
      const subtotal = currentInvoice.subtotal;
      const taxAmount = (subtotal * newTaxRate) / 100;
      const totalAmount = subtotal + taxAmount - newDiscountAmount + newShippingAmount;
      
      updateData.tax_amount = taxAmount;
      updateData.total_amount = totalAmount;
    }
  }
  
  // Perform the update
  const { data: updatedInvoice, error: updateError } = await supabase
    .from('invoices')
    .update(updateData)
    .eq('id', invoice_id)
    .select(`
      id,
      invoice_number,
      status,
      customer_name,
      customer_email,
      customer_phone,
      customer_address,
      subtotal,
      tax_amount,
      tax_rate,
      discount_amount,
      shipping_amount,
      total_amount,
      payment_method,
      payment_reference,
      due_date,
      notes,
      internal_notes,
      updated_at,
      updated_by
    `)
    .single();
  
  if (updateError) throw updateError;
  
  return json(updatedInvoice);
}

// Helper functions to get current values
async function getCurrentTaxRate(supabase, invoiceId) {
  const { data } = await supabase
    .from('invoices')
    .select('tax_rate')
    .eq('id', invoiceId)
    .single();
  return data?.tax_rate || 0;
}

async function getCurrentDiscountAmount(supabase, invoiceId) {
  const { data } = await supabase
    .from('invoices')
    .select('discount_amount')
    .eq('id', invoiceId)
    .single();
  return data?.discount_amount || 0;
}

async function getCurrentShippingAmount(supabase, invoiceId) {
  const { data } = await supabase
    .from('invoices')
    .select('shipping_amount')
    .eq('id', invoiceId)
    .single();
  return data?.shipping_amount || 0;
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    headers: { "Content-Type": "application/json" },
    status
  });
}
