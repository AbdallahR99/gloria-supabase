// File: functions/cart/update-quantity.ts
export async function handleUpdateCartItemQuantity(req, supabase, user, authError) {
  if (authError || !user) throw new Error("Unauthorized");
  const body = await req.json();
  const { product_id, quantity, size, color, user_id: customUserId } = body;
  if (!product_id || quantity == null) {
    return json({
      message: "Missing required fields: product_id or quantity"
    }, 400);
  }
  const userId = customUserId ?? user.id;
  const now = new Date().toISOString();
  let query = supabase.from("cart").select("id").eq("user_id", userId).eq("product_id", product_id).eq("is_deleted", false);
  if (size != null) query = query.eq("size", size);
  if (color != null) query = query.eq("color", color);
  const { data: existing, error: fetchError } = await query.maybeSingle();
  if (fetchError) throw fetchError;
  if (!existing) {
    return json({
      message: "Cart item not found"
    }, 404);
  }
  const { error: updateError } = await supabase.from("cart").update({
    quantity,
    updated_at: now,
    updated_by: user.id
  }).eq("id", existing.id);
  if (updateError) throw updateError;
  return json({
    status: "quantity_updated"
  });
}
function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    headers: {
      "Content-Type": "application/json"
    },
    status
  });
}
