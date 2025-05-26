// File: functions/invoices/bulk.ts
export async function handleBulkCreateInvoices(req, supabase, user, authError) {
  if (authError || !user) throw new Error("Unauthorized");
  
  const body = await req.json();
  
  if (!Array.isArray(body)) {
    return json({
      message: "Expected array of invoice data"
    }, 400);
  }

  const now = new Date().toISOString();
  const results = [];
  const errors = [];

  for (let i = 0; i < body.length; i++) {
    try {
      const invoiceData = body[i];
      const {
        user_id,
        billing_address_id,
        billing_details,
        items,
        notes_en,
        notes_ar,
        payment_method,
        payment_status = 'pending',
        due_date
      } = invoiceData;

      if (!user_id || !items || !Array.isArray(items) || items.length === 0) {
        errors.push({
          index: i,
          message: "user_id and items array are required"
        });
        continue;
      }

      // Generate invoice number
      const { data: invoiceNumberData } = await supabase
        .rpc('generate_invoice_number');
      
      const invoice_number = invoiceNumberData;

      let subtotal = 0;
      let delivery_fee = 0;
      let billing_info = {};      // Handle billing information - clone data for independence
      if (billing_address_id) {
        const { data: address, error: addressError } = await supabase
          .from("addresses")
          .select(`
            first_name,
            last_name,
            phone,
            city,
            state,
            area,
            street,
            building,
            apartment,
            notes
          `)
          .eq("id", billing_address_id)
          .eq("user_id", user_id)
          .single();

        if (addressError || !address) {
          errors.push({
            index: i,
            message: "Billing address not found"
          });
          continue;
        }

        billing_info = {
          billing_first_name: address.first_name,
          billing_last_name: address.last_name,
          billing_phone: address.phone,
          billing_city: address.city,
          billing_state: address.state, // Store state name directly
          billing_area: address.area,
          billing_street: address.street,
          billing_building: address.building,
          billing_apartment: address.apartment,
          billing_notes: address.notes
        };        } else if (billing_details) {
        billing_info = {
          billing_first_name: billing_details.first_name,
          billing_last_name: billing_details.last_name,
          billing_phone: billing_details.phone,
          billing_email: billing_details.email,
          billing_company: billing_details.company,
          billing_city: billing_details.city,
          billing_state: billing_details.state, // Store state name directly
          billing_area: billing_details.area,
          billing_street: billing_details.street,
          billing_building: billing_details.building,
          billing_apartment: billing_details.apartment,
          billing_notes: billing_details.notes
        };
      }

      // Set delivery fee from invoiceData or default
      const delivery_fee = invoiceData.delivery_fee || 0;      // Validate and prepare invoice items with product data cloning
      const invoice_items = [];
      const product_skus = items.map(item => item.product_sku);
      
      const { data: products, error: productsError } = await supabase
        .from("products")
        .select("sku, name_en, name_ar, price")
        .in("sku", product_skus)
        .eq("is_deleted", false);

      if (productsError) {
        errors.push({
          index: i,
          message: "Error fetching products: " + productsError.message
        });
        continue;
      }

      const productMap = Object.fromEntries(
        products.map(p => [p.sku, p])
      );      let hasInvalidItems = false;
      for (const item of items) {
        // Allow manual product data or lookup from products table
        let product_name_en = item.product_name_en;
        let product_name_ar = item.product_name_ar;
        let default_unit_price = item.unit_price;

        // Try to get product data, but don't fail if product doesn't exist
        const product = productMap[item.product_sku];
        
        // Use product data if available, otherwise fallback to SKU or provided data
        product_name_en = product_name_en || product?.name_en || `Product ${item.product_sku}`;
        product_name_ar = product_name_ar || product?.name_ar || `منتج ${item.product_sku}`;
        default_unit_price = default_unit_price || product?.price || 0;

        // If no unit price is provided and product doesn't exist, require manual price
        if (default_unit_price === 0 && !item.unit_price) {
          errors.push({
            index: i,
            message: `Product with SKU '${item.product_sku}' not found. Please provide unit_price manually.`
          });
          hasInvalidItems = true;
          continue;
        }const quantity = item.quantity || 1;
        const unit_price = item.unit_price || default_unit_price;
        const total_price = quantity * unit_price;
        
        subtotal += total_price;

        invoice_items.push({
          product_sku: item.product_sku,
          product_name_en,
          product_name_ar,
          quantity,
          unit_price,
          total_price,
          size: item.size,
          color: item.color,
          created_at: now,
          updated_at: now,
          created_by: user.email,
          updated_by: user.email
        });
      }

      if (hasInvalidItems) continue;

      const total_amount = subtotal + delivery_fee;

      // Create the invoice
      const { data: invoice, error: invoiceError } = await supabase
        .from("invoices")
        .insert({
          invoice_number,
          user_id,
          ...billing_info,
          subtotal,
          delivery_fee,
          total_amount,
          currency: 'AED',
          due_date,
          payment_status,
          payment_method,
          notes_en,
          notes_ar,
          is_manual: true,
          created_at: now,
          updated_at: now,
          created_by: user.email,
          updated_by: user.email
        })
        .select()
        .single();

      if (invoiceError) {
        errors.push({
          index: i,
          message: "Error creating invoice: " + invoiceError.message
        });
        continue;
      }

      // Add invoice items
      const items_with_invoice_id = invoice_items.map(item => ({
        ...item,
        invoice_id: invoice.id
      }));

      const { error: itemsError } = await supabase
        .from("invoice_items")
        .insert(items_with_invoice_id);

      if (itemsError) {
        errors.push({
          index: i,
          message: "Error creating invoice items: " + itemsError.message
        });
        continue;
      }

      results.push({
        index: i,
        invoice
      });

    } catch (error) {
      errors.push({
        index: i,
        message: error.message
      });
    }
  }

  return json({
    data: results,
    errors: errors,
    message: `Processed ${body.length} invoices. ${results.length} successful, ${errors.length} failed.`
  }, results.length > 0 ? 201 : 400);
}

