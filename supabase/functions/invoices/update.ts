// File: functions/invoices/update.ts
export async function handleUpdateInvoice(req, supabase, user, authError) {
  if (authError || !user) throw new Error("Unauthorized");
  
  const url = new URL(req.url);
  const pathParts = url.pathname.split('/');
  const invoiceId = pathParts[pathParts.length - 1];
  
  if (!invoiceId) {
    return json({ message: "Invoice ID is required" }, 400);
  }

  const body = await req.json();
  const {
    payment_status,
    payment_method,
    payment_date,
    notes_en,
    notes_ar,
    due_date,
    billing_details // For updating billing information
  } = body;

  try {
    // First, check if the invoice exists and user has permission
    const { data: existingInvoice, error: fetchError } = await supabase
      .from("invoices")
      .select("id, user_id, payment_status, is_manual")
      .eq("id", invoiceId)
      .eq("is_deleted", false)
      .single();

    if (fetchError || !existingInvoice) {
      return json({ message: "Invoice not found" }, 404);
    }

    // Check permissions (user owns invoice or is staff)
    if (existingInvoice.user_id !== user.id) {
      // TODO: Add staff role check here
      throw new Error("Unauthorized to update this invoice");
    }

    const now = new Date().toISOString();
    const updateData = {
      updated_at: now,
      updated_by: user.email
    };

    // Update payment information
    if (payment_status !== undefined) {
      updateData.payment_status = payment_status;
      
      // If marking as paid, set payment date if not provided
      if (payment_status === 'paid' && !payment_date) {
        updateData.payment_date = now;
      } else if (payment_date) {
        updateData.payment_date = payment_date;
      }
    }

    if (payment_method !== undefined) {
      updateData.payment_method = payment_method;
    }

    if (payment_date !== undefined) {
      updateData.payment_date = payment_date;
    }

    if (notes_en !== undefined) {
      updateData.notes_en = notes_en;
    }

    if (notes_ar !== undefined) {
      updateData.notes_ar = notes_ar;
    }

    if (due_date !== undefined) {
      updateData.due_date = due_date;
    }

    // Update billing details if provided (only for manual invoices)
    if (billing_details && existingInvoice.is_manual) {
      if (billing_details.first_name !== undefined) {
        updateData.billing_first_name = billing_details.first_name;
      }
      if (billing_details.last_name !== undefined) {
        updateData.billing_last_name = billing_details.last_name;
      }
      if (billing_details.phone !== undefined) {
        updateData.billing_phone = billing_details.phone;
      }
      if (billing_details.email !== undefined) {
        updateData.billing_email = billing_details.email;
      }
      if (billing_details.company !== undefined) {
        updateData.billing_company = billing_details.company;
      }
      if (billing_details.city !== undefined) {
        updateData.billing_city = billing_details.city;
      }      if (billing_details.state !== undefined) {
        updateData.billing_state = billing_details.state; // Store state name directly
      }
      if (billing_details.area !== undefined) {
        updateData.billing_area = billing_details.area;
      }
      if (billing_details.street !== undefined) {
        updateData.billing_street = billing_details.street;
      }
      if (billing_details.building !== undefined) {
        updateData.billing_building = billing_details.building;
      }
      if (billing_details.apartment !== undefined) {
        updateData.billing_apartment = billing_details.apartment;
      }
      if (billing_details.notes !== undefined) {
        updateData.billing_notes = billing_details.notes;
      }
    }    // Update the invoice
    const { data: updatedInvoice, error: updateError } = await supabase
      .from("invoices")
      .update(updateData)
      .eq("id", invoiceId)
      .select(`
        *,
        invoice_items(*)
      `)
      .single();

    if (updateError) {
      throw updateError;
    }

    return json({
      data: updatedInvoice,
      message: "Invoice updated successfully"
    });

  } catch (error) {
    console.error("Error updating invoice:", error);
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
