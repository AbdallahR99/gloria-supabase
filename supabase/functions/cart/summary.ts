// File: functions/cart/summary.ts
export async function handleGetCartSummary(req, supabase, user, authError) {
  if (authError || !user) throw new Error("❌ Unauthorized access");
  const url = new URL(req.url);
  const userIdParam = url.searchParams.get("user_id");
  const userId = userIdParam ?? user.id;
  console.log("🔍 Fetching cart summary for user:", userId);
  // Fetch cart items
  const { data: cartItems, error: cartError } = await supabase.from("cart_items").select("quantity, product_id").eq("user_id", userId).eq("is_deleted", false);
  if (cartError) {
    console.error("❗ Error fetching cart items:", cartError);
    throw cartError;
  }
  console.log("🛒 Cart items:", cartItems);
  const productIds = cartItems.map((item)=>item.product_id);
  const { data: products, error: productError } = await supabase.from("products").select("id, price, old_price").in("id", productIds);
  if (productError) {
    console.error("❗ Error fetching product data:", productError);
    throw productError;
  }
  const productMap = Object.fromEntries(products.map((p)=>[
      p.id,
      p
    ]));
  let subtotal = 0;
  let discount = 0;
  let oldSubtotal = 0;
  for (const item of cartItems){
    const qty = item.quantity ?? 0;
    const product = productMap[item.product_id];
    const price = product?.price ?? 0;
    const oldPrice = product?.old_price ?? price;
    subtotal += price * qty;
    oldSubtotal += oldPrice * qty;
    discount += (oldPrice - price) * qty;
  }
  const discountPercentage = oldSubtotal > 0 ? discount / oldSubtotal * 100 : 0;
  console.log("💰 Subtotal:", subtotal);
  console.log("💸 Old Subtotal:", oldSubtotal);
  console.log("🏷️ Discount:", discount);
  console.log("📊 Discount %:", discountPercentage.toFixed(2));
  // Fetch default address
  const { data: address } = await supabase.from("addresses").select("state").eq("user_id", userId).eq("is_default", true).maybeSingle();
  let deliveryFee = 0;
  if (address?.state) {
    console.log("📦 Fetching delivery fee for state:", address.state);
    const { data: state } = await supabase.from("states").select("delivery_fee").eq("id", address.state).maybeSingle();
    deliveryFee = state?.delivery_fee ?? 0;
  }
  const total = subtotal + deliveryFee;
  const summary = {
    subtotal,
    old_subtotal: oldSubtotal,
    discount,
    discount_percentage: parseFloat(discountPercentage.toFixed(2)),
    delivery_fee: deliveryFee,
    total
  };
  console.log("📤 Cart summary response:", summary);
  return json(summary);
}
function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    headers: {
      "Content-Type": "application/json"
    },
    status
  });
}
