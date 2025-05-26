// File: functions/invoices/delete.ts
export async function handleDeleteInvoice(req, supabase, user, authError) {
  if (authError || !user) throw new Error("Unauthorized");
  
  const url = new URL(req.url);
  const pathParts = url.pathname.split('/');
  const invoiceId = pathParts[pathParts.length - 1];
  
  if (!invoiceId) {
    return json({ message: "Invoice ID is required" }, 400);
  }

  try {
    // First, check if the invoice exists and user has permission
    const { data: existingInvoice, error: fetchError } = await supabase
      .from("invoices")
      .select("id, user_id, payment_status, is_manual, order_code")
      .eq("id", invoiceId)
      .eq("is_deleted", false)
      .single();

    if (fetchError || !existingInvoice) {
      return json({ message: "Invoice not found" }, 404);
    }

    // Check permissions (user owns invoice or is staff)
    if (existingInvoice.user_id !== user.id) {
      // TODO: Add staff role check here
      throw new Error("Unauthorized to delete this invoice");
    }

    // Check if invoice can be deleted
    if (existingInvoice.payment_status === 'paid') {
      return json({
        message: "Cannot delete a paid invoice"
      }, 400);
    }

    // Auto-generated invoices (linked to orders) should be handled carefully
    if (!existingInvoice.is_manual && existingInvoice.order_code) {
      return json({
        message: "Cannot delete auto-generated invoice. Contact support if needed."
      }, 400);
    }

    const now = new Date().toISOString();

    // Soft delete the invoice and its items
    const { error: updateError } = await supabase
      .from("invoices")
      .update({
        is_deleted: true,
        deleted_at: now,
        deleted_by: user.email,
        updated_at: now,
        updated_by: user.email
      })
      .eq("id", invoiceId);

    if (updateError) {
      throw updateError;
    }

    // Soft delete invoice items
    const { error: itemsError } = await supabase
      .from("invoice_items")
      .update({
        is_deleted: true,
        deleted_at: now,
        deleted_by: user.email,
        updated_at: now,
        updated_by: user.email
      })
      .eq("invoice_id", invoiceId);

    if (itemsError) {
      console.error("Error soft deleting invoice items:", itemsError);
      // Don't throw here as the main invoice is already deleted
    }

    return json({
      message: "Invoice deleted successfully"
    });

  } catch (error) {
    console.error("Error deleting invoice:", error);
    throw error;
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
