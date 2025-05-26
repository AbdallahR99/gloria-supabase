// File: functions/invoices/update-payment-status.ts

export async function handleUpdatePaymentStatus(req, supabase, user, authError) {
  if (authError || !user) throw new Error("Unauthorized");
  
  const url = new URL(req.url);
  const invoice_id = url.pathname.split('/')[2]; // Extract ID from path like /invoices/{id}/payment-status
  
  const body = await req.json();
  const {
    payment_status,
    payment_method,
    payment_date,
    notes_en,
    notes_ar
  } = body;

  // Validate payment_status enum
  const validPaymentStatuses = ['pending', 'paid', 'overdue', 'cancelled', 'refunded', 'failed'];
  if (!payment_status || !validPaymentStatuses.includes(payment_status)) {
    return json({
      message: `Invalid payment_status. Must be one of: ${validPaymentStatuses.join(', ')}`
    }, 400);
  }

  // Validate payment_method enum if provided
  const validPaymentMethods = ['cash', 'card', 'bank_transfer', 'digital_wallet', 'credit', 'other'];
  if (payment_method && !validPaymentMethods.includes(payment_method)) {
    return json({
      message: `Invalid payment_method. Must be one of: ${validPaymentMethods.join(', ')}`
    }, 400);
  }

  try {
    // Check if invoice exists and user has permission
    const { data: existingInvoice, error: fetchError } = await supabase
      .from("invoices")
      .select("id, payment_status, user_id")
      .eq("id", invoice_id)
      .eq("is_deleted", false)
      .single();

    if (fetchError || !existingInvoice) {
      return json({ message: "Invoice not found" }, 404);
    }

    // Prepare update data
    const updateData = {
      payment_status,
      updated_at: new Date().toISOString(),
      updated_by: user.email
    };

    // Add payment method if provided
    if (payment_method) {
      updateData.payment_method = payment_method;
    }

    // Add payment date if provided, or set to now if status is 'paid'
    if (payment_date) {
      updateData.payment_date = payment_date;
    } else if (payment_status === 'paid') {
      updateData.payment_date = new Date().toISOString();
    }

    // Add notes if provided
    if (notes_en !== undefined) {
      updateData.notes_en = notes_en;
    }
    if (notes_ar !== undefined) {
      updateData.notes_ar = notes_ar;
    }

    // Update the invoice
    const { data: updatedInvoice, error: updateError } = await supabase
      .from("invoices")
      .update(updateData)
      .eq("id", invoice_id)
      .select()
      .single();

    if (updateError) {
      throw updateError;
    }

    return json({
      data: updatedInvoice,
      message: "Payment status updated successfully"
    });

  } catch (error) {
    console.error("Error updating payment status:", error);
    return json({
      message: "Failed to update payment status",
      error: error.message
    }, 500);
  }
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
    },
  });
}