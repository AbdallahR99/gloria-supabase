// File: functions/invoices/create.ts

export async function handleCreateInvoiceFromOrder(req, supabase, user, authError) {
  if (authError || !user) throw new Error("Unauthorized");
  
  const body = await req.json();
  const { order_code } = body;

  if (!order_code) {
    return json({
      message: "order_code is required"
    }, 400);
  }

  try {
    // Check if invoice already exists for this order
    const { data: existingInvoice } = await supabase
      .from("invoices")
      .select("id, invoice_number")
      .eq("order_code", order_code)
      .eq("is_deleted", false)
      .single();

    if (existingInvoice) {
      return json({
        message: "Invoice already exists for this order",
        data: existingInvoice
      }, 409);
    }

    // Get order details
    const { data: order, error: orderError } = await supabase
      .from("orders")
      .select(`
        *,
        order_items (
          *
        )
      `)
      .eq("order_code", order_code)
      .single();

    if (orderError || !order) {
      return json({ message: "Order not found" }, 404);
    }

    // Generate invoice number
    const { data: invoiceNumberData } = await supabase
      .rpc('generate_invoice_number');
    
    const invoice_number = invoiceNumberData;
    const now = new Date().toISOString();

    // Calculate totals from order
    const calculated_subtotal = order.subtotal || 0;
    const calculated_total = order.total_amount || calculated_subtotal;

    // Create the invoice with cloned data from the order
    const { data: invoice, error: invoiceError } = await supabase
      .from("invoices")
      .insert({
        invoice_number,
        order_code: order.order_code,
        user_id: order.user_id?.toString(),
        user_email: order.user_email || '',
        user_phone: order.user_phone || '',
        billing_first_name: order.billing_first_name || '',
        billing_last_name: order.billing_last_name || '',
        billing_phone: order.billing_phone || '',
        billing_email: order.billing_email || '',
        billing_city: order.billing_city || '',
        billing_state: order.billing_state || '',
        billing_area: order.billing_area || '',
        billing_street: order.billing_street || '',
        billing_building: order.billing_building || '',
        billing_apartment: order.billing_apartment || '',
        billing_notes: order.billing_notes || '',
        subtotal: calculated_subtotal,
        delivery_fee: order.delivery_fee || 0,
        total_amount: calculated_total,
        currency: order.currency || 'AED',
        invoice_date: now,
        payment_status: 'pending',
        is_manual: false,
        created_at: now,
        updated_at: now,
        created_by: user.email,
        updated_by: user.email
      })
      .select()
      .single();

    if (invoiceError) {
      throw invoiceError;
    }

    // Create invoice items from order items
    if (order.order_items && order.order_items.length > 0) {
      const invoice_items = order.order_items
        .filter(item => !item.is_deleted && item.product_sku)
        .map(item => ({
          invoice_id: invoice.id,
          product_sku: item.product_sku,
          product_name_en: item.product_name_en || '',
          product_name_ar: item.product_name_ar || '',
          quantity: item.quantity,
          unit_price: item.unit_price || 0,
          total_price: item.total_price || (item.quantity * (item.unit_price || 0)),
          size: item.size || '',
          color: item.color || '',
          created_at: now,
          updated_at: now,
          created_by: user.email,
          updated_by: user.email
        }));

      if (invoice_items.length > 0) {
        const { error: itemsError } = await supabase
          .from("invoice_items")
          .insert(invoice_items);

        if (itemsError) {
          throw itemsError;
        }
      }
    }

    return json({
      data: invoice,
      message: "Invoice created from order successfully"
    }, 201);

  } catch (error) {
    console.error("Error creating invoice from order:", error);
    return json({
      message: "Failed to create invoice from order",
      error: error.message
    }, 500);
  }
}

export async function handleCreateManualInvoice(req, supabase, user, authError) {
  if (authError || !user) throw new Error("Unauthorized");
  
  const body = await req.json();  const {
    user_id,
    billing_address_id, // Optional: reference to copy billing info from existing address
    billing_details, // Alternative: custom billing details
    items, // Array of { product_sku, quantity, unit_price?, size?, color?, product_name_en?, product_name_ar? }
    notes_en,
    notes_ar,
    payment_method, // 'cash' | 'card' | 'bank_transfer' | 'digital_wallet' | 'credit' | 'other'
    payment_status = 'pending', // 'pending' | 'paid' | 'overdue' | 'cancelled' | 'refunded' | 'failed'
    due_date,
    delivery_fee = 0 // Optional delivery fee override
  } = body;

  if (!user_id || !items || !Array.isArray(items) || items.length === 0) {
    return json({
      message: "user_id and items array are required"
    }, 400);
  }
  const now = new Date().toISOString();
  let subtotal = 0;

  try {
    // Get invoice number
    const { data: invoiceNumberData } = await supabase
      .rpc('generate_invoice_number');
    
    const invoice_number = invoiceNumberData;

    // Prepare billing information
    let billing_info = {};
      if (billing_address_id) {
      // Use existing address - clone the data for independence
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
        return json({ message: "Billing address not found" }, 404);
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
      // Use custom billing details - store directly for independence
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
    }    // Validate and prepare invoice items with product data cloning
    const invoice_items = [];
    const product_skus = items.map(item => item.product_sku);
    
    // Get product information for all SKUs to clone the data
    const { data: products, error: productsError } = await supabase
      .from("products")
      .select("sku, name_en, name_ar, price")
      .in("sku", product_skus)
      .eq("is_deleted", false);

    if (productsError) {
      throw productsError;
    }

    const productMap = Object.fromEntries(
      products.map(p => [p.sku, p])
    );    // Validate items and calculate totals
    for (const item of items) {
      // Allow manual product data or lookup from products table
      let product_name_en = item.product_name_en;
      let product_name_ar = item.product_name_ar;
      let default_unit_price = item.unit_price;

      // If product names not provided, try to get from products table
      const product = productMap[item.product_sku];
      
      // Use product data if available, otherwise fallback to SKU or provided data
      product_name_en = product_name_en || product?.name_en || `Product ${item.product_sku}`;
      product_name_ar = product_name_ar || product?.name_ar || `منتج ${item.product_sku}`;
      default_unit_price = default_unit_price || product?.price || 0;

      // If no unit price is provided and product doesn't exist, require manual price
      if (default_unit_price === 0 && !item.unit_price) {
        return json({
          message: `Product with SKU '${item.product_sku}' not found. Please provide unit_price manually.`
        }, 400);
      }

      const quantity = item.quantity || 1;
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

    const total_amount = subtotal + delivery_fee;    // Create the invoice with cloned data
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
      throw invoiceError;
    }

    // Add invoice_id to items and insert them
    const items_with_invoice_id = invoice_items.map(item => ({
      ...item,
      invoice_id: invoice.id
    }));

    const { error: itemsError } = await supabase
      .from("invoice_items")
      .insert(items_with_invoice_id);

    if (itemsError) {
      throw itemsError;
    }

    return json({
      data: invoice,
      message: "Manual invoice created successfully"
    }, 201);

  } catch (error) {
    console.error("Error creating manual invoice:", error);
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
