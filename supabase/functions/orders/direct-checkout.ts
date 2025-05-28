// direct functions/orders/direct-checkout.ts

export async function handleDirectCheckout(req, supabase, user, authError) {
  if (authError || !user) throw new Error("Unauthorized");

  const body = await req.json();
  const {
    product_id,
    quantity = 1,
    size = null,
    color = null,
    address_id,
    note,
    user_id: customUserId
  } = body;

  if (!product_id || !address_id) {
    return json({ message: "Missing product_id or address_id" }, 400);
  }

  const userId = customUserId ?? user.id;
  const now = new Date().toISOString();

  // ✅ Step 1: Fetch product
  const { data: product, error: productError } = await supabase
    .from("products")
    .select("id, price, old_price")
    .eq("id", product_id)
    .eq("is_deleted", false)
    .single();

  if (productError || !product) throw new Error("Product not found");

  const price = product.price ?? 0;
  const oldPrice = product.old_price ?? price;

  const subtotal = price * quantity;
  const discount = (oldPrice - price) * quantity;

  // ✅ Step 2: Get delivery fee
  const { data: address } = await supabase
    .from("addresses")
    .select("state")
    .eq("id", address_id)
    .eq("user_id", userId)
    .single();

  if (!address) throw new Error("Address not found");

  const { data: state } = await supabase
    .from("states")
    .select("delivery_fee")
    .eq("id", address.state)
    .single();

  const delivery_fee = state?.delivery_fee ?? 0;
  const total_price = subtotal + delivery_fee;

  const order_code = `ORD-${Math.random().toString(36).substring(2, 10).toUpperCase()}`;

  // ✅ Step 3: Create order
  const { data: order, error: orderError } = await supabase
    .from("orders")
    .insert({
      user_id: userId,
      address_id,
      status: "pending",
      note: "Direct checkout",
      user_note: note,
      total_price,
      order_code,
      created_at: now,
      updated_at: now,
      created_by: user.id,
      updated_by: user.id
    })
    .select()
    .single();

  if (orderError) throw orderError;

  // ✅ Step 4: Create order item
  const { error: itemError } = await supabase.from("order_items").insert({
    order_id: order.id,
    product_id,
    quantity,
    price,
    size,
    color,
    created_at: now,
    updated_at: now,
    created_by: user.id,
    updated_by: user.id
  });

  if (itemError) throw itemError;

  // ✅ Step 5: Insert status history
  await supabase.from("order_status_history").insert({
    order_id: order.id,
    status: order.status,
    changed_by: user.email,
    note: order.note
  });

  return json({
    order_id: order.id,
    order_code,
    total_price,
    delivery_fee,
    product_id,
    quantity
  }, 201);
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    headers: { "Content-Type": "application/json" },
    status
  });
}
