// File: functions/cart/upsert.ts
export async function handleUpsertCartItem(req, supabase, user, authError) {
  if (authError || !user) throw new Error("❌ Unauthorized access");
  const body = await req.json();
  console.log("📥 Request body:", body);
  const { product_id, size, color, user_id: customUserId } = body;
  // Always default to 1 if quantity is not provided or is invalid
  // This prevents accidentally using product stock quantity
  let quantity = 1;
  if (body.quantity && typeof body.quantity === 'number' && body.quantity > 0) {
    quantity = body.quantity;
  }
  console.log("🔢 Using quantity:", quantity);
  if (!product_id) {
    console.log("⚠️ Missing product_id");
    return json({
      message: "Missing required field: product_id"
    }, 400);
  }
  const userId = customUserId ?? user.id;
  const now = new Date().toISOString();
  // 🔍 Check for existing cart item
  let query = supabase.from("cart_items").select("id, quantity").eq("user_id", userId).eq("product_id", product_id).eq("is_deleted", false);
  if (size == null) {
    query = query.is("size", null);
  } else {
    query = query.eq("size", size);
  }
  if (color == null) {
    query = query.is("color", null);
  } else {
    query = query.eq("color", color);
  }
  const { data: existing, error: selectError } = await query.maybeSingle();
  if (selectError) {
    console.error("❗ Select error:", selectError);
    return json({
      message: selectError.message
    }, 500);
  }
  console.log("🔎 Existing cart item:", existing);
  if (existing) {
    // Update existing item - you can choose to:
    // Option 1: Replace quantity (current behavior)
    // Option 2: Add to existing quantity (increment)
    // Option 1: Replace with new quantity
    const newQuantity = quantity;
    // Option 2: Add to existing quantity (uncomment if you prefer this)
    // const newQuantity = existing.quantity + quantity;
    const { error: updateError } = await supabase.from("cart_items").update({
      quantity: newQuantity,
      updated_at: now,
      updated_by: user.id
    }).eq("id", existing.id);
    if (updateError) {
      console.error("🛑 Update error:", updateError);
      return json({
        message: updateError.message
      }, 500);
    }
    console.log("✅ Cart item updated with quantity:", newQuantity);
    return json({
      status: "updated",
      quantity: newQuantity
    });
  }
  // Insert new cart item
  const { error: insertError } = await supabase.from("cart_items").insert({
    user_id: userId,
    product_id,
    quantity,
    size,
    color,
    created_at: now,
    updated_at: now,
    created_by: user.id,
    updated_by: user.id,
    is_deleted: false
  });
  if (insertError) {
    console.error("❌ Insert error:", insertError);
    return json({
      message: insertError.message
    }, 500);
  }
  console.log("🆕 Cart item added with quantity:", quantity);
  return json({
    status: "added",
    quantity
  }, 201);
}
function json(data, status = 200) {
  console.log("📤 Response:", data);
  return new Response(JSON.stringify(data), {
    headers: {
      "Content-Type": "application/json"
    },
    status
  });
}
