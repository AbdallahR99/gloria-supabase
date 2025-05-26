export async function handleCheckoutOrder(req, supabase, user, authError) {
  if (authError || !user) throw new Error("Unauthorized");
  const body = await req.json();
  const { address_id, note, user_id: customUserId } = body;
  const userId = customUserId ?? user.id;
  // ✅ Step 1: Fetch cart items from correct table
  const { data: cartItems, error: cartError } = await supabase.from("cart_items").select("product_id, quantity, size, color").eq("user_id", userId).eq("is_deleted", false);
  if (cartError) throw cartError;
  if (!cartItems || cartItems.length === 0) throw new Error("Cart is empty");
  // ✅ Step 2: Fetch product prices
  const productIds = cartItems.map((item)=>item.product_id);
  const { data: products, error: productsError } = await supabase.from("products").select("id, price, old_price").in("id", productIds);
  if (productsError) throw productsError;
  const productMap = new Map(products.map((p)=>[
      p.id,
      p
    ]));
  // ✅ Step 3: Calculate totals
  let subtotal = 0;
  let discount = 0;
  const now = new Date().toISOString();
  cartItems.forEach((item)=>{
    const product = productMap.get(item.product_id);
    const price = product?.price ?? 0;
    const oldPrice = product?.old_price ?? price;
    subtotal += price * item.quantity;
    discount += (oldPrice - price) * item.quantity;
  });
  // ✅ Step 4: Get delivery fee
  const { data: address } = await supabase.from("addresses").select("state").eq("id", address_id).eq("user_id", userId).single();
  if (!address) throw new Error("Address not found");
  const { data: state } = await supabase.from("states").select("delivery_fee").eq("id", address.state).single();
  const delivery_fee = state?.delivery_fee ?? 0;
  const total_price = subtotal + delivery_fee;
  const order_code = `ORD-${Math.random().toString(36).substring(2, 10).toUpperCase()}`;
  // ✅ Step 5: Create order
  const { data: order, error: orderError } = await supabase.from("orders").insert({
    user_id: userId,
    address_id,
    status: "pending",
    note: "Initial order creation",
    user_note: note,
    total_price,
    order_code,
    created_at: now,
    updated_at: now,
    created_by: user.id,
    updated_by: user.id
  }).select().single();
  if (orderError) throw orderError;
  // ✅ Step 6: Insert order items
  const orderItems = cartItems.map((item)=>({
      order_id: order.id,
      product_id: item.product_id,
      quantity: item.quantity,
      size: item.size,
      color: item.color,
      created_at: now,
      updated_at: now,
      created_by: user.id,
      updated_by: user.id
    }));
  const { error: itemsError } = await supabase.from("order_items").insert(orderItems);
  if (itemsError) throw itemsError;
  // ✅ Step 7: Insert status history
  await supabase.from("order_status_history").insert({
    order_id: order.id,
    status: order.status,
    changed_by: user.email,
    note: order.note
  });
  // ✅ Step 8: Clear cart
  const { error: clearCartError } = await supabase.from("cart_items").delete().eq("user_id", userId);
  if (clearCartError) throw clearCartError;
  return json({
    order_id: order.id,
    order_code,
    cartError
  }, 201);
}
function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    headers: {
      "Content-Type": "application/json"
    },
    status
  });
}