export async function handleBulkDeleteInvoices(req, supabase, user, authError) {
  if (authError || !user) throw new Error("Unauthorized");
  
  const body = await req.json();
  
  if (!Array.isArray(body)) {
    return json({
      message: "Expected array of invoice IDs"
    }, 400);
  }

  const now = new Date().toISOString();
  const results = [];
  const errors = [];

  for (let i = 0; i < body.length; i++) {
    try {
      const invoiceId = body[i];

      if (!invoiceId) {
        errors.push({
          index: i,
          message: "Invoice ID is required"
        });
        continue;
      }

      // Check if invoice exists and user has permission
      const { data: existingInvoice, error: fetchError } = await supabase
        .from("invoices")
        .select("id, user_id, payment_status, is_manual, order_code")
        .eq("id", invoiceId)
        .eq("is_deleted", false)
        .single();

      if (fetchError || !existingInvoice) {
        errors.push({
          index: i,
          message: "Invoice not found"
        });
        continue;
      }

      if (existingInvoice.user_id !== user.id) {
        errors.push({
          index: i,
          message: "Unauthorized to delete this invoice"
        });
        continue;
      }

      if (existingInvoice.payment_status === 'paid') {
        errors.push({
          index: i,
          message: "Cannot delete a paid invoice"
        });
        continue;
      }

      if (!existingInvoice.is_manual && existingInvoice.order_code) {
        errors.push({
          index: i,
          message: "Cannot delete auto-generated invoice"
        });
        continue;
      }

      // Soft delete the invoice
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
        errors.push({
          index: i,
          message: "Error deleting invoice: " + updateError.message
        });
        continue;
      }

      // Soft delete invoice items
      await supabase
        .from("invoice_items")
        .update({
          is_deleted: true,
          deleted_at: now,
          deleted_by: user.email,
          updated_at: now,
          updated_by: user.email
        })
        .eq("invoice_id", invoiceId);

      results.push({
        index: i,
        invoiceId
      });

    } catch (error) {
      errors.push({
        index: i,
        message: error.message
      });
    }
  }

  return json({
    data: results,
    errors: errors,
    message: `Processed ${body.length} invoices. ${results.length} deleted successfully, ${errors.length} failed.`
  });
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
    },
  });
}
